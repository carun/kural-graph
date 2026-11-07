import { listAnthropicModels, streamAnthropic } from "./anthropic";
import { PROVIDERS, type ProviderId } from "./providers";
import { canChat, sseData, stripThinking, trimLeading } from "./stream";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResolvedProvider {
  id: ProviderId;
  url: string;
  base: string;
  apiKey: string | null;
  model: string;
  /** the model the caller asked for (differs from `model` when a retired model was substituted) */
  requested: string;
}

export class ProviderError extends Error {
  status: number;
  code: "no-key" | "upstream" | "network" | "bad-request";
  constructor(message: string, status: number, code: ProviderError["code"]) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Everything is in the browser now, so the only credentials are the key typed for this provider. */
export function resolveProvider(id: ProviderId, opts: { apiKey?: string | null; model?: string | null; baseUrl?: string | null }): ResolvedProvider {
  const p = PROVIDERS[id];
  const apiKey = opts.apiKey?.trim() || null;
  const model = opts.model?.trim() || p.defaultModel;
  let base = p.baseUrl;
  if (id === "ollama") {
    base = (opts.baseUrl?.trim() || p.baseUrl).replace(/\/+$/, "");
    base = base.endsWith("/v1") ? base : `${base}/v1`;
  }
  if (p.envKey && !apiKey) throw new ProviderError(`No API key configured for ${p.name}.`, 400, "no-key");
  const remembered = fallbackFor.get(`${id}|${model}`);
  return {
    id,
    base,
    url: `${base}/chat/completions`,
    apiKey,
    model: remembered || model,
    requested: model,
  };
}

function headers(p: ResolvedProvider): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (p.apiKey) h.Authorization = `Bearer ${p.apiKey}`;
  return h;
}

/** A browser only says "failed to fetch", and for Ollama that nearly always means it isn't allowing this site. */
function unreachable(p: ResolvedProvider, e: unknown): Error {
  if ((e as Error).name === "AbortError") return e as Error;
  const name = PROVIDERS[p.id].name;
  if (p.id !== "ollama") return new ProviderError(`Could not reach ${name}: ${(e as Error).message}`, 502, "network");
  const base = p.base.replace(/\/v1$/, "");
  // Reported as the same "failed to fetch", though no setting on the Ollama side could fix it.
  if (globalThis.location?.protocol === "https:" && /^http:\/\/(?!localhost|127\.0\.0\.1)/.test(base)) return new ProviderError(`Your browser won’t let this secure page call ${base}, a plain http address on another machine. Use an https address, such as the machine’s tailnet name, or run Ollama on this computer.`, 502, "network");
  return new ProviderError(`Could not reach ${name} at ${base}. Check that it is running and that OLLAMA_ORIGINS includes ${globalThis.location?.origin}.`, 502, "network");
}

/** Stream text deltas from the provider, and to nowhere else. */
export function streamChat(p: ResolvedProvider, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}): AsyncGenerator<string> {
  if (p.id === "anthropic") return streamAnthropic({ apiKey: p.apiKey ?? "", model: p.model, messages, signal: opts.signal });
  // Reasoning models (e.g. DeepSeek R1) may inline <think>…</think>; keep only the answer.
  return trimLeading(stripThinking(streamOpenAiCompatible(p, messages, opts)));
}

