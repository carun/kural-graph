import { run as fetchSources } from './01-fetch.ts';
import { run as parseTamil } from './03-parse-tamil.ts';
import { run as parseCommentary } from './03b-commentary.ts';
import { buildStructure } from './05-structure.ts';
import { mergeAnnotations } from './06-merge.ts';
import { computeGalaxy, computeLayout } from './07-layout.ts';
import { buildVectors } from './08-embeddings.ts';
import { stageModels } from './08-models.ts';
import { bundle } from './09-bundle.ts';
import { addSyntheticIdeas } from './lib/synthetic.ts';

await fetchSources();
parseTamil();
parseCommentary();

const structure = buildStructure();
const merged = mergeAnnotations(structure);
// Placeholder ideas stand in only until annotation exists, and a release build refuses them.
const graph = merged?.graph ?? addSyntheticIdeas(structure);
await stageModels();
const lotus = computeLayout(graph);
bundle(graph, lotus, computeGalaxy(graph, lotus), merged);
if (merged !== null) await buildVectors(merged);
console.log('Pipeline complete.');
