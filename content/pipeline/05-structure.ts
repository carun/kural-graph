import { Checks } from './lib/check.ts';
import { chapterId, coupletId, partOfChapter, type Graph, type GraphEdge, type GraphNode } from './lib/graph.ts';
import { loadChapters } from './lib/readings.ts';
import { DIVISIONS, divisionOf } from './lib/structure.ts';

const VOICE_LABELS = { he: 'He', she: 'She', maid: 'The Maid' } as const;

/** The divisions are Parimelazhagar's. Titles and speakers come from the readings. */
export function buildStructure(): Graph {
  const checks = new Checks('structure');
  const chapters = loadChapters();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const d of DIVISIONS) {
    const isPart = d.parent === null && d.id !== 'introduction';
    nodes.push({
      id: d.id,
      type: isPart ? 'part' : 'division',
      label: d.title,
      part: partOfChapter(d.firstChapter),
      chapters: { [d.firstChapter]: 1, [d.lastChapter]: 1 },
    });
    if (d.parent !== null) edges.push({ source: d.id, target: d.parent, type: 'IN_DIVISION' });
  }

  for (const c of chapters) {
    const n = c.chapter;
    nodes.push({ id: chapterId(n), type: 'chapter', label: c.title, part: partOfChapter(n), chapter: n });
    edges.push({ source: chapterId(n), target: divisionOf(n), type: 'IN_DIVISION' });
    if (n > 1) edges.push({ source: chapterId(n - 1), target: chapterId(n), type: 'NEXT_CHAPTER' });
  }

  for (const [id, label] of Object.entries(VOICE_LABELS)) nodes.push({ id: `voice:${id}`, type: 'voice', label });

  for (const { chapter, couplets } of chapters) {
    for (const k of couplets) {
      nodes.push({ id: coupletId(k.n), type: 'couplet', label: String(k.n), part: partOfChapter(chapter), chapter });
      edges.push({ source: coupletId(k.n), target: chapterId(chapter), type: 'IN_CHAPTER' });
      if (k.n > 1) edges.push({ source: coupletId(k.n - 1), target: coupletId(k.n), type: 'NEXT_COUPLET' });
      if (k.speaker !== undefined) edges.push({ source: coupletId(k.n), target: `voice:${k.speaker}`, type: 'SPOKEN_BY' });
    }
  }

  const count = (type: string) => edges.filter((e) => e.type === type).length;
  checks.equal(count('IN_CHAPTER'), 1330, 'IN_CHAPTER edges');
  checks.equal(count('NEXT_COUPLET'), 1329, 'NEXT_COUPLET edges');
  checks.equal(count('NEXT_CHAPTER'), 132, 'NEXT_CHAPTER edges');
  checks.equal(count('SPOKEN_BY'), 250, 'SPOKEN_BY edges');
  checks.equal(count('IN_DIVISION'), 143, 'IN_DIVISION edges');
  checks.equal(nodes.filter((n) => n.type === 'part').length, 3, 'parts');
  checks.finish();
  return { nodes, edges, synthetic: false };
}
