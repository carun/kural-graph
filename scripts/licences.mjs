#!/usr/bin/env node
// Writes public/third-party-notices.txt, for the About page. The bundles strip the licence comments that MIT and BSD ask
// us to keep, and the OFL wants its text to travel with the fonts, so everything shipped is gathered into one file.
// Runtime dependencies come from package-lock.json. next/font downloads the fonts at build time without their licences,
// so those are read from the same fonts in the dev dependencies. Run it after changing dependencies.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Dev tools the lock file doesn't mark as dev, because Next names Playwright as an optional peer.
const TOOLS = /node_modules\/(@playwright\/test|playwright|playwright-core)$/;
const LINE = `\n\n${"-".repeat(72)}\n\n`;

const MODEL = `all-MiniLM-L6-v2 (quantised ONNX conversion by Xenova)
Licence: Apache-2.0
https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
https://huggingface.co/Xenova/all-MiniLM-L6-v2
Full text: https://www.apache.org/licenses/LICENSE-2.0`;

const FONTS = [
  ["Inter", "@fontsource-variable/inter"],
  ["Source Serif 4", "@fontsource-variable/source-serif-4"],
  ["Noto Serif Tamil", "@fontsource/noto-serif-tamil"],
].map(([name, dir]) => `${name} (font)\nLicence: OFL-1.1\n\n${readFileSync(join(ROOT, "node_modules", dir, "LICENSE"), "utf8").trim()}`);

const licenceFile = (dir) => readdirSync(dir).find((f) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(f));

const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
const seen = new Set();
const packages = Object.entries(lock.packages)
  .filter(([path, p]) => path && !p.dev && !TOOLS.test(path) && existsSync(join(ROOT, path)))
  .map(([path, p]) => ({ path, name: path.split("node_modules/").pop(), version: p.version, license: p.license ?? "not stated" }))
  .filter((p) => !seen.has(`${p.name}@${p.version}`) && seen.add(`${p.name}@${p.version}`))
  .sort((a, b) => a.name.localeCompare(b.name));

const sections = packages.map((p) => {
  const dir = join(ROOT, p.path);
  const file = licenceFile(dir);
  const text = file ? readFileSync(join(dir, file), "utf8").trim() : `No licence file in the package. Declared licence: ${p.license}.`;
  return `${p.name} ${p.version}\nLicence: ${p.license}\n\n${text}`;
});

writeFileSync(join(ROOT, "public/third-party-notices.txt"), `${["Third-party notices for Kural Graph", MODEL, ...FONTS, ...sections].join(LINE)}\n`);
console.log(`${packages.length} packages, ${FONTS.length} fonts, ${sections.filter((s) => s.includes("No licence file")).length} packages without a licence file of their own`);
