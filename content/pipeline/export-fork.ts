import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, REPO, ROOT } from './lib/paths.ts';
import { toRevisedIast } from './lib/tamilToIast.ts';

/**
 * Writes the Kural into the data format of the app, the fork of GitaViśva around this folder, so the app itself
 * can stay close to its upstream. Everything readers see comes from here. `npm run data` runs it after the pipeline.
 */
const FORK = REPO;
// His name in the owner's romanisation, wherever readers see it.
const spelled = (doc: unknown): string => JSON.stringify(doc).replaceAll('Parimelazhagar', toRevisedIast('பரிமேலழகர்'));
// Each in its author's own words, from a public text. Each file lists its source and corrections.
const clean = (file: string) => new Map<number, string>(readJson<any>(join(ROOT, 'data', 'clean', `${file}.json`)).couplets.map((c: any) => [c.n, c.text]));
// Offered beside the readings, never as the default or as what a model reads.
const aiyar = clean('aiyar');
const pope = clean('pope');
const drewLazarus = clean('drew-lazarus');
// His id, name and school, then where the book came from. Sivamuthu's book stops at couplet 1080.
const TAMIL_COMMENTARIES = [
  { authorId: 7, author: toRevisedIast('மணக்குடவர்'), school: 'Classical commentary', work: 'The oldest commentary that survives, from Project Madurai', text: clean('manakkudavar') },
  { authorId: 8, author: toRevisedIast('மு. வரதராசனார்'), school: 'Modern commentary', work: 'திருக்குறள் தெளிவுரை, from Tamil Wikisource', text: clean('varadarasanar') },
  { authorId: 9, author: toRevisedIast('மயிலை சிவமுத்து'), school: 'Modern commentary', work: 'திருக்குறள், இனிய எளிய உரை, from Tamil Wikisource. Parts 1 and 2 only', text: clean('sivamuthu') },
  { authorId: 10, author: toRevisedIast('தேவநேயப் பாவாணர்'), school: 'Modern commentary', work: 'திருக்குறள் தமிழ் மரபுரை, from the Tamil Digital Library', text: clean('pavanar') },
];
const OUT = join(FORK, 'public', 'data');
const data = (name: string) => readJson<any>(join(ROOT, 'public', 'data', `${name}.json`));

const graph = data('graph');
const links: { e: number; b: number; r: string; q: string; c?: number[]; a?: string[] }[] = data('links');
const ideas: any[] = data('ideas');
const { couplets }: { couplets: any[] } = data('couplets');
const structure = data('structure');
const commentary: { context?: string; gloss: string[]; notes: string[] }[] = data('commentary');
const chains: any[] = data('chains');
const flows = data('flows');
const situations: { situation: string }[] = readJson<any>(join(ROOT, 'data', 'annotations', 'flows-situations.json')).situations;

/** A whole-chapter recording goes into the data only once its file exists, so the player never offers one it can't play. */
function chapterAudio(n: number): { url: string; duration: null; source: string; title: string }[] {
  const file = `chapter-${String(n).padStart(3, '0')}.mp3`;
  return existsSync(join(FORK, 'public', 'audio', file)) ? [{ url: `/audio/${file}`, duration: null, source: 'Recording', title: `Chapter ${n}` }] : [];
}

const verseId = (n: number) => `K_${n}`;
const chapterId = (n: number) => `CH_${n}`;
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

const SPEAKERS: Record<string, { id: string; label: string; tamil: string; role: string; desc: string }> = {
  he: { id: 'character:he', label: 'He', tamil: 'தலைவன்', role: 'The man in love', desc: 'The man of Part 3, who speaks in the couplets on his love.' },
  she: { id: 'character:she', label: 'She', tamil: 'தலைவி', role: 'The woman in love', desc: 'The woman of Part 3, who speaks in most of its couplets.' },
  maid: { id: 'character:friend', label: 'The Friend', tamil: 'தோழி', role: 'Her friend', desc: 'Her friend in Part 3, who speaks to them both.' },
};
const POET = { id: 'character:tiruvalluvar', label: 'Tiruvalluvar', tamil: 'திருவள்ளுவர்', role: 'The poet', desc: 'The poet of the Kural, who speaks in Parts 1 and 2.' };

