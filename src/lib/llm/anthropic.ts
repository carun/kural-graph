import type { ChatMessage } from "./client";
import { sseData } from "./stream";

const API = "https://api.anthropic.com/v1";

/** Models that accept server-side fallbacks when a request is declined. */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const headers = (apiKey: string): Record<string, string> => ({
  "x-api-key": apiKey,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

export async function listAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API}/models?limit=100`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`Anthropic returned ${res.status}`);
  const { data } = (await res.json()) as { data?: { id: string }[] };
  return (data ?? []).map((m) => m.id);
}

interface AnthropicRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export class ModelDeclined extends Error {}

/** Streams text from the Messages API. A visitor's key goes straight to Anthropic. */
export async function* streamAnthropic({ apiKey, model, messages, signal }: AnthropicRequest): AsyncGenerator<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const fallback = FALLBACK_MODELS.has(model);
  const res = await fetch(`${API}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers(apiKey),
      ...(fallback ? { "anthropic-beta": FALLBACK_BETA } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      stream: true,
      system,
      messages: messages.filter((m) => m.role !== "system"),
      output_config: { effort: "low" },
      ...(fallback ? { fallbacks: "default" } : {}),
    }),
    signal,
  });
  if (!res.ok || res.body === null) throw new Error(`Anthropic returned ${res.status}`);

  for await (const data of sseData(res.body)) {
    const event = JSON.parse(data) as { type: string; delta?: { type?: string; text?: string; stop_reason?: string } };
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) yield event.delta.text;
    if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") throw new ModelDeclined("The model declined this request.");
  }
}
