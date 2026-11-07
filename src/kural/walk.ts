// From a situation, through what it can feel like, to what the Kural sets against that, to the couplets that say so.
// The rules are the Kural site's own, and each was earned by a real failure. Works on his graph's plain data and has
// no runtime imports, so every walk runs under `node --test`.

export interface WalkNode {
  id: string;
  type: string;
  label: string;
  sensitive?: boolean;
  direct?: boolean;
  leaveOut?: string[];
  silent?: string;
}

export interface WalkEdge {
  source: string;
  target: string;
  type: string;
  props?: Record<string, unknown>;
}

/** What a walk reads. His `GitaGraphs` and the raw graph file both fit. */
export interface WalkGraph {
  nodeById: Map<string, WalkNode>;
  edges: WalkEdge[];
}

export interface WalkFeeling {
  id: string;
  label: string;
  reason: string;
}

export interface Way {
  id: string;
  label: string;
  reason: string;
  /** Stated in the text, rather than a step a reader has to take. */
  stated: boolean;
  couplets: string[];
  /** True when the Kural offers this for the situation itself, and not only for a feeling in it. */
  direct: boolean;
  /** The feelings on this walk that this answers. */
  answers: string[];
}

export interface Walk {
  situation: { id: string; label: string };
  feelings: WalkFeeling[];
  ways: Way[];
  /** Couplets linked to the situation that no way through cites. */
  also: string[];
  /** What the Kural does say, where it offers no way through. */
  silent?: string;
}

const MAX_WAYS = 6;
const MAX_COUPLETS_PER_WAY = 2;
const MAX_ALSO = 5;

export const FEELINGS_NOTE = "Our suggestion, not the Kural’s words.";
export const OLD_VIEW_NOTE = "An old view, given here as the text has it.";
export const HELPLINE_LINE = "This is a book, read by an AI, and it can’t replace a person. If you are in danger, or thinking of ending your life, please reach out now:";
export const HELPLINE_URL = "https://findahelpline.com";

const whyOf = (e: WalkEdge) => (typeof e.props?.why === "string" ? e.props.why : "");
const versesOf = (e: WalkEdge) => (Array.isArray(e.props?.verses) ? (e.props.verses as string[]).map((n) => `K_${n}`) : []);

// Built once per graph. His `neighbors` follows graphology's order, and a walk must keep the order of the data.
const indexes = new WeakMap<WalkEdge[], { out: Map<string, WalkEdge[]>; into: Map<string, WalkEdge[]> }>();
function indexOf(g: WalkGraph) {
  let index = indexes.get(g.edges);
  if (!index) {
    index = { out: new Map(), into: new Map() };
    for (const e of g.edges) {
      index.out.set(e.source, [...(index.out.get(e.source) ?? []), e]);
      index.into.set(e.target, [...(index.into.get(e.target) ?? []), e]);
    }
    indexes.set(g.edges, index);
  }
  return index;
}

/** Marked in the data, on the couplet's node and on the couplet itself. Pass either. */
export const isSensitive = (n: object | undefined) => (n as { sensitive?: boolean } | undefined)?.sensitive === true;

/** A couplet that could hurt someone in distress is never offered, whatever links to it. */
export function safeFor(g: WalkGraph, verse: string, situation?: string): boolean {
  if (isSensitive(g.nodeById.get(verse))) return false;
  return !(situation !== undefined && g.nodeById.get(situation)?.leaveOut?.includes(verse));
}

export function walkFrom(g: WalkGraph, id: string): Walk | null {
  const situation = g.nodeById.get(id);
  if (situation?.type !== "LifeDilemma") return null;
  const { out, into } = indexOf(g);

  const feelings = (out.get(id) ?? [])
    .filter((e) => e.type === "EVOKES_STATE")
    .flatMap((e): WalkFeeling[] => {
      const idea = g.nodeById.get(e.target);
      return idea ? [{ id: idea.id, label: idea.label, reason: whyOf(e) }] : [];
    });

  const ways = new Map<string, Way>();
  const addWay = (edge: WalkEdge, ideaId: string, direct: boolean, feeling?: string) => {
    const idea = g.nodeById.get(ideaId);
    if (!idea) return;
    const couplets = versesOf(edge).filter((n) => safeFor(g, n, id)).slice(0, MAX_COUPLETS_PER_WAY);
    const held = ways.get(ideaId);
    if (!held) {
      ways.set(ideaId, { id: idea.id, label: idea.label, reason: whyOf(edge), stated: edge.props?.basis === "explicit", couplets, direct, answers: feeling === undefined ? [] : [feeling] });
      return;
    }
    held.direct ||= direct;
    if (feeling !== undefined && !held.answers.includes(feeling)) held.answers.push(feeling);
    for (const n of couplets) if (!held.couplets.includes(n) && held.couplets.length < MAX_COUPLETS_PER_WAY) held.couplets.push(n);
  };
  for (const e of out.get(id) ?? []) if (e.type === "RESOLVED_THROUGH") addWay(e, e.target, true);
  if (!situation.direct) {
    // His ANTIDOTE_TO also carries our OVERCOMES, which isn't an answer to a feeling and must stay off a walk.
    for (const f of feelings) for (const e of into.get(f.id) ?? []) if (e.type === "ANTIDOTE_TO" && e.props?.from === "ANTIDOTE_TO") addWay(e, e.source, false, f.id);
  }

  const shown = [...ways.values()].sort((a, b) => Number(b.direct) - Number(a.direct)).slice(0, MAX_WAYS);
  const cited = new Set(shown.flatMap((w) => w.couplets));
  const also = (into.get(id) ?? [])
    .filter((e) => e.type === "ADDRESSES_DILEMMA" && g.nodeById.get(e.source)?.type === "Verse")
    .map((e) => e.source)
    .filter((n) => !cited.has(n) && safeFor(g, n, id))
    .slice(0, MAX_ALSO);

  return { situation: { id: situation.id, label: situation.label }, feelings, ways: shown, also, ...(situation.silent === undefined ? {} : { silent: situation.silent }) };
}

/** Every couplet a walk shows, in the order it shows them. */
export const coupletsOf = (w: Walk) => [...new Set([...w.ways.flatMap((x) => x.couplets), ...w.also])];

export const takesOnlyItsOwn = (g: WalkGraph, situation: string) => g.nodeById.get(situation)?.direct === true;

/** The feelings a walk would otherwise answer in general terms, for a situation that takes only its own ways. */
export function feelingsHeldBack(g: WalkGraph, situation: string): string[] {
  if (!takesOnlyItsOwn(g, situation)) return [];
  return (indexOf(g).out.get(situation) ?? []).filter((e) => e.type === "EVOKES_STATE").map((e) => e.target);
}
