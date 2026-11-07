import { forceCenter, forceLink, forceManyBody, forceSimulation, type SimLink, type SimNode } from 'd3-force-3d';
import { Checks } from './lib/check.ts';
import { type Graph, type GraphNode } from './lib/graph.ts';

/** [x, y] is the plan view, as if looking down on the lotus. z is height above the ring. */
export type Positions = Record<string, [number, number, number]>;

const RING = 1000;
const PART_GAP_DEGREES = 5;
const CHAPTERS = 133;
const PART_STARTS = new Set([39, 109]);

/** Couplets form a teardrop outside their chapter: 1, 2, 3, 3, 1 from the ring outwards. */
const PETAL_ROWS = [1, 2, 3, 3, 1];
const PETAL_START = 36;
const PETAL_ROW_STEP = 25;
const PETAL_LATERAL_STEP = 13.5;
const PETAL_BASE_HEIGHT = 34;
const PETAL_RISE = 58;

const DIVISION_RADIUS = 870;
const PART_LABEL_RADIUS = 800;
const IDEA_MIN_RADIUS = 70;
const IDEA_MAX_RADIUS = 720;
const IDEA_MIN_SPACING = 36;
const DOME_BASE_HEIGHT = 110;
const DOME_HEIGHT = 620;
const RELAX_ROUNDS = 240;
const MIN_NODE_SPACING = 10;

const round = (v: number): number => Math.round(v * 10) / 10;
const polar = (angle: number, radius: number): [number, number] => [Math.sin(angle) * radius, Math.cos(angle) * radius];

/** Clockwise from the top, with a gap before each part. */
function chapterAngles(): number[] {
  const gap = (PART_GAP_DEGREES * Math.PI) / 180;
  const step = (2 * Math.PI - gap * 3) / CHAPTERS;
  const angles: number[] = [];
  let angle = gap / 2 + step / 2;
  for (let n = 1; n <= CHAPTERS; n++) {
    if (PART_STARTS.has(n)) angle += gap;
    angles.push(angle);
    angle += step;
  }
  return angles;
}

function petal(angle: number, index: number): [number, number, number] {
  let row = 0;
  let left = index;
  while (left >= PETAL_ROWS[row]!) {
    left -= PETAL_ROWS[row]!;
    row++;
  }
  const width = PETAL_ROWS[row]!;
  const lateral = (left - (width - 1) / 2) * PETAL_LATERAL_STEP;
  const radial = RING + PETAL_START + row * PETAL_ROW_STEP;
  const [ox, oy] = polar(angle, radial);
  return [ox + Math.cos(angle) * lateral, oy - Math.sin(angle) * lateral, PETAL_BASE_HEIGHT + row * PETAL_RISE];
}

interface IdeaFocus {
  angle: number;
  /** 1 when an idea sits in one place on the ring, near 0 when it spreads all round. */
  focus: number;
}

/** An idea's angle is the mean of its chapters, and its focus how tightly they cluster. */
function ideaFocus(node: GraphNode, angles: number[]): IdeaFocus {
  let sumX = 0;
  let sumY = 0;
  let total = 0;
  for (const [chapter, weight] of Object.entries(node.chapters ?? {})) {
    const angle = angles[Number(chapter) - 1]!;
    sumX += Math.sin(angle) * weight;
    sumY += Math.cos(angle) * weight;
    total += weight;
  }
  if (total === 0) return { angle: 0, focus: 0 };
  return { angle: Math.atan2(sumX, sumY), focus: Math.hypot(sumX, sumY) / total };
}

/**
 * Radius comes from an idea's rank by focus, not the raw value. Most ideas are
 * focused, so raw values would pile them against the outer edge and draw a ring
 * that means nothing. The square root gives each idea equal area, so the disc
 * fills evenly while cross-cutting ideas still sit at the centre.
 */
function placeIdeas(ideas: GraphNode[], angles: number[]): [number, number][] {
  const foci = ideas.map((node) => ideaFocus(node, angles));
  const order = ideas.map((_, i) => i).sort((a, b) => foci[a]!.focus - foci[b]!.focus || ideas[a]!.id.localeCompare(ideas[b]!.id));
  const points = new Array<[number, number]>(ideas.length);
  order.forEach((ideaIndex, rank) => {
    const radius = IDEA_MIN_RADIUS + (IDEA_MAX_RADIUS - IDEA_MIN_RADIUS) * Math.sqrt((rank + 0.5) / ideas.length);
    points[ideaIndex] = polar(foci[ideaIndex]!.angle, radius);
  });
  return points;
}

