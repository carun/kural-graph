// Reflect's rules on the app's own code and the real graph, ported from the Kural site's reflect.test.ts.
import "./resolve.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GraphData, GraphNode, PersonalThought, VersesDoc } from "../src/lib/types.ts";

const { suggestConnections, offlinePerspective, offerableIn, situationsIn } = await import("../src/lib/graphrag/reflect.ts");
const { buildGraphs } = await import("../src/lib/graph/graphStore.ts");
const { coupletsOf, isSensitive, walkFrom } = await import("../src/kural/walk.ts");
const { buildSearchIndex } = await import("../src/lib/graphrag/search.ts");

const read = <T>(name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${name}.json`, import.meta.url)), "utf8")) as T;
const data = read<GraphData>("kural-graph");
const versesDoc = read<VersesDoc>("kural-verses");
const versesById = new Map(versesDoc.verses.map((v) => [v.id, v]));
const context = (thoughts: PersonalThought[] = [], index: Awaited<ReturnType<typeof buildSearchIndex>> | null = null) => ({ graphs: buildGraphs(data, thoughts), versesById, versesDoc, data, index });
const ctx = context();
const withSearch = context([], await buildSearchIndex(versesDoc, data));
const verseOf = (id: string) => ctx.graphs.nodeById.get(id);
type Node = GraphNode & { sensitive?: boolean; leaveOut?: string[]; direct?: boolean; silent?: string; keywords?: string[] };
const situations = data.nodes.filter((n): n is Extract<GraphNode, { type: "LifeDilemma" }> & Node => n.type === "LifeDilemma");
const offered = async (text: string, c = withSearch) => (await suggestConnections(c, text)).candidates;
const verses = (list: { targetId: string }[]) => list.filter((c) => c.targetId.startsWith("K_")).map((c) => c.targetId);

test("matches a situation from everyday words", async () => {
  assert.ok((await offered("my friend betrayed me")).some((c) => c.targetId === "dilemma:friend-let-you-down"));
  assert.ok((await offered("I can’t stop gambling")).some((c) => c.targetId === "dilemma:cant-stop-gambling"));
  assert.ok((await offered("I can't pay the rent this month")).some((c) => c.targetId === "dilemma:struggling-to-get-by"));
});

test("never offers a sensitive couplet, whichever way it matched", async () => {
  const sensitive = data.nodes.filter(isSensitive).map((n) => n.id);
  assert.equal(sensitive.length, 161);
  // By naming it, by its own words, and through every situation's own words.
  for (const id of sensitive.slice(0, 40)) {
    const number = id.slice(2);
    const words = (verseOf(id) as { snippet: string }).snippet;
    for (const text of [`What about Kural ${number}?`, words]) {
      for (const v of verses(await offered(text))) assert.equal(isSensitive(verseOf(v)), false, `${v} offered for “${text}”`);
    }
  }
});

test("every situation, reached by every one of its own phrases, offers nothing sensitive and nothing it leaves out", async () => {
  for (const s of situations) {
    for (const text of [s.label, ...s.keywords]) {
      for (const v of verses(await offered(text))) {
        assert.equal(isSensitive(verseOf(v)), false, `${v} offered for “${text}”`);
        assert.ok(!s.leaveOut?.includes(v), `${v} is left out of ${s.id}`);
      }
    }
  }
});

test("leaves out what a situation says is wrong to offer, even if the search found it", async () => {
  const left = situations.find((s) => s.id === "dilemma:cant-stop-gambling")!.leaveOut!;
  assert.ok(left.length > 0);
  const n = left[0];
  const words = (verseOf(n) as { snippet: string }).snippet;
  assert.ok(!verses(await offered(`I can't stop gambling. ${words}`)).includes(n));
  assert.ok(!verses(await offered(`I can't stop gambling. What about Kural ${n.slice(2)}?`)).includes(n));
});

test("a direct situation brings in only what its walk shows, whatever else the words touch", async () => {
  for (const s of situations.filter((x) => x.direct)) {
    const walk = new Set(coupletsOf(walkFrom(ctx.graphs, s.id)!));
    const found = (await offered(s.keywords[0], ctx)).filter((c) => c.basis === "related");
    if (!situationsIn(ctx, s.keywords[0]).includes(s.id) || situationsIn(ctx, s.keywords[0]).length > 1) continue;
    for (const c of found) assert.ok(walk.has(c.targetId), `${c.targetId} on ${s.id}`);
  }
});

