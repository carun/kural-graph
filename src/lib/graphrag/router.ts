import type { GraphNode } from "@/lib/types";
import { looseMatches } from "@/kural/route";
import { fold, phraseIn } from "./text";

export interface Routed {
  id: string;
  score: number;
  cues: string[];
}

export interface RouteResult {
  emotions: Routed[];
  dilemmas: Routed[];
  concepts: Routed[];
  characters: Routed[];
  verses: string[];
  chapters: number[];
}

const sortTop = (m: Map<string, Routed>, n: number) => [...m.values()].sort((a, b) => b.score - a.score).slice(0, n);

/**
 * Deterministic semantic routing: maps free text (questions, journal entries) onto Emotion, LifeDilemma,
 * SanskritConcept and Character nodes using curated lexicons, plus explicit verse/chapter references.
 */
export function routeText(text: string, nodes: GraphNode[], verseExists: (id: string) => boolean): RouteResult {
  const t = " " + fold(text) + " ";
  const emotions = new Map<string, Routed>();
  const dilemmas = new Map<string, Routed>();
  const concepts = new Map<string, Routed>();
  const characters = new Map<string, Routed>();
  const bump = (m: Map<string, Routed>, id: string, s: number, cue: string) => {
    const r = m.get(id) || { id, score: 0, cues: [] };
    r.score += s;
    if (!r.cues.includes(cue)) r.cues.push(cue);
    m.set(id, r);
  };

  for (const n of nodes) {
    if (n.type === "Emotion") {
      for (const cue of n.lexicon) if (phraseIn(t, cue)) bump(emotions, n.id, 1 + cue.split(" ").length * 0.4, cue);
      if (phraseIn(t, n.iast) || phraseIn(t, n.label)) bump(emotions, n.id, 2.5, phraseIn(t, n.label) ? n.label.toLowerCase() : n.iast);
    } else if (n.type === "LifeDilemma") {
      for (const cue of n.keywords) if (phraseIn(t, cue)) bump(dilemmas, n.id, 1 + cue.split(" ").length * 0.4, cue);
    } else if (n.type === "SanskritConcept") {
      if (phraseIn(t, n.iast) || phraseIn(t, n.label)) bump(concepts, n.id, 2.5, phraseIn(t, n.label) ? n.label.toLowerCase() : n.iast);
      for (const cue of (n as { lexicon?: string[] }).lexicon ?? []) if (phraseIn(t, cue)) bump(concepts, n.id, 1 + cue.split(" ").length * 0.3, cue);
    } else if (n.type === "Character") {
      const first = fold(n.label.split(/[ (&]/)[0]);
      if (first.length > 3 && phraseIn(t, first)) bump(characters, n.id, 1, first);
    }
  }

  for (const m of looseMatches(text, nodes)) bump(m.kind === "emotion" ? emotions : m.kind === "dilemma" ? dilemmas : concepts, m.id, m.score, m.cue);

  const verses: string[] = [];
  const refRe = /\b(?:k|kural|couplet)\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?(?!\d)/gi;
  for (const m of text.matchAll(refRe)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let v = a; v <= Math.min(b, a + 12); v++) {
      const id = `K_${v}`;
      if (verseExists(id) && !verses.includes(id)) verses.push(id);
    }
  }
  const chapters = [...text.matchAll(/chapter\s+(\d{1,3})/gi)].map((m) => Number(m[1])).filter((c) => c >= 1 && c <= 133);

  return {
    emotions: sortTop(emotions, 5),
    dilemmas: sortTop(dilemmas, 4),
    concepts: sortTop(concepts, 6),
    characters: sortTop(characters, 3),
    verses,
    chapters,
  };
}
