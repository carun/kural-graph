import { join } from 'node:path';
import type { TamilCouplet } from './03-parse-tamil.ts';
import { Checks } from './lib/check.ts';
import { parseCommentary } from './lib/commentary.ts';
import { CACHE, CLEAN, readJson, writeJson } from './lib/paths.ts';

/** Parimelazhagar's commentary, one entry per couplet. Both readings are checked against it. */
export function run(): void {
  const checks = new Checks('commentary');
  const pages = readJson<Record<string, { text: string }>>(join(CACHE, 'wikisource-parimelazhagar.json'));
  const { couplets } = readJson<{ couplets: TamilCouplet[] }>(join(CLEAN, 'tamil.json'));
  const { entries, prefaces } = parseCommentary(pages, couplets);
  checks.equal(entries.length, 1330, 'commentary entries');
  checks.equal(entries.filter((e) => e.gloss.length === 0).length, 0, 'entries with no gloss');
  checks.equal(Object.values(prefaces).filter((p) => p.length >= 25).length, 133, 'chapter introductions');
  writeJson(join(CLEAN, 'parimelazhagar.json'), { entries, prefaces });
  console.log(`  ${entries.length} entries; ${Object.keys(prefaces).length} chapter introductions`);
  checks.finish();
}

if (import.meta.main) run();
