import { bfsFromNode } from "graphology-traversal";
import type { Chain, Dialogue, GraphData, GraphNode, RelationType, Verse, VersesDoc } from "@/lib/types";
import { RELATIONS } from "@/lib/graph/relations";
import type { GitaGraphs } from "@/lib/graph/graphStore";
import { describeNode } from "@/lib/graph/pathfinder";
import { routeText } from "./router";
import { searchIndex, type SearchIndex } from "./search";
import { concernIn, type Concern } from "./safety";
import { askIntent } from "./intent";
import { composeAnswer } from "@/kural/compose";
import { tensionsTouching, type Tension } from "@/kural/tensions";
import { FEELINGS_NOTE, OLD_VIEW_NOTE, coupletsOf, isSensitive, safeFor, takesOnlyItsOwn, walkFrom, type Walk } from "@/kural/walk";
import { linkWords } from "@/kural/wording";

export interface RagContext {
  graphs: GitaGraphs;
  versesById: Map<string, Verse>;
  versesDoc: VersesDoc;
  data: GraphData;
  index: SearchIndex | null;
}

export interface RankedItem {
  id: string;
  score: number;
  reasons: string[];
}

export interface Retrieval {
  query: string;
  crisis: boolean;
  concern: Concern;
  /** After a self-harm concern, everything found waits here until the reader chooses to see it. */
  held?: Retrieval;
  /** The walk for the situation the question matched, if any. */
  walk?: Walk;
  tensions: Tension[];
  seeds: { id: string; score: number; via: string }[];
  verses: RankedItem[];
  concepts: RankedItem[];
  emotions: RankedItem[];
  dilemmas: RankedItem[];
  chains: Chain[];
  dialogues: Dialogue[];
  subgraph: { nodes: string[]; edges: string[] };
  searchMode: string;
  timings: { search: number; traverse: number; total: number };
  context: string;
}

const HUB_DEGREE = 60;
const SPEAKER_NAME: Record<string, string> = { tiruvalluvar: "Tiruvalluvar", he: "the man in love", she: "the woman in love", friend: "her friend" };

/** Separates a relation from its curated explanation in a retrieval reason ("heals Krodha (Anger): …"). */
export const WHY_SEP = ": ";
/** The most explanatory reason: one that carries a curated "why", else the first. */
export const bestReason = (reasons: string[]) => reasons.find((x) => x.includes(WHY_SEP)) || reasons[0];

function reasonFor(g: GitaGraphs, type: RelationType, node: string, other: string, outgoing: boolean, props?: Record<string, unknown>) {
  const meta = RELATIONS[type];
  const otherLabel = describeNode(g.nodeById.get(other)).replace(/ \(\)$/, "");
  const base = `${linkWords(props, outgoing, outgoing ? meta.verb : meta.inverse)} ${otherLabel}`;
  const why = typeof props?.why === "string" ? props.why : undefined;
  return why ? `${base}${WHY_SEP}${why}` : base;
}

/**
 * Hybrid GraphRAG retrieval.
 *   1. Seeds from deterministic semantic routing (lexicons, explicit refs) + Orama BM25 / hybrid vector search.
 *   2. 2-hop breadth-first expansion over the graph (hubs are reached but not expanded), scoring each node by
 *      the strongest relation that reached it, damped by depth and degree.
 *   3. Rank verses / concepts / states / dilemmas, attach causal chains & dialogues, and cut the induced subgraph
 *      that the UI highlights on the 2D/3D canvas.
 */
