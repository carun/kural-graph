import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { WikisourcePages } from './01-fetch.ts';
import { Checks } from './lib/check.ts';
import { CACHE, CLEAN, EVAL, readJson, readText, writeJson, writeText } from './lib/paths.ts';
import { fromRevisedIast, normaliseTamil, toRevisedIast } from './lib/tamilToIast.ts';

const TOTAL = 1330;
const FIXES = join(CLEAN, 'tamil-fixes.yaml');

/** Everything else in the dataset (mv, sp, mk, Translation, ...) must never leave the cache. */
const ALLOWED_FIELDS = ['Number', 'Line1', 'Line2', 'transliteration1', 'transliteration2'] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];
type Raw = Record<AllowedField, string | number> & Record<string, unknown>;

interface Lines {
  line1: string;
  line2: string;
}

export type Witnesses = Map<number, Lines>;

export interface Fix {
  n: number;
  line: 1 | 2;
  dataset: string;
  text: string;
  kind: 'corrupted' | 'reading' | 'keep' | 'metre';
  status: 'proposed' | 'approved';
  basis: string;
}

export interface TamilCouplet {
  n: number;
  tamil: [string, string];
  iast: [string, string];
  /** The dataset's ad hoc romanisation. Search index only, never displayed. */
  datasetRoman: [string, string];
}

/** Madurai's printed numbers are wrong in four places, so the order is what counts. */
const MADURAI_MISPRINTS: Record<number, number> = { 72: 71, 753: 752, 781: 7811, 1293: 2983 };

export function parseMadurai(html: string): Witnesses {
  const body = html
    .slice(html.indexOf('<h3'))
    .replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gis, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');

  const out: Witnesses = new Map();
  let pending: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!/[஀-௿]/.test(line)) continue;
    const numbered = /^(.*?)\s*(\d{1,4})$/.exec(line);
    if (numbered === null) {
      pending.push(line);
      continue;
    }
    const n = out.size + 1;
    const printed = Number(numbered[2]);
    if (printed !== n && MADURAI_MISPRINTS[n] !== printed) {
      throw new Error(`Madurai couplet ${n} is printed as ${printed}, which is not a known misprint`);
    }
    out.set(n, { line1: normaliseTamil(pending.join(' ')), line2: normaliseTamil(numbered[1]!) });
    pending = [];
  }
  return out;
}

/** Most pages use Pline. The last chapter's page uses float_right. */
const PLINE = /\{\{(?:[Pp]line|float_right)\|(\d+)(?:\|[^}]*)?\}\}/;

export function parseWikisource(pages: WikisourcePages): Witnesses {
  const out: Witnesses = new Map();
  for (const { text } of Object.values(pages)) {
    const lines = text
      .replace(/<noinclude>.*?<\/noinclude>/gs, '')
      .replace(/<\/?poem>/g, '')
      .replace(/﻿/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('{{center') && !l.startsWith('{{c|'));
    lines.forEach((line, i) => {
      const m = PLINE.exec(line);
      if (m === null) return;
      // Kural 72 is misprinted as a second 71.
      const printed = Number(m[1]);
      const n = out.has(printed) ? printed + 1 : printed;
      out.set(n, { line1: normaliseTamil(lines[i - 1] ?? ''), line2: normaliseTamil(line.replace(PLINE, '')) });
    });
  }
  return out;
}

export interface ParimelazhagarVerse {
  /** The traditional joined form. Its spelling differs from the other editions throughout. */
  joined: [string, string];
}

const VERSE_HEADING = /^=+\s*(?:<FONT[^>]*>\s*)?(?:திருக்)?குறள்\s*:?\s*(\d+)/;
const NOT_VERSE = /பதப்பிரிப்பு|தொடரமைப்பு|இதன்பொருள்|பரிமேலழகர்|உரை|அதிகார/;