/** Our node ids, in the prefixes his app reads. */
function idOf(id: string): string {
  const couplet = /^k(\d+)$/.exec(id);
  if (couplet) return verseId(Number(couplet[1]));
  const chapter = /^ch(\d+)$/.exec(id);
  if (chapter) return chapterId(Number(chapter[1]));
  const [kind, slug] = id.split(':');
  if (kind === 'quality') return `emotion:${slug}`;
  if (kind === 'theme') return `concept:${slug}`;
  if (kind === 'role') return `concept:role-${slug}`;
  if (kind === 'image') return `concept:image-${slug}`;
  if (kind === 'situation') return `dilemma:${slug}`;
  if (kind === 'voice') return SPEAKERS[slug!]!.id;
  throw new Error(`no mapping for ${id}`);
}

const speakerOf = (c: any): string => (c.voice ? SPEAKERS[c.voice.speaker]!.id : POET.id).replace('character:', '');
const refOf = (c: any): string => String(c.n);

// His word-by-word grid comes from the commentator's own gloss, written "word= meaning;".
function wordByWord(n: number): { w: string; m: string; k: string[] }[] {
  const parts = commentary[n - 1]!.gloss.join(' ').split(/;/).map((p) => p.trim()).filter(Boolean);
  const pairs = parts.flatMap((p) => {
    const at = p.indexOf('=');
    return at < 1 ? [] : [{ w: p.slice(0, at).trim(), m: p.slice(at + 1).trim().replace(/[.]$/, ''), k: [] }];
  });
  return pairs.length > 0 && pairs.length >= parts.length * 0.6 ? pairs : [];
}

const situationOf = new Map(situations.map((s) => [s.situation, s]));

// --- Nodes
const nodes: any[] = [];
const chaptersOut = structure.chapters.map((c: any) => {
  const division = structure.divisions.find((d: any) => d.id === c.division);
  return {
    id: chapterId(c.n),
    number: c.n,
    name: c.tamil,
    iast: toRevisedIast(c.tamil),
    transliterated: fold(toRevisedIast(c.tamil)),
    title: c.title,
    meaning: division?.title ?? '',
    verseCount: 10,
    summary: { en: c.note ?? '', hi: '' },
    audio: chapterAudio(c.n),
  };
});
for (const c of chaptersOut) {
  nodes.push({ id: c.id, type: 'Chapter', label: `Chapter ${c.number}`, number: c.number, name: c.name, iast: c.iast, title: c.title, meaning: c.meaning, verseCount: 10, summary: c.summary.en });
}

const versesOut = couplets.map((c) => {
  const chapter = Math.ceil(c.n / 10);
  const verse = ((c.n - 1) % 10) + 1;
  const speaker = speakerOf(c);
  const spoken = c.voice ? SPEAKERS[c.voice.speaker]! : null;
  return {
    id: verseId(c.n),
    ref: refOf(c),
    chapter,
    verse,
    order: c.n,
    canonical: true,
    speaker,
    uvacha: spoken ? { sa: spoken.tamil, iast: toRevisedIast(spoken.tamil), tr: c.context ?? spoken.label } : null,
    sanskrit: c.tamil,
    iast: c.iast,
    transliteration: c.iast.map(fold),
    padaccheda: wordByWord(c.n),
    meter: { name: 'Kural veṇbā', family: 'veṇbā', syllables: 7, scansion: [] },
    audio: { verse: [`/audio/${String(c.n).padStart(4, '0')}.mp3`], chapterFrac: (verse - 1) / 10 },
    translations: { en: { 1: c.text, 2: c.pm, 4: aiyar.get(c.n), 5: pope.get(c.n), 6: drewLazarus.get(c.n) }, hi: {} },
    commentaryAuthors: [2, 3, ...TAMIL_COMMENTARIES.filter((t) => t.text.has(c.n)).map((t) => t.authorId)],
    ...(c.sensitive ? { sensitive: true } : {}),
    reading: { tag: c.tag, ...(c.note ? { note: c.note } : {}) },
  };
});
for (const v of versesOut) {
  const c = couplets[v.order - 1];
  nodes.push({ id: v.id, type: 'Verse', label: `Kural ${v.ref}`, ref: v.ref, chapter: v.chapter, verse: v.verse, speaker: v.speaker, canonical: true, meter: 'kural-venba', sa: c.tamil[0], snippet: c.text, ...(c.sensitive ? { sensitive: true } : {}) });
}

const spokenCount = new Map<string, number>();
for (const v of versesOut) spokenCount.set(v.speaker, (spokenCount.get(v.speaker) ?? 0) + 1);
for (const c of [POET, ...Object.values(SPEAKERS)]) {
  nodes.push({ id: c.id, type: 'Character', label: c.label, sa: c.tamil, iast: toRevisedIast(c.tamil), role: c.role, desc: c.desc, side: '', versesSpoken: spokenCount.get(c.id.replace('character:', '')) ?? 0 });
}

