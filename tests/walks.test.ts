// All 58 walks on the real data: nothing sensitive, nothing left out, and the same walks tirukkural-kb reviewed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { coupletsOf, isSensitive, walkFrom, type Walk, type WalkEdge, type WalkGraph, type WalkNode } from "../src/kural/walk.ts";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const data = JSON.parse(readFileSync(path("../public/data/kural-graph.json"), "utf8")) as { nodes: WalkNode[]; edges: WalkEdge[] };
const g: WalkGraph = { nodeById: new Map(data.nodes.map((n) => [n.id, n])), edges: data.edges };
const situations = data.nodes.filter((n) => n.type === "LifeDilemma");
const walks = new Map(situations.map((s) => [s.id, walkFrom(g, s.id)!]));

test("there are 58 situations, and every one has a walk with at least one feeling", () => {
  assert.equal(situations.length, 58);
  for (const [id, w] of walks) assert.ok(w.feelings.length > 0, id);
});

test("no walk shows a sensitive couplet", () => {
  assert.equal(data.nodes.filter(isSensitive).length, 161);
  for (const [id, w] of walks) for (const n of coupletsOf(w)) assert.equal(isSensitive(g.nodeById.get(n)), false, `${n} on ${id}`);
});

test("no walk shows a couplet its situation leaves out", () => {
  for (const s of situations) for (const n of coupletsOf(walks.get(s.id)!)) assert.ok(!s.leaveOut?.includes(n), `${n} on ${s.id}`);
});

test("a direct situation shows only its own ways", () => {
  const direct = situations.filter((s) => s.direct);
  assert.ok(direct.length > 0);
  for (const s of direct) {
    const own = new Set(data.edges.filter((e) => e.type === "RESOLVED_THROUGH" && e.source === s.id).map((e) => e.target));
    for (const w of walks.get(s.id)!.ways) {
      assert.ok(own.has(w.id), `${w.id} on ${s.id}`);
      assert.ok(w.direct);
    }
  }
});

test("a walk says what the Kural doesn’t offer wherever the data does", () => {
  for (const s of situations) assert.equal(walks.get(s.id)!.silent, s.silent);
  assert.equal(situations.filter((s) => s.silent).length, 31);
});

test("every feeling and every way carries its reason", () => {
  for (const [id, w] of walks) {
    for (const f of w.feelings) assert.ok(f.reason, `${f.id} on ${id}`);
    for (const x of w.ways) assert.ok(x.reason, `${x.id} on ${id}`);
  }
});

test("the links from a situation to a feeling are all marked as ours", () => {
  const evokes = data.edges.filter((e) => e.type === "EVOKES_STATE");
  assert.equal(evokes.length, 101);
  for (const e of evokes) assert.equal(e.props?.basis, "editorial");
});

test("every interpretive link keeps a reason and how firmly it stands", () => {
  const structural = new Set(["BELONGS_TO", "NEXT_VERSE", "NEXT_CHAPTER", "SPOKE"]);
  for (const e of data.edges) {
    if (structural.has(e.type)) continue;
    assert.ok(e.props?.why, `${e.type} ${e.source} ${e.target}`);
    assert.ok(["explicit", "inferred", "editorial"].includes(e.props?.basis as string), `${e.type} ${e.source} ${e.target}`);
  }
});

// walks.md is the review copy. It lives with the content, so this only runs where that repo sits beside this one.
const REVIEWED = path("../../tirukkural-kb/data/eval/walks.md");
const printed = (w: Walk) => {
  const text = (id: string) => (g.nodeById.get(id) as WalkNode & { snippet: string }).snippet;
  const label = (id: string) => g.nodeById.get(id)!.label;
  const lines = [`## ${w.situation.label}`, ""];
  for (const f of w.feelings) lines.push(`- **Can feel like ${f.label}:** ${f.reason}`);
  for (const x of w.ways) {
    const via = x.direct ? "" : ` (via ${x.answers.map(label).join(", ")})`;
    lines.push(`- **${x.label}${via}:** ${x.reason}`);
    for (const n of x.couplets) lines.push(`  - K${n.slice(2)}: ${text(n)}`);
  }
  if (w.silent !== undefined) lines.push(`- **What the Kural doesn’t offer:** ${w.silent}`);
  for (const n of w.also) lines.push(`- Also K${n.slice(2)}: ${text(n)}`);
  return lines.join("\n");
};

test("the walks match the reviewed walks.md, line for line", { skip: !existsSync(REVIEWED) }, () => {
  const [, ...reviewed] = readFileSync(REVIEWED, "utf8").trimEnd().split(/^(?=## )/m);
  const mine = situations.map((s) => printed(walks.get(s.id)!));
  assert.equal(reviewed.length, 58);
  const expected = new Map(reviewed.map((r) => [r.split("\n")[0], r.trimEnd()]));
  for (const walk of mine) assert.equal(walk, expected.get(walk.split("\n")[0]));
});
