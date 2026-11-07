import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web/wasm';
import { REPO } from './paths.ts';

const MAX_TOKENS = 128;

/**
 * The same runtime and model the browser uses, so stored vectors and a query
 * embedded on someone's phone live in the same space.
 */
export async function createEmbedder(): Promise<(text: string) => Promise<Float32Array>> {
  ort.env.wasm.numThreads = 1;
  // Given as bytes: the runtime can't fetch a file path under Node.
  ort.env.wasm.wasmBinary = new Uint8Array(readFileSync(join(REPO, 'node_modules', 'onnxruntime-web', 'dist', 'ort-wasm-simd-threaded.wasm')));
  const models = join(REPO, 'public', 'models', 'minilm');
  const tokenizer = new Tokenizer(
    JSON.parse(readFileSync(join(models, 'tokenizer.json'), 'utf8')),
    JSON.parse(readFileSync(join(models, 'tokenizer_config.json'), 'utf8')),
  );
  const session = await ort.InferenceSession.create(new Uint8Array(readFileSync(join(models, 'model_quantized.onnx'))), { executionProviders: ['wasm'] });

  const tensor = (values: number[]) => new ort.Tensor('int64', BigInt64Array.from(values, (v) => BigInt(v)), [1, values.length]);

  return async (text) => {
    const encoded = tokenizer.encode(text);
    const ids = encoded.ids.slice(0, MAX_TOKENS);
    const mask = encoded.attention_mask.slice(0, MAX_TOKENS);
    const types = (encoded.token_type_ids ?? ids.map(() => 0)).slice(0, MAX_TOKENS);
    const output = (await session.run({ input_ids: tensor(ids), attention_mask: tensor(mask), token_type_ids: tensor(types) })).last_hidden_state!;
    const width = output.dims[2]!;
    const hidden = output.data as Float32Array;
    const vector = new Float32Array(width);
    let count = 0;
    mask.forEach((m: number, t: number) => {
      if (m === 0) return;
      count++;
      for (let i = 0; i < width; i++) vector[i]! += hidden[t * width + i]!;
    });
    let norm = 0;
    for (let i = 0; i < width; i++) {
      vector[i]! /= count;
      norm += vector[i]! * vector[i]!;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < width; i++) vector[i]! /= norm;
    return vector;
  };
}
