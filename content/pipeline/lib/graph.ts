export const IDEA_TYPES = ['quality', 'theme', 'role', 'situation', 'image'] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];
export type NodeType = 'part' | 'division' | 'chapter' | 'couplet' | 'voice' | IdeaType;

export const STRUCTURAL_EDGES = ['IN_CHAPTER', 'IN_DIVISION', 'NEXT_COUPLET', 'NEXT_CHAPTER', 'SPOKEN_BY'] as const;
export const INTERPRETIVE_EDGES = [
  'COMMENDS', 'CONDEMNS', 'DEFINES', 'VOICES', 'ENUMERATES', 'ADDRESSES', 'GUIDES', 'USES_IMAGE',
  'LEADS_TO', 'REQUIRES', 'OVERCOMES', 'OPPOSES',
  'ECHOES', 'QUALIFIES', 'IN_TENSION_WITH',
  'EVOKES', 'RESOLVED_THROUGH', 'ANTIDOTE_TO', 'PORTRAYS', 'ANSWERS', 'FOLLOWS',
] as const;
export const EDGE_TYPES = [...STRUCTURAL_EDGES, ...INTERPRETIVE_EDGES] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  /** Which of the three parts (paals) this belongs to. */
  part?: 1 | 2 | 3;
  chapter?: number;
  /** Chapters an idea touches, with weights. Drives its place on the map. */
  chapters?: Record<number, number>;
}

/** What a reader sees for an interpretive link. Structural edges have none. */
export interface EdgeDetail {
  /** Editorial links are ours and not the Kural's, and they must say so to readers. */
  basis: 'explicit' | 'inferred' | 'editorial';
  reason: string;
  quote: string;
  /** The couplets that state it, for links between two ideas. */
  couplets?: number[];
  /** How many agents reached this link on their own. */
  agreement?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  detail?: EdgeDetail;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** True while placeholder ideas stand in for real annotation. */
  synthetic: boolean;
}

export const coupletId = (n: number): string => `k${n}`;
export const chapterId = (n: number): string => `ch${n}`;
export const partOfChapter = (chapter: number): 1 | 2 | 3 => (chapter <= 38 ? 1 : chapter <= 108 ? 2 : 3);
