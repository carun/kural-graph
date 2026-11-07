import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');
/** The repository around this folder: node_modules, and the public folder that ships. */
export const REPO = join(ROOT, '..');
export const CACHE = join(ROOT, '.cache');
export const CLEAN = join(ROOT, 'data', 'clean');
export const EVAL = join(ROOT, 'data', 'eval');

export const readText = (path: string): string => readFileSync(path, 'utf8');
export const readJson = <T>(path: string): T => JSON.parse(readText(path)) as T;

export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export const writeJson = (path: string, value: unknown): void =>
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
