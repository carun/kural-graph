import { existsSync } from 'node:fs';
import { readJson } from './lib/paths.ts';
import { chapterFile, chapterProblems, EXPECTED, type ChapterReading, type Expected } from './lib/readings.ts';

/** Checks the named chapters, or all 133. Exits non-zero if anything fails. */
const expected = readJson<Expected>(EXPECTED);
const wanted = process.argv.slice(2).map(Number);
const chapters = wanted.length > 0 ? wanted : Array.from({ length: 133 }, (_, i) => i + 1);

let total = 0;
let missing = 0;
for (const n of chapters) {
  if (!existsSync(chapterFile(n))) {
    missing++;
    if (wanted.length > 0) console.log(`chapter ${n}: not written yet`);
    continue;
  }
  const problems = chapterProblems(readJson<ChapterReading>(chapterFile(n)), expected);
  total += problems.length;
  console.log(`chapter ${n}: ${problems.length === 0 ? 'clean' : `${problems.length} problems`}`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
}
if (missing > 0) console.log(`${missing} chapters not written yet.`);
console.log(total === 0 && missing === 0 ? 'All readings are clean.' : `${total} problems.`);
process.exitCode = total === 0 && (missing === 0 || wanted.length === 0) ? 0 : 1;
