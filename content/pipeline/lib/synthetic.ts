import { chapterId, coupletId, IDEA_TYPES, type EdgeType, type Graph, type GraphEdge, type GraphNode, type IdeaType } from './graph.ts';

/**
 * Placeholder ideas and links at the volume real annotation is expected to reach.
 * They exist only so the map's legibility can be judged before annotation is paid
 * for. Their names say what they are, and a release build refuses to ship them.
 */
const COUNTS: Record<IdeaType, number> = { quality: 100, theme: 30, role: 25, situation: 40, image: 30 };
const EDGES_PER_COUPLET = 3;
const COUPLET_LINKS = 600;
const IDEA_LINKS = 300;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUPLET_TO_IDEA: Record<IdeaType, EdgeType[]> = {
  quality: ['COMMENDS', 'CONDEMNS', 'DEFINES'],
  theme: ['GUIDES', 'ENUMERATES'],
  role: ['ADDRESSES'],
  situation: ['GUIDES'],
  image: ['USES_IMAGE'],
};

export function addSyntheticIdeas(graph: Graph): Graph {
  const random = mulberry32(1330);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

  const ideas: (GraphNode & { type: IdeaType; home: number; spread: number })[] = [];
  for (const type of IDEA_TYPES) {
    for (let i = 1; i <= COUNTS[type]; i++) {
      // Most ideas belong to a few chapters. A few cut across the whole text.
      const wide = random() < 0.15;
      ideas.push({
        id: `${type}:placeholder-${i}`,
        type,
        label: `${type[0]!.toUpperCase()}${type.slice(1)} ${i}`,
        home: 1 + Math.floor(random() * 133),
        spread: wide ? 60 + random() * 70 : 2 + random() * 12,
        chapters: {},
      });
    }
  }

  const affinity = (idea: (typeof ideas)[number], chapter: number): number => {
    const gap = Math.min(Math.abs(idea.home - chapter), 133 - Math.abs(idea.home - chapter));
    return Math.exp(-((gap / idea.spread) ** 2));
  };

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const link = (source: string, target: string, type: EdgeType) => {
    const key = `${source}|${target}|${type}`;
    if (source === target || seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, type });
  };

  for (let n = 1; n <= 1330; n++) {
    const chapter = Math.ceil(n / 10);
    const weighted = ideas.map((idea) => ({ idea, weight: affinity(idea, chapter) * random() }));
    weighted.sort((a, b) => b.weight - a.weight);
    for (const { idea } of weighted.slice(0, EDGES_PER_COUPLET)) {
      link(coupletId(n), idea.id, pick(COUPLET_TO_IDEA[idea.type]));
      idea.chapters![chapter] = (idea.chapters![chapter] ?? 0) + 1;
    }
  }

  for (let i = 0; i < COUPLET_LINKS; i++) {
    const a = 1 + Math.floor(random() * 1330);
    const b = 1 + Math.floor(random() * 1330);
    link(coupletId(a), coupletId(b), pick(['ECHOES', 'QUALIFIES', 'IN_TENSION_WITH'] as const));
  }
  for (let i = 0; i < IDEA_LINKS; i++) {
    link(pick(ideas).id, pick(ideas).id, pick(['LEADS_TO', 'REQUIRES', 'OVERCOMES', 'OPPOSES'] as const));
  }

  const nodes: GraphNode[] = ideas.map(({ home: _home, spread: _spread, ...node }) => node);
  return {
    nodes: [...graph.nodes, ...nodes],
    edges: [...graph.edges, ...edges],
    synthetic: true,
  };
}

export { chapterId };
