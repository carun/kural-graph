import louvain from "graphology-communities-louvain";
import type { GitaGraphs } from "./graphStore";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Communities {
  of: Record<string, number>;
  /** community id → rank by size (0 = largest); only the eight largest receive a categorical hue */
  rank: Record<number, number>;
  count: number;
  modularity: number;
  ms: number;
}

/** Louvain community detection on the weighted undirected projection (deterministic seed for stable colours). */
export function detectCommunities(g: GitaGraphs): Communities {
  const t0 = performance.now();
  const res = louvain.detailed(g.path, {
    getEdgeWeight: (_e, attr) => 1 / Math.max(0.5, attr.weight),
    resolution: 1.1,
    rng: mulberry32(108),
  });
  const sizes = new Map<number, number>();
  for (const c of Object.values(res.communities)) sizes.set(c, (sizes.get(c) || 0) + 1);
  const rank: Record<number, number> = {};
  [...sizes.entries()].sort((a, b) => b[1] - a[1]).forEach(([c], i) => (rank[c] = i));
  return { of: res.communities, rank, count: res.count, modularity: res.modularity, ms: performance.now() - t0 };
}

// Documented categorical order (blue, orange, aqua, yellow, magenta, green, violet, red), stepped per theme.
// Communities past the eighth fold into a neutral "other" tone rather than cycling hues.
const PALETTE = {
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
};
export function communityColor(c: Communities, id: string, dark: boolean): string {
  const r = c.rank[c.of[id] ?? -1];
  return r !== undefined && r < 8 ? PALETTE[dark ? "dark" : "light"][r] : dark ? "#5f5a52" : "#b9b3a9";
}

// ── the three Parts of the book, a fixed grouping beside the detected ones ──
export const PART_NAMES = ["Righteousness", "Wealth", "Desire"];
const PART_COLORS = { dark: ["#3987e5", "#d95926", "#199e70"], light: ["#2a78d6", "#eb6834", "#1baf7a"] };
export const partColors = (dark: boolean) => PART_COLORS[dark ? "dark" : "light"];
export const partOfChapter = (n: number) => (n <= 38 ? 0 : n <= 108 ? 1 : 2);

/** Part of each node: couplets and chapters by position, anything else by where most of its couplets lie (if most do). */
export function partsOf(g: GitaGraphs): Map<string, number> {
  const of = new Map<string, number>();
  const counts = new Map<string, number[]>();
  g.graph.forEachNode((id, n) => {
    if (n.type === "Chapter") of.set(id, partOfChapter(n.number));
    if (n.type !== "Verse") return;
    const part = partOfChapter(n.chapter);
    of.set(id, part);
    g.graph.forEachNeighbor(id, (other) => {
      const c = counts.get(other) ?? [0, 0, 0];
      c[part]++;
      counts.set(other, c);
    });
  });
  for (const [id, c] of counts) {
    if (of.has(id)) continue;
    const top = Math.max(...c);
    if (top >= (c[0] + c[1] + c[2]) * 0.6) of.set(id, c.indexOf(top));
  }
  return of;
}
export function partColor(parts: Map<string, number>, id: string, dark: boolean): string {
  const part = parts.get(id);
  return part === undefined ? (dark ? "#5f5a52" : "#b9b3a9") : partColors(dark)[part];
}