export async function retrieve(
  ctx: RagContext,
  query: string,
  opts: { vector?: number[] | null; extraSeeds?: { id: string; score: number; via: string }[]; limitVerses?: number; careful?: boolean } = {},
): Promise<Retrieval> {
  const t0 = performance.now();
  const g = ctx.graphs;
  const has = (id: string) => g.graph.hasNode(id);
  const route = routeText(query, ctx.data.nodes, has);

  const seeds = new Map<string, { id: string; score: number; via: string }>();
  const addSeed = (id: string, score: number, via: string) => {
    if (!has(id) || score <= 0) return;
    const s = seeds.get(id);
    if (s) s.score += score * 0.7;
    else seeds.set(id, { id, score, via });
  };
  const norm = <T extends { score: number }>(arr: T[]) => {
    const max = Math.max(1, ...arr.map((r) => r.score));
    return arr.map((r) => ({ ...r, s: r.score / max }));
  };

  route.verses.forEach((id) => addSeed(id, 3, "referenced directly"));
  route.chapters.forEach((c) => addSeed(`CH_${c}`, 1.2, "chapter referenced"));
  norm(route.emotions).forEach((r) => addSeed(r.id, 1.6 * r.s + 0.4, `you mentioned “${r.cues[0]}”`));
  norm(route.dilemmas).forEach((r) => addSeed(r.id, 1.6 * r.s + 0.4, `situation cue “${r.cues[0]}”`));
  norm(route.concepts).forEach((r) => addSeed(r.id, 1.3 * r.s + 0.3, `concept cue “${r.cues[0]}”`));
  route.characters.forEach((r) => addSeed(r.id, 0.4, `names ${r.cues[0]}`));
  opts.extraSeeds?.forEach((s) => addSeed(s.id, s.score, s.via));

  let searchMode = "graph-only";
  let searchMs = 0;
  if (ctx.index) {
    const { hits, mode, ms } = await searchIndex(ctx.index, query, { limit: 14, vector: opts.vector });
    searchMode = mode;
    searchMs = ms;
    hits.forEach((h, rank) => addSeed(h.id, (h.kind === "verse" ? 1.1 : 0.85) / (1 + rank * 0.3), mode === "hybrid" ? "semantic + BM25 match" : mode === "devanagari" ? "Tamil text match" : "BM25 text match"));
  }

  // ── Step 2 · 2-hop traversal ────────────────────────────────────────────────────────────────
  const t1 = performance.now();
  const scores = new Map<string, { score: number; reasons: string[] }>();
  const credit = (id: string, s: number, reason: string) => {
    const r = scores.get(id) || { score: 0, reasons: [] };
    r.score += s;
    if (r.reasons.length < 4 && !r.reasons.includes(reason)) r.reasons.push(reason);
    scores.set(id, r);
  };

  // Personal thoughts are walls: they never shape public retrieval, and their text (via a reason such as
  // "connects to <thought>") can never end up in a context that is sent to a language model.
  const personal = (id: string) => g.nodeById.get(id)?.type === "PersonalThought";
  for (const seed of seeds.values()) {
    if (personal(seed.id)) continue;
    credit(seed.id, seed.score, seed.via);
    const depthOf = new Map<string, number>();
    bfsFromNode(g.path, seed.id, (node, _attr, depth) => {
      if (depth > 0 && personal(node)) return true;
      depthOf.set(node, depth);
      if (depth >= 2) return true;
      if (depth >= 1 && g.path.degree(node) > HUB_DEGREE) return true;
      return false;
    });
    for (const [node, d] of depthOf) {
      if (d === 0) continue;
      let best = 0;
      let bestType: RelationType | null = null;
      let bestOther = "";
      let bestOutgoing = true;
      let bestProps: Record<string, unknown> | undefined;
      g.graph.forEachEdge(node, (_key, attr, source, target) => {
        const other = source === node ? target : source;
        if (depthOf.get(other) !== d - 1) return;
        const w = RELATIONS[attr.type].rag;
        if (w > best) {
          best = w;
          bestType = attr.type;
          bestOther = other;
          bestOutgoing = source === node;
          bestProps = attr.props;
        }
      });
      if (!bestType) continue;
      const damp = 1 + Math.log10(1 + g.path.degree(node)) * 0.35;
      credit(node, (seed.score * best * (d === 1 ? 0.6 : 0.22)) / damp, reasonFor(g, bestType, node, bestOther, bestOutgoing, d === 1 ? bestProps : bestProps && { from: bestProps.from }));
    }
  }
  const traverseMs = performance.now() - t1;

  // Someone may be in trouble here, so nothing goes out that a walk or Reflect would hold back. Only a question plainly
  // about the text can meet a sensitive couplet, which then carries its note: distress often reads as a general question.
  const concern = concernIn(query);
  const intent = askIntent(query);
  const situations = route.dilemmas.map((r) => r.id);
  const careful = opts.careful || concern !== null || intent !== "study" || situations.length > 0;
  const offerable = (id: string) => !careful || (safeFor(g, id) && situations.every((s) => safeFor(g, id, s)));
  const walk = intent !== "study" && situations.length ? walkFrom(g, situations[0]) ?? undefined : undefined;

  const ranked = (type: GraphNode["type"], n: number) =>
    [...scores.entries()]
      .filter(([id]) => g.nodeById.get(id)?.type === type && (type !== "Verse" || offerable(id)))
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, n)
      .map(([id, r]) => ({ id, score: Number(r.score.toFixed(3)), reasons: r.reasons }));

  let verses = ranked("Verse", opts.limitVerses ?? 7);
  if (walk) {
    // A walk's couplets come first, and a situation that takes only its own ways takes nothing the traversal found.
    const fromWalk = coupletsOf(walk).map((id) => ({ id, score: 50, reasons: [`speaks to ${walk.situation.label}`] }));
    const others = takesOnlyItsOwn(g, walk.situation.id) ? [] : verses.filter((v) => !fromWalk.some((w) => w.id === v.id));
    verses = [...fromWalk, ...others].slice(0, Math.max(opts.limitVerses ?? 7, fromWalk.length));
  }
  for (const id of route.verses.slice().reverse()) {
    if (!offerable(id)) continue;
    if (!verses.some((v) => v.id === id)) verses = [{ id, score: 99, reasons: ["referenced directly"] }, ...verses].slice(0, Math.max(opts.limitVerses ?? 7, route.verses.length));
  }
  // Both sides of a tension, so a model can cite the couplet that pulls the other way.
  const tensions = tensionsTouching(g, verses.map((v) => v.id)).filter((t) => offerable(t.a) && offerable(t.b));
  for (const t of tensions) {
    for (const id of [t.a, t.b]) if (!verses.some((v) => v.id === id)) verses.push({ id, score: 0, reasons: [`in tension${WHY_SEP}${t.reason}`] });
  }
  const concepts = ranked("SanskritConcept", 4);
  const emotions = ranked("Emotion", 4);
  const dilemmas = ranked("LifeDilemma", 3);

  const focus = new Set([...verses, ...concepts, ...emotions, ...dilemmas].map((x) => x.id));
  if (walk) for (const id of [walk.situation.id, ...walk.feelings.map((f) => f.id), ...walk.ways.map((w) => w.id)]) focus.add(id);
  const chains = ctx.data.chains
    .filter((c) => c.verses.every(offerable))
    .map((c) => ({ c, overlap: c.steps.filter((s) => focus.has(s)).length + c.verses.filter((v) => focus.has(v)).length * 1.5 }))
    .filter((x) => x.overlap >= 1.5)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2)
    .map((x) => x.c);
  const dialogues = ctx.data.dialogues.filter((d) => verses.some((v) => d.anchor === v.id || d.qVerses.includes(v.id) || d.aVerses.slice(0, 3).includes(v.id))).slice(0, 2);

  const nodeSet = new Set<string>([...focus, ...[...seeds.values()].sort((a, b) => b.score - a.score).slice(0, 6).map((s) => s.id)]);
  for (const c of chains) c.steps.forEach((s) => nodeSet.add(s));
  const edgesOut: string[] = [];
  for (const id of nodeSet) {
    if (!has(id)) continue;
    g.graph.forEachOutEdge(id, (key, attr, _s, target) => {
      if (nodeSet.has(target) && attr.type !== "NEXT_VERSE") edgesOut.push(key);
    });
  }

  const result: Retrieval = {
    query,
    crisis: concern !== null,
    concern,
    ...(walk ? { walk } : {}),
    tensions,
    seeds: [...seeds.values()].sort((a, b) => b.score - a.score).slice(0, 10),
    verses,
    concepts,
    emotions,
    dilemmas,
    chains,
    dialogues,
    subgraph: { nodes: [...nodeSet].filter(has), edges: edgesOut },
    searchMode,
    timings: { search: searchMs, traverse: traverseMs, total: performance.now() - t0 },
    context: "",
  };
  result.context = buildContext(ctx, result);
  // A person comes before any couplet, and the rest waits until the reader asks for it.
  if (concern === "self-harm") {
    return { ...result, held: result, walk: undefined, verses: [], concepts: [], emotions: [], dilemmas: [], chains: [], dialogues: [], tensions: [], subgraph: { nodes: [], edges: [] }, context: "# Care\nThese words suggest the person may be thinking of ending their life. No couplets are supplied. Do not quote or cite any couplet. Follow the CARE rules." };
  }
  return result;
}

