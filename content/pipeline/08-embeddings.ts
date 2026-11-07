import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Merged } from './06-merge.ts';
import { Checks } from './lib/check.ts';
import { createEmbedder } from './lib/embedder.ts';
import { ROOT, writeJson } from './lib/paths.ts';
import { loadChapters } from './lib/readings.ts';

const DIMENSIONS = 384;
const DATA = join(ROOT, 'public', 'data');

/** Stored as int8, about a quarter of the size of float32, at no cost a reader could notice. */
export async function buildVectors(merged: Merged): Promise<void> {
  const checks = new Checks('embeddings');
  const notes = new Map(merged.shards.flatMap((s) => s.couplets).map((c) => [c.n, c]));
  const embed = await createEmbedder();

  const items: { id: string; text: string }[] = [
    ...loadChapters().flatMap((c) => c.couplets).map((c) => {
      const note = notes.get(c.n);
      return { id: `k${c.n}`, text: [c.plain, note?.gloss, note?.keywords.join(', ')].filter(Boolean).join(' ') };
    }),
    ...merged.ideas.map((v) => ({ id: v.id, text: `${v.label}: ${v.definition} ${v.synonyms.join(', ')}` })),
  ];

  const vectors: Float32Array[] = [];
  for (const item of items) vectors.push(await embed(item.text));

  let peak = 0;
  for (const v of vectors) {
    const norm = Math.hypot(...v);
    checks.that(Math.abs(norm - 1) < 1e-3, `a vector has length ${norm}`);
    checks.equal(v.length, DIMENSIONS, 'vector dimensions');
    for (const x of v) peak = Math.max(peak, Math.abs(x));
  }

  const scale = 127 / peak;
  const packed = new Int8Array(vectors.length * DIMENSIONS);
  vectors.forEach((v, row) => v.forEach((x, i) => {
    packed[row * DIMENSIONS + i] = Math.round(x * scale);
  }));

  writeFileSync(join(DATA, 'vectors.bin'), Buffer.from(packed.buffer));
  writeJson(join(DATA, 'vectors.json'), { dimensions: DIMENSIONS, scale, ids: items.map((i) => i.id) });
  console.log(`  ${vectors.length} vectors, ${Math.round(packed.byteLength / 1024)} KB`);
  checks.finish();
}
