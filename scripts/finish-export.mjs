#!/usr/bin/env node
/**
 * Finishes `next build` (output: "export") for a static host, with the steps Next can't do itself:
 *   1. moves Next's inline scripts into a file, because public/_headers blocks inline scripts;
 *   2. gives the service worker the list of everything a view can ask for, and a version made from its contents;
 *   3. checks the result against Cloudflare's limits.
 * Run by `npm run build`, and so by `npm run deploy`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUT = path.resolve("out");
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20_000;
const MODEL_FILES = ["models/minilm/model_quantized.onnx", "models/minilm/tokenizer.json", "models/minilm/tokenizer_config.json"];
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const hash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 16);
const files = (dir = OUT) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const rel = (file) => path.relative(OUT, file).split(path.sep).join("/");

if (!fs.existsSync(path.join(OUT, "index.html"))) fail("out/index.html is missing. Run `next build` first.");
for (const file of MODEL_FILES) if (!fs.existsSync(path.join(OUT, file))) fail(`out/${file} is missing. Run \`npm run build\`, which fetches it first.`);

// 1. Next writes each page's data as inline scripts. They only queue data, and it is read by DOMContentLoaded, so they
// can run from one file at the end of the body. This keeps them in order, and script-src free of 'unsafe-inline'.
for (const file of files().filter((f) => f.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(INLINE_SCRIPT)].map((m) => m[1]);
  if (scripts.length === 0) continue;
  const body = scripts.join(";\n");
  const src = `/_next/static/inline-${hash(body)}.js`;
  fs.writeFileSync(path.join(OUT, src), body);
  const moved = html.replace(INLINE_SCRIPT, "").replace("</body>", `<script src="${src}"></script></body>`);
  if (!moved.includes(src)) fail(`${rel(file)} has no </body> to put its script before.`);
  fs.writeFileSync(file, moved);
}

// Webpack writes this build machine's path into the ONNX runtime's chunk. Nothing reads it, so it needn't be published.
const here = pathToFileURL(process.cwd()).href;
for (const file of files(path.join(OUT, "_next/static/chunks"))) {
  const js = fs.readFileSync(file, "utf8");
  if (js.includes(here)) fs.writeFileSync(file, js.replaceAll(here, "file:///app"));
}

// 2. All the commentaries as one file, which the service worker unpacks.
const commentary = Object.fromEntries(
  files(path.join(OUT, "data/commentary"))
    .sort()
    .map((f) => [path.basename(f, ".json"), JSON.parse(fs.readFileSync(f, "utf8"))]),
);
fs.writeFileSync(path.join(OUT, "data/commentary-all.json"), JSON.stringify(commentary));

// What a first visit keeps. The model is left out: it comes on first use, and the embedding worker keeps it. So are the
// recordings: every reader would download all of them, and one failed file would stop the install.
const skip = (name) =>
  ["_headers", "sw.js", "404.html", "index.html", "index.txt", "og.jpg", "data/commentary-all.json"].includes(name) ||
  /^(models|audio|data\/commentary)\//.test(name) ||
  /^_next\/(?!static\/)/.test(name) ||
  /\.(wasm|mjs|map)$/.test(name);
const shell = files().map(rel).filter((name) => !skip(name)).sort();
// The host serves about.html at /about and redirects the file's own address there, so a page is kept under its clean
// address. A redirect can't be kept: a browser refuses one as the answer to a navigation.
const urls = ["/", ...shell.map((name) => `/${name.replace(/\.html$/, "")}`)];

const digest = createHash("sha256");
for (const name of ["index.html", "data/commentary-all.json", ...shell]) digest.update(name).update(fs.readFileSync(path.join(OUT, name)));
const version = `kural-graph-${digest.digest("hex").slice(0, 16)}`;

const swFile = path.join(OUT, "sw.js");
const sw = fs.readFileSync(swFile, "utf8");
const filled = sw.replace(/^const VERSION = .*$/m, `const VERSION = ${JSON.stringify(version)};`).replace(/^const SHELL = .*$/m, `const SHELL = ${JSON.stringify(urls)};`);
if (!filled.includes(version) || !filled.includes(urls[1])) fail("out/sw.js has no VERSION or SHELL line to fill in.");
fs.writeFileSync(swFile, filled);

// 3. Cloudflare Workers Static Assets refuses a deploy over these.
const all = files();
const big = all.filter((f) => fs.statSync(f).size > MAX_BYTES);
if (big.length > 0) fail(`over 25 MiB: ${big.map(rel).join(", ")}`);
if (all.length > MAX_FILES) fail(`${all.length} files, over the limit of ${MAX_FILES}`);
const size = (list) => (list.reduce((n, f) => n + fs.statSync(f).size, 0) / 1e6).toFixed(1);
console.log(`✓ ${version}: ${urls.length} files and ${Object.keys(commentary).length} commentaries kept on first visit (${size(shell.map((n) => path.join(OUT, n)))} MB of shell), ${all.length} files, ${size(all)} MB in out/`);
