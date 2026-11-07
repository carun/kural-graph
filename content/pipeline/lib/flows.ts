import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ANNOTATIONS } from './annotations.ts';
import { readJson } from './paths.ts';
import { loadChapters, style } from './readings.ts';
import type { VocabularyEntry } from './vocabulary.ts';

/**
 * The walks through the book: from a situation, to what it feels like, to what the Kural sets
 * against that, to the couplets that say so. Also the book's own order, and threads through it.
 */
type Basis = 'explicit' | 'inferred';

export interface CoupletClaim {
  n: number;
  basis: Basis;
  reason: string;
  quote: string;
}

export interface FeelingFlow {
  feeling: string;
  /** Couplets that show this feeling or its cost. */
  portrays: CoupletClaim[];
  /** Couplets that say what to do with it. */
  answers: CoupletClaim[];
}

export interface Antidote {
  feeling: string;
  idea: string;
  basis: Basis;
  couplets: number[];
  reason: string;
  quote: string;
}

export interface Evokes {
  feeling: string;
  reason: string;
}

export interface Resolve {
  idea: string;
  basis: Basis;
  couplets: number[];
  reason: string;
  quote: string;
}

export interface SituationFlow {
  situation: string;
  evokes: Evokes[];
  resolves: Resolve[];
  /** What the Kural does say, where it offers no way through. */
  silent?: string;
  /** Show only `resolves`. A feeling's general answers would be wrong for someone in this situation. */
  direct?: boolean;
  /** Couplets linked to this situation that are true of it, but wrong to offer someone living through it. */
  leaveOut?: number[];
}

export interface ChapterFlow {
  chapter: number;
  after: number;
  reason: string;
}

export interface ThreadStep {
  n: number;
  quote: string;
  why: string;
}

export interface Thread {
  id: string;
  title: string;
  summary: string;
  steps: ThreadStep[];
}

export interface Flows {
  feelings: FeelingFlow[];
  antidotes: Antidote[];
  situations: SituationFlow[];
  chapters: ChapterFlow[];
  threads: Thread[];
  /** Which files exist. A file on disk must be complete; one still to come is skipped. */
  present: { feelings: boolean; situations: boolean; book: boolean };
}

const FEELINGS = join(ANNOTATIONS, 'flows-feelings.json');
const SITUATIONS = join(ANNOTATIONS, 'flows-situations.json');
const BOOK = join(ANNOTATIONS, 'flows-book.json');

export function loadFlows(): Flows {
  const present = { feelings: existsSync(FEELINGS), situations: existsSync(SITUATIONS), book: existsSync(BOOK) };
  const f = present.feelings ? readJson<Pick<Flows, 'feelings' | 'antidotes'>>(FEELINGS) : { feelings: [], antidotes: [] };
  const s = present.situations ? readJson<Pick<Flows, 'situations'>>(SITUATIONS) : { situations: [] };
  const b = present.book ? readJson<Pick<Flows, 'chapters' | 'threads'>>(BOOK) : { chapters: [], threads: [] };
  return { ...f, ...s, ...b, present };
}

