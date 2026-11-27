"use client";
import { create } from "zustand";
import { RING_R, WORLD } from "@/lib/graph/layoutParams";
import type { ColorBy } from "@/lib/store/useGitaStore";

/**
 * The map has two shapes: the galaxy (his wheel) and the crown (ours). Both share the same rim. The crown was first
 * called the lotus, and keeps that id in code and in saved settings. The crown is the default; the galaxy shows only
 * once chosen.
 */
export type GraphShape = "galaxy" | "lotus";
/** His colour modes, plus the three Parts of the book. */
export type GraphColor = ColorBy | "part";

type Vec3 = [number, number, number];
const KEY = "gitaviswa:graph-shape";

export const useGraphShape = create<{ shape: GraphShape; setShape: (shape: GraphShape) => void }>((set) => ({
  shape: (() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(KEY) === "galaxy" ? "galaxy" : "lotus";
    } catch {
      return "lotus";
    }
  })(),
  setShape: (shape) => {
    set({ shape });
    try {
      localStorage.setItem(KEY, shape);
    } catch {}
  },
}));

/** The crown stands above its rim, so the camera looks a little higher and stands a little further back. */
export const LOTUS_VIEW = { lift: 40 * WORLD, zoom: 1.08 };

/**
 * The crown's tiers above the couplets, in the legend's order: each kind of idea on a ring of its own, narrowing as it
 * rises. Radius and height are fractions of the rim's radius.
 */
const TIERS: [prefix: string, radius: number, height: number][] = [
  ["concept:", 0.76, 0.33],
  ["emotion:", 0.6, 0.45],
  ["dilemma:", 0.43, 0.56],
  ["character:", 0.23, 0.66],
];

/** Bearings pushed apart, keeping their order round the circle, until no two are closer than `gap` radians. */
export function spreadRound(bearings: number[], gap: number): number[] {
  const order = bearings.map((b, i) => [b, i] as const).sort((a, b) => a[0] - b[0]);
  const at = order.map(([b]) => b);
  const n = at.length;
  for (let pass = 0; pass < 500; pass++) {
    let moved = false;
    for (let k = 0; k < n; k++) {
      const next = k + 1 < n ? at[k + 1]! : at[0]! + 2 * Math.PI;
      const short = gap - (next - at[k]!);
      if (short <= 1e-9) continue;
      at[k]! -= short / 2;
      if (k + 1 < n) at[k + 1]! += short / 2;
      else at[0]! += short / 2;
      moved = true;
    }
    if (!moved) break;
  }
  const out = new Array<number>(n);
  order.forEach(([, i], k) => (out[i] = at[k]!));
  return out;
}

/**
 * The crown's positions. kural-layout.json has them in the content repo's terms: a plan view in x and y, height in z, on
 * a ring of `lotusRing`. Each idea keeps its bearing there, so it still stands over the part of the book its couplets
 * come from, but moves onto its kind's tier. Here y is up and chapter angles run from x to z, so the same rim falls on
 * the same chapters.
 */
export function lotusPositions(doc: object): Map<string, Vec3> | null {
  const { lotus, lotusRing = 1000 } = doc as { lotus?: Record<string, Vec3>; lotusRing?: number };
  if (!lotus) return null;
  const at = new Map(Object.entries(lotus));
  for (const [prefix, radius, height] of TIERS) {
    const ids = [...at.keys()].filter((id) => id.startsWith(prefix));
    if (!ids.length) continue;
    // Close neighbours on a tier keep at least 0.6 of an even share of the circle between them.
    const bearings = spreadRound(
      ids.map((id) => Math.atan2(at.get(id)![1], at.get(id)![0])),
      (0.6 * 2 * Math.PI) / ids.length,
    );
    ids.forEach((id, i) => at.set(id, [radius * lotusRing * Math.cos(bearings[i]!), radius * lotusRing * Math.sin(bearings[i]!), height * lotusRing]));
  }
  const s = RING_R / lotusRing;
  return new Map([...at].map(([id, [x, y, z]]) => [id, [y * s, z * s, x * s]]));
}
