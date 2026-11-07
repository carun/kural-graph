import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CLEAN, readJson, readText, ROOT } from './paths.ts';
import { IDEA_TYPES, type IdeaType } from './graph.ts';

export const VOCABULARY = join(ROOT, 'data', 'ontology', 'vocabulary.yaml');

export interface VocabularyEntry {
  id: string;
  type: IdeaType;
  label: string;
  /** The Kural's own word, where it has one. Its romanisation is always derived, never typed. */
  tamil?: string;
  polarity?: 'virtue' | 'vice' | 'state';
  /** Something a person feels, so a walk from a situation can pass through it. */
  feeling?: boolean;
  definition: string;
  /** What this is not: the near neighbour an annotator might confuse it with. */
  boundary?: string;
  /** Modern words for search and Reflect. */
  synonyms: string[];
  /** Couplets that show it clearly. */
  evidence: number[];
}

const ID = /^(quality|theme|role|situation|image):[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DEFINITION = 240;
const TAMIL_ONLY = /^[஀-௿ ]+$/;

export const loadVocabulary = (): VocabularyEntry[] =>
  existsSync(VOCABULARY) ? (parseYaml(readText(VOCABULARY)) as VocabularyEntry[]) : [];

/** Tamil inflects, so a term counts as attested if its stem appears in the text or chapter names. */
function attestedIn(corpus: string, term: string): boolean {
  const letters = [...term.replace(/ /g, '')];
  const stem = letters.slice(0, Math.max(3, Math.ceil(letters.length * 0.65))).join('');
  return corpus.includes(stem);
}

export function vocabularyProblems(entries: VocabularyEntry[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { couplets, chapters } = readJson<{ couplets: { tamil: string[] }[]; chapters: { tamil: string }[] }>(join(CLEAN, 'tamil.json'));
  const tamilCorpus = [...couplets.flatMap((c) => c.tamil), ...chapters.map((c) => c.tamil)].join(' ').replace(/ /g, '');

  const seen = new Set<string>();
  const labels = new Map<string, string>();

  for (const e of entries) {
    const at = e.id ?? '(entry with no id)';
    if (!ID.test(e.id ?? '')) errors.push(`${at}: id must look like quality:anger`);
    if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
    seen.add(e.id);
    if (!IDEA_TYPES.includes(e.type)) errors.push(`${at}: unknown type ${e.type}`);
    if (e.id?.split(':')[0] !== e.type) errors.push(`${at}: id prefix does not match type ${e.type}`);
    if (!e.label?.trim()) errors.push(`${at}: no label`);

    const key = `${e.type}|${e.label?.toLowerCase()}`;
    if (labels.has(key)) errors.push(`${at}: same label as ${labels.get(key)}`);
    labels.set(key, e.id);

    if (!e.definition?.trim()) errors.push(`${at}: no definition`);
    else if (e.definition.length > MAX_DEFINITION) errors.push(`${at}: definition is over ${MAX_DEFINITION} characters`);

    if (e.type === 'quality') {
      if (!['virtue', 'vice', 'state'].includes(e.polarity ?? '')) errors.push(`${at}: a quality needs polarity virtue, vice or state`);
      if (!e.boundary?.trim()) errors.push(`${at}: a quality needs a boundary note`);
    } else if (e.polarity !== undefined) {
      errors.push(`${at}: only qualities have polarity`);
    }

    const wanted = e.type === 'situation' ? 6 : 2;
    if ((e.synonyms?.length ?? 0) < wanted) errors.push(`${at}: needs at least ${wanted} synonyms`);
    for (const s of e.synonyms ?? []) if (s !== s.toLowerCase()) errors.push(`${at}: synonym "${s}" must be lowercase`);

    if ((e.evidence?.length ?? 0) < 2) errors.push(`${at}: needs at least 2 evidence couplets`);
    for (const n of e.evidence ?? []) if (!Number.isInteger(n) || n < 1 || n > 1330) errors.push(`${at}: evidence ${n} is not a couplet`);

    if (e.tamil !== undefined) {
      if (!TAMIL_ONLY.test(e.tamil)) errors.push(`${at}: tamil must be Tamil script only`);
      else if (!attestedIn(tamilCorpus, e.tamil)) errors.push(`${at}: ${e.tamil} is not attested in the Kural`);
    }
    if ('iast' in e) errors.push(`${at}: never write iast, it is derived from tamil`);
  }

  const synonymOwners = new Map<string, string>();
  for (const e of entries) {
    for (const s of e.synonyms ?? []) {
      const key = `${e.type}|${s}`;
      const owner = synonymOwners.get(key);
      if (owner !== undefined && owner !== e.id) warnings.push(`"${s}" is a synonym of both ${owner} and ${e.id}`);
      synonymOwners.set(key, e.id);
    }
  }
  return { errors, warnings };
}
