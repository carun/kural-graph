import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, ROOT } from './paths.ts';

export const READINGS = join(ROOT, 'data', 'readings');
export const EXPECTED = join(ROOT, 'annotation', 'readings', 'expected.json');

export type Tag = 'agrees' | 'adds' | 'differs';
export type Speaker = 'he' | 'she' | 'maid';

/** What happens to one existing link: a new quote, optionally a new reason, or removal. */
export interface LinkDecision {
  id: string;
  quote?: string;
  reason?: string;
  remove?: string;
}

export interface CoupletReading {
  n: number;
  /** The plain English reading, written from the Tamil. This is the site's main text. */
  plain: string;
  /** Parimelazhagar's reading, paraphrased into English. */
  pm: string;
  tag: Tag;
  note?: string;
  /** Part 3 only: who is speaking and why, from his context line. */
  context?: string;
  speaker?: Speaker;
  sensitive?: string;
  links: LinkDecision[];
}

export interface ChapterReading {
  chapter: number;
  title: string;
  /** His introduction to the chapter, in a sentence or two of English. */
  note?: string;
  couplets: CoupletReading[];
  ideaLinks: LinkDecision[];
}

export interface Expected {
  /** Kept link IDs for each couplet. */
  couplets: Record<string, string[]>;
  /** Idea-to-idea link IDs for each chapter, with the couplets each may quote. */
  ideaLinks: Record<string, { id: string; couplets: number[] }[]>;
  /** Couplets whose Tamil uses these words. */
  anbu: number[];
  kamam: number[];
}

export const chapterFile = (n: number): string => join(READINGS, 'chapters', `${String(n).padStart(3, '0')}.json`);

export function loadChapters(): ChapterReading[] {
  const dir = join(READINGS, 'chapters');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => readJson<ChapterReading>(join(dir, f)));
}

/** Words of Aiyar's period, or marks that show the text wasn't finished. */
const OLD_WORDS = /\b(?:thou|thee|thy|thine|hath|doth|dost|shalt|verily|behold|unto|whoso\w*|bouderie|\w{3,}eth)\b/i;
const NOT_OLD = /\b(?:teeth|beneath|death|breath|health|wealth|stealth|faith|sheath|wreath|underneath|bequeath|seventh|tenth|ninth|eighth|Elizabeth)\b/gi;
const K_LOVE = new Set([911, 1276]);

