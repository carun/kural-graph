/**
 * How the book divides, following Parimelazhagar: three Parts, then his இயல்கள்.
 * Ranges are chapters. துறவறவியல் divides again into vows and knowledge.
 */
export interface Division {
  id: string;
  label: string;
  title: string;
  /** His Tamil name, where he gives one. */
  tamil?: string;
  parent: string | null;
  firstChapter: number;
  lastChapter: number;
}

export const DIVISIONS: Division[] = [
  { id: 'introduction', label: '', title: 'Introduction', tamil: 'பாயிரவியல்', parent: null, firstChapter: 1, lastChapter: 4 },
  { id: 'part-1', label: 'Part I', title: 'Righteousness', tamil: 'அறத்துப்பால்', parent: null, firstChapter: 5, lastChapter: 38 },
  { id: 'section-1-1', label: 'Section I', title: 'The Householder’s Life', tamil: 'இல்லறவியல்', parent: 'part-1', firstChapter: 5, lastChapter: 24 },
  { id: 'section-1-2', label: 'Section II', title: 'The Renunciant’s Life', tamil: 'துறவறவியல்', parent: 'part-1', firstChapter: 25, lastChapter: 37 },
  { id: 'subdivision-1-2-a', label: 'Subdivision A', title: 'Vows', tamil: 'விரதம்', parent: 'section-1-2', firstChapter: 25, lastChapter: 33 },
  { id: 'subdivision-1-2-b', label: 'Subdivision B', title: 'Knowledge', tamil: 'ஞானம்', parent: 'section-1-2', firstChapter: 34, lastChapter: 37 },
  { id: 'section-1-3', label: 'Section III', title: 'Fate', tamil: 'ஊழியல்', parent: 'part-1', firstChapter: 38, lastChapter: 38 },
  { id: 'part-2', label: 'Part II', title: 'Wealth', tamil: 'பொருட்பால்', parent: null, firstChapter: 39, lastChapter: 108 },
  { id: 'section-2-1', label: 'Section I', title: 'The Ruler', tamil: 'அரசியல்', parent: 'part-2', firstChapter: 39, lastChapter: 63 },
  { id: 'section-2-2', label: 'Section II', title: 'The Parts of the State', tamil: 'அங்கவியல்', parent: 'part-2', firstChapter: 64, lastChapter: 95 },
  { id: 'section-2-3', label: 'Section III', title: 'Remaining Matters', tamil: 'ஒழிபியல்', parent: 'part-2', firstChapter: 96, lastChapter: 108 },
  { id: 'part-3', label: 'Part III', title: 'Desire', tamil: 'காமத்துப்பால்', parent: null, firstChapter: 109, lastChapter: 133 },
  { id: 'section-3-1', label: 'Section I', title: 'Secret Union', tamil: 'களவியல்', parent: 'part-3', firstChapter: 109, lastChapter: 115 },
  { id: 'section-3-2', label: 'Section II', title: 'Wedded Life', tamil: 'கற்பியல்', parent: 'part-3', firstChapter: 116, lastChapter: 133 },
];

/** The narrowest division a chapter sits in. */
export function divisionOf(chapter: number): string {
  const holding = DIVISIONS.filter((d) => chapter >= d.firstChapter && chapter <= d.lastChapter);
  return holding.reduce((a, b) => (b.lastChapter - b.firstChapter < a.lastChapter - a.firstChapter ? b : a)).id;
}
