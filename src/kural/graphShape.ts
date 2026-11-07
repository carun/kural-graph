"use client";
import { create } from "zustand";
import { RING_R, WORLD } from "@/lib/graph/layoutParams";
import type { ColorBy } from "@/lib/store/useGitaStore";

/** The map has two shapes: the galaxy (his wheel) and the lotus (ours). Both share the same rim. */
export type GraphShape = "galaxy" | "lotus";
/** His colour modes, plus the three Parts of the book. */
export type GraphColor = ColorBy | "part";

type Vec3 = [number, number, number];
const KEY = "gitaviswa:graph-shape";

export const useGraphShape = create<{ shape: GraphShape; setShape: (shape: GraphShape) => void }>((set) => ({
  shape: (() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(KEY) === "lotus" ? "lotus" : "galaxy";
    } catch {
      return "galaxy";
    }
  })(),
  setShape: (shape) => {
    set({ shape });
    try {
      localStorage.setItem(KEY, shape);
    } catch {}
  },
}));

/** The lotus stands above its rim, so the camera looks a little higher and stands a little further back. */
export const LOTUS_VIEW = { lift: 40 * WORLD, zoom: 1.08 };

/**
 * The lotus positions in kural-layout.json are in the content repo's terms: a plan view in x and y, height in z, on a
 * ring of `lotusRing`. Here y is up and chapter angles run from x to z, so the same rim falls on the same chapters.
 */
export function lotusPositions(doc: object): Map<string, Vec3> | null {
  const { lotus, lotusRing = 1000 } = doc as { lotus?: Record<string, Vec3>; lotusRing?: number };
  if (!lotus) return null;
  const s = RING_R / lotusRing;
  return new Map(Object.entries(lotus).map(([id, [x, y, z]]) => [id, [y * s, z * s, x * s]]));
}
