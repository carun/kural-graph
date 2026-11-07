// Model calls go straight from the browser to the provider, so these rules have nothing behind them: which models are
// offered, what each provider is sent, what is shown of a reply, and where a key is kept.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import "./resolve.ts";

// The bundler reads React's named exports, which Node can't. No component renders here, so the store only needs the
// import to exist.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "react") return { url: "data:text/javascript,export const useMemo=(f)=>f();export default {}", shortCircuit: true };
    return next(specifier, context);
  },
});

class Memory {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
}
const session = new Memory();
const local = new Memory();
Object.assign(globalThis, { window: globalThis, sessionStorage: session, localStorage: local, location: { origin: "https://kural.test" } });

const { ModelDeclined, streamAnthropic } = await import("../src/lib/llm/anthropic.ts");
const { listModels, openStream, resolveProvider, streamChat } = await import("../src/lib/llm/client.ts");
const { canChat, stripThinking, trimLeading } = await import("../src/lib/llm/stream.ts");
const { currentConnection, useSettings } = await import("../src/lib/store/settingsStore.ts");

async function* chunks(...parts: string[]) {
  yield* parts;
}
const collect = async (source: AsyncIterable<string>) => {
  let out = "";
  for await (const part of source) out += part;
  return out;
};
const sse = (lines: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(lines.map((l) => `data: ${l}\n\n`).join("")));
        controller.close();
      },
    }),
  );
const delta = (content: string) => JSON.stringify({ choices: [{ delta: { content } }] });

type Call = [string, RequestInit];
const realFetch = globalThis.fetch;
function stubFetch(reply: (url: string) => Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return reply(url);
  }) as typeof fetch;
  return calls;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

for (const id of ["bge-m3:latest", "nomic-embed-text", "mxbai-embed-large", "all-minilm:l6-v2", "text-embedding-3-small", "qwen3-embedding:8b", "snowflake-arctic-embed"]) {
  test(`an embedding model is never offered: ${id}`, () => assert.equal(canChat(id), false));
}
for (const id of ["deepseek-r1:32b", "qwen3.8:27b-32k", "gpt-4o", "llama3.3:70b", "grok-4"]) {
  test(`a chat model is offered: ${id}`, () => assert.equal(canChat(id), true));
}

test("the model list keeps every chat model and drops the rest", async () => {
  stubFetch(() => Response.json({ data: [{ id: "zeta:7b" }, { id: "alpha:7b" }, { id: "bge-m3:latest" }, { id: "whisper-large-v3" }, { id: "retired", active: false }] }));
  assert.deepEqual(await listModels(resolveProvider("ollama", {})), ["alpha:7b", "zeta:7b"]);
});

test("blank lines before an answer are dropped and the rest is left alone", async () => {
  assert.equal(await collect(trimLeading(chunks("\n", "\n  ", "First", "\n\nSecond\n"))), "First\n\nSecond\n");
  assert.equal(await collect(trimLeading(chunks("\n", "  "))), "");
});

test("a thinking block is removed, even with its tags split across chunks", async () => {
  assert.equal(await collect(stripThinking(chunks("<think>working it out</think>The answer."))), "The answer.");
  assert.equal(await collect(stripThinking(chunks("<th", "ink>hidden</th", "ink>Shown ", "text"))), "Shown text");
  assert.equal(await collect(stripThinking(chunks("a < b and ", "<thing> stays"))), "a < b and <thing> stays");
});

test("a reply streams with its thinking stripped", async () => {
  stubFetch(() => sse([delta("<thi"), delta("nk>secret</think>\n\n"), delta("Shown"), "[DONE]"]));
  assert.equal(await collect(streamChat(resolveProvider("ollama", { model: "m" }), [])), "Shown");
});

test("the key goes to its own provider, and Ollama is sent none", async () => {
  const groq = stubFetch(() => sse(["[DONE]"]));
  await collect(streamChat(resolveProvider("groq", { apiKey: "k", model: "m" }), []));
  assert.equal(groq[0][0], "https://api.groq.com/openai/v1/chat/completions");
  assert.equal((groq[0][1].headers as Record<string, string>).Authorization, "Bearer k");

  const ollama = stubFetch(() => sse(["[DONE]"]));
  await collect(streamChat(resolveProvider("ollama", { apiKey: "k2", model: "m", baseUrl: "https://box.tail.ts.net/" }), []));
  assert.equal(ollama[0][0], "https://box.tail.ts.net/v1/chat/completions");
  assert.equal((ollama[0][1].headers as Record<string, string>).Authorization, "Bearer k2");
});

test("only Ollama is asked to skip thinking", async () => {
  const ollama = stubFetch(() => sse(["[DONE]"]));
  await collect(streamChat(resolveProvider("ollama", { model: "m" }), []));
  const local = JSON.parse(ollama[0][1].body as string);
  assert.equal(local.reasoning_effort, "none");
  assert.equal(local.max_tokens, undefined);

  const groq = stubFetch(() => sse(["[DONE]"]));
  await collect(streamChat(resolveProvider("groq", { apiKey: "k", model: "m" }), []));
  assert.equal(JSON.parse(groq[0][1].body as string).reasoning_effort, undefined);
});

