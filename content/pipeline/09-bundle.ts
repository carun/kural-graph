import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { TamilCouplet } from './03-parse-tamil.ts';
import type { Merged } from './06-merge.ts';
import type { Positions } from './07-layout.ts';
import { Checks } from './lib/check.ts';
import type { Commentary } from './lib/commentary.ts';
import { EDGE_TYPES, partOfChapter, type Graph, type NodeType } from './lib/graph.ts';
import { CACHE, CLEAN, readJson, readText, ROOT, writeText } from './lib/paths.ts';
import { loadChapters } from './lib/readings.ts';
import { DIVISIONS, divisionOf } from './lib/structure.ts';
import { foldToAscii, toLetterForLetter, toRevisedIast } from './lib/tamilToIast.ts';

const PUBLIC = join(ROOT, 'public');
const DATA = join(PUBLIC, 'data');
/** Cloudflare refuses any single asset over this size. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const FIRST_LOAD_BUDGET_BYTES = 450 * 1024;
const NODE_TYPES: NodeType[] = ['part', 'division', 'chapter', 'couplet', 'voice', 'quality', 'theme', 'role', 'situation', 'image'];

interface TamilChapter {
  n: number;
  tamil: string;
  iast: string;
  paal: { n: number; tamil: string; iast: string };
  iyal: { n: number; tamil: string; iast: string };
}

const compact = (value: unknown): string => JSON.stringify(value);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** A quality's tone, by position. It colours the map, and 0 means it has none. */
const TONES = ['', 'virtue', 'vice', 'state'];
/** Definitions cite couplets by bare number, which a reader can't tell from a quantity. */
const namedCouplets = (text: string): string => text.replace(/(?<![\w-])(?<!(?:[Pp]arts?|[Cc]hapters?) )(?<!(?:[Cc]hapters?|[Pp]arts?) \d{1,3} (?:to|and) )\d{1,4}(?![\w-])/g, 'Kural $&');

/** How a link is held, by position: inferred, stated in the text, or ours rather than the Kural's. */
const BASIS = ['inferred', 'explicit', 'editorial'];

