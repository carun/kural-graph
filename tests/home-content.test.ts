/* eslint-disable @typescript-eslint/no-explicit-any -- these tests read raw JSON documents */
// The home page quotes the book before the data has loaded, so it keeps its own copy. This holds that copy to the data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ARISE, GRAPH_COUNTS_FALLBACK, LADDER, SCENES, SITUATIONS, SPOTLIGHT } from "../src/components/home/homeContent.ts";

const json = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const { verses, chapters } = json("kural-verses.json");
const graph = json("kural-graph.json");
const byId = new Map<string, any>(verses.map((v: any) => [v.id, v]));
const nodes = new Map<string, any>(graph.nodes.map((n: any) => [n.id, n]));
const plain = (id: string) => byId.get(id).translations.en["1"];

test("the switcher quotes each couplet exactly, and none is sensitive", () => {
  for (const v of SPOTLIGHT) {
    const d = byId.get(v.id);
    assert.deepEqual(v.sa, d.sanskrit, v.id);
    assert.deepEqual(v.iast, d.iast, v.id);
    assert.equal(v.en, plain(v.id));
    assert.equal(v.ref, d.ref);
    assert.equal(v.gloss, `Chapter ${d.chapter}, ${chapters[d.chapter - 1].title}`);
    assert.ok(!d.sensitive, `${v.id} is sensitive`);
  }
});

test("the quoted couplets are exact, and no situation leaves any of them out", () => {
  assert.deepEqual(ARISE.sa, byId.get(ARISE.id).sanskrit);
  assert.equal(ARISE.en, plain(ARISE.id));
  for (const s of SCENES) {
    assert.equal(s.quote, plain(s.verseId));
    assert.ok(!byId.get(s.verseId).sensitive);
  }
  const left = new Set(graph.nodes.flatMap((n: any) => n.leaveOut ?? []));
  for (const id of [ARISE.id, ...SPOTLIGHT.map((v) => v.id), ...SCENES.map((s) => s.verseId)]) assert.ok(!left.has(id), `${id} is left out of a walk`);
});

test("the Parts cover all 133 chapters in order", () => {
  assert.deepEqual(SCENES.map((s) => s.chapters), [38, 70, 25]);
  let next = 1;
  for (const s of SCENES) {
    assert.equal(s.chapter, next);
    next += s.chapters;
  }
  assert.equal(next - 1, chapters.length);
});

test("the situations on the front page are gentle ones", () => {
  for (const s of SITUATIONS) {
    const n = nodes.get(s.id);
    assert.ok(n, s.id);
    assert.ok(!n.silent, `${s.id} has no way through`);
    assert.ok(!n.leaveOut?.length, `${s.id} holds couplets back`);
  }
});

test("the chain is a real chain, with the graph's own labels", () => {
  const chain = graph.chains.find((c: any) => c.id === LADDER.id);
  assert.equal(chain.title, LADDER.title);
  assert.deepEqual(LADDER.steps.map((s) => s.id), chain.steps);
  for (const s of LADDER.steps) assert.equal(s.label, nodes.get(s.id).label);
});

test("the counts match the graph", () => {
  const { edges, ...by } = GRAPH_COUNTS_FALLBACK;
  assert.equal(edges, graph.stats.edges);
  for (const [k, n] of Object.entries(by)) assert.equal(n, graph.stats.byLabel[k], k);
});
