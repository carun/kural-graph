// Ask on the app's own code and the real graph: support first, grounding, and the offline answer.
import "./resolve.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GraphData, VersesDoc } from "../src/lib/types.ts";

const { retrieve, composeOfflineAnswer } = await import("../src/lib/graphrag/engine.ts");
const { buildGraphs } = await import("../src/lib/graph/graphStore.ts");
const { extractCitations, keepSupplied, resolveCitation, suppliedIn } = await import("../src/lib/graphrag/citations.ts");
const { buildSearchIndex } = await import("../src/lib/graphrag/search.ts");
const { isSensitive, OLD_VIEW_NOTE, FEELINGS_NOTE } = await import("../src/kural/walk.ts");
const prompts = await import("../src/lib/graphrag/prompts.ts");

const read = <T>(name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${name}.json`, import.meta.url)), "utf8")) as T;
const data = read<GraphData>("kural-graph");
const versesDoc = read<VersesDoc>("kural-verses");
const graphs = buildGraphs(data, []);
const ctx = { graphs, versesById: new Map(versesDoc.verses.map((v) => [v.id, v])), versesDoc, data, index: await buildSearchIndex(versesDoc, data) };
const has = (id: string) => graphs.graph.hasNode(id);
const sensitive = data.nodes.filter(isSensitive).map((n) => n.id);
const leftOutOf = (id: string) => (graphs.nodeById.get(id) as unknown as { leaveOut: string[] }).leaveOut;

test("after a self-harm concern every couplet waits, and nothing reaches a model", async () => {
  for (const q of ["I don’t want to live", "what’s the point of anything", "I can't stop gambling and I want to die"]) {
    const r = await retrieve(ctx, q);
    assert.equal(r.concern, "self-harm");
    assert.equal(r.crisis, true);
    assert.deepEqual(r.verses, []);
    assert.deepEqual(r.subgraph.nodes, []);
    assert.equal(r.walk, undefined);
    assert.doesNotMatch(r.context, /\[K\d+\]/);
    assert.ok(r.context.length > 0, "an empty context would make the server fetch its own");
    assert.doesNotMatch(composeOfflineAnswer(ctx, r), /\[K\d+\]/);
  }
});

test("the reader can still choose to see them, safely filtered", async () => {
  const r = await retrieve(ctx, "I can't stop gambling and I want to die");
  assert.ok(r.held);
  const shown = composeOfflineAnswer(ctx, r.held);
  assert.match(shown, /\[K\d+\]/);
  for (const v of r.held.verses) assert.equal(isSensitive(graphs.nodeById.get(v.id)), false);
});

test("an abuse concern keeps the couplets but never a sensitive one", async () => {
  const r = await retrieve(ctx, "my husband hits me, what does the Kural say about wives");
  assert.equal(r.concern, "abuse");
  assert.equal(r.crisis, true);
  for (const v of r.verses) assert.equal(isSensitive(graphs.nodeById.get(v.id)), false, v.id);
});

test("a personal question gets no sensitive couplet, however well it matched", async () => {
  for (const id of sensitive.slice(0, 30)) {
    const r = await retrieve(ctx, `I feel lost. ${(graphs.nodeById.get(id) as unknown as { snippet: string }).snippet}`);
    assert.ok(!r.verses.some((v) => v.id === id), id);
  }
});

test("a study question may cite a sensitive couplet, only with its note", async () => {
  const id = sensitive[0];
  const r = await retrieve(ctx, `Explain Kural ${id.slice(2)}`);
  assert.ok(r.verses.some((v) => v.id === id));
  assert.match(r.context, new RegExp(OLD_VIEW_NOTE));
  const answer = composeOfflineAnswer(ctx, r);
  assert.match(answer, new RegExp(`\\[K${id.slice(2)}\\]`));
  assert.match(answer, new RegExp(OLD_VIEW_NOTE));
});

test("a citation of a sensitive couplet can’t appear without its note, from any source", () => {
  const id = sensitive[0];
  const c = resolveCitation(`[K${id.slice(2)}]`, data.nodes, has);
  assert.equal(c.kind, "verse");
  assert.ok(c.label.includes(OLD_VIEW_NOTE));
  assert.ok(!resolveCitation("[K1]", data.nodes, has).label.includes(OLD_VIEW_NOTE));
});

test("citations are the Kural’s: couplets, ranges, feelings and ideas", () => {
  const list = extractCitations("See [K380], [K371-380], [Emotion: Anger] and [Concept: Fate]. [BG 2.47] is not one.", data.nodes, has);
  assert.deepEqual(list.map((c) => [c.kind, c.ids[0]]), [["verse", "K_380"], ["verse", "K_371"], ["emotion", "emotion:anger"], ["concept", "concept:destiny"]]);
  assert.equal(resolveCitation("[K9999]", data.nodes, has).kind, "unknown");
});

test("a couplet that wasn’t supplied can’t be cited", () => {
  assert.equal(keepSupplied("One [K380] and two [K1050].", new Set(["K_380"])), "One [K380] and two.");
});

test("a situation gets its walk, offline and for a model, and nothing it holds back", async () => {
  const r = await retrieve(ctx, "I can't stop gambling");
  assert.equal(r.walk?.situation.id, "dilemma:cant-stop-gambling");
  for (const n of leftOutOf("dilemma:cant-stop-gambling")) assert.ok(!r.verses.some((v) => v.id === n));
  const answer = composeOfflineAnswer(ctx, r);
  assert.match(answer, new RegExp(FEELINGS_NOTE));
  assert.match(answer, /What the Kural doesn’t offer/);
  assert.match(answer, /findahelpline\.com/);
  assert.match(r.context, /What the Kural doesn't offer/);
  assert.match(r.context, new RegExp(FEELINGS_NOTE));
  // A definition says what the Kural concludes, which a walk has to earn.
  assert.ok(!answer.includes((graphs.nodeById.get("dilemma:cant-stop-gambling") as unknown as { desc: string }).desc));
  assert.ok(!r.context.includes((graphs.nodeById.get("dilemma:cant-stop-gambling") as unknown as { desc: string }).desc));
});

test("a direct situation takes nothing the traversal found", async () => {
  const r = await retrieve(ctx, "my friend betrayed me");
  assert.deepEqual(r.verses.map((v) => v.id), ["K_800", "K_798", "K_809", "K_810"]);
});

test("the offline answer works with no index and no network, and never tells someone what they feel", async () => {
  const bare = { ...ctx, index: null };
  const r = await retrieve(bare, "What does the Kural say about anger?");
  assert.equal(r.searchMode, "graph-only");
  const answer = composeOfflineAnswer(bare, r);
  assert.match(answer, /\[Emotion: Anger\]/);
  assert.match(answer, /\[K\d+\]/);
  assert.doesNotMatch(answer, /resonates|What you describe|Gita|BG /);
});

test("the reasons read in the Kural site’s words", async () => {
  const r = await retrieve({ ...ctx, index: null }, "What does the Kural say about anger?");
  const text = r.verses.flatMap((v) => v.reasons).join(" ");
  assert.doesNotMatch(text, /cultivates|heals|antidote/);
  assert.match(text, /answers|warns against|portrays/);
});

test("tensions come with both sides, for a reader and for a model", async () => {
  const r = await retrieve(ctx, "Is fate stronger than effort? Kural 380");
  assert.ok(r.tensions.some((t) => t.a === "K_380" || t.b === "K_380"));
  assert.ok(r.verses.some((v) => v.id === "K_620"));
  assert.match(r.context, /pull two ways/);
  assert.match(composeOfflineAnswer(ctx, r), /Where it pulls two ways/);
});

test("every everyday word in the router points at a real idea", async () => {
  const { EVERYDAY } = await import("../src/kural/route.ts");
  for (const id of Object.keys(EVERYDAY)) assert.ok(has(id), id);
});

test("a query in Tamil finds its couplet, with or without the spaces", async () => {
  const { searchIndex } = await import("../src/lib/graphrag/search.ts");
  for (const q of ["ஊழிற் பெருவலி", "ஊழிற்பெருவலி"]) {
    const { hits } = await searchIndex(ctx.index, q);
    assert.ok(hits.some((h) => h.id === "K_380"), q);
  }
  assert.deepEqual((await searchIndex(ctx.index, "இல்லாதசொல்லொன்று")).hits, []);
});

test("the prompts ground on the Kural and carry no trace of the Gita", () => {
  for (const p of [prompts.PARTHA_SARATHI_SYSTEM, prompts.BRIDGE_SYSTEM, prompts.TRANSLATE_SYSTEM, prompts.COMMENTARY_SYSTEM, prompts.ANALYZE_SYSTEM]) {
    assert.doesNotMatch(p, /Gita|Krishna|Arjuna|Sanskrit|Bhagavad|\bBG\b/);
    assert.match(p, /Tirukkural/);
  }
  assert.match(prompts.PARTHA_SARATHI_SYSTEM, /\[K380\]/);
  assert.match(prompts.PARTHA_SARATHI_SYSTEM, /Tele-MANAS/);
  assert.match(prompts.PARTHA_SARATHI_SYSTEM, new RegExp(OLD_VIEW_NOTE));
});

test("once a concern is raised, later questions in that conversation get no sensitive couplet", async () => {
  const id = sensitive[0];
  const q = `Explain Kural ${id.slice(2)}`;
  assert.ok((await retrieve(ctx, q)).verses.some((v) => v.id === id), "on its own this study question cites it");
  const after = await retrieve(ctx, q, { careful: true });
  for (const v of after.verses) assert.equal(isSensitive(graphs.nodeById.get(v.id)), false, v.id);
});

test("Ask keeps only the couplets a model was given, single or in a range", async () => {
  const r = await retrieve(ctx, "What does the Kural say about anger?");
  const supplied = suppliedIn(r.context);
  assert.ok(r.verses.length > 0 && r.verses.every((v) => supplied.has(v.id)), "every couplet retrieved is tagged in the context");
  const real = r.verses[0].id.slice(2);
  assert.equal(keepSupplied(`True [K${real}]. Invented [K9999]. Remembered [K1050].`, supplied), `True [K${real}]. Invented. Remembered.`);
  assert.equal(keepSupplied("All of it [K1-1330].", new Set(["K_1"])), "All of it.");
  assert.equal(keepSupplied("Both [K1-2].", new Set(["K_1", "K_2"])), "Both [K1-2].");
});

test("a chain never hands a sensitive couplet to someone in trouble", async () => {
  for (const q of ["I can’t stop gambling, what do I do?", "I feel like everything is going wrong for me", "I am thinking about rebirth and I feel lost", "my husband hits me, how does fortune leave"]) {
    const r = await retrieve(ctx, q);
    for (const c of r.chains) for (const v of c.verses) assert.equal(isSensitive(graphs.nodeById.get(v)), false, `${q}: ${c.id} ${v}`);
    for (const id of suppliedIn(r.context)) assert.equal(isSensitive(graphs.nodeById.get(id)), false, `${q}: ${id} reached the model`);
  }
});

test("no situation or feeling, asked as a person would, puts a sensitive or left-out couplet in front of them", async () => {
  const asked = data.nodes.filter((n) => n.type === "LifeDilemma" || (n.type === "Emotion" && "feeling" in n && n.feeling));
  assert.ok(asked.length > 58);
  for (const n of asked) {
    for (const q of [`I am struggling with this: ${n.label}. What should I do?`, `I feel lost. ${n.label}`]) {
      const r = await retrieve(ctx, q);
      const out = new Set([...suppliedIn(r.context), ...suppliedIn(composeOfflineAnswer(ctx, r)), ...r.verses.map((v) => v.id)]);
      for (const id of out) assert.equal(isSensitive(graphs.nodeById.get(id)), false, `${q}: ${id}`);
      if (r.walk?.situation.id === n.id) for (const id of (n as unknown as { leaveOut?: string[] }).leaveOut ?? []) assert.ok(!out.has(id), `${q}: left-out ${id}`);
    }
  }
});
