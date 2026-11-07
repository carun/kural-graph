import { join } from 'node:path';
import { ANNOTATIONS, chainProblems, crossLinkProblems, loadChains, loadCrossLinks, loadShards, shardProblems, type Shard } from './lib/annotations.ts';
import { readJson } from './lib/paths.ts';
import { loadVocabulary } from './lib/vocabulary.ts';

/** Checks one shard file by name, or every shard. Exits non-zero if anything fails. */
const name = process.argv[2];
const shards: Shard[] = name === undefined ? loadShards() : [readJson<Shard>(join(ANNOTATIONS, `${name}.json`))];
const vocabulary = loadVocabulary();

let total = 0;
for (const shard of shards) {
  const problems = shardProblems(shard, vocabulary);
  total += problems.length;
  const edges = shard.couplets.reduce((n, c) => n + (c.edges?.length ?? 0), 0);
  console.log(`${shard.shard}: ${shard.couplets.length} couplets, ${edges} edges, ${shard.ideaLinks?.length ?? 0} idea links, ${shard.proposals?.length ?? 0} proposals`);
  for (const p of problems.slice(0, 60)) console.log(`  ${p}`);
  if (problems.length > 60) console.log(`  ...and ${problems.length - 60} more`);
}
if (name === undefined) {
  for (const file of loadCrossLinks()) {
    const problems = crossLinkProblems(file);
    total += problems.length;
    console.log(`${file.shard}: ${file.links.length} links`);
    for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
  }
  const problems = chainProblems(loadChains(), vocabulary);
  total += problems.length;
  for (const p of problems) console.log(`  ${p}`);
}
console.log(total === 0 ? 'All annotations are clean.' : `${total} problems.`);
process.exitCode = total === 0 ? 0 : 1;
