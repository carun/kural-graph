import { Tokenizer } from "@huggingface/tokenizers";
import * as ort from "onnxruntime-web/wasm";

const MODEL_ROOT = "/models/minilm";
// Bundled with a hash in its name, so it can never be out of step with the runtime above.
const RUNTIME = new URL("../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", import.meta.url).href;
// public/sw.js keeps this cache when a new version of the site arrives.
const CACHE = "kural-graph-models";
const MAX_TOKENS = 128;

// Threads need cross-origin isolation, and a model this small doesn't need them.
ort.env.wasm.numThreads = 1;

interface Ready {
  tokenizer: Tokenizer;
  session: ort.InferenceSession;
}

let ready: Promise<Ready> | null = null;

/**
 * Kept here rather than left to the service worker, which may not be in control
 * yet when someone first asks. A download this size must only ever happen once.
 */
async function load(path: string): Promise<Response> {
  // Made absolute because the dev server runs workers from a blob: address, which a path can't resolve against.
  const url = new URL(path, self.location.origin).href;
  const cache = "caches" in self ? await caches.open(CACHE).catch(() => null) : null;
  const kept = await cache?.match(url);
  if (kept !== undefined) return kept;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  await cache?.put(url, response.clone()).catch(() => undefined);
  return response;
}

const bytes = async (path: string) => new Uint8Array(await (await load(path)).arrayBuffer());

async function start(): Promise<Ready> {
  const [tokenizerJson, tokenizerConfig, model, runtime] = await Promise.all([
    load(`${MODEL_ROOT}/tokenizer.json`).then((r) => r.json()),
    load(`${MODEL_ROOT}/tokenizer_config.json`).then((r) => r.json()),
    bytes(`${MODEL_ROOT}/model_quantized.onnx`),
    bytes(RUNTIME),
  ]);
  // This entry bundles its loader, so only the binary comes from our own files.
  ort.env.wasm.wasmBinary = runtime;
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
  return { tokenizer: new Tokenizer(tokenizerJson, tokenizerConfig), session };
}

const toTensor = (values: number[]): ort.Tensor => new ort.Tensor("int64", BigInt64Array.from(values, (v) => BigInt(v)), [1, values.length]);

/** Mean of the token vectors, weighted by the attention mask, then unit length. */
function pool(hidden: Float32Array, mask: number[], width: number): Float32Array {
  const out = new Float32Array(width);
  let count = 0;
  mask.forEach((m, t) => {
    if (m === 0) return;
    count++;
    for (let i = 0; i < width; i++) out[i] += hidden[t * width + i];
  });
  let norm = 0;
  for (let i = 0; i < width; i++) {
    out[i] /= count;
    norm += out[i] * out[i];
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < width; i++) out[i] /= norm;
  return out;
}

async function embed(text: string): Promise<Float32Array> {
  // A failed download must not stick, or coming back online wouldn't help.
  ready ??= start().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  const { tokenizer, session } = await ready;
  const encoded = tokenizer.encode(text);
  const ids = encoded.ids.slice(0, MAX_TOKENS);
  const mask = encoded.attention_mask.slice(0, MAX_TOKENS);
  const types = (encoded.token_type_ids ?? ids.map(() => 0)).slice(0, MAX_TOKENS);
  const feeds = { input_ids: toTensor(ids), attention_mask: toTensor(mask), token_type_ids: toTensor(types) };
  const output = (await session.run(feeds)).last_hidden_state!;
  return pool(output.data as Float32Array, mask, output.dims[2]!);
}

self.onmessage = async (event: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = event.data;
  try {
    const vector = await embed(text);
    self.postMessage({ id, vector }, { transfer: [vector.buffer] });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
