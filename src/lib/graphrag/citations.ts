import type { GraphNode } from "@/lib/types";
import { OLD_VIEW_NOTE, isSensitive } from "@/kural/walk";
import { fold } from "./text";

export interface Citation {
  raw: string;
  label: string;
  kind: "verse" | "concept" | "emotion" | "dilemma" | "character" | "chapter" | "unknown";
  ids: string[];
}

/** Matches [K380], [K371-380], [Concept: Fate], [Emotion: Anger], [Dilemma: …], [Character: …], [Chapter 2] */
export const CITATION_RE = /\[((?:K|Kural)\s*\d{1,4}(?:\s*[-–]\s*\d{1,4})?|(?:Concept|Emotion|State|Dilemma|Character|Chapter)\s*:?\s*[^\]\n]{1,64})\]/g;

export function resolveCitation(raw: string, nodes: GraphNode[], verseExists: (id: string) => boolean): Citation {
  const inner = raw.replace(/^\[|\]$/g, "").trim();
  const kural = inner.match(/^(?:K|Kural)\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/i);
  if (kural) {
    const a = Number(kural[1]);
    const b = kural[2] ? Number(kural[2]) : a;
    const ids: string[] = [];
    for (let v = a; v <= Math.min(b, a + 30); v++) if (verseExists(`K_${v}`)) ids.push(`K_${v}`);
    // The label is what every chip shows, so a sensitive couplet can't be cited without its note, model or no model.
    const old = ids.some((id) => isSensitive(nodes.find((n) => n.id === id)));
    return { raw, label: `Kural ${a}${b !== a ? `–${b}` : ""}${old ? `: ${OLD_VIEW_NOTE}` : ""}`, kind: ids.length ? "verse" : "unknown", ids };
  }
  const ch = inner.match(/^Chapter\s*:?\s*(\d{1,3})/i);
  if (ch) return { raw, label: `Chapter ${ch[1]}`, kind: "chapter", ids: [`CH_${Number(ch[1])}`] };

  const m = inner.match(/^(Concept|Emotion|State|Dilemma|Character)\s*:?\s*(.+)$/i);
  if (!m) return { raw, label: inner, kind: "unknown", ids: [] };
  const want = m[1].toLowerCase();
  const type = want === "concept" ? "SanskritConcept" : want === "emotion" || want === "state" ? "Emotion" : want === "dilemma" ? "LifeDilemma" : "Character";
  const kind = (type === "SanskritConcept" ? "concept" : type === "Emotion" ? "emotion" : type === "LifeDilemma" ? "dilemma" : "character") as Citation["kind"];
  const name = fold(m[2].replace(/\(.*?\)/g, "")).trim();
  const pool = nodes.filter((n) => n.type === type);
  const score = (n: GraphNode) => {
    const names = [n.label, "iast" in n ? n.iast : "", "en" in n ? n.en : "", n.id.split(":")[1] || ""].map((x) => fold(String(x)).replace(/-/g, " "));
    if (names.some((x) => x === name)) return 3;
    if (names.some((x) => x && (x.startsWith(name) || name.startsWith(x)))) return 2;
    if (names.some((x) => x && (x.includes(name) || name.includes(x)))) return 1;
    return 0;
  };
  const best = pool.map((n) => [n, score(n)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0];
  return best ? { raw, label: best[0].label, kind, ids: [best[0].id] } : { raw, label: m[2].trim(), kind: "unknown", ids: [] };
}

/** The couplets a model was given: exactly those tagged in the context it received. */
export function suppliedIn(context: string): Set<string> {
  return new Set([...context.matchAll(/\[K(\d{1,4})\]/g)].map((m) => `K_${Number(m[1])}`));
}

/** Drops couplet tags outside what was supplied. A model can't then cite from memory, or reach a couplet held back from it. */
export function keepSupplied(text: string, supplied: Set<string>): string {
  return text.replace(/\s*\[(?:K|Kural)\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\]/g, (tag, a, b) => {
    for (let n = Number(a); n <= Number(b ?? a); n++) if (!supplied.has(`K_${n}`)) return "";
    return tag;
  });
}

export function extractCitations(text: string, nodes: GraphNode[], verseExists: (id: string) => boolean): Citation[] {
  const seen = new Map<string, Citation>();
  for (const m of text.matchAll(CITATION_RE)) {
    if (!seen.has(m[0])) seen.set(m[0], resolveCitation(m[0], nodes, verseExists));
  }
  return [...seen.values()];
}