test("a couplet that only warns is not offered to someone already in the feeling", async () => {
  // Every feeling and vice, because where a feeling has answers they outrank its warnings and would hide a lapse.
  let reached = 0;
  for (const n of data.nodes) {
    if (n.type !== "Emotion") continue;
    const warned = new Set(data.edges.filter((e) => e.target === n.id && e.props?.from === "CONDEMNS").map((e) => e.source));
    if (!warned.size) continue;
    reached++;
    const text = `I feel ${n.label.toLowerCase()}`;
    // Two ways in are fine, because both were reviewed for this reader: it also answers the feeling, or a walk shows it.
    const answers = new Set(data.edges.filter((e) => e.target === n.id && e.props?.from === "ANSWERS").map((e) => e.source));
    const walked = new Set(situationsIn(ctx, text).flatMap((s: string) => coupletsOf(walkFrom(ctx.graphs, s)!)));
    for (const c of await offered(text, ctx)) if (c.basis === "related" && warned.has(c.targetId)) assert.ok(answers.has(c.targetId) || walked.has(c.targetId), `${c.targetId} only warns against ${n.label}`);
  }
  assert.ok(reached > 10, `only ${reached} ideas carry warnings`);
});

test("the gate holds for what a model sends back, too", () => {
  const offerable = offerableIn(ctx.graphs, ["dilemma:cant-stop-gambling"]);
  const left = situations.find((s) => s.id === "dilemma:cant-stop-gambling")!.leaveOut![0];
  const sensitive = data.nodes.find(isSensitive)!.id;
  assert.equal(offerable(left), false);
  assert.equal(offerable(sensitive), false);
  assert.equal(offerable("K_1"), true);
  assert.equal(offerable("emotion:anger"), true);
});

test("never tells someone what they feel: a feeling is theirs only if they said so", async () => {
  const about = (await offered("Why does the Kural call anger an enemy?", ctx)).find((c) => c.targetId === "emotion:anger");
  assert.ok(about);
  assert.notEqual(about.basis, "expressed");
  assert.doesNotMatch(about.why, /feeling/);
  const denied = await offered("I am not angry, only curious about what it says.", ctx);
  assert.ok(!denied.some((c) => c.targetId === "emotion:anger" && c.basis === "expressed"));
  const said = (await offered("I feel angry with my brother", ctx)).find((c) => c.targetId === "emotion:anger");
  assert.equal(said?.basis, "expressed");
  assert.match(said!.why, /You wrote about feeling “angry”/);
  const s = await suggestConnections(ctx, "my friend betrayed me");
  assert.doesNotMatch(offlinePerspective(ctx, s), /You (are|feel) /);
});

test("a perspective offers a couplet only after it passed the gate, in the Kural’s name", async () => {
  const s = await suggestConnections(ctx, "I feel lonely and nobody calls");
  const text = offlinePerspective(ctx, s);
  assert.match(text, /Kural/);
  assert.doesNotMatch(text, /Gita|dialogue|\(\)/);
});

test("a saved thought never reaches what a model is given", async () => {
  const secret = "my-private-word-in-a-saved-thought";
  // It has to bridge public nodes: a thought is only ever reached through, so one link alone could hide a leak.
  const far = data.nodes.filter((n) => n.type === "Verse").slice(0, 300).map((n) => n.id);
  const thought: PersonalThought = {
    id: "t1",
    text: `${secret} and anger`,
    createdAt: 1,
    connections: ["emotion:anger", ...far].map((targetId) => ({ id: `c:${targetId}`, targetId, relation: "relates_to", status: "accepted", origin: "user", why: secret, createdAt: 1 })),
  };
  const { retrieve } = await import("../src/lib/graphrag/engine.ts");
  const r = await retrieve(context([thought]), "What does the Kural say about anger?", { limitVerses: 400 });
  assert.ok(r.verses.length > 20, "enough is retrieved for a leak to show");
  assert.doesNotMatch(r.context, new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(r.verses), new RegExp(secret));
  assert.ok(!r.subgraph.nodes.includes("thought:t1"));
  const suggestions = await suggestConnections(context([thought]), "anger");
  assert.ok(!suggestions.candidates.some((c) => c.targetId.startsWith("thought:")));
  assert.doesNotMatch(JSON.stringify(suggestions), new RegExp(secret));
});
