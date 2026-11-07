// People don't write in our keywords. "My friend betrayed me" has to reach "betrayed by a friend", as it did on the
// Kural's own site, so ideas are also matched word by word on their stems. A match needs two words of one phrase, or a
// phrase's only real word when few ideas use it: "he left me" must not fire on every "left".
import type { GraphNode } from "@/lib/types";
import { keywords } from "../lib/graphrag/text";

const NOT_A_SUFFIX = new Set("beneath teeth best rest west test nest guest honest modest forest earnest interest harvest request manifest priest justly only always this thus less wealth death wisdom kindness".split(" "));
const FILLER = new Set("want wants wanted feel feels feeling felt keep keeps get gets got make makes made really like know think thing things someone somebody people need needs going time much many still even ever back take takes took cant dont wont didnt doesnt isnt arent wasnt cannot stop".split(" "));

export function stem(word: string): string {
  if (NOT_A_SUFFIX.has(word) || word.length < 4) return word;
  let w = word;
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("es") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
  if (/(.)\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1);
  return w.replace(/e$/, "");
}

const stems = (s: string) => keywords(s).filter((w) => !FILLER.has(w)).map((w) => [stem(w), w] as const);

/** Everyday forms the lexicons don't carry, each a word someone would write for themselves. */
export const EVERYDAY: Record<string, string[]> = {
  "emotion:anger": ["angry", "furious", "annoyed", "irritated", "enraged"],
  "emotion:grief": ["sad", "grieving", "mourning", "heartbroken", "miserable", "unhappy"],
  "emotion:envy": ["envious", "jealous"],
  "emotion:worry": ["worried", "nervous", "tense"],
  "emotion:fear": ["fearful", "nervous"],
  "emotion:loneliness": ["alone"],
  "emotion:hurt": ["betrayed", "disappointed"],
  "emotion:regret": ["regretful"],
  "emotion:guilt": ["ashamed", "shame"],
  "emotion:craving": ["greedy"],
  "emotion:restlessness": ["restless", "sleepless"],
  "emotion:losing-heart": ["hopeless", "defeated", "exhausted"],
  "emotion:distrust": ["distrustful"],
};

type Kind = "emotion" | "dilemma" | "concept";
interface Phrase {
  id: string;
  kind: Kind;
  stems: string[];
  /** Words as written, counting the small ones, since "he left me" is not a match for "left". */
  words: number;
}

const indexes = new WeakMap<GraphNode[], { phrases: Phrase[]; seenIn: Map<string, number>; ideasWith: Map<string, Set<string>> }>();

function indexOf(nodes: GraphNode[]) {
  let index = indexes.get(nodes);
  if (index) return index;
  const phrases: Phrase[] = [];
  const add = (id: string, kind: Kind, list: string[]) => {
    for (const p of list) {
      const s = [...new Set(stems(p).map(([x]) => x))];
      if (s.length) phrases.push({ id, kind, stems: s, words: p.split(/\s+/).length });
    }
  };
  for (const n of nodes) {
    if (n.type === "Emotion") add(n.id, "emotion", [n.label, ...n.lexicon, ...(EVERYDAY[n.id] ?? [])]);
    else if (n.type === "LifeDilemma") add(n.id, "dilemma", [n.label, ...n.keywords]);
    else if (n.type === "SanskritConcept" && n.category !== "image") add(n.id, "concept", [n.label, ...((n as { lexicon?: string[] }).lexicon ?? [])]);
  }
  const seenIn = new Map<string, number>();
  const ideasWith = new Map<string, Set<string>>();
  for (const p of phrases) {
    for (const s of p.stems) {
      seenIn.set(s, (seenIn.get(s) ?? 0) + 1);
      ideasWith.set(s, (ideasWith.get(s) ?? new Set()).add(p.id));
    }
  }
  indexes.set(nodes, (index = { phrases, seenIn, ideasWith }));
  return index;
}

export interface LooseMatch {
  id: string;
  kind: Kind;
  score: number;
  /** The writer's own word that decided it, so a reason can quote them exactly. */
  cue: string;
}

export function looseMatches(text: string, nodes: GraphNode[]): LooseMatch[] {
  const { phrases, seenIn, ideasWith } = indexOf(nodes);
  const written = new Map(stems(text));
  if (!written.size) return [];
  const best = new Map<string, LooseMatch>();
  for (const p of phrases) {
    const hit = p.stems.filter((s) => written.has(s));
    if (hit.length < Math.min(2, p.stems.length) || (hit.length === 1 && p.words > 1 && (ideasWith.get(hit[0])?.size ?? 0) > 2)) continue;
    const rarest = hit.reduce((a, b) => ((seenIn.get(b) ?? 0) < (seenIn.get(a) ?? 0) ? b : a));
    const score = 0.6 * hit.length * (hit.length / p.stems.length) + 0.4;
    const cur = best.get(p.id);
    if (!cur || score > cur.score) best.set(p.id, { id: p.id, kind: p.kind, score, cue: written.get(rarest)! });
  }
  return [...best.values()];
}
