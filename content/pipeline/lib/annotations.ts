import { existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { EdgeType, IdeaType } from './graph.ts';
import { readJson, readText, ROOT } from './paths.ts';
import { loadChapters } from './readings.ts';
import type { VocabularyEntry } from './vocabulary.ts';

export const ANNOTATIONS = join(ROOT, 'data', 'annotations');

export type Basis = 'explicit' | 'inferred';

export interface CoupletEdge {
  type: EdgeType;
  target: string;
  basis: Basis;
  reason: string;
  quote: string;
}

export interface CoupletAnnotation {
  n: number;
  /** A modern paraphrase. It feeds search only and is never displayed. */
  gloss: string;
  keywords: string[];
  sensitive?: string;
  edges: CoupletEdge[];
}

export interface IdeaLink {
  type: EdgeType;
  source: string;
  target: string;
  basis: Basis;
  reason: string;
  quote: string;
  /** The couplets that state it. */
  couplets: number[];
}

export interface Proposal {
  label: string;
  type: IdeaType;
  why: string;
  couplets: number[];
}

export interface Shard {
  shard: string;
  chapters: number[];
  couplets: CoupletAnnotation[];
  ideaLinks: IdeaLink[];
  proposals: Proposal[];
}

export interface CrossLink {
  type: 'ECHOES' | 'QUALIFIES' | 'IN_TENSION_WITH';
  a: number;
  b: number;
  basis: Basis;
  reason: string;
  quoteA: string;
  quoteB: string;
}

export interface CrossLinkFile {
  shard: string;
  links: CrossLink[];
}

export interface ChainStep {
  idea: string;
  /** The couplet that takes this step on to the next. The last step has none. */
  couplet?: number;
  quote?: string;
}

export interface Chain {
  id: string;
  title: string;
  summary: string;
  steps: ChainStep[];
}

export interface Override {
  edge: string;
  action: 'remove' | 'retype';
  /** For a retype: what the couplet really does. The idea was right, the edge type wasn't. */
  to?: EdgeType;
  why: string;
}

const COUPLET_EDGE_TARGETS: Partial<Record<EdgeType, IdeaType[]>> = {
  COMMENDS: ['quality', 'theme'],
  CONDEMNS: ['quality', 'theme'],
  DEFINES: ['quality', 'theme'],
  ENUMERATES: ['quality', 'theme'],
  ADDRESSES: ['role'],
  GUIDES: ['situation'],
  USES_IMAGE: ['image'],
};
const IDEA_LINK_TYPES: EdgeType[] = ['LEADS_TO', 'REQUIRES', 'OVERCOMES', 'OPPOSES'];

/** These praise death over dishonour or poverty. Reflect must never offer them, whatever an annotator decides. */
export const MUST_BE_SENSITIVE = [967, 969, 1050];

const MAX_IDEA_EDGES = 4;
const MAX_REASON = 170;
const MAX_GLOSS = 170;
const MIN_QUOTE = 3;

/** Stable across reruns, so a human correction in overrides.json still finds its edge. */
export const edgeId = (source: string, type: string, target: string): string =>
  createHash('sha256').update(`${source}|${type}|${target}`).digest('hex').slice(0, 16);

export function loadShards(): Shard[] {
  if (!existsSync(ANNOTATIONS)) return [];
  return readdirSync(ANNOTATIONS)
    .filter((f) => /^(pilot|shard-\d+)\.json$/.test(f))
    .map((f) => readJson<Shard>(join(ANNOTATIONS, f)));
}

export function loadCrossLinks(): CrossLinkFile[] {
  if (!existsSync(ANNOTATIONS)) return [];
  return readdirSync(ANNOTATIONS)
    .filter((f) => f.startsWith('crosslinks') && f.endsWith('.json'))
    .map((f) => readJson<CrossLinkFile>(join(ANNOTATIONS, f)));
}

export function loadChains(): Chain[] {
  const path = join(ANNOTATIONS, 'chains.yaml');
  return existsSync(path) ? (parseYaml(readText(path)) as Chain[]) : [];
}

export function loadOverrides(): Override[] {
  const path = join(ANNOTATIONS, 'overrides.json');
  return existsSync(path) ? readJson<Override[]>(path) : [];
}

/** Link quotes come from the plain reading, which is the site's text. */
const plainReadings = (): Map<number, string> => new Map(loadChapters().flatMap((c) => c.couplets).map((k) => [k.n, k.plain]));

/** Removed links stay on file as a record, and they don't have to quote the current text. */
const removedLinks = (): Set<string> => new Set(loadOverrides().filter((o) => o.action === 'remove').map((o) => o.edge));

export function crossLinkProblems(file: CrossLinkFile): string[] {
  const problems: string[] = [];
  const plain = plainReadings();
  const removed = removedLinks();
  const text = (n: number) => plain.get(n) ?? '';
  const seen = new Set<string>();
  for (const l of file.links) {
    const at = `${l.type} ${l.a} ${l.b}`;
    const gone = removed.has(edgeId(`k${l.a}`, l.type, `k${l.b}`)) || removed.has(edgeId(`k${l.b}`, l.type, `k${l.a}`));
    if (!['ECHOES', 'QUALIFIES', 'IN_TENSION_WITH'].includes(l.type)) problems.push(`${at}: not a couplet link type`);
    if (l.a === l.b) problems.push(`${at}: links a couplet to itself`);
    if (!text(l.a) || !text(l.b)) problems.push(`${at}: not a couplet`);
    const key = `${l.type}|${Math.min(l.a, l.b)}|${Math.max(l.a, l.b)}`;
    if (seen.has(key)) problems.push(`${at}: duplicate`);
    seen.add(key);
    if (!l.reason?.trim() || l.reason.length > MAX_REASON) problems.push(`${at}: reason is missing or over ${MAX_REASON} characters`);
    if (l.basis !== 'explicit' && l.basis !== 'inferred') problems.push(`${at}: basis must be explicit or inferred`);
    if (gone) continue;
    if (!l.quoteA || !text(l.a).includes(l.quoteA)) problems.push(`${at}: quoteA is not verbatim in Kural ${l.a}`);
    if (!l.quoteB || !text(l.b).includes(l.quoteB)) problems.push(`${at}: quoteB is not verbatim in Kural ${l.b}`);
  }
  return problems;
}

export function chainProblems(chains: Chain[], vocabulary: VocabularyEntry[]): string[] {
  const problems: string[] = [];
  const plain = plainReadings();
  const ids = new Set(vocabulary.map((e) => e.id));
  const chainIds = new Set<string>();
  for (const chain of chains) {
    if (chainIds.has(chain.id)) problems.push(`${chain.id}: duplicate chain`);
    chainIds.add(chain.id);
    if (!chain.title?.trim() || !chain.summary?.trim()) problems.push(`${chain.id}: needs a title and summary`);
    if ((chain.steps?.length ?? 0) < 2) problems.push(`${chain.id}: needs at least two steps`);
    chain.steps?.forEach((step, i) => {
      if (!ids.has(step.idea)) problems.push(`${chain.id} step ${i + 1}: ${step.idea} is not in the vocabulary`);
      const last = i === chain.steps.length - 1;
      if (last) return;
      const text = plain.get(step.couplet ?? 0);
      if (text === undefined) problems.push(`${chain.id} step ${i + 1}: needs a couplet`);
      else if (!step.quote || !text.includes(step.quote)) problems.push(`${chain.id} step ${i + 1}: quote is not verbatim in Kural ${step.couplet}`);
    });
  }
  return problems;
}

export function shardProblems(shard: Shard, vocabulary: VocabularyEntry[]): string[] {
  const problems: string[] = [];
  const plain = plainReadings();
  const removed = removedLinks();
  const text = (n: number) => plain.get(n) ?? '';
  const ideas = new Map(vocabulary.map((e) => [e.id, e]));

  const expected = shard.chapters.flatMap((c) => Array.from({ length: 10 }, (_, i) => (c - 1) * 10 + i + 1));
  const present = new Set(shard.couplets.map((c) => c.n));
  for (const n of expected) if (!present.has(n)) problems.push(`Kural ${n} is missing`);
  for (const n of present) if (!expected.includes(n)) problems.push(`Kural ${n} is outside this shard's chapters`);
  if (present.size !== shard.couplets.length) problems.push('a couplet appears twice');

  const checkQuote = (at: string, quote: string, numbers: number[]) => {
    if ((quote?.trim().length ?? 0) < MIN_QUOTE) problems.push(`${at}: no quote`);
    else if (!numbers.some((n) => text(n).includes(quote))) problems.push(`${at}: "${quote}" is not verbatim in the plain reading`);
  };
  const checkReason = (at: string, reason: string, basis: string) => {
    if (!reason?.trim()) problems.push(`${at}: no reason`);
    else if (reason.length > MAX_REASON) problems.push(`${at}: reason is over ${MAX_REASON} characters`);
    if (basis !== 'explicit' && basis !== 'inferred') problems.push(`${at}: basis must be explicit or inferred`);
  };

  for (const c of shard.couplets) {
    const at = `Kural ${c.n}`;
    if (!c.gloss?.trim()) problems.push(`${at}: no gloss`);
    else if (c.gloss.length > MAX_GLOSS) problems.push(`${at}: gloss is over ${MAX_GLOSS} characters`);
    if ((c.keywords?.length ?? 0) < 2 || c.keywords.length > 6) problems.push(`${at}: needs 2 to 6 keywords`);
    for (const k of c.keywords ?? []) if (k !== k.toLowerCase()) problems.push(`${at}: keyword "${k}" must be lowercase`);

    if (MUST_BE_SENSITIVE.includes(c.n) && !c.sensitive) problems.push(`${at}: must be flagged sensitive`);

    const seen = new Set<string>();
    for (const e of c.edges ?? []) {
      const edgeAt = `${at} ${e.type} ${e.target}`;
      const allowed = COUPLET_EDGE_TARGETS[e.type];
      const idea = ideas.get(e.target);
      if (allowed === undefined) problems.push(`${edgeAt}: not a couplet edge type`);
      if (idea === undefined) problems.push(`${edgeAt}: target is not in the vocabulary`);
      else if (allowed !== undefined && !allowed.includes(idea.type)) problems.push(`${edgeAt}: ${e.type} cannot point at a ${idea.type}`);
      const key = `${e.type}|${e.target}`;
      if (seen.has(key)) problems.push(`${edgeAt}: duplicate edge`);
      seen.add(key);
      checkReason(edgeAt, e.reason, e.basis);
      if (!removed.has(edgeId(`k${c.n}`, e.type, e.target))) checkQuote(edgeAt, e.quote, [c.n]);
    }
    // A list is a list, so ENUMERATES can run past the cap: Kural 381 names six things.
    const counted = (c.edges ?? []).filter((e) => e.type !== 'ENUMERATES').length;
    if (counted > MAX_IDEA_EDGES) problems.push(`${at}: ${counted} edges is over the cap of ${MAX_IDEA_EDGES}`);
  }

  for (const link of shard.ideaLinks ?? []) {
    const at = `${link.type} ${link.source} -> ${link.target}`;
    if (!IDEA_LINK_TYPES.includes(link.type)) problems.push(`${at}: not an idea link type`);
    for (const id of [link.source, link.target]) if (!ideas.has(id)) problems.push(`${at}: ${id} is not in the vocabulary`);
    if (link.source === link.target) problems.push(`${at}: links an idea to itself`);
    if ((link.couplets?.length ?? 0) === 0) problems.push(`${at}: cites no couplets`);
    checkReason(at, link.reason, link.basis);
    if (!removed.has(edgeId(link.source, link.type, link.target))) checkQuote(at, link.quote, link.couplets ?? []);
  }

  return problems;
}
