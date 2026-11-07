#!/usr/bin/env node
// Paints the home page's pictures into public/images/home, and the link preview into public/og.jpg.
//   node scripts/home-art/paint.mjs             every scene
//   node scripts/home-art/paint.mjs hero lamp   only these
//   node scripts/home-art/paint.mjs --preview <dir> hero   a full-size PNG instead, for looking at
// It needs a browser: run `npx playwright install chromium` once.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { SLOTS } from "./slots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(ROOT, "public/images/home");

const OG = { scene: "og", w: 1200, h: 630 };

const args = process.argv.slice(2);
const at = args.indexOf("--preview");
const preview = at >= 0 ? args.splice(at, 2)[1] : null;
const wanted = new Set(args);
const jobs = [...Object.values(SLOTS), OG].filter((j) => !wanted.size || wanted.has(j.scene));

const fonts = [
  ["Noto Serif Tamil", "@fontsource/noto-serif-tamil/files/noto-serif-tamil-tamil-600-normal.woff2", "600"],
  ["Noto Serif Tamil", "@fontsource/noto-serif-tamil/files/noto-serif-tamil-tamil-400-normal.woff2", "400"],
  ["Source Serif 4", "@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-normal.woff2", "200 900"],
  ["Inter", "@fontsource-variable/inter/files/inter-latin-standard-normal.woff2", "100 900"],
].map(([family, file, weight]) => ({ family, weight, data: readFileSync(join(ROOT, "node_modules", file)).toString("base64") }));

const verses = JSON.parse(readFileSync(join(ROOT, "public/data/kural-verses.json"), "utf8")).verses;
const graph = JSON.parse(readFileSync(join(ROOT, "public/data/kural-graph.json"), "utf8"));
const layout = JSON.parse(readFileSync(join(ROOT, "public/data/kural-layout.json"), "utf8"));
const skip = new Set(["SPOKE", "NEXT_VERSE", "BELONGS_TO", "NEXT_CHAPTER"]);
const data = {
  couplets: verses.slice(0, 6).map((v) => v.sanskrit),
  nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type })),
  edges: graph.edges.filter((e) => !skip.has(e.type)).map((e) => [e.source, e.target]),
  positions: layout.positions,
};

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.setContent("<!doctype html><title>paint</title>");
await page.addScriptTag({ path: join(HERE, "scenes.js") });
await page.evaluate(async (fonts) => {
  for (const f of fonts) {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    const face = new FontFace(f.family, bytes, { weight: f.weight });
    document.fonts.add(await face.load());
  }
}, fonts);

if (preview) mkdirSync(preview, { recursive: true });
else mkdirSync(OUT, { recursive: true });
for (const job of jobs) {
  const t = Date.now();
  const png = await page.evaluate(({ scene, w, h, data }) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    window.SCENES[scene](ctx, w, h, data);
    return c.toDataURL("image/png").split(",")[1];
  }, { ...job, data });
  const buf = Buffer.from(png, "base64");
  if (preview) writeFileSync(join(preview, `${job.scene}.png`), buf);
  else if (job === OG) await sharp(buf).jpeg({ quality: 86, mozjpeg: true }).toFile(join(ROOT, "public/og.jpg"));
  else for (const w of job.widths) await sharp(buf).resize(w).webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(join(OUT, `${job.base}-${w}.webp`));
  console.log(job.scene, `${Date.now() - t}ms`);
}
await browser.close();
