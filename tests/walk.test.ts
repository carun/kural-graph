// The walk's rules on small made-up graphs, ported from the Kural site's walk.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEELINGS_NOTE, walkFrom, type WalkEdge, type WalkGraph, type WalkNode } from "../src/kural/walk.ts";

const props = (verses: number[], basis = "explicit", from?: string) => ({ why: "why", quote: "a quote here", basis, verses: verses.map(String), ...(from ? { from } : {}) });
const S = "dilemma:hurt";
const evokes: WalkEdge = { type: "EVOKES_STATE", source: S, target: "emotion:anger", props: { why: "why", basis: "editorial", from: "EVOKES" } };
const answers = (verses: number[]): WalkEdge => ({ type: "ANTIDOTE_TO", source: "emotion:forgiveness", target: "emotion:anger", props: props(verses, "explicit", "ANTIDOTE_TO") });
const way = (verses: number[]): WalkEdge => ({ type: "RESOLVED_THROUGH", source: S, target: "emotion:restraint", props: props(verses, "explicit", "RESOLVED_THROUGH") });
const speaks = (n: number): WalkEdge => ({ type: "ADDRESSES_DILEMMA", source: `K_${n}`, target: S, props: props([], "explicit", "GUIDES") });

function graph(edges: WalkEdge[], { sensitive = [] as number[], silent, direct }: { sensitive?: number[]; silent?: string; direct?: boolean } = {}): WalkGraph {
  const nodes: WalkNode[] = [
    { id: S, type: "LifeDilemma", label: "hurt", leaveOut: ["K_9"], ...(silent ? { silent } : {}), ...(direct ? { direct } : {}) },
    { id: "emotion:anger", type: "Emotion", label: "Anger" },
    { id: "emotion:forgiveness", type: "Emotion", label: "Forgiveness" },
    { id: "emotion:restraint", type: "Emotion", label: "Restraint" },
    ...Array.from({ length: 20 }, (_, i): WalkNode => ({ id: `K_${i + 1}`, type: "Verse", label: `Kural ${i + 1}`, ...(sensitive.includes(i + 1) ? { sensitive: true } : {}) })),
  ];
  return { nodeById: new Map(nodes.map((n) => [n.id, n])), edges };
}

test("goes through the feeling to what answers it", () => {
  const walk = walkFrom(graph([evokes, answers([3])]), S)!;
  assert.deepEqual(walk.feelings.map((f) => f.id), ["emotion:anger"]);
  assert.equal(walk.ways[0].direct, false);
  assert.deepEqual(walk.ways[0].answers, ["emotion:anger"]);
  assert.deepEqual(walk.ways[0].couplets, ["K_3"]);
});

test("puts what the Kural offers for the situation itself first", () => {
  const walk = walkFrom(graph([evokes, answers([3]), way([4])]), S)!;
  assert.deepEqual(walk.ways.map((w) => w.id), ["emotion:restraint", "emotion:forgiveness"]);
});

test("never includes a sensitive couplet, however it is linked", () => {
  const walk = walkFrom(graph([evokes, way([5, 6]), speaks(7), speaks(8)], { sensitive: [5, 7] }), S)!;
  assert.deepEqual(walk.ways[0].couplets, ["K_6"]);
  assert.deepEqual(walk.also, ["K_8"]);
});

test("keeps off a walk a couplet that is true of the situation but wrong to offer", () => {
  const walk = walkFrom(graph([evokes, speaks(9), speaks(10), way([9, 11])]), S)!;
  assert.deepEqual(walk.also, ["K_10"]);
  assert.deepEqual(walk.ways[0].couplets, ["K_11"]);
});

test("says so when the Kural offers no way through", () => {
  const walk = walkFrom(graph([evokes], { silent: "It offers nothing here." }), S)!;
  assert.deepEqual(walk.ways, []);
  assert.equal(walk.silent, "It offers nothing here.");
});

test("leaves out a feeling’s general answers where they would be wrong", () => {
  const walk = walkFrom(graph([evokes, answers([3]), way([4])], { direct: true }), S)!;
  assert.deepEqual(walk.ways.map((w) => w.id), ["emotion:restraint"]);
});

test("a link that overcomes isn’t an answer to a feeling, though both share his relation", () => {
  const overcomes: WalkEdge = { type: "ANTIDOTE_TO", source: "emotion:forgiveness", target: "emotion:anger", props: props([3], "explicit", "OVERCOMES") };
  assert.deepEqual(walkFrom(graph([evokes, overcomes]), S)!.ways, []);
});

test("keeps the reason, and whether the text states it", () => {
  const inferred: WalkEdge = { ...way([4]), props: props([4], "inferred", "RESOLVED_THROUGH") };
  const walk = walkFrom(graph([evokes, inferred, answers([3])]), S)!;
  assert.equal(walk.ways[0].reason, "why");
  assert.equal(walk.ways[0].stated, false);
  assert.equal(walk.ways[1].stated, true);
});

test("holds to its limits: six ways, two couplets a way, five others", () => {
  const edges: WalkEdge[] = [evokes, way([1, 2, 3])];
  for (let i = 0; i < 8; i++) edges.push({ type: "RESOLVED_THROUGH", source: S, target: `emotion:way-${i}`, props: props([12], "explicit", "RESOLVED_THROUGH") });
  for (const n of [13, 14, 15, 16, 17, 18, 19]) edges.push(speaks(n));
  const g = graph(edges);
  for (let i = 0; i < 8; i++) g.nodeById.set(`emotion:way-${i}`, { id: `emotion:way-${i}`, type: "Emotion", label: `Way ${i}` });
  const walk = walkFrom(g, S)!;
  assert.equal(walk.ways.length, 6);
  assert.equal(walk.ways[0].couplets.length, 2);
  assert.equal(walk.also.length, 5);
});

test("the feelings are marked as our suggestion", () => {
  assert.match(FEELINGS_NOTE, /not the Kural/);
});

test("only starts from a situation", () => {
  assert.equal(walkFrom(graph([evokes]), "emotion:anger"), null);
});
