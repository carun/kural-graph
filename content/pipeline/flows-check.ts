import { flowProblems, loadFlows } from './lib/flows.ts';
import { loadVocabulary } from './lib/vocabulary.ts';

const flows = loadFlows();
const problems = flowProblems(flows, loadVocabulary());
for (const p of problems) console.log(p);
const { feelings, antidotes, situations, chapters, threads, present } = flows;
console.log(`${feelings.length} feelings, ${antidotes.length} antidotes, ${situations.length} situations, ${chapters.length} chapter reasons, ${threads.length} threads`);
console.log(`Files: feelings ${present.feelings ? 'yes' : 'no'}, situations ${present.situations ? 'yes' : 'no'}, book ${present.book ? 'yes' : 'no'}`);
console.log(problems.length === 0 ? 'All flows are clean.' : `${problems.length} problems.`);
process.exit(problems.length === 0 ? 0 : 1);