test("OpenAI is not sent the settings its newer models refuse", async () => {
  const calls = stubFetch(() => sse(["[DONE]"]));
  await collect(streamChat(resolveProvider("openai", { apiKey: "k", model: "gpt-5" }), [{ role: "user", content: "q" }]));
  assert.deepEqual(JSON.parse(calls[0][1].body as string), { model: "gpt-5", messages: [{ role: "user", content: "q" }], stream: true });
});

test("a provider that needs a key can't be called without one", () => {
  assert.throws(() => resolveProvider("anthropic", {}), /No API key/);
});

test("a retired model is swapped for one the provider still offers", async () => {
  const calls = stubFetch((url) => {
    if (url.endsWith("/models")) return Response.json({ data: [{ id: "openai/gpt-oss-20b" }] });
    if (JSON.parse(String(calls.at(-1)![1].body)).model === "gone") return new Response(JSON.stringify({ error: { message: "The model `gone` does not exist" } }), { status: 404 });
    return sse([delta("hi"), "[DONE]"]);
  });
  const { first, provider, fallbackFrom } = await openStream(resolveProvider("groq", { apiKey: "k", model: "gone" }), []);
  assert.equal(first.value, "hi");
  assert.equal(provider.model, "openai/gpt-oss-20b");
  assert.equal(fallbackFrom, "gone");
});

test("a failed call to Ollama says what to check", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  await assert.rejects(listModels(resolveProvider("ollama", {})), /OLLAMA_ORIGINS includes https:\/\/kural\.test/);
});

test("stopping a reply stays a stop, not a connection failure", async () => {
  globalThis.fetch = (async () => {
    throw new DOMException("Aborted", "AbortError");
  }) as typeof fetch;
  await assert.rejects(collect(streamChat(resolveProvider("groq", { apiKey: "k", model: "m" }), [])), { name: "AbortError" });
});

test("Anthropic gets its system prompt apart and is told this is a browser", async () => {
  const calls = stubFetch(() => sse([]));
  await collect(streamAnthropic({ apiKey: "k", model: "claude-opus-5-5", messages: [{ role: "system", content: "rules" }, { role: "user", content: "q" }] }));
  const body = JSON.parse(calls[0][1].body as string);
  assert.equal(body.system, "rules");
  assert.equal(body.messages.length, 1);
  assert.equal(body.fallbacks, "default");
  const headers = calls[0][1].headers as Record<string, string>;
  assert.equal(headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(headers["x-api-key"], "k");
});

test("Anthropic text is read and a refusal is surfaced", async () => {
  stubFetch(() =>
    sse([
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "partial" } }),
      JSON.stringify({ type: "message_delta", delta: { stop_reason: "refusal" } }),
    ]),
  );
  const parts: string[] = [];
  await assert.rejects(async () => {
    for await (const p of streamAnthropic({ apiKey: "k", model: "claude-opus-5-5", messages: [{ role: "user", content: "x" }] })) parts.push(p);
  }, ModelDeclined);
  assert.deepEqual(parts, ["partial"]);
});

beforeEach(() => {
  session.map.clear();
  local.map.clear();
  useSettings.setState({ active: null, keys: {}, models: {}, remember: false });
});
const stored = (m: Memory) => [...m.map.values()].join(" ");

test("a key stays in this tab by default", async () => {
  await useSettings.getState().saveProvider("groq", { key: "gsk_secret", makeDefault: true });
  assert.match(stored(session), /gsk_secret/);
  assert.doesNotMatch(stored(local), /gsk_secret/);
  assert.equal(currentConnection(useSettings.getState())?.provider, "groq");
});

test("Remember moves a key to this device, and un-remembering moves it back", async () => {
  await useSettings.getState().saveProvider("groq", { key: "gsk_secret", remember: true });
  assert.match(stored(local), /gsk_secret/);
  assert.doesNotMatch(stored(session), /gsk_secret/);
  await useSettings.getState().saveProvider("groq", { key: "gsk_secret", remember: false });
  assert.doesNotMatch(stored(local), /gsk_secret/);
  assert.match(stored(session), /gsk_secret/);
});

test("the persisted settings never hold a key", async () => {
  await useSettings.getState().saveProvider("groq", { key: "gsk_secret", model: "m", remember: true, makeDefault: true });
  assert.doesNotMatch(local.getItem("gitaviswa:agni-kunda") ?? "", /gsk_secret/);
  assert.match(local.getItem("gitaviswa:agni-kunda") ?? "", /"active":"groq"/);
});

test("removing a key disconnects its provider", async () => {
  await useSettings.getState().saveProvider("groq", { key: "gsk_secret", makeDefault: true });
  await useSettings.getState().forgetKey("groq");
  assert.equal(currentConnection(useSettings.getState()), null);
  assert.doesNotMatch(stored(session), /gsk_secret/);
});

test("no model is connected until someone chooses one", () => {
  assert.equal(currentConnection(useSettings.getState()), null);
});
