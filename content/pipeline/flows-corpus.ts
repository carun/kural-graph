import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TamilCouplet } from './03-parse-tamil.ts';
import { edgeId, loadOverrides, loadShards } from './lib/annotations.ts';
import type { Commentary } from './lib/commentary.ts';
import { CLEAN, readJson, ROOT } from './lib/paths.ts';
import { loadChapters } from './lib/readings.ts';
import { loadVocabulary } from './lib/vocabulary.ts';

/** Source files for the agents who write the flows: the text, the ideas and the situations. */
const OUT = join(ROOT, 'annotation', 'flows');
mkdirSync(OUT, { recursive: true });

const { couplets } = readJson<{ couplets: TamilCouplet[] }>(join(CLEAN, 'tamil.json'));
const commentary = readJson<Commentary>(join(CLEAN, 'parimelazhagar.json'));
const chapters = loadChapters();
const vocabulary = loadVocabulary();
const removed = new Set(loadOverrides().filter((o) => o.action === 'remove').map((o) => o.edge));

const corpus: string[] = [];
for (const c of chapters) {
  corpus.push(`\n======== CHAPTER ${c.chapter}: ${c.title}`);
  for (const k of c.couplets) corpus.push(`K${k.n}${k.sensitive ? ' [SENSITIVE]' : ''} ${couplets[k.n - 1]!.tamil.join(' / ')}\n  ${k.plain}${k.context ? `\n  (${k.context} Speaker: ${k.speaker})` : ''}`);
}
writeFileSync(join(OUT, 'corpus.txt'), `${corpus.join('\n')}\n`);

const ideas = vocabulary.filter((v) => v.type === 'quality' || v.type === 'theme').map((v) =>
  `${v.id} | ${v.label}${v.tamil ? ` (${v.tamil})` : ''}${v.polarity ? ` | ${v.polarity}` : ''}${v.feeling ? ' | FEELING' : ''} | ${v.definition}${v.boundary ? ` | Not: ${v.boundary}` : ''}`);
writeFileSync(join(OUT, 'ideas.txt'), `${ideas.join('\n')}\n`);

const guides = new Map<string, string[]>();
for (const s of loadShards()) for (const c of s.couplets) for (const e of c.edges) {
  if (e.type !== 'GUIDES' || removed.has(edgeId(`k${c.n}`, e.type, e.target))) continue;
  guides.set(e.target, [...(guides.get(e.target) ?? []), `  K${c.n}: ${e.reason}`]);
}
const situations = vocabulary.filter((v) => v.type === 'situation').map((v) =>
  `${v.id} | ${v.label}\n  ${v.definition}\n${(guides.get(v.id) ?? ['  (no couplets linked yet)']).join('\n')}`);
writeFileSync(join(OUT, 'situations.txt'), `${situations.join('\n\n')}\n`);

const intros = chapters.map((c) => `=== Chapter ${c.chapter}: ${c.title}\nHis Tamil: ${commentary.prefaces[c.chapter]}\nOur English: ${c.note}`);
writeFileSync(join(OUT, 'introductions.txt'), `${intros.join('\n\n')}\n`);
console.log(`Wrote corpus, ideas, situations and introductions to ${OUT}`);