export function bundle(graph: Graph, positions: Positions, galaxy: Positions, merged: Merged | null, release = process.argv.includes('--release')): void {
  const checks = new Checks('bundle');
  const readings = loadChapters();
  const reading = new Map(readings.flatMap((c) => c.couplets.map((k) => [k.n, { ...k, chapter: c.chapter }] as const)));
  const tamil = readJson<{ couplets: TamilCouplet[]; chapters: TamilChapter[] }>(join(CLEAN, 'tamil.json'));
  mkdirSync(DATA, { recursive: true });

  checks.that(!release || !graph.synthetic, 'a release build must not contain placeholder ideas');

  const index = new Map(graph.nodes.map((n, i) => [n.id, i]));
  const polarity = new Map((merged?.ideas ?? []).map((v) => [v.id, v.polarity ?? '']));
  const graphFile = compact({
    synthetic: graph.synthetic,
    nodeTypes: NODE_TYPES,
    edgeTypes: EDGE_TYPES,
    nodes: graph.nodes.map((n) => {
      const [x, y, z] = positions[n.id]!;
      const [gx, gy, gz] = galaxy[n.id]!;
      return [n.id, NODE_TYPES.indexOf(n.type), n.label, x, y, z, n.part ?? 0, n.chapter ?? 0, gx, gy, gz, TONES.indexOf(polarity.get(n.id) ?? '')];
    }),
    edges: graph.edges.map((e) => [index.get(e.source), index.get(e.target), EDGE_TYPES.indexOf(e.type)]),
  });
  writeText(join(DATA, 'graph.json'), graphFile);

  // Reasons load only when someone opens a link, so the map stays quick to start.
  writeText(
    join(DATA, 'links.json'),
    compact(
      graph.edges.flatMap((e, i) =>
        e.detail === undefined ? [] : [{ e: i, b: BASIS.indexOf(e.detail.basis), r: e.detail.reason, q: e.detail.quote, c: e.detail.couplets, a: e.detail.agreement }],
      ),
    ),
  );
  writeText(
    join(DATA, 'ideas.json'),
    compact(
      (merged?.ideas ?? []).map(({ evidence: _evidence, ...idea }) => ({
        ...idea,
        definition: namedCouplets(idea.definition),
        ...(idea.tamil === undefined ? {} : { iast: toRevisedIast(idea.tamil) }),
      })),
    ),
  );
  writeText(join(DATA, 'chains.json'), compact(merged?.chains ?? []));
  writeText(
    join(DATA, 'flows.json'),
    compact({
      threads: merged?.flows.threads ?? [],
      chapters: merged?.flows.chapters ?? [],
      silent: Object.fromEntries((merged?.flows.situations ?? []).flatMap((s) => (s.silent === undefined ? [] : [[s.situation, s.silent]]))),
      direct: (merged?.flows.situations ?? []).filter((s) => s.direct === true).map((s) => s.situation),
      leaveOut: Object.fromEntries((merged?.flows.situations ?? []).flatMap((s) => (s.leaveOut === undefined ? [] : [[s.situation, s.leaveOut]]))),
    }),
  );

  writeText(
    join(DATA, 'structure.json'),
    compact({
      divisions: DIVISIONS,
      chapters: readings.map((c, i) => {
        const t = tamil.chapters[i]!;
        return {
          n: c.chapter,
          title: c.title,
          ...(c.note === undefined ? {} : { note: c.note }),
          division: divisionOf(c.chapter),
          part: partOfChapter(c.chapter),
          tamil: t.tamil,
          iast: t.iast,
          paal: t.paal,
          iyal: t.iyal,
        };
      }),
    }),
  );

  const annotated = new Map((merged?.shards ?? []).flatMap((s) => s.couplets).map((c) => [c.n, c]));
  const ideaWords = new Map((merged?.ideas ?? []).map((v) => [v.id, [v.label, ...v.synonyms].join(' ')]));

  writeText(
    join(DATA, 'couplets.json'),
    compact({
      couplets: tamil.couplets.map((t) => {
        const k = reading.get(t.n)!;
        const sensitive = annotated.get(t.n)?.sensitive ?? k.sensitive;
        return {
          n: t.n,
          chapter: k.chapter,
          text: k.plain,
          pm: k.pm,
          tag: k.tag,
          ...(k.note === undefined ? {} : { note: k.note }),
          ...(k.context === undefined ? {} : { context: k.context }),
          ...(k.speaker === undefined ? {} : { voice: { speaker: k.speaker } }),
          tamil: t.tamil,
          iast: t.iast,
          ...(sensitive === undefined ? {} : { sensitive: true }),
        };
      }),
    }),
  );

  // His Tamil loads only when someone opens it, because it is the largest text here.
  const { entries } = readJson<Commentary>(join(CLEAN, 'parimelazhagar.json'));
  writeText(join(DATA, 'commentary.json'), compact(entries.map(({ context, gloss, notes }) => ({ ...(context === null ? {} : { context }), gloss, notes }))));

  // Forms people type. Never displayed.
  writeText(
    join(DATA, 'search.json'),
    compact(
      tamil.couplets.map((c) => {
        const forms = [foldToAscii(c.iast.join(' ')), foldToAscii(c.tamil.map(toLetterForLetter).join(' ')), c.datasetRoman.join(' ').toLowerCase()];
        const note = annotated.get(c.n);
        return {
          roman: [...new Set(forms.flatMap((f) => f.split(/\s+/)))].join(' '),
          ...(note === undefined
            ? {}
            : {
                gloss: `${note.gloss} ${note.keywords.join(' ')}`,
                ideas: note.edges.map((e) => ideaWords.get(e.target) ?? '').join(' '),
              }),
        };
      }),
    ),
  );

  const firstLoad = statSync(join(DATA, 'graph.json')).size + statSync(join(DATA, 'structure.json')).size;
  checks.that(firstLoad <= FIRST_LOAD_BUDGET_BYTES, `first load is ${Math.round(firstLoad / 1024)} KB`);

  for (const path of walk(PUBLIC)) {
    const size = statSync(path).size;
    checks.that(size <= MAX_FILE_BYTES, `${relative(ROOT, path)} is ${(size / 1048576).toFixed(1)} MiB, over Cloudflare's limit`);
  }

  // Sampled commentary and other translators' text must never reach the public folder.
  const raw = readJson<{ kural: Record<string, string>[] }>(join(CACHE, 'tamil-kural.json')).kural;
  const shipped = walk(DATA).map((p) => readText(p)).join('\n');
  for (const entry of raw.filter((_, i) => i % 7 === 0)) {
    for (const field of ['mv', 'sp', 'mk', 'Translation', 'explanation', 'couplet']) {
      const sample = String(entry[field] ?? '').slice(0, 30);
      checks.that(sample === '' || !shipped.includes(sample), `forbidden ${field} text from Kural ${entry.Number} is in public/`);
    }
  }

  console.log(`  graph ${graph.nodes.length} nodes, ${graph.edges.length} edges; first load ${Math.round(firstLoad / 1024)} KB${graph.synthetic ? ' (PLACEHOLDER IDEAS)' : ''}`);
  checks.finish();
}