const MAX_REASON = 170;
const MAX_SILENT = 240;
const MAX_SUMMARY = 200;
const MAX_EVOKES = 3;
const MAX_RESOLVES = 3;
const MIN_QUOTE = 3;
const THREAD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function flowProblems(flows: Flows, vocabulary: VocabularyEntry[]): string[] {
  const problems: string[] = [];
  const couplets = new Map(loadChapters().flatMap((c) => c.couplets).map((k) => [k.n, k]));
  const ideas = new Map(vocabulary.map((v) => [v.id, v]));
  const feelings = vocabulary.filter((v) => v.feeling === true);
  const isFeeling = (id: string) => ideas.get(id)?.feeling === true;

  const reason = (text: string | undefined, at: string, n = 0) => {
    if (!text?.trim()) return problems.push(`${at}: needs a reason`);
    if (text.length > MAX_REASON) problems.push(`${at}: reason is over ${MAX_REASON} characters`);
    if (/^(this|the) (couplet|verse|kural)\b/i.test(text)) problems.push(`${at}: don't start with "This couplet"`);
    problems.push(...style(text, at, n));
    return 0;
  };
  const quoted = (quote: string | undefined, cited: number[], at: string) => {
    if (!quote || quote.trim().split(/\s+/).length < MIN_QUOTE) return problems.push(`${at}: needs a quote of at least ${MIN_QUOTE} words`);
    if (!cited.some((n) => couplets.get(n)?.plain.includes(quote))) problems.push(`${at}: quote is not word for word in a cited couplet`);
    return 0;
  };
  const known = (n: number, at: string): boolean => {
    if (couplets.has(n)) return true;
    problems.push(`${at}: K${n} does not exist`);
    return false;
  };
  /** Someone in distress is walked to these, so a couplet that could hurt them can never be one. */
  const safe = (cited: number[], at: string) => {
    for (const n of cited) if (couplets.get(n)?.sensitive) problems.push(`${at}: K${n} is sensitive and can't be offered as an answer`);
  };
  const basis = (b: string | undefined, at: string) => {
    if (b !== 'explicit' && b !== 'inferred') problems.push(`${at}: basis must be explicit or inferred`);
  };

  if (flows.present.feelings) {
    const covered = new Set(flows.feelings.map((f) => f.feeling));
    for (const f of feelings) if (!covered.has(f.id)) problems.push(`${f.id}: marked as a feeling but has no entry`);
    for (const f of flows.feelings) {
      if (!isFeeling(f.feeling)) problems.push(`${f.feeling}: not marked as a feeling in the vocabulary`);
      if (f.portrays.length + f.answers.length === 0) problems.push(`${f.feeling}: needs at least one couplet`);
      for (const [kind, claims] of [['portrays', f.portrays], ['answers', f.answers]] as const) {
        const seen = new Set<number>();
        for (const c of claims) {
          const at = `${f.feeling} ${kind} K${c.n}`;
          if (seen.has(c.n)) problems.push(`${at}: listed twice`);
          seen.add(c.n);
          if (!known(c.n, at)) continue;
          basis(c.basis, at);
          reason(c.reason, at, c.n);
          quoted(c.quote, [c.n], at);
          if (kind === 'answers') safe([c.n], at);
        }
      }
    }
    for (const a of flows.antidotes) {
      const at = `antidote ${a.idea} to ${a.feeling}`;
      if (!isFeeling(a.feeling)) problems.push(`${at}: ${a.feeling} is not a feeling`);
      const idea = ideas.get(a.idea);
      if (idea === undefined) problems.push(`${at}: unknown idea`);
      else if (idea.polarity === 'vice' || idea.type === 'situation') problems.push(`${at}: an antidote can't be a vice or a situation`);
      if ((a.couplets?.length ?? 0) === 0) problems.push(`${at}: must cite a couplet`);
      a.couplets?.forEach((n) => known(n, at));
      basis(a.basis, at);
      reason(a.reason, at, a.couplets?.[0] ?? 0);
      quoted(a.quote, a.couplets ?? [], at);
      safe(a.couplets ?? [], at);
    }
  }

  if (flows.present.situations) {
    const covered = new Set(flows.situations.map((s) => s.situation));
    for (const v of vocabulary) if (v.type === 'situation' && !covered.has(v.id)) problems.push(`${v.id}: has no entry`);
    for (const s of flows.situations) {
      if (ideas.get(s.situation)?.type !== 'situation') problems.push(`${s.situation}: not a situation`);
      if (s.evokes.length === 0 || s.evokes.length > MAX_EVOKES) problems.push(`${s.situation}: needs 1 to ${MAX_EVOKES} feelings`);
      if (s.resolves.length > MAX_RESOLVES) problems.push(`${s.situation}: at most ${MAX_RESOLVES} ways through`);
      if (s.resolves.length === 0 && !s.silent?.trim()) problems.push(`${s.situation}: with no way through, say what the Kural does say in silent`);
      if (s.direct !== undefined && typeof s.direct !== 'boolean') problems.push(`${s.situation}: direct must be true or left out`);
      s.leaveOut?.forEach((n) => known(n, `${s.situation} leaveOut`));
      if (s.silent !== undefined) {
        if (s.silent.length > MAX_SILENT) problems.push(`${s.situation}: silent is over ${MAX_SILENT} characters`);
        problems.push(...style(s.silent, `${s.situation} silent`, 0));
      }
      for (const e of s.evokes) {
        if (!isFeeling(e.feeling)) problems.push(`${s.situation}: ${e.feeling} is not a feeling`);
        reason(e.reason, `${s.situation} evokes ${e.feeling}`);
      }
      for (const r of s.resolves) {
        const at = `${s.situation} resolves ${r.idea}`;
        const idea = ideas.get(r.idea);
        if (idea === undefined) problems.push(`${at}: unknown idea`);
        else if (idea.polarity === 'vice' || idea.type === 'situation' || idea.type === 'image') problems.push(`${at}: can't be a vice, a situation or an image`);
        if ((r.couplets?.length ?? 0) === 0) problems.push(`${at}: must cite a couplet`);
        r.couplets?.forEach((n) => known(n, at));
        basis(r.basis, at);
        reason(r.reason, at, r.couplets?.[0] ?? 0);
        quoted(r.quote, r.couplets ?? [], at);
        safe(r.couplets ?? [], at);
      }
    }
  }

  if (flows.present.book) {
    const seen = new Set<number>();
    for (const c of flows.chapters) {
      const at = `chapter ${c.chapter}`;
      if (seen.has(c.chapter)) problems.push(`${at}: listed twice`);
      seen.add(c.chapter);
      if (!(c.chapter >= 2 && c.chapter <= 133)) problems.push(`${at}: out of range`);
      if (!(c.after >= 1 && c.after < c.chapter)) problems.push(`${at}: must follow an earlier chapter`);
      reason(c.reason, at);
    }
    const ids = new Set<string>();
    for (const t of flows.threads) {
      if (!THREAD_ID.test(t.id) || ids.has(t.id)) problems.push(`thread ${t.id}: bad or repeated id`);
      ids.add(t.id);
      if (!t.title?.trim() || !t.summary?.trim()) problems.push(`thread ${t.id}: needs a title and summary`);
      if ((t.summary?.length ?? 0) > MAX_SUMMARY) problems.push(`thread ${t.id}: summary is over ${MAX_SUMMARY} characters`);
      if (t.steps.length < 4 || t.steps.length > 8) problems.push(`thread ${t.id}: needs 4 to 8 steps`);
      if (new Set(t.steps.map((s) => s.n)).size !== t.steps.length) problems.push(`thread ${t.id}: repeats a couplet`);
      for (const s of t.steps) {
        const at = `thread ${t.id} K${s.n}`;
        if (!known(s.n, at)) continue;
        reason(s.why, at, s.n);
        quoted(s.quote, [s.n], at);
        safe([s.n], at);
      }
    }
  }
  return problems;
}