/** Strips one verse line of its wiki markup, the colour template and its (NN) counter. */
const verseText = (raw: string): string =>
  normaliseTamil(
    raw
      .replace(/\|?\s*\{\{red\|.*$/, '')
      .replace(/'''\s*\(\s*\d*\s*\)\s*'''.*$/, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/'''/g, ' ')
      .replace(/^[;:\s]+/, '')
      .replace(/\(\s*\d*\s*\)/g, ' ')
      .replace(/\|/g, ' '),
  );

/** Headings and verses vary by chapter, and this edition is evidence only, so reading is tolerant. */
export function parseParimelazhagar(pages: WikisourcePages): Map<number, ParimelazhagarVerse> {
  const out = new Map<number, ParimelazhagarVerse>();
  for (const { text } of Object.values(pages)) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const heading = VERSE_HEADING.exec(line);
      if (heading === null) return;
      const verses: string[] = [];
      for (let j = i + 1; j < lines.length && verses.length < 2; j++) {
        const candidate = lines[j]!.trim();
        if (candidate.startsWith('=')) break;
        if (!/[\u0b80-\u0bff]/.test(candidate) || candidate.startsWith(':') || NOT_VERSE.test(candidate)) continue;
        verses.push(verseText(candidate));
      }
      if (verses.length === 2) out.set(Number(heading[1]), { joined: [verses[0]!, verses[1]!] });
    });
  }
  return out;
}

const letters = (s: string): string => s.normalize('NFC').replace(/[^஀-௿]/g, '');
const footCount = (s: string): number => s.replace(/[.,;:!?]/g, ' ').trim().split(/\s+/).length;

/**
 * Clusters Tamil does not allow. They come from encoding damage shared by the
 * editions, so a comparison between editions can't see them.
 */
const IMPOSSIBLE_CLUSTERS = /க்த|ற்ய|வ்ம|வ்ர|த்ர|க்ல|ழ்ய/;
/** A stray space before a pulli consonant, a pulli missing from னறு, a swapped ஓஒ, or ௌ typed as ெ + ள. */
const DAMAGED_SHAPE = /\s[க-ஹ]்|[க-ஹ]னறு|^ஒஓ|\sஒஓ|ெள(?![\u0bbe-\u0bcd])/;

type LineClass = 'madurai-outlier' | 'dataset-outlier' | 'wikisource-outlier' | 'all-differ';

function classify(d: string, m: string, w: string): LineClass | null {
  const [ld, lm, lw] = [letters(d), letters(m), letters(w)];
  if (ld === lm && lm === lw) return null;
  if (ld === lw) return 'madurai-outlier';
  if (lm === lw) return 'dataset-outlier';
  if (ld === lm) return 'wikisource-outlier';
  return 'all-differ';
}

interface Detail {
  section: {
    detail: {
      name: string;
      number: number;
      chapterGroup: {
        detail: {
          name: string;
          number: number;
          chapters: { detail: { name: string; number: number; start: number; end: number }[] };
        }[];
      };
    }[];
  };
}

const REVIEW_INTRO = `# Tamil text review

The base text is [tk120404/thirukkural](https://github.com/tk120404/thirukkural). It was checked against three
other sources, and with tests that don't depend on any edition:

- **Project Madurai.** The dataset evidently descends from this text and inherits its encoding damage.
- **Wikisource, திருக்குறள், மூலம்.** Proofread scans of a printed 1997 edition. It shares a few of the same
  odd errors, so it was probably seeded from the Madurai text. It is only partly independent.
- **Wikisource, பரிமேலழகர் உரை.** Typed separately, with word-by-word glosses. This is the strongest witness.
- **Rules of the language.** Impossible consonant clusters, damaged shapes, and the fixed 4+3 feet of a kural.

Decisions live in \`data/clean/tamil-fixes.yaml\`. To accept one, set its \`status\` to \`approved\`.
`;

const REVIEW_LIMITS = `## Alignment of Aiyar with the Tamil

Numbering alone doesn't prove the order matches inside a chapter, so each chapter's couplets were matched against
a reference English by meaning, using bge-m3 embeddings. 127 of 133 chapters paired exactly by number. The 13
couplets in question (chapters 16, 29, 50, 69, 72, 92) were then read against the Tamil, and the numbering was right
every time. Comparing Aiyar with the Tamil directly did not work: the model handles classical Tamil poorly.

## What this review can't promise

- An error shared by every copy, in a valid word, is only caught where a check compares it with Parimelazhagar's
  text, and these checks did not catch everything. K262 and K689 passed them and were found only when the readings
  were written from his commentary. A later scan of every word against his gloss found no others, but it can't
  separate a real variant from a slip in the Wikisource edition.
- The word check reads the inside of each word, so a wrong first or last letter can slip past it.
- Choosing between genuine readings is a scholarly judgement. Those two were decided by the reviewer.
`;

function reviewTable(fixes: Fix[], columns: 'change' | 'keep'): string {
  const head = columns === 'change' ? '| Kural | Dataset | Proposed | Why |\n|---|---|---|---|' : '| Kural | Kept text | Why |\n|---|---|---|';
  const rows = fixes.map((f) =>
    columns === 'change'
      ? `| ${f.n}.${f.line} | ${f.dataset} | ${f.text} | ${f.basis} |`
      : `| ${f.n}.${f.line} | ${f.dataset} | ${f.basis} |`,
  );
  return [head, ...rows].join('\n');
}

function writeReview(fixes: Fix[]): void {
  const kind = (k: Fix['kind']) => fixes.filter((f) => f.kind === k);
  const pending = fixes.filter((f) => f.status === 'proposed').length;
  writeText(
    join(EVAL, 'tamil-review.md'),
    [
      REVIEW_INTRO,
      `**${fixes.length} decisions, ${pending} still proposed.**\n`,
      `## Choices between readings (${kind('reading').length})\n\nDecided by the reviewer.\n\n${reviewTable(kind('reading'), 'change')}\n`,
      `## Repairs of damaged text (${kind('corrupted').length})\n\n${reviewTable(kind('corrupted'), 'change')}\n`,
      `## Dataset kept against a disagreeing witness (${kind('keep').length})\n\n${reviewTable(kind('keep'), 'keep')}\n`,
      `## Spacing only (${kind('metre').length})\n\n${reviewTable(kind('metre'), 'change')}\n`,
      REVIEW_LIMITS,
    ].join('\n'),
  );
}

export function run(allowProposed = process.argv.includes('--allow-proposed')): void {
  const checks = new Checks('parse Tamil');
  const raw = readJson<{ kural: Raw[] }>(join(CACHE, 'tamil-kural.json')).kural;
  const madurai = parseMadurai(readText(join(CACHE, 'madurai.html')));
  const wikisource = parseWikisource(readJson<WikisourcePages>(join(CACHE, 'wikisource-moolam.json')));
  checks.equal(raw.length, TOTAL, 'dataset couplets');
  checks.equal(madurai.size, TOTAL, 'Madurai couplets');
  checks.equal(wikisource.size, TOTAL, 'Wikisource couplets');
  const missing = Array.from({ length: TOTAL }, (_, i) => i + 1).filter((n) => !wikisource.has(n));
  if (missing.length > 0) console.log(`  Wikisource is missing: ${missing.join(', ')}`);

  const fixes: Fix[] = existsSync(FIXES) ? (parseYaml(readText(FIXES)) as Fix[]) : [];
  const fixFor = (n: number, line: number) => fixes.find((f) => f.n === n && f.line === line);

  const parimelazhagar = parseParimelazhagar(readJson<WikisourcePages>(join(CACHE, 'wikisource-parimelazhagar.json')));
  console.log(`  Parimelazhagar edition covers ${parimelazhagar.size} couplets`);

  const disagreements: {
    n: number;
    line: 1 | 2;
    class: LineClass;
    dataset: string;
    madurai: string;
    wikisource: string;
    parimelazhagar: string | null;
  }[] = [];
  const couplets: TamilCouplet[] = raw.map((r, i) => {
    const n = Number(r.Number);
    checks.equal(n, i + 1, 'dataset numbering');
    const final = ([1, 2] as const).map((line) => {
      const dataset = normaliseTamil(String(r[`Line${line}`]));
      const pick = (w: Lines | undefined) => (line === 1 ? w?.line1 : w?.line2) ?? '';
      const m = pick(madurai.get(n));
      const w = pick(wikisource.get(n));

      const lineClass = classify(dataset, m, w);
      if (lineClass !== null) {
        const p = parimelazhagar.get(n);
        disagreements.push({ n, line, class: lineClass, dataset, madurai: m, wikisource: w, parimelazhagar: p?.joined[line - 1] ?? null });
      }

      const fix = fixFor(n, line);
      // Madurai outliers need no entry: the dataset and the print edition agree.
      if (lineClass !== null && lineClass !== 'madurai-outlier') {
        checks.that(fix !== undefined, `Kural ${n} line ${line} (${lineClass}) has no entry in tamil-fixes.yaml`);
      }
      if (fix === undefined) return dataset;
      checks.equal(fix.dataset, dataset, `Kural ${n} line ${line} fix was written for different dataset text`);
      checks.that(allowProposed || fix.status === 'approved', `Kural ${n} line ${line} fix is still proposed`);
      return normaliseTamil(fix.text);
    }) as [string, string];

    return {
      n,
      tamil: final,
      iast: [toRevisedIast(final[0]), toRevisedIast(final[1])],
      datasetRoman: [String(r.transliteration1), String(r.transliteration2)],
    };
  });

  const metreOutliers: { n: number; feet: [number, number]; tamil: [string, string]; wikisource: [string, string]; wikisourceFeet: [number, number] }[] = [];
  for (const c of couplets) {
    for (const [i, line] of c.tamil.entries()) {
      const where = `Kural ${c.n} line ${i + 1}`;
      checks.that(!/\p{Cn}/u.test(line), `${where} has an unassigned code point`);
      checks.that(!/[ஜஷஸஹஶ]/.test(line), `${where} has a Grantha letter, which breaks the round trip`);
      checks.that(!IMPOSSIBLE_CLUSTERS.test(line), `${where} has a cluster Tamil does not allow: ${line}`);
      checks.that(!DAMAGED_SHAPE.test(line), `${where} has a damaged shape: ${line}`);
      checks.equal(fromRevisedIast(c.iast[i]!), line, `${where} IAST round trip`);
      checks.equal(c.iast[i], c.iast[i]!.toLowerCase(), `${where} is lowercase`);
    }
    const feet: [number, number] = [footCount(c.tamil[0]), footCount(c.tamil[1])];
    if (feet[0] !== 4 || feet[1] !== 3) {
      const w = wikisource.get(c.n);
      const wLines: [string, string] = [w?.line1 ?? '', w?.line2 ?? ''];
      metreOutliers.push({ n: c.n, feet, tamil: c.tamil, wikisource: wLines, wikisourceFeet: [footCount(wLines[0]), footCount(wLines[1])] });
    }
  }

  checks.equal(metreOutliers.length, 0, 'couplets off the 4+3 metre');

  const detail = readJson<Detail[]>(join(CACHE, 'tamil-detail.json'))[0]!;
  const named = (name: string) => ({ tamil: name, iast: toRevisedIast(name) });
  const chapters = detail.section.detail.flatMap((paal) =>
    paal.chapterGroup.detail.flatMap((iyal) =>
      iyal.chapters.detail.map((c) => {
        checks.equal(c.start, (c.number - 1) * 10 + 1, `chapter ${c.number} start`);
        return { n: c.number, ...named(c.name), paal: { n: paal.number, ...named(paal.name) }, iyal: { n: iyal.number, ...named(iyal.name) } };
      }),
    ),
  );
  checks.equal(chapters.length, 133, 'Tamil chapters');

  const byClass = Object.groupBy(disagreements, (d) => d.class);
  const summary = Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v?.length ?? 0]));
  writeJson(join(EVAL, 'tamil-witnesses.json'), { summary, disagreements, metreOutliers });
  console.log(`  ${disagreements.length} lines disagree: ${JSON.stringify(summary)}; ${metreOutliers.length} couplets off the 4+3 metre`);
  checks.finish();

  writeJson(join(CLEAN, 'tamil.json'), { couplets, chapters });
  writeReview(fixes);
}

if (import.meta.main) run();
