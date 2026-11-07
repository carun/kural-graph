import {
  chainProblems, crossLinkProblems, edgeId, loadChains, loadCrossLinks, loadOverrides, loadShards, shardProblems,
  type Chain, type Shard,
} from './lib/annotations.ts';
import { Checks } from './lib/check.ts';
import { flowProblems, loadFlows, type Flows } from './lib/flows.ts';
import { chapterId, coupletId, type EdgeDetail, type EdgeType, type Graph, type GraphEdge, type GraphNode } from './lib/graph.ts';
import { loadVocabulary, vocabularyProblems, type VocabularyEntry } from './lib/vocabulary.ts';

export interface Merged {
  graph: Graph;
  ideas: VocabularyEntry[];
  chains: Chain[];
  shards: Shard[];
  flows: Flows;
}

const TOTAL = 1330;
const FIRST_VOICED = 1081;
const IDEA_LINKS = new Set<string>(['LEADS_TO', 'REQUIRES', 'OVERCOMES', 'OPPOSES']);

/** Adds the annotated ideas and links to the structural graph. Any failed check stops the build. */
export function mergeAnnotations(base: Graph): Merged | null {
  const shards = loadShards();
  if (shards.length === 0) return null;

  const checks = new Checks('merge');
  const vocabulary = loadVocabulary();
  const { errors } = vocabularyProblems(vocabulary);
  errors.forEach((e) => checks.that(false, e));

  for (const shard of shards) for (const p of shardProblems(shard, vocabulary)) checks.that(false, `${shard.shard}: ${p}`);
  const crossLinks = loadCrossLinks();
  for (const file of crossLinks) for (const p of crossLinkProblems(file)) checks.that(false, `${file.shard}: ${p}`);
  const chains = loadChains();
  for (const p of chainProblems(chains, vocabulary)) checks.that(false, p);
  const flows = loadFlows();
  for (const p of flowProblems(flows, vocabulary)) checks.that(false, `flows: ${p}`);

  const covered = new Set(shards.flatMap((s) => s.couplets.map((c) => c.n)));
  checks.equal(covered.size, TOTAL, 'annotated couplets');

  const overrides = loadOverrides();
  const removed = new Set(overrides.filter((o) => o.action === 'remove').map((o) => o.edge));
  const retyped = new Map(overrides.filter((o) => o.action === 'retype').map((o) => [o.edge, o.to!]));
  const applied = new Set<string>();
  const kept = (source: string, type: string, target: string) => {
    const id = edgeId(source, type, target);
    if (!removed.has(id)) return true;
    applied.add(id);
    return false;
  };

  const polarity = new Map(vocabulary.map((v) => [v.id, v.polarity]));
  const edges: GraphEdge[] = [];
  const weights = new Map<string, Record<number, number>>();
  const touch = (idea: string, chapter: number) => {
    const w = weights.get(idea) ?? {};
    w[chapter] = (w[chapter] ?? 0) + 1;
    weights.set(idea, w);
  };

  const ideaLinks = new Map<string, number[]>();
  for (const shard of shards) {
    for (const c of shard.couplets) {
      const chapter = Math.ceil(c.n / 10);
      const source = coupletId(c.n);
      for (const e of c.edges) {
        if (!kept(source, e.type, e.target)) continue;
        const id = edgeId(source, e.type, e.target);
        const type = retyped.get(id) ?? e.type;
        if (retyped.has(id)) applied.add(id);
        // Part 3 is spoken by lovers. Someone pining doesn't define pining: they voice it.
        const voiced = type === 'DEFINES' && c.n >= FIRST_VOICED && polarity.get(e.target) === 'state';
        edges.push({ source, target: e.target, type: voiced ? 'VOICES' : type, detail: { basis: e.basis, reason: e.reason, quote: e.quote } });
        touch(e.target, chapter);
      }
    }
    for (const l of shard.ideaLinks ?? []) {
      if (!kept(l.source, l.type, l.target)) continue;
      // Two shards can state the same link from different couplets: one link, both citations.
      const id = edgeId(l.source, l.type, l.target);
      const same = ideaLinks.get(id);
      if (same !== undefined) {
        same.push(...l.couplets.filter((n) => !same.includes(n)));
        continue;
      }
      const couplets = [...l.couplets];
      ideaLinks.set(id, couplets);
      edges.push({ source: l.source, target: l.target, type: l.type, detail: { basis: l.basis, reason: l.reason, quote: l.quote, couplets } });
    }
  }

  // Agents worked separately by idea, so several can reach the same pair. Keep the
  // first, and count how many did: independent agreement is the best signal there is.
  const pairKey = (l: { type: string; a: number; b: number }) => `${l.type}|${Math.min(l.a, l.b)}|${Math.max(l.a, l.b)}`;
  const agreement = new Map<string, number>();
  for (const file of crossLinks) for (const l of file.links) agreement.set(pairKey(l), (agreement.get(pairKey(l)) ?? 0) + 1);

  const pairs = new Set<string>();
  for (const file of crossLinks) {
    for (const l of file.links) {
      const [source, target] = [coupletId(l.a), coupletId(l.b)];
      const pair = pairKey(l);
      if (pairs.has(pair)) continue;
      // Marked seen first, or a removed link returns if another agent found it the other way round.
      pairs.add(pair);
      if (!kept(source, l.type, target)) continue;
      edges.push({ source, target, type: l.type as EdgeType, detail: { basis: l.basis, reason: l.reason, quote: `${l.quoteA} … ${l.quoteB}`, couplets: [l.a, l.b], agreement: agreement.get(pair) } });
    }
  }

  const addFlow = (source: string, target: string, type: EdgeType, detail: EdgeDetail) => {
    if (kept(source, type, target)) edges.push({ source, target, type, detail });
  };
  for (const f of flows.feelings) {
    for (const [type, claims] of [['PORTRAYS', f.portrays], ['ANSWERS', f.answers]] as const) {
      for (const { n, basis, reason, quote } of claims) {
        addFlow(coupletId(n), f.feeling, type, { basis, reason, quote });
        touch(f.feeling, Math.ceil(n / 10));
      }
    }
  }
  for (const { idea, feeling, basis, reason, quote, couplets } of flows.antidotes) addFlow(idea, feeling, 'ANTIDOTE_TO', { basis, reason, quote, couplets });
  for (const s of flows.situations) {
    for (const { feeling, reason } of s.evokes) addFlow(s.situation, feeling, 'EVOKES', { basis: 'editorial', reason, quote: '' });
    for (const { idea, basis, reason, quote, couplets } of s.resolves) addFlow(s.situation, idea, 'RESOLVED_THROUGH', { basis, reason, quote, couplets });
  }
  for (const { chapter, after, reason } of flows.chapters) addFlow(chapterId(chapter), chapterId(after), 'FOLLOWS', { basis: 'explicit', reason, quote: '' });

  // An idea nothing points at would float on the map with no meaning.
  const used = vocabulary.filter((v) => weights.has(v.id) || edges.some((e) => e.source === v.id || e.target === v.id));
  const nodes: GraphNode[] = used.map((v) => ({ id: v.id, type: v.type, label: v.label, chapters: weights.get(v.id) ?? {} }));
  const ids = new Set(used.map((v) => v.id));
  const inTheText = (id: string) => /^(k|ch)\d+$/.test(id) || ids.has(id);
  const live = edges.filter((e) => inTheText(e.source) && inTheText(e.target));

  // A removal that matches nothing did nothing, which is how a mistyped ID hides.
  for (const id of [...removed, ...retyped.keys()]) checks.that(applied.has(id), `override ${id} matches no link`);

  const linked = new Set(
    live.filter((e) => IDEA_LINKS.has(e.type)).flatMap((e) => [`${e.source}|${e.target}`, `${e.target}|${e.source}`]),
  );
  for (const chain of chains) {
    chain.steps.slice(1).forEach((step, i) => {
      const from = chain.steps[i]!.idea;
      checks.that(linked.has(`${from}|${step.idea}`), `chain ${chain.id} steps from ${from} to ${step.idea}, but no link says so`);
    });
  }

  console.log(`  ${used.length}/${vocabulary.length} ideas in use; ${live.length} interpretive links; ${chains.length} chains; ${removed.size} removed by audit`);
  checks.finish();
  return { graph: { nodes: [...base.nodes, ...nodes], edges: [...base.edges, ...live], synthetic: false }, ideas: used, chains, shards, flows };
}

export { chapterId };
