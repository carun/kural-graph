"use client";
import { ANALYZE_SYSTEM, BRIDGE_SYSTEM, COMMENTARY_SYSTEM, PARTHA_SARATHI_SYSTEM, TRANSLATE_SYSTEM, buildUserTurn } from "@/lib/graphrag/prompts";
import { currentConnection, useSettings } from "@/lib/store/settingsStore";
import { completeChat, listModels, openStream, pickModel, ProviderError, resolveProvider, type ChatMessage } from "./client";
import { PROVIDERS, type ProviderId } from "./providers";

export interface StreamResult {
  ok: boolean;
  text: string;
  error?: string;
  code?: string;
  provider?: string;
  model?: string;
  /** set when the configured model was retired and another was substituted */
  fallbackFrom?: string;
}

type Mode = "chat" | "bridge" | "translate" | "analyze" | "commentary";
const SYSTEM: Record<Mode, string> = { chat: PARTHA_SARATHI_SYSTEM, bridge: BRIDGE_SYSTEM, translate: TRANSLATE_SYSTEM, analyze: ANALYZE_SYSTEM, commentary: COMMENTARY_SYSTEM };

/** Stream a completion straight from this browser to the user's active provider. There is no server in between. */
export async function streamFromApi(opts: {
  mode: Mode;
  question: string;
  context?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  onToken?: (t: string, full: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> {
  const s = useSettings.getState();
  const conn = currentConnection(s);
  if (!conn) return { ok: false, text: "", code: "no-key", error: "No LLM provider connected." };
  const question = opts.question.slice(0, 4000).trim();
  const context = (opts.context || "").slice(0, 24000);
  const history: ChatMessage[] = (opts.history || []).slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM[opts.mode] }, ...history, { role: "user", content: context ? buildUserTurn(question, context) : question }];

  let text = "";
  try {
    const p = resolveProvider(conn.provider, { apiKey: s.keys[conn.provider], model: conn.model, baseUrl: s.ollamaBaseUrl });
    const { gen, first, provider, fallbackFrom } = await openStream(p, messages, { temperature: opts.mode === "analyze" || opts.mode === "translate" || opts.mode === "commentary" ? 0.2 : 0.55, signal: opts.signal });
    const take = (chunk: string) => {
      text += chunk;
      opts.onToken?.(chunk, text);
    };
    if (!first.done) {
      take(first.value);
      for await (const chunk of gen) take(chunk);
    }
    // All it wrote may have been thinking, which is stripped.
    if (!text.trim()) return { ok: false, text, code: "upstream", error: "The model returned no answer." };
    return { ok: true, text, provider: PROVIDERS[conn.provider].name, model: provider.model, fallbackFrom };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: true, text, provider: PROVIDERS[conn.provider].name, model: conn.model };
    return { ok: false, text, code: e instanceof ProviderError ? e.code : "network", error: (e as Error).message };
  }
}

/** What Settings is typing or has saved, before it is the active connection. */
export interface ProviderInput {
  key?: string;
  model?: string;
  baseUrl?: string;
}

/** Live chat-model list for a provider, so retired presets never strand the user. */
export async function fetchModels(id: ProviderId, input: ProviderInput): Promise<{ models: string[]; recommended: string | null }> {
  const models = await listModels(resolveProvider(id, { apiKey: input.key, baseUrl: input.baseUrl }));
  return { models, recommended: pickModel(id, models) };
}

export type TestResult = { ok: true; model: string; fallbackFrom?: string; latencyMs: number } | { ok: false; error: string };

/** Round-trip a tiny completion to verify a provider/key/model combination. */
export async function testConnection(id: ProviderId, input: ProviderInput): Promise<TestResult> {
  const t0 = performance.now();
  // A local model may have to load into memory first.
  const limit = id === "ollama" ? 60 : 20;
  try {
    const p = resolveProvider(id, { apiKey: input.key, model: input.model, baseUrl: input.baseUrl });
    const out = await Promise.race([
      completeChat(p, [{ role: "user", content: "Reply with exactly the word: ok" }], { maxTokens: 400, temperature: 0 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new ProviderError(`Timed out after ${limit}s`, 504, "network")), limit * 1000)),
    ]);
    return { ok: true, model: out.model, fallbackFrom: out.fallbackFrom, latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