async function* streamOpenAiCompatible(p: ResolvedProvider, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal }): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch(p.url, {
      method: "POST",
      headers: headers(p),
      body: JSON.stringify({
        model: p.model,
        messages,
        stream: true,
        // OpenAI's newer models refuse both of these, and the model list offers them.
        ...(p.id === "openai" ? {} : { temperature: opts.temperature ?? 0.5 }),
        // Reasoning models spend tokens before answering; give them headroom. Ollama costs nothing, and a thinking
        // model there that ran out of budget mid-thought would leave no answer at all.
        ...(p.id === "openai" || p.id === "ollama" ? {} : { max_tokens: opts.maxTokens ?? (isReasoningModel(p.model) ? 2400 : 1100) }),
        // Groq's gpt-oss models stream reasoning separately; "low" keeps first-token latency down.
        ...(p.id === "groq" && /gpt-oss/.test(p.model) ? { reasoning_effort: "low" } : {}),
        // A local thinking model can reason for minutes before its first word. Only Ollama takes this: others may refuse it.
        ...(p.id === "ollama" ? { reasoning_effort: "none" } : {}),
      }),
      signal: opts.signal,
    });
  } catch (e) {
    throw unreachable(p, e);
  }
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body.slice(0, 400);
    try {
      const j = JSON.parse(body);
      msg = j.error?.message || j.message || msg;
    } catch {}
    throw new ProviderError(`${PROVIDERS[p.id].name} responded ${res.status}: ${msg}`, res.status, "upstream");
  }

  for await (const data of sseData(res.body)) {
    try {
      const delta: string = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    } catch {
      // partial / keep-alive line
    }
  }
}

const isReasoningModel = (m: string) => /gpt-oss|qwen3|deepseek-r1|o[134]|reason/i.test(m);

// ── model discovery & retired-model fallback ─────────────────────────────────────────────────────
// Providers retire models (Groq dropped llama-3.3-70b-versatile in 2026). When a configured model is gone we
// pick the best available chat model, remember the substitution for this page, and tell the user.

const NON_CHAT = /whisper|tts|orpheus|guard|embed|moderation|transcri|speech|vision-preview|dall-e|image/i;
const fallbackFor = new Map<string, string>();

export async function listModels(p: ResolvedProvider): Promise<string[]> {
  if (p.id === "anthropic") return (await listAnthropicModels(p.apiKey ?? "")).filter(canChat).sort();
  let res: Response;
  try {
    res = await fetch(`${p.base}/models`, { headers: headers(p), signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw unreachable(p, e);
  }
  if (!res.ok) throw new ProviderError(`${PROVIDERS[p.id].name} /models responded ${res.status}`, res.status, "upstream");
  const j = (await res.json()) as { data?: { id: string; active?: boolean }[] };
  return (j.data || []).filter((m) => m.active !== false && !NON_CHAT.test(m.id) && canChat(m.id)).map((m) => m.id).sort();
}

/** Choose a replacement: the provider's preset order first, then anything chat-capable. */
export function pickModel(id: ProviderId, available: string[]): string | null {
  for (const m of PROVIDERS[id].models) if (available.includes(m.id)) return m.id;
  return available[0] ?? null;
}

const isMissingModel = (e: unknown) =>
  e instanceof ProviderError && e.code === "upstream" && (e.status === 404 || e.status === 400) && /model/i.test(e.message) && /not exist|not found|decommission|no longer|invalid model|unknown model|does not have access/i.test(e.message);

/**
 * Start a stream, transparently substituting an available model if the configured one was retired.
 * Returns the first chunk eagerly so callers can still answer with a JSON error before streaming.
 */
export async function openStream(
  p: ResolvedProvider,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<{ gen: AsyncGenerator<string>; first: IteratorResult<string>; provider: ResolvedProvider; fallbackFrom?: string }> {
  try {
    const gen = streamChat(p, messages, opts);
    return { gen, first: await gen.next(), provider: p, fallbackFrom: p.requested !== p.model ? p.requested : undefined };
  } catch (e) {
    if (!isMissingModel(e)) throw e;
    const available = await listModels(p).catch(() => []);
    const next = pickModel(p.id, available.filter((m) => m !== p.model));
    if (!next) throw e;
    fallbackFor.set(`${p.id}|${p.requested}`, next);
    const q = { ...p, model: next };
    const gen = streamChat(q, messages, opts);
    return { gen, first: await gen.next(), provider: q, fallbackFrom: p.requested };
  }
}

/** Non-streaming helper (JSON tasks such as journal analysis). */
export async function completeChat(p: ResolvedProvider, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<{ text: string; model: string; fallbackFrom?: string }> {
  const { gen, first, provider, fallbackFrom } = await openStream(p, messages, opts);
  let out = first.done ? "" : first.value;
  if (!first.done) for await (const d of gen) out += d;
  return { text: out.trim(), model: provider.model, fallbackFrom };
}