export function style(text: string, field: string, n: number): string[] {
  const out: string[] = [];
  if (OLD_WORDS.test(text.replace(NOT_OLD, ''))) out.push(`K${n} ${field}: old-fashioned word`);
  if (/Aiyar|Drew|Lazarus/.test(text)) out.push(`K${n} ${field}: mentions a translator`);
  if (/[—–]/.test(text)) out.push(`K${n} ${field}: use a full stop or comma, not a dash`);
  if (/['"]/.test(text)) out.push(`K${n} ${field}: use curly quotes and apostrophes`);
  if (/\s{2,}/.test(text) || text !== text.trim()) out.push(`K${n} ${field}: stray spaces`);
  return out;
}

export function chapterProblems(c: ChapterReading, expected: Expected): string[] {
  const out: string[] = [];
  const first = (c.chapter - 1) * 10 + 1;
  if (typeof c.title !== 'string' || c.title.length < 3 || c.title.length > 48) out.push('title must be 3 to 48 characters');
  if (typeof c.note !== 'string' || c.note === '') out.push('chapter needs his introduction as its note');
  else if (c.note.length > 260) out.push('chapter note is over 260 characters');
  const numbers = (c.couplets ?? []).map((k) => k.n).join(',');
  const want = Array.from({ length: 10 }, (_, i) => first + i).join(',');
  if (numbers !== want) out.push(`couplets must be ${want}, got ${numbers}`);

  const quoted = new Map<number, string>();
  for (const k of c.couplets ?? []) {
    quoted.set(k.n, k.plain);
    if (typeof k.plain !== 'string' || k.plain.length < 20 || k.plain.length > 200) out.push(`K${k.n} plain must be 20 to 200 characters`);
    else if (!/[.?!”]$/.test(k.plain)) out.push(`K${k.n} plain must end as a sentence`);
    if (typeof k.pm !== 'string' || k.pm.length < 30 || k.pm.length > 380) out.push(`K${k.n} pm must be 30 to 380 characters`);
    out.push(...style(k.plain ?? '', 'plain', k.n), ...style(k.pm ?? '', 'pm', k.n));
    if (k.note !== undefined) out.push(...style(k.note, 'note', k.n));
    if (!['agrees', 'adds', 'differs'].includes(k.tag)) out.push(`K${k.n} tag must be agrees, adds or differs`);
    if (k.tag === 'differs' && !k.note) out.push(`K${k.n} needs a note saying how his reading differs`);
    if (k.note !== undefined && k.note.length > 240) out.push(`K${k.n} note is over 240 characters`);

    const voiced = k.n >= 1081;
    if (voiced && !['he', 'she', 'maid'].includes(k.speaker ?? '')) out.push(`K${k.n} speaker must be he, she or maid`);
    if (voiced && (typeof k.context !== 'string' || k.context.length < 8 || k.context.length > 170)) out.push(`K${k.n} context must be 8 to 170 characters`);
    if (!voiced && (k.speaker !== undefined || k.context !== undefined)) out.push(`K${k.n} speaker and context belong to Part 3 only`);

    if (expected.anbu.includes(k.n)) {
      const word = K_LOVE.has(k.n) ? /\blove/i : /loving-kindness/i;
      if (!word.test(k.plain ?? '')) out.push(`K${k.n} plain: அன்பு must be ${K_LOVE.has(k.n) ? 'love here' : 'loving-kindness'}`);
    }
    if (expected.kamam.includes(k.n) && !/desire/i.test(k.plain ?? '')) out.push(`K${k.n} plain: காமம் must be desire`);

    const wanted = new Set(expected.couplets[k.n] ?? []);
    const seen = new Set<string>();
    for (const l of k.links ?? []) {
      if (!wanted.has(l.id)) out.push(`K${k.n} link ${l.id} is not one of this couplet's links`);
      if (seen.has(l.id)) out.push(`K${k.n} link ${l.id} appears twice`);
      seen.add(l.id);
      out.push(...decisionProblems(l, `K${k.n} link ${l.id}`, [k.plain ?? '']));
    }
    for (const id of wanted) if (!seen.has(id)) out.push(`K${k.n} is missing a decision for link ${id}`);
  }

  const ideas = new Map((expected.ideaLinks[c.chapter] ?? []).map((l) => [l.id, l.couplets]));
  const seen = new Set<string>();
  for (const l of c.ideaLinks ?? []) {
    const cited = ideas.get(l.id);
    if (cited === undefined) {
      out.push(`idea link ${l.id} does not belong to this chapter`);
      continue;
    }
    seen.add(l.id);
    out.push(...decisionProblems(l, `idea link ${l.id}`, cited.flatMap((n) => quoted.get(n) ?? [])));
  }
  for (const id of ideas.keys()) if (!seen.has(id)) out.push(`missing a decision for idea link ${id}`);
  return out;
}

function decisionProblems(l: LinkDecision, where: string, texts: string[]): string[] {
  const out: string[] = [];
  if (l.remove !== undefined) {
    if (l.remove.length < 10) out.push(`${where}: say why it goes`);
    if (l.quote !== undefined || l.reason !== undefined) out.push(`${where}: a removal has no quote or reason`);
    return out;
  }
  if (typeof l.quote !== 'string' || l.quote.length < 3) return [`${where}: needs a quote`];
  if (!texts.some((t) => t.includes(l.quote!))) out.push(`${where}: quote is not word for word in the plain reading: ${l.quote}`);
  if (l.reason !== undefined) {
    if (l.reason.length > 170) out.push(`${where}: reason is over 170 characters`);
    if (/Aiyar|bouderie|Bouderie/.test(l.reason)) out.push(`${where}: reason mentions Aiyar's words`);
  }
  return out;
}
