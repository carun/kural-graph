import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, readJson, ROOT, writeJson } from './lib/paths.ts';
import { Checks } from './lib/check.ts';

const TAMIL_COMMIT = 'cf3ff6c5a73c23b4092913156830457caab65fd4';
const TAMIL_BASE = `https://raw.githubusercontent.com/tk120404/thirukkural/${TAMIL_COMMIT}`;

export const SOURCES = {
  tamilKural: { file: 'tamil-kural.json', url: `${TAMIL_BASE}/thirukkural.json` },
  tamilDetail: { file: 'tamil-detail.json', url: `${TAMIL_BASE}/detail.json` },
  madurai: {
    file: 'madurai.html',
    url: 'https://www.projectmadurai.org/pm_etexts/utf8/pmuni0001.html',
  },
} as const;

const LOCK = join(ROOT, 'pipeline', 'sources.lock.json');
type Lock = Record<string, { url: string; sha256: string }>;

const WIKISOURCE_API = 'https://ta.wikisource.org/w/api.php';
const WIKIMEDIA_AGENT = 'kural-graph-pipeline/0.1 (personal research tool)';
const BATCH = 12;
const BATCH_PAUSE_MS = 3000;

const MOOLAM_PAGE = 'பக்கம்:திருக்குறள், மூலம்.pdf/';
const MOOLAM_PAGES = 142;
const PARIMELAZHAGAR_PREFIX = 'திருக்குறள் பரிமேலழகர் உரை/';

/** Revisions are pinned so a later edit to a page can't silently change a witness. */
const WIKISOURCE_EDITIONS = {
  wikisource: { file: 'wikisource-moolam.json', pins: 'wikisource-revisions.json' },
  parimelazhagar: { file: 'wikisource-parimelazhagar.json', pins: 'parimelazhagar-revisions.json' },
} as const;

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'kural-graph-pipeline' } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

async function wikisourceQuery(params: Record<string, string>): Promise<WikisourceResponse> {
  const body = new URLSearchParams({ ...params, format: 'json', formatversion: '2' });
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(WIKISOURCE_API, { method: 'POST', body, headers: { 'User-Agent': WIKIMEDIA_AGENT } });
    if (res.ok) return (await res.json()) as WikisourceResponse;
    if (res.status !== 429) throw new Error(`Wikisource returned ${res.status}`);
    await pause(Number(res.headers.get('Retry-After') ?? 30) * 1000);
  }
  throw new Error('Wikisource is still rate limiting after 6 attempts');
}

interface WikisourceResponse {
  continue?: Record<string, string>;
  query: {
    allpages?: { title: string }[];
    pages?: { title: string; revisions?: { revid: number; slots: { main: { content: string } } }[] }[];
  };
}

export type WikisourcePages = Record<string, { revid: number; text: string }>;

async function allPages(prefix: string): Promise<string[]> {
  const titles: string[] = [];
  let next: Record<string, string> = {};
  for (;;) {
    const data = await wikisourceQuery({ action: 'query', list: 'allpages', apprefix: prefix, aplimit: 'max', ...next });
    titles.push(...(data.query.allpages ?? []).map((p) => p.title));
    if (data.continue === undefined) return titles;
    next = data.continue;
    await pause(BATCH_PAUSE_MS);
  }
}

async function fetchEdition(titles: () => Promise<string[]>, pinFile: string): Promise<Buffer> {
  const pinPath = join(ROOT, 'pipeline', pinFile);
  const pinned = existsSync(pinPath) ? readJson<Record<string, number>>(pinPath) : null;
  const wanted = pinned === null ? await titles() : Object.keys(pinned);
  const pages: WikisourcePages = {};

  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const selector: Record<string, string> = pinned === null
      ? { titles: batch.join('|') }
      : { revids: batch.map((t) => String(pinned[t])).join('|') };
    const data = await wikisourceQuery({ action: 'query', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', ...selector });
    for (const page of data.query.pages ?? []) {
      const revision = page.revisions?.[0];
      if (revision === undefined) throw new Error(`Wikisource has no revision for ${page.title}`);
      pages[page.title] = { revid: revision.revid, text: revision.slots.main.content };
    }
    await pause(BATCH_PAUSE_MS);
  }

  if (pinned === null) {
    writeJson(pinPath, Object.fromEntries(wanted.map((t) => [t, pages[t]!.revid])));
  }
  return Buffer.from(JSON.stringify(Object.fromEntries(wanted.map((t) => [t, pages[t]]))));
}

const EDITION_TITLES: Record<keyof typeof WIKISOURCE_EDITIONS, () => Promise<string[]>> = {
  // Proofread scans of a printed 1997 edition, numbered couplet by couplet.
  wikisource: async () => Array.from({ length: MOOLAM_PAGES }, (_, i) => `${MOOLAM_PAGE}${i + 1}`),
  // The verses sit inside Parimelazhagar's commentary, typed separately from the others.
  parimelazhagar: () => allPages(PARIMELAZHAGAR_PREFIX),
};

/** Raw downloads stay in the gitignored cache: the Tamil JSON holds fields we must not commit. */
export async function run(updateLock = process.argv.includes('--update-lock')): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  const lock: Lock = existsSync(LOCK) ? readJson<Lock>(LOCK) : {};
  const checks = new Checks('fetch');

  for (const [name, { file, url }] of Object.entries(SOURCES)) {
    const path = join(CACHE, file);
    const pinned = lock[name]?.url === url ? lock[name]?.sha256 : undefined;
    const cached = existsSync(path) ? readFileSync(path) : null;
    const bytes = cached !== null && sha256(cached) === pinned ? cached : await download(url);
    const hash = sha256(bytes);

    if (updateLock) {
      lock[name] = { url, sha256: hash };
    } else {
      checks.equal(hash, pinned, `${name} SHA-256 (rerun with --update-lock only after reviewing the change)`);
    }
    writeFileSync(path, bytes);
  }

  for (const [name, { file, pins }] of Object.entries(WIKISOURCE_EDITIONS)) {
    const path = join(CACHE, file);
    const pinned = lock[name]?.sha256;
    const cached = existsSync(path) ? readFileSync(path) : null;
    const bytes =
      cached !== null && sha256(cached) === pinned
        ? cached
        : await fetchEdition(EDITION_TITLES[name as keyof typeof WIKISOURCE_EDITIONS], pins);
    if (updateLock) {
      lock[name] = { url: `${WIKISOURCE_API} (revisions pinned in pipeline/${pins})`, sha256: sha256(bytes) };
    } else {
      checks.equal(sha256(bytes), pinned, `${name} SHA-256`);
    }
    writeFileSync(path, bytes);
  }

  if (updateLock) writeJson(LOCK, lock);
  checks.finish();
}

if (import.meta.main) await run();
