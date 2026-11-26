// The map on the real data: both shapes place every point, and the suggested paths are real and safe.
import "./resolve.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { buildGraphs } = await import("../src/lib/graph/graphStore.ts");
const { findSutraPath, SUTRA_PRESETS } = await import("../src/lib/graph/pathfinder.ts");
const { RING_R, chapterAngle, fixedPosition } = await import("../src/lib/graph/layoutParams.ts");
import type { GraphData } from "../src/lib/types.ts";

type Vec3 = [number, number, number];
const read = (p: string) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8"));
const data = read("../public/data/kural-graph.json") as GraphData;
const layout = read("../public/data/kural-layout.json") as { positions: Record<string, Vec3>; lotus: Record<string, Vec3> };
const graphs = buildGraphs(data);
const reach = (id: string) => Math.hypot(layout.positions[id][0], layout.positions[id][2]);

test("every point has a place in both shapes", () => {
  for (const n of data.nodes) {
    assert.ok(layout.positions[n.id], `${n.id} in the galaxy`);
    assert.ok(layout.lotus[n.id], `${n.id} in the lotus`);
  }
});

test("chapters keep their ring, with a gap before each Part", () => {
  for (const n of data.nodes) if (n.type === "Chapter") fixedPosition(n)!.forEach((v, i) => assert.ok(Math.abs(v - layout.positions[n.id][i]) < 0.1, n.id));
  const step = chapterAngle(2) - chapterAngle(1);
  assert.ok(chapterAngle(39) - chapterAngle(38) > step * 2);
  assert.ok(chapterAngle(109) - chapterAngle(108) > step * 2);
  assert.ok(chapterAngle(133) < Math.PI * 2);
});

test("couplets gather at the rim by chapter, and the ideas stay in the middle", () => {
  for (const n of data.nodes) {
    if (n.type === "Verse") {
      assert.ok(reach(n.id) > RING_R * 0.7, `${n.id} is near the rim`);
      assert.ok(reach(n.id) < RING_R * 1.15, `${n.id} is near the rim`);
    }
    if (n.type === "Emotion" || n.type === "SanskritConcept" || n.type === "LifeDilemma") assert.ok(reach(n.id) < RING_R * 0.7, `${n.id} is inside the rim`);
  }
});

test("every suggested path exists, takes more than one step, and passes no sensitive couplet", () => {
  assert.equal(SUTRA_PRESETS.length, 6);
  for (const p of SUTRA_PRESETS) {
    const path = findSutraPath(graphs, p.from, p.to);
    assert.ok(path, p.label);
    assert.ok(path.steps.length >= 2, `${p.label} is more than a single link`);
    for (const id of path.nodes) assert.ok(!("sensitive" in graphs.nodeById.get(id)!), `${p.label} passes ${id}`);
  }
});

const { lotusPositions, spreadRound } = await import("../src/kural/graphShape.ts");

test("the crown sets each kind of idea on a ring of its own, narrowing as it rises in the legend's order", () => {
  const crown = lotusPositions(layout)!;
  const rings = ["concept:", "emotion:", "dilemma:", "character:"].map((prefix) => {
    const at = [...crown].filter(([id]) => id.startsWith(prefix)).map(([, p]) => p);
    assert.ok(at.length > 0, prefix);
    const heights = new Set(at.map((p) => p[1].toFixed(3)));
    const radii = new Set(at.map((p) => Math.hypot(p[0], p[2]).toFixed(3)));
    assert.equal(heights.size, 1, `${prefix} all at one height`);
    assert.equal(radii.size, 1, `${prefix} all on one ring`);
    return { height: at[0]![1], radius: Math.hypot(at[0]![0], at[0]![2]) };
  });
  for (let i = 1; i < rings.length; i++) {
    assert.ok(rings[i]!.height > rings[i - 1]!.height, "each tier above the last");
    assert.ok(rings[i]!.radius < rings[i - 1]!.radius, "each tier narrower than the last");
  }
  // The rim and its couplets stay where the layout put them.
  const s = RING_R / (layout as { lotusRing?: number }).lotusRing!;
  for (const id of ["CH_1", "CH_133", "K_1", "K_1330"]) {
    const [x, y, z] = (layout.lotus as Record<string, Vec3>)[id]!;
    assert.deepEqual(crown.get(id), [y * s, z * s, x * s], id);
  }
});

test("spreading bearings round a ring keeps their order and a minimum gap", () => {
  const TAU = 2 * Math.PI;
  const bearings = [0.1, 0.11, 0.12, 0.13, 3, 3.001, -3.1, -3.09, 1.5];
  const gap = (0.6 * TAU) / bearings.length;
  const out = spreadRound(bearings, gap);
  const order = (xs: number[]) => xs.map((b, i) => [((b % TAU) + TAU) % TAU, i] as const).sort((a, b) => a[0] - b[0]);
  // The same cyclic order, starting from wherever the first one landed.
  const before = order(bearings).map(([, i]) => i);
  const after = order(out).map(([, i]) => i);
  const turn = after.indexOf(before[0]!);
  assert.deepEqual([...after.slice(turn), ...after.slice(0, turn)], before);
  const sorted = order(out).map(([b]) => b);
  for (let k = 0; k < sorted.length; k++) {
    const next = k + 1 < sorted.length ? sorted[k + 1]! : sorted[0]! + TAU;
    assert.ok(next - sorted[k]! >= gap - 1e-6, `gap after bearing ${k}`);
  }
});
