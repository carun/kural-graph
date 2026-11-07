import { IDEA_TYPES } from './lib/graph.ts';
import { loadVocabulary, vocabularyProblems } from './lib/vocabulary.ts';

const entries = loadVocabulary();
const { errors, warnings } = vocabularyProblems(entries);

console.log(IDEA_TYPES.map((t) => `${t} ${entries.filter((e) => e.type === t).length}`).join(', '));
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(errors.length === 0 ? 'Vocabulary is valid.' : `${errors.length} errors.`);
process.exitCode = errors.length === 0 ? 0 : 1;
