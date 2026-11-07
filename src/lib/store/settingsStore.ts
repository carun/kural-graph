"use client";
// Agni-Kunda — BYOK settings. A static site has nowhere else to keep a key, and it goes only to its own provider.
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PROVIDERS, type ProviderId } from "@/lib/llm/providers";

export interface SaveResult {
  message: string;
}

const KEYS_KEY = "gitaviswa:keys";

function readKeys(): Partial<Record<ProviderId, string>> {
  try {
    return JSON.parse(localStorage.getItem(KEYS_KEY) ?? sessionStorage.getItem(KEYS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeKeys(keys: Partial<Record<ProviderId, string>>, remember: boolean) {
  const value = JSON.stringify(keys);
  try {
    // Keys stay for this tab only unless someone asks otherwise.
    if (remember) {
      localStorage.setItem(KEYS_KEY, value);
      sessionStorage.removeItem(KEYS_KEY);
    } else {
      sessionStorage.setItem(KEYS_KEY, value);
      localStorage.removeItem(KEYS_KEY);
    }
  } catch {
    // The key still works for this page view.
  }
}

interface SettingsState {
  active: ProviderId | null;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  ollamaBaseUrl: string;
  semantic: boolean;
  /** Whether keys outlive this tab. */
  remember: boolean;

  loadEnv: () => Promise<void>;
  setActive: (p: ProviderId | null) => void;
  setModel: (p: ProviderId, model: string) => void;
  setSemantic: (on: boolean) => void;
  saveProvider: (p: ProviderId, input: { key?: string; model?: string; baseUrl?: string; makeDefault?: boolean; remember?: boolean }) => Promise<SaveResult>;
  forgetKey: (p: ProviderId) => Promise<void>;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      active: null,
      keys: readKeys(),
      models: {},
      ollamaBaseUrl: "http://localhost:11434",
      // Off until the reader asks: unlike his server-side search, this downloads about 38 MB to their device.
      semantic: false,
      remember: false,

      // There is no .env to read on a static site. Kept so that page.tsx can stay as it is.
      loadEnv: async () => {},

      setActive: (active) => set({ active }),
      setModel: (p, model) => set({ models: { ...get().models, [p]: model } }),
      setSemantic: (semantic) => set({ semantic }),

      saveProvider: async (p, input) => {
        const keys = { ...get().keys };
        const models = { ...get().models };
        if (input.key !== undefined) {
          if (input.key.trim()) keys[p] = input.key.trim();
          else delete keys[p];
        }
        if (input.model) models[p] = input.model;
        const remember = input.remember ?? get().remember;
        set({ keys, models, remember, ...(p === "ollama" && input.baseUrl ? { ollamaBaseUrl: input.baseUrl } : {}), ...(input.makeDefault ? { active: p } : {}) });
        writeKeys(keys, remember);
        if (!keys[p]) return { message: "Saved in this browser." };
        return { message: remember ? "Saved in this browser. The key stays until you remove it." : "Saved for this tab. The key goes when you close it." };
      },

      forgetKey: async (p) => {
        const keys = { ...get().keys };
        delete keys[p];
        set({ keys });
        writeKeys(keys, get().remember);
      },
    }),
    {
      name: "gitaviswa:agni-kunda",
      // Keys are left out on purpose: readKeys and writeKeys decide where they live.
      partialize: (s) => ({ active: s.active, models: s.models, ollamaBaseUrl: s.ollamaBaseUrl, semantic: s.semantic, remember: s.remember }),
    },
  ),
);

export type Connection = { provider: ProviderId; via: "browser" | "local"; model: string } | null;

/** The provider Partha-Sarathi will actually use right now (null → offline graph-composed answers). */
export function currentConnection(s: Pick<SettingsState, "active" | "keys" | "models">): Connection {
  const p = s.active;
  if (!p) return null;
  const model = s.models[p] || PROVIDERS[p].defaultModel;
  if (p === "ollama") return { provider: p, via: "local", model };
  if (s.keys[p]) return { provider: p, via: "browser", model };
  return null;
}

/**
 * React hook for the active connection. Selects only stable store references and derives the object with
 * useMemo — a selector that builds a fresh object (`useSettings((s) => currentConnection(s))`) makes
 * zustand's useSyncExternalStore snapshot unstable and loops forever.
 */
export function useConnection(): Connection {
  const active = useSettings((s) => s.active);
  const keys = useSettings((s) => s.keys);
  const models = useSettings((s) => s.models);
  return useMemo(() => currentConnection({ active, keys, models }), [active, keys, models]);
}