/** A stable 0-1 value from a name, so depth inside the dome never changes between builds. */
function stableFraction(text: string): number {
  let hash = 2166136261;
  for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

/**
 * Ideas form a dome over the centre of the ring, so the ones that cut across the
 * whole text rise to its crown. Each sits somewhere inside the dome rather than
 * on its surface, which keeps it from reading as a hollow shell.
 */
function domeHeight(id: string, x: number, y: number): number {
  const reach = Math.min(1, Math.hypot(x, y) / (IDEA_MAX_RADIUS + 40));
  const surface = Math.sqrt(1 - reach * reach);
  return DOME_BASE_HEIGHT + DOME_HEIGHT * surface * (0.45 + 0.55 * stableFraction(id));
}

/** Fixed order and rounds with no randomness, so the same input always gives the same map. */
function relax(points: [number, number][], fixed: [number, number][]): void {
  for (let round_ = 0; round_ < RELAX_ROUNDS; round_++) {
    for (const anchor of fixed) {
      for (const p of points) {
        const dx = p[0] - anchor[0];
        const dy = p[1] - anchor[1];
        const distance = Math.hypot(dx, dy) || 1;
        if (distance >= IDEA_MIN_SPACING) continue;
        p[0] += (dx / distance) * (IDEA_MIN_SPACING - distance);
        p[1] += (dy / distance) * (IDEA_MIN_SPACING - distance);
      }
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        let distance = Math.hypot(dx, dy);
        if (distance >= IDEA_MIN_SPACING) continue;
        if (distance < 0.001) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          distance = 1;
        }
        const push = (IDEA_MIN_SPACING - distance) / 2 / distance;
        a[0] -= dx * push;
        a[1] -= dy * push;
        b[0] += dx * push;
        b[1] += dy * push;
      }
    }
    for (const p of points) {
      const radius = Math.hypot(p[0], p[1]);
      if (radius > IDEA_MAX_RADIUS) {
        p[0] *= IDEA_MAX_RADIUS / radius;
        p[1] *= IDEA_MAX_RADIUS / radius;
      }
    }
  }
}

function meanAngle(first: number, last: number, angles: number[]): number {
  return (angles[first - 1]! + angles[last - 1]!) / 2;
}

/** Settled at this size, then scaled to the lotus's ring, so one camera fits both shapes. */
const SIM_RING = 640;
const SIM_TICKS = 350;
const CHAPTER_WAVE = 34;
const CHAPTER_WAVES = 7;
const COUPLET_REACH = 1.18;
const IDEA_REACH = 0.74;
const LINK_DISTANCE: Record<string, number> = { IN_CHAPTER: 34, NEXT_COUPLET: 12 };
const LINK_STRENGTH: Record<string, number> = { IN_CHAPTER: 0.9, NEXT_COUPLET: 0.35 };
const IDEA_LINK_DISTANCE = 85;
const IDEA_LINK_STRENGTH = 0.07;
const LEFT_OUT = new Set(['IN_DIVISION', 'NEXT_CHAPTER', 'SPOKEN_BY', 'FOLLOWS']);

/** Keeps couplets near the rim, ideas within it, and everything near the plane of the ring. */
function containment(nodes: (SimNode & { type: string })[]) {
  return (alpha: number): void => {
    for (const n of nodes) {
      if (n.fx !== undefined) continue;
      const radius = Math.hypot(n.x!, n.z!);
      const limit = SIM_RING * (n.type === 'couplet' ? COUPLET_REACH : IDEA_REACH);
      if (radius > limit) {
        const pull = ((radius - limit) / radius) * alpha * 0.35;
        n.vx! -= n.x! * pull;
        n.vz! -= n.z! * pull;
      }
      n.vy! -= n.y! * alpha * 0.03;
    }
  };
}

/**
 * The galaxy: chapters on a gently waved ring, at the same angles as the lotus, and everything
 * else placed by what it links to. The simulation has no randomness, so a rerun gives the same map.
 */
