// Reading a model's reply as it streams, straight from the browser. No imports, so it runs under `node --test`.

/** These turn text into numbers and can't hold a conversation, so they are never offered. */
const EMBEDDING_MODEL = /(^|[-_/:.])(embed|embedding|embeddings|bge|e5|gte|minilm)([-_/:.\d]|$)/i;

export const canChat = (id: string): boolean => !EMBEDDING_MODEL.test(id);

/** Splits a stream into complete server-sent `data:` payloads. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (data !== "" && data !== "[DONE]") yield data;
    }
  }
}

/**
 * Reasoning models stream their working inside <think> tags, and a tag can arrive
 * split across chunks, so a possible opening is held back until it is settled.
 */
export async function* stripThinking(source: AsyncIterable<string>): AsyncGenerator<string> {
  const OPEN = "<think>";
  const CLOSE = "</think>";
  let buffer = "";
  let thinking = false;

  const heldBack = (text: string, tag: string): number => {
    for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
      if (text.endsWith(tag.slice(0, n))) return n;
    }
    return 0;
  };

  for await (const chunk of source) {
    buffer += chunk;
    for (;;) {
      if (thinking) {
        const end = buffer.indexOf(CLOSE);
        if (end === -1) {
          buffer = buffer.slice(buffer.length - heldBack(buffer, CLOSE));
          break;
        }
        buffer = buffer.slice(end + CLOSE.length).replace(/^\s+/, "");
        thinking = false;
      } else {
        const start = buffer.indexOf(OPEN);
        if (start !== -1) {
          if (start > 0) yield buffer.slice(0, start);
          buffer = buffer.slice(start + OPEN.length);
          thinking = true;
          continue;
        }
        const keep = heldBack(buffer, OPEN);
        if (buffer.length > keep) yield buffer.slice(0, buffer.length - keep);
        buffer = buffer.slice(buffer.length - keep);
        break;
      }
    }
  }
  if (!thinking && buffer !== "") yield buffer;
}

/** Reasoning models often open their answer with blank lines, which would show as a gap. */
export async function* trimLeading(source: AsyncIterable<string>): AsyncGenerator<string> {
  let started = false;
  for await (const piece of source) {
    const text = started ? piece : piece.trimStart();
    if (text === "") continue;
    started = true;
    yield text;
  }
}
