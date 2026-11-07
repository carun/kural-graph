#!/usr/bin/env node
// Puts a real painting in a slot on the home page, in place of the painted one:
//   node scripts/home-art/swap.mjs hero ~/paintings/dusk.png
// It crops to the slot's shape from the centre and writes every width Picture.tsx asks for.
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SLOTS } from "./slots.mjs";

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/images/home");
const [key, file] = process.argv.slice(2);
const slot = SLOTS[key];
if (!slot || !file) {
  console.error(`Usage: swap.mjs <slot> <image>\nSlots: ${Object.keys(SLOTS).join(", ")}`);
  process.exit(1);
}
const { width, height } = await sharp(file).metadata();
if (width < slot.w || height < slot.h) console.warn(`Warning: ${width}x${height} is smaller than the ${slot.w}x${slot.h} this slot wants, so it will be scaled up.`);
for (const w of slot.widths) {
  const h = Math.round((w * slot.h) / slot.w);
  await sharp(file).resize(w, h, { fit: "cover", position: "centre" }).webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(join(HOME, `${slot.base}-${w}.webp`));
  console.log(`${slot.base}-${w}.webp`);
}
