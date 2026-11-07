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

test("every point has a place in both shapes, except the poet in the lotus, who keeps the centre", () => {
  for (const n of data.nodes) {
    assert.ok(layout.positions[n.id], `${n.id} in the galaxy`);
    if (n.id !== "character:tiruvalluvar") assert.ok(layout.lotus[n.id], `${n.id} in the lotus`);
  }
  assert.deepEqual(layout.positions["character:tiruvalluvar"], [0, 0, 0]);
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