for (const v of ideas) {
  // His `en` is the line under the name. Ours is the romanised Tamil, because the name is already English.
  const base = { sa: v.tamil ?? '', iast: v.iast ?? '', en: v.iast ?? '', desc: v.definition };
  if (v.type === 'quality') {
    nodes.push({ id: idOf(v.id), type: 'Emotion', label: v.label, ...base, valence: v.polarity === 'virtue' ? 'healing' : 'afflictive', guna: '', modern: '', lexicon: v.synonyms ?? [], ...(v.feeling ? { feeling: true } : {}), polarity: v.polarity });
  } else if (v.type === 'situation') {
    const s: any = situationOf.get(v.id) ?? {};
    nodes.push({ id: idOf(v.id), type: 'LifeDilemma', label: v.label, sa: '', desc: v.definition, keywords: v.synonyms ?? [], ...(s.silent ? { silent: s.silent } : {}), ...(s.direct ? { direct: true } : {}), ...(s.leaveOut ? { leaveOut: s.leaveOut.map(verseId) } : {}) });
  } else {
    nodes.push({ id: idOf(v.id), type: 'SanskritConcept', label: v.label, ...base, category: v.type, lexicon: v.synonyms ?? [] });
  }
}

// --- Edges. Every interpretive link keeps its reason, its quote and how firmly it stands.
const RELATION: Record<string, (target: string) => string> = {
  IN_CHAPTER: () => 'BELONGS_TO',
  NEXT_COUPLET: () => 'NEXT_VERSE',
  NEXT_CHAPTER: () => 'NEXT_CHAPTER',
  COMMENDS: (t) => (t.startsWith('emotion:') ? 'CULTIVATES' : 'MENTIONS_CONCEPT'),
  CONDEMNS: (t) => (t.startsWith('emotion:') ? 'DEPICTS_STATE' : 'MENTIONS_CONCEPT'),
  DEFINES: () => 'DEFINES_CONCEPT',
  VOICES: () => 'DEPICTS_STATE',
  ENUMERATES: (t) => (t.startsWith('emotion:') ? 'MENTIONS_STATE' : 'MENTIONS_CONCEPT'),
  ADDRESSES: () => 'MENTIONS_CONCEPT',
  USES_IMAGE: () => 'MENTIONS_CONCEPT',
  GUIDES: () => 'ADDRESSES_DILEMMA',
  LEADS_TO: () => 'CAUSES_STATE',
  REQUIRES: () => 'REQUIRES',
  OVERCOMES: () => 'ANTIDOTE_TO',
  OPPOSES: () => 'OPPOSES',
  ECHOES: () => 'ECHOES_VERSE',
  QUALIFIES: () => 'QUALIFIES',
  IN_TENSION_WITH: () => 'IN_TENSION_WITH',
  EVOKES: () => 'EVOKES_STATE',
  RESOLVED_THROUGH: () => 'RESOLVED_THROUGH',
  ANTIDOTE_TO: () => 'ANTIDOTE_TO',
  PORTRAYS: () => 'DEPICTS_STATE',
  ANSWERS: () => 'HEALS',
};
const details = new Map(links.map((l) => [l.e, l]));
const edges: any[] = [];
const seen = new Set<string>();
const held = new Map<string, any>();
const push = (source: string, target: string, type: string, props?: Record<string, unknown>) => {
  const key = `${source}|${type}|${target}`;
  if (seen.has(key)) {
    // His graph allows one edge per relation and pair, but two of ours can land on the same one. Both reasons are kept,
    // and a walk's answer stays the one on the edge, since OVERCOMES and ANTIDOTE_TO share his relation and only the second walks.
    const edge = held.get(key);
    if (props === undefined || edge === undefined) return;
    if (props.from === 'ANTIDOTE_TO') edge.props = { ...props, also: [edge.props, ...(edge.props?.also ?? [])] };
    else edge.props = { ...edge.props, also: [...(edge.props?.also ?? []), props] };
    return;
  }
  seen.add(key);
  const edge = { source, target, type, weight: 1, ...(props ? { props } : {}) };
  held.set(key, edge);
  edges.push(edge);
};
graph.edges.forEach(([s, t, k]: [number, number, number], index: number) => {
  const type: string = graph.edgeTypes[k];
  const [from, to] = [graph.nodes[s][0], graph.nodes[t][0]] as [string, string];
  if (type === 'SPOKEN_BY' || type === 'IN_DIVISION' || from.startsWith('part') || to.startsWith('part')) return;
  if (type === 'FOLLOWS') return;
  const map = RELATION[type];
  if (map === undefined) throw new Error(`no relation for ${type}`);
  const target = idOf(to);
  const detail = details.get(index);
  const props = detail === undefined ? undefined : { why: detail.r, ...(detail.q ? { quote: detail.q } : {}), basis: ['inferred', 'explicit', 'editorial'][detail.b], ...(detail.c ? { verses: detail.c.map(String) } : {}), from: type, ...(detail.a ? { agents: detail.a } : {}) };
  push(idOf(from), target, map(target), props);
});
for (const { chapter, after, reason } of flows.chapters) {
  const existing = edges.find((e) => e.type === 'NEXT_CHAPTER' && e.source === chapterId(after) && e.target === chapterId(chapter));
  if (existing) existing.props = { why: reason };
  else push(chapterId(after), chapterId(chapter), 'NEXT_CHAPTER', { why: reason });
}
for (const v of versesOut) push(`character:${v.speaker}`, v.id, 'SPOKE');

