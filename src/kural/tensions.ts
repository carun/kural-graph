// Where the Kural pulls two ways. These are the project's signature, so everything that shows a couplet can find them.
// Type imports only, so it runs under `node --test`.
import type { WalkEdge, WalkGraph } from "./walk";

export interface Tension {
  /** Stable across visits, for the Lineage control. */
  key: string;
  a: string;
  b: string;
  reason: string;
  stated: boolean;
}

const toTension = (e: WalkEdge): Tension => ({ key: `${e.source}|${e.target}`, a: e.source, b: e.target, reason: typeof e.props?.why === "string" ? e.props.why : "", stated: e.props?.basis === "explicit" });
const agents = (e: WalkEdge) => (typeof e.props?.agents === "number" ? e.props.agents : 1);

/** Every tension. Pairs that several agents reached on their own come first, as on the Kural's own site. */
export function allTensions(g: Pick<WalkGraph, "edges">): Tension[] {
  return g.edges.filter((e) => e.type === "IN_TENSION_WITH").sort((x, y) => agents(y) - agents(x)).map(toTension);
}

/** Tensions with at least one end among these couplets, the first couplets' first. */
export function tensionsTouching(g: Pick<WalkGraph, "edges">, verses: string[], limit = 2): Tension[] {
  const rank = new Map(verses.map((id, i) => [id, i]));
  const at = (t: Tension) => Math.min(rank.get(t.a) ?? Infinity, rank.get(t.b) ?? Infinity);
  return allTensions(g).filter((t) => at(t) < Infinity).sort((x, y) => at(x) - at(y)).slice(0, limit);
}
