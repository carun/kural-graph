import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Checks } from './lib/check.ts';
import { readJson, REPO, ROOT, writeJson } from './lib/paths.ts';

const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
const MODEL_BASE = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${REVISION}`;
const MODEL_FILES = { 'model_quantized.onnx': 'onnx/model_quantized.onnx', 'tokenizer.json': 'tokenizer.json', 'tokenizer_config.json': 'tokenizer_config.json' };

const LOCK = join(ROOT, 'pipeline', 'models.lock.json');
export const MODEL_DIR = join(REPO, 'public', 'models', 'minilm');
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** Hosted with the app so semantic search keeps working offline and never touches a CDN. Too big to keep in git, so it's fetched once and checked. */
export async function stageModels(updateLock = process.argv.includes('--update-lock')): Promise<void> {
  const checks = new Checks('models');
  mkdirSync(MODEL_DIR, { recursive: true });
  const lock: Record<string, string> = existsSync(LOCK) ? readJson(LOCK) : {};

  for (const [file, remote] of Object.entries(MODEL_FILES)) {
    const path = join(MODEL_DIR, file);
    let bytes = existsSync(path) ? readFileSync(path) : null;
    if (bytes === null || sha256(bytes) !== lock[file]) {
      console.log(`  fetching ${file}`);
      const res = await fetch(`${MODEL_BASE}/${remote}`, { headers: { 'User-Agent': 'kural-graph-pipeline' } });
      if (!res.ok) throw new Error(`${remote} returned ${res.status}`);
      bytes = Buffer.from(await res.arrayBuffer());
      writeFileSync(path, bytes);
    }
    if (updateLock || lock[file] === undefined) lock[file] = sha256(bytes);
    checks.equal(sha256(bytes), lock[file], `${file} SHA-256`);
  }

  if (updateLock) writeJson(LOCK, lock);
  checks.finish();
}

if (import.meta.main) await stageModels();
