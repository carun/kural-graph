// Every picture on the home page, by its key in ART in src/components/home/Picture.tsx (keep the two in step): the scene
// that paints it, the name of its files, and the sizes they come in. The last width is the size it is painted at.
export const SLOTS = {
  hero: { scene: "hero", base: "hero", w: 1672, h: 941, widths: [828, 1280, 1672] },
  heroPortrait: { scene: "heroPortrait", base: "hero-portrait", w: 1120, h: 1400, widths: [750, 1120] },
  fightOrFlight: { scene: "leaves", base: "leaves", w: 1080, h: 607, widths: [720, 1080] },
  cosmicWide: { scene: "nightWide", base: "night-wide", w: 1911, h: 819, widths: [1280, 1911] },
  cosmic: { scene: "night", base: "night", w: 1280, h: 720, widths: [828, 1280] },
  ch01: { scene: "rain", base: "part-righteousness", w: 960, h: 720, widths: [640, 960] },
  ch02: { scene: "rice", base: "part-wealth", w: 960, h: 720, widths: [640, 960] },
  ch18: { scene: "moon", base: "part-desire", w: 960, h: 720, widths: [640, 960] },
  setting: { scene: "cart", base: "setting", w: 1200, h: 800, widths: [768, 1200] },
  lamp: { scene: "lamp", base: "lamp", w: 900, h: 900, widths: [560, 900] },
  dusk: { scene: "dusk", base: "dusk", w: 1200, h: 630, widths: [800, 1200] },
};
