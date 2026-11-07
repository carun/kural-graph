import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TamilCouplet } from './03-parse-tamil.ts';
import { edgeId, loadOverrides, loadShards } from './lib/annotations.ts';
import type { Commentary } from './lib/commentary.ts';
import { coupletId } from './lib/graph.ts';
import { CLEAN, readJson, ROOT, writeJson, writeText } from './lib/paths.ts';
import { EXPECTED, type Expected } from './lib/readings.ts';
import { loadVocabulary } from './lib/vocabulary.ts';

/** One source file per agent: the Tamil, his commentary, and the links to carry over. */
const OUT = join(ROOT, 'annotation', 'readings');
mkdirSync(OUT, { recursive: true });

const { couplets, chapters } = readJson<{ couplets: TamilCouplet[]; chapters: { n: number; tamil: string }[] }>(join(CLEAN, 'tamil.json'));
const commentary = readJson<Commentary>(join(CLEAN, 'parimelazhagar.json'));
const vocabulary = new Map(loadVocabulary().map((v) => [v.id, v]));
const overrides = loadOverrides();
const removed = new Set(overrides.filter((o) => o.action === 'remove').map((o) => o.edge));
const retyped = new Map(overrides.filter((o) => o.action === 'retype').map((o) => [o.edge, o.to!]));
const shards = loadShards();
const annotated = new Map(shards.flatMap((s) => s.couplets).map((c) => [c.n, c]));

const expected: Expected = {
  couplets: {},
  ideaLinks: {},
  anbu: couplets.filter((c) => /அன்ப|அன்பி|அன்பு/.test(c.tamil.join(' '))).map((c) => c.n),
  kamam: couplets.filter((c) => /காமம்|காமத்/.test(c.tamil.join(' '))).map((c) => c.n),
};

interface IdeaLinkOut { id: string; type: string; source: string; target: string; reason: string; quote: string; couplets: number[] }
const ideaLinks = new Map<string, IdeaLinkOut>();
for (const s of shards) {
  for (const l of s.ideaLinks ?? []) {
    const id = edgeId(l.source, l.type, l.target);
    if (removed.has(id)) continue;
    const held = ideaLinks.get(id);
    if (held === undefined) ideaLinks.set(id, { id, type: l.type, source: l.source, target: l.target, reason: l.reason, quote: l.quote, couplets: [...l.couplets] });
    else held.couplets.push(...l.couplets.filter((n) => !held.couplets.includes(n)));
  }
}
const ideaByChapter = new Map<number, IdeaLinkOut[]>();
for (const l of ideaLinks.values()) {
  const chapter = Math.ceil(Math.min(...l.couplets) / 10);
  ideaByChapter.set(chapter, [...(ideaByChapter.get(chapter) ?? []), l]);
  // Only couplets in the same chapter can be quoted, because that is all one agent has written.
  expected.ideaLinks[chapter] = [...(expected.ideaLinks[chapter] ?? []), { id: l.id, couplets: l.couplets.filter((n) => Math.ceil(n / 10) === chapter) }];
}

function chapterText(n: number): string {
  const lines: string[] = [`\n======== CHAPTER ${n}: ${chapters[n - 1]!.tamil}`];
  const preface = commentary.prefaces[n];
  if (preface) lines.push(`His introduction: ${preface}`);
  const ideas = new Set<string>();
  let lastContext: string | null = null;
  for (let k = (n - 1) * 10 + 1; k <= n * 10; k++) {
    const c = couplets[k - 1]!;
    const e = commentary.entries[k - 1]!;
    const a = annotated.get(k)!;
    lines.push('', `--- K${k}`, `Tamil: ${c.tamil.join(' / ')}`);
    if (k >= 1081) {
      const same = e.context !== null && /இதுவுமது|அதுவுமது/.test(e.context);
      lines.push(`His context line: ${same ? `இதுவுமது, meaning the same as above: ${lastContext}` : (e.context ?? '(none in this copy)')}`);
      if (e.context !== null && !same) lastContext = e.context;
    }
    lines.push(`His gloss: ${e.gloss.join(' ')}`);
    if (e.notes.length > 0) lines.push(`His notes: ${e.notes.join(' ')}`);
    if (a.sensitive) lines.push(`Sensitive already: ${a.sensitive}`);
    const ids: string[] = [];
    for (const edge of a.edges) {
      const id = edgeId(coupletId(k), edge.type, edge.target);
      if (removed.has(id)) continue;
      ids.push(id);
      ideas.add(edge.target);
      lines.push(`Link ${id}: ${retyped.get(id) ?? edge.type} ${vocabulary.get(edge.target)?.label ?? edge.target} (${edge.basis}). Reason: ${edge.reason} Old quote: ${edge.quote}`);
    }
    expected.couplets[k] = ids;
  }
  for (const l of ideaByChapter.get(n) ?? []) {
    ideas.add(l.source);
    ideas.add(l.target);
    lines.push('', `Idea link ${l.id}: ${vocabulary.get(l.source)?.label} ${l.type} ${vocabulary.get(l.target)?.label}, stated in K${l.couplets.join(', K')}. Reason: ${l.reason} Old quote: ${l.quote}`);
  }
  if (ideas.size > 0) {
    lines.push('', 'What the ideas above mean:');
    for (const id of ideas) {
      const v = vocabulary.get(id);
      if (v) lines.push(`  ${v.label}: ${v.definition}`);
    }
  }
  return lines.join('\n');
}

const plan: Record<string, number[]> = Object.fromEntries(shards.filter((s) => s.shard !== 'pilot').map((s) => [s.shard, s.chapters]));
plan['shard-09'] = [8, 38, ...plan['shard-09']!];
for (const [shard, list] of Object.entries(plan)) writeText(join(OUT, `${shard}.txt`), `${list.map(chapterText).join('\n')}\n`);
writeJson(EXPECTED, expected);
console.log(Object.entries(plan).map(([s, l]) => `${s}: ${l.length} chapters`).join('; '));
console.log(`anbu ${expected.anbu.length}, kamam ${expected.kamam.length}: ${expected.kamam.join(' ')}`);
console.log(`couplet links ${Object.values(expected.couplets).flat().length}, idea links ${ideaLinks.size}`);
