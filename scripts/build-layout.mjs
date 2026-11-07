// Precomputes the 3D cosmos layout into public/data/kural-layout.json, so browsers place nodes directly instead of
// running a 350-tick force simulation on the main thread at every visit (and again on every legend toggle).
// Runs the same forces CosmicGraph3D used live (shared constants in src/lib/graph/layoutParams.ts).
// Usage: npm run data:layout   (also run after `npm run data` regenerates the graph)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import { ALPHA_DECAY, CHARGE, LAYOUT_TICKS, VELOCITY_DECAY, containForce, fixedPosition, hashUnit, linkDistance, linkStrength } from "../src/lib/graph/layoutParams.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const graph = JSON.parse(readFileSync(join(root, "public/data/kural-graph.json"), "utf8"));

const hubs = new Map(graph.nodes.filter((n) => n.type === "Chapter").map((n) => [n.number, fixedPosition(n)]));
const nodes = graph.nodes.map((n) => {
  const f = fixedPosition(n);
  if (f) return { id: n.id, type: n.type, x: f[0], y: f[1], z: f[2], fx: f[0], fy: f[1], fz: f[2] };
  // Couplets start beside their chapter, so 133 small clusters don't have to untangle from the middle.
  const hub = n.type === "Verse" ? hubs.get(n.chapter) : null;
  if (!hub) return { id: n.id, type: n.type };
  const a = hashUnit(n.id) * Math.PI * 2;
  const r = 6 + hashUnit(n.id, 1) * 20;
  return { id: n.id, type: n.type, x: hub[0] * 0.95 + Math.cos(a) * r, y: hub[1] + (hashUnit(n.id, 2) - 0.5) * 30, z: hub[2] * 0.95 + Math.sin(a) * r };
});
const ids = new Set(nodes.map((n) => n.id));
const links = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ source: e.source, target: e.target, type: e.type }));

const t0 = performance.now();
const sim = forceSimulation(nodes, 3)
  .alphaDecay(ALPHA_DECAY)
  .velocityDecay(VELOCITY_DECAY)
  .force("link", forceLink(links).id((d) => d.id).distance((l) => linkDistance(l.type)).strength((l) => linkStrength(l.type)))
  .force("charge", forceManyBody().strength(CHARGE.strength).distanceMax(CHARGE.distanceMax))
  .force("center", forceCenter())
  .force("contain", containForce())
  .stop();
for (let i = 0; i < LAYOUT_TICKS; i++) sim.tick();

const round = (v) => Math.round(v * 10) / 10;
const positions = Object.fromEntries(nodes.map((n) => [n.id, [round(n.x), round(n.y), round(n.z)]]));
// The lotus positions are written here by pipeline/export-fork.ts in the content repo; a rebuild keeps them.
const file = join(root, "public/data/kural-layout.json");
const { lotus, lotusRing } = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const doc = { kind: "gitaviswa-layout", version: 1, graphVersion: graph.meta?.version ?? null, generatedAt: graph.meta?.generatedAt ?? null, nodeCount: nodes.length, ticks: LAYOUT_TICKS, positions, lotus, lotusRing };
writeFileSync(file, JSON.stringify(doc));
console.log(`layout: ${nodes.length} nodes, ${links.length} links, ${LAYOUT_TICKS} ticks in ${Math.round(performance.now() - t0)} ms → public/data/kural-layout.json`);