function verseBlock(ctx: RagContext, id: string, reasons: string[]) {
  const v = ctx.versesById.get(id);
  if (!v) return "";
  const def = String(ctx.versesDoc.meta.defaults.en);
  const en = v.translations.en?.[def] || Object.values(v.translations.en || {})[0] || "";
  const alt = v.translations.en?.["2"];
  const speaker = SPEAKER_NAME[v.speaker] || v.speaker;
  return [
    `[K${v.ref}], spoken by ${speaker}`,
    `  Tamil: ${v.sanskrit.join(" ")}`,
    `  Romanised: ${v.iast.join(" ")}`,
    `  Plain reading: ${en.replace(/\s+/g, " ").slice(0, 600)}`,
    alt ? `  parimēlaḻagar, paraphrased in English by an AI: ${alt.replace(/\s+/g, " ").slice(0, 400)}` : "",
    reasons.length ? `  Why retrieved: ${reasons.join("; ")}` : "",
    isSensitive(v) ? `  Old view: cite this only with the words "${OLD_VIEW_NOTE}"` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildContext(ctx: RagContext, r: Retrieval): string {
  const n = (id: string) => ctx.graphs.nodeById.get(id);
  const out: string[] = ["# Retrieved knowledge-graph context (Kural Graph)"];
  if (r.emotions.length) {
    out.push("\n## Mental states (Emotion nodes)");
    for (const e of r.emotions) {
      const x = n(e.id);
      if (x?.type === "Emotion") out.push(`[Emotion: ${x.label}] ${[x.sa, x.en].filter(Boolean).join(", ")}. ${x.desc}`);
    }
  }
  if (r.dilemmas.length) {
    out.push("\n## Life situations (LifeDilemma nodes)");
    for (const d of r.dilemmas) {
      const x = n(d.id);
      if (x?.type === "LifeDilemma") out.push(`[Dilemma: ${x.label}]`);
    }
  }
  if (r.concepts.length) {
    out.push("\n## Concepts (SanskritConcept nodes)");
    for (const c of r.concepts) {
      const x = n(c.id);
      if (x?.type === "SanskritConcept") out.push(`[Concept: ${x.label}] ${[x.sa, x.en].filter(Boolean).join(", ")}. ${x.desc}`);
    }
  }
  if (r.walk) {
    out.push(`\n## What the Kural offers for this situation: ${r.walk.situation.label}`);
    out.push(`It can feel like (${FEELINGS_NOTE}): ${r.walk.feelings.map((f) => `${f.label}: ${f.reason}`).join(" ")}`);
    for (const w of r.walk.ways) out.push(`${w.label}: ${w.reason} ${w.stated ? "Stated in the text." : "Inferred."} ${w.couplets.map((c) => `[K${c.slice(2)}]`).join(" ")}`);
    if (r.walk.silent) out.push(`What the Kural doesn't offer: ${r.walk.silent}`);
  }
  out.push("\n## Couplets");
  for (const v of r.verses) out.push(verseBlock(ctx, v.id, v.reasons));
  if (r.tensions.length) {
    out.push("\n## Where the couplets pull two ways");
    for (const t of r.tensions) out.push(`[K${t.a.slice(2)}] and [K${t.b.slice(2)}]: ${t.reason}`);
  }
  if (r.chains.length) {
    out.push("\n## Causal chains");
    for (const c of r.chains) out.push(`${c.title} (${c.verses.map((v) => `[K${v.slice(2)}]`).join(", ")}): ${c.summary} Steps: ${c.steps.map((s) => n(s)?.label || s).join(" → ")}.`);
  }
  if (r.dialogues.length) {
    out.push("\n## Dialogue structure");
    for (const d of r.dialogues) out.push(`Question at ${d.anchor.replace("K_", "Kural ")} (${d.asker}): “${d.question}” → answered in Kural ${d.a}. ${d.theme}`);
  }
  return out.join("\n");
}

/** Zero-key answer composed deterministically from the retrieved subgraph (works fully offline). */
export function composeOfflineAnswer(ctx: RagContext, r: Retrieval): string {
  const def = String(ctx.versesDoc.meta.defaults.en);
  return composeAnswer(
    {
      node: (id) => ctx.graphs.nodeById.get(id),
      couplet: (id) => {
        const v = ctx.versesById.get(id);
        return v && { ref: v.ref, text: (v.translations.en?.[def] || "").replace(/\s+/g, " "), roman: (v.iast[0] || "").replace(/[|]/g, "").trim() };
      },
    },
    r,
  );
}