export function computeGalaxy(graph: Graph, lotus: Positions): Positions {
  const checks = new Checks('galaxy');
  const angles = chapterAngles();
  const nodes = graph.nodes
    .filter((n) => n.type !== 'part' && n.type !== 'division' && n.type !== 'voice')
    .map((n): SimNode & { type: string } => {
      if (n.type !== 'chapter') return { id: n.id, type: n.type };
      const angle = angles[n.chapter! - 1]!;
      const [x, z] = [Math.sin(angle) * SIM_RING, -Math.cos(angle) * SIM_RING];
      const y = CHAPTER_WAVE * Math.sin(angle * CHAPTER_WAVES);
      return { id: n.id, type: n.type, x, y, z, fx: x, fy: y, fz: z };
    });
  const kept = new Set(nodes.map((n) => n.id));
  const links: SimLink[] = graph.edges
    .filter((e) => !LEFT_OUT.has(e.type) && kept.has(e.source) && kept.has(e.target))
    .map((e) => ({ source: e.source, target: e.target, type: e.type }));

  const simulation = forceSimulation(nodes, 3)
    .alphaDecay(0.022)
    .velocityDecay(0.33)
    .force('link', forceLink(links).id((n) => n.id).distance((l) => LINK_DISTANCE[l.type] ?? IDEA_LINK_DISTANCE).strength((l) => LINK_STRENGTH[l.type] ?? IDEA_LINK_STRENGTH))
    .force('charge', forceManyBody().strength(-22).distanceMax(420))
    .force('center', forceCenter())
    .force('contain', containment(nodes))
    .stop();
  for (let i = 0; i < SIM_TICKS; i++) simulation.tick();

  const scale = RING / SIM_RING;
  // Part names and voices aren't drawn as points, so they keep their places in the ring.
  const positions: Positions = { ...lotus };
  for (const n of nodes) positions[n.id] = [round(n.x! * scale), round(-n.z! * scale), round(n.y! * scale)];
  checks.that(Object.values(positions).flat().every(Number.isFinite), 'every galaxy position is a number');
  checks.finish();
  return positions;
}

export function computeLayout(graph: Graph): Positions {
  const checks = new Checks('layout');
  const angles = chapterAngles();
  const positions: Positions = {};
  const ideas: GraphNode[] = [];

  for (const node of graph.nodes) {
    switch (node.type) {
      case 'chapter':
        positions[node.id] = [...polar(angles[node.chapter! - 1]!, RING), 0];
        break;
      case 'couplet': {
        const index = (Number(node.label) - 1) % 10;
        positions[node.id] = petal(angles[node.chapter! - 1]!, index);
        break;
      }
      case 'part':
      case 'division': {
        const span = Object.keys(node.chapters ?? {}).map(Number);
        const angle = meanAngle(Math.min(...span), Math.max(...span), angles);
        positions[node.id] = [...polar(angle, node.type === 'part' ? PART_LABEL_RADIUS : DIVISION_RADIUS), 0];
        break;
      }
      case 'voice': {
        // Part III's speakers sit together just inside its arc.
        const offset = { 'voice:he': -0.09, 'voice:she': 0, 'voice:maid': 0.09 }[node.id] ?? 0;
        positions[node.id] = [...polar(meanAngle(109, 133, angles) + offset, RING - 60), 0];
        break;
      }
      default:
        ideas.push(node);
    }
  }

  const points = placeIdeas(ideas, angles);
  relax(points, graph.nodes.filter((n) => n.type === 'part').map((n) => [positions[n.id]![0], positions[n.id]![1]]));
  ideas.forEach((node, i) => {
    const [x, y] = points[i]!;
    positions[node.id] = [x, y, domeHeight(node.id, x, y)];
  });

  for (const [id, [x, y, z]] of Object.entries(positions)) positions[id] = [round(x), round(y), round(z)];

  const entries = Object.entries(positions);
  checks.equal(entries.length, graph.nodes.length, 'every node placed');
  let closest = Infinity;
  let pair = '';
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [a, pa] = entries[i]!;
      const [b, pb] = entries[j]!;
      const distance = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      if (distance < closest) {
        closest = distance;
        pair = `${a} and ${b}`;
      }
    }
  }
  checks.that(closest >= MIN_NODE_SPACING, `${pair} are only ${closest.toFixed(1)} apart`);
  console.log(`  closest pair ${closest.toFixed(1)} units (${pair})`);
  checks.finish();
  return positions;
}