// --- Paths through the book
const COLOURS = ['#D4AF37', '#3987e5', '#199e70', '#d95926', '#9085e9', '#c874b2', '#2fa8b5', '#e3a44b'];
const threads = flows.threads.map((t: any, i: number) => ({ id: t.id, title: t.title, color: COLOURS[i % COLOURS.length], verses: t.steps.map((s: any) => String(s.n)), note: t.summary, steps: t.steps }));
const chainsOut = chains.map((c) => ({ id: c.id, title: c.title, summary: c.summary, verses: c.steps.flatMap((s: any) => (s.couplet ? [verseId(s.couplet)] : [])), steps: c.steps.map((s: any) => idOf(s.idea)) }));

const byLabel: Record<string, number> = {};
for (const n of nodes) byLabel[n.type] = (byLabel[n.type] ?? 0) + 1;
const byRelation: Record<string, number> = {};
for (const e of edges) byRelation[e.type] = (byRelation[e.type] ?? 0) + 1;

const numbering = '1,330 couplets in 133 chapters of ten.';
const generatedAt = new Date(0).toISOString();
const sources = [
  { name: 'Tirukkural', url: 'https://github.com/tk120404/thirukkural', license: 'Apache-2.0' },
  { name: 'Parimelazhagar’s commentary, Tamil Wikisource', url: 'https://ta.wikisource.org/wiki/திருக்குறள்_பரிமேலழகர்_உரை', license: 'CC BY-SA' },
  { name: 'G. U. Pope, 1886, Internet Archive', url: 'https://archive.org/details/tiruvalluvanayan00tiruuoft', license: 'Public domain' },
  { name: 'W. H. Drew and J. Lazarus, 1885, Internet Archive', url: 'https://archive.org/details/kuraloftiruvallu00tirurich', license: 'Public domain' },
  { name: 'Manakkudavar’s commentary, Project Madurai', url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0650.html', license: 'Free to distribute with its header intact' },
  { name: 'Mu. Varadarasanar’s commentary, Tamil Wikisource', url: 'https://ta.wikisource.org/wiki/திருக்குறள்_தெளிவுரை,_மு._வரதராசன்', license: 'CC BY-SA' },
  { name: 'Mayilai Sivamuthu’s commentary, Tamil Wikisource', url: 'https://ta.wikisource.org/wiki/திருக்குறள்,_இனிய_எளிய_உரை', license: 'CC BY-SA' },
  { name: 'Devaneya Pavanar’s commentary, Tamil Digital Library', url: 'https://archive.org/details/tdl.48404-1-1', license: 'Nationalised by the Government of Tamil Nadu' },
];

const graphDoc = {
  meta: { name: 'Kural Graph', version: '1.0.0', generatedAt, numbering, sources },
  schema: { nodeLabels: { Chapter: '133 chapters', Verse: '1,330 couplets', Character: 'the poet and the speakers of Part 3', SanskritConcept: 'themes, roles and images', Emotion: 'virtues, vices and states of mind', LifeDilemma: 'life situations', PersonalThought: 'private thoughts, on this device only' }, relations: {} },
  categories: { theme: 'Themes', role: 'Roles', image: 'Images' },
  threads,
  dialogues: [],
  chains: chainsOut,
  nodes,
  edges,
  stats: { nodes: nodes.length, edges: edges.length, byLabel, byRelation },
};
const versesDoc = {
  meta: { name: 'Kural Graph', version: '1.0.0', generatedAt, numbering, defaults: { en: 1, hi: 1 }, audioNote: 'Couplets are read by your device until a recording exists.', sources },
  authors: [
    { id: 1, name: 'Plain reading', lang: 'en', kind: 'translation' },
    { id: 2, name: 'Parimelazhagar', lang: 'en', kind: 'both', school: 'Classical commentary', work: 'Paraphrased in English by an AI' },
    { id: 3, name: 'Parimelazhagar', lang: 'sa', kind: 'commentary', school: 'Classical commentary', work: 'His Tamil' },
    { id: 4, name: 'V. V. S. Aiyar', lang: 'en', kind: 'translation', work: 'The Kural, 1916' },
    { id: 5, name: 'G. U. Pope', lang: 'en', kind: 'translation', work: 'The ‘Sacred’ Kurral, 1886' },
    { id: 6, name: 'W. H. Drew and J. Lazarus', lang: 'en', kind: 'translation', work: 'The Kural, 1885' },
    ...TAMIL_COMMENTARIES.map(({ authorId, author, school, work }) => ({ id: authorId, name: author, lang: 'sa', kind: 'commentary', school, work })),
  ],
  chapters: chaptersOut,
  verses: versesOut,
};

mkdirSync(join(OUT, 'commentary'), { recursive: true });
for (const f of readdirSync(join(OUT, 'commentary'))) rmSync(join(OUT, 'commentary', f));
for (const old of ['gita-graph.json', 'gita-verses.json', 'gita-layout.json', 'gita-embeddings.json', 'gita-cypher-seed.cypher']) {
  if (existsSync(join(OUT, old))) rmSync(join(OUT, old));
}
writeFileSync(join(OUT, 'kural-graph.json'), spelled(graphDoc));
// The map's second shape. The app's scripts/build-layout.mjs writes the first into this file and keeps these.
const layoutFile = join(OUT, 'kural-layout.json');
const shown = new Set(nodes.map((n) => n.id));
const lotus = Object.fromEntries(graph.nodes.flatMap(([id, type, , x, y, z]: any[]) => (['part', 'division'].includes(graph.nodeTypes[type]) || !shown.has(idOf(id)) ? [] : [[idOf(id), [x, y, z]]])));
writeFileSync(layoutFile, JSON.stringify({ ...(existsSync(layoutFile) ? readJson<any>(layoutFile) : { kind: 'gitaviswa-layout', version: 1, positions: {} }), lotus, lotusRing: 1000 }));
writeFileSync(join(OUT, 'kural-verses.json'), spelled(versesDoc));
for (const c of couplets) {
  const m = commentary[c.n - 1]!;
  writeFileSync(
    join(OUT, 'commentary', `${verseId(c.n)}.json`),
    spelled({
      id: verseId(c.n),
      ref: refOf(c),
      commentaries: [
        { authorId: 2, author: 'Parimelazhagar', school: 'Classical commentary', lang: 'en', text: [c.context, c.pm, c.note].filter(Boolean).join('\n\n'), work: 'Paraphrased in English by an AI' },
        { authorId: 3, author: 'Parimelazhagar', school: 'Classical commentary', lang: 'sa', text: [m.context ? `(${m.context})` : '', ...m.gloss, ...m.notes].filter(Boolean).join('\n\n'), work: 'His Tamil' },
        ...TAMIL_COMMENTARIES.filter((t) => t.text.has(c.n)).map(({ authorId, author, school, work, text }) => ({ authorId, author, school, lang: 'sa', text: text.get(c.n), work })),
      ],
    }),
  );
}

// Semantic search, in his format. Our rows are int8 at our own scale, not his 127. His decoder makes each row unit
// length, so only the direction counts. Chapters and speakers have no row: keyword search still finds them.
const { dimensions, ids }: { dimensions: number; ids: string[] } = data('vectors');
const vectors = readFileSync(join(ROOT, 'public', 'data', 'vectors.bin'));
if (vectors.length !== ids.length * dimensions) throw new Error('vectors.bin does not match vectors.json');
writeFileSync(join(OUT, 'kural-embeddings.json'), JSON.stringify({ model: 'Xenova/all-MiniLM-L6-v2', dim: dimensions, ids: ids.map(idOf), vectors: vectors.toString('base64') }));
console.log(`${nodes.length} nodes, ${edges.length} edges`, byLabel);
console.log(byRelation);
console.log('word-by-word on', versesOut.filter((v) => v.padaccheda.length > 0).length, 'couplets;', 'sensitive', versesOut.filter((v) => v.sensitive).length);
