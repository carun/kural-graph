import * as THREE from "three";

/** His 18 chapter labels all fit around the ring. Our 133 can't, so these choose which labels to show and how large. */
export interface LabelView {
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  /** Distance from the camera to what it orbits, and the same at the home view. */
  distance: number;
  home: number;
}
export interface Hub {
  id: string;
  text: string;
  /** World position and radius. */
  at: THREE.Vector3;
  r: number;
  /** A fixed world height, for labels that don't size themselves to the screen. */
  size?: number;
  /** A chapter: named beside the ring, not above its point. */
  rim?: boolean;
  /** On screen now, perhaps fading out. A new name waits rather than appear on top of it. */
  showing?: boolean;
  /** Its width in label heights, once drawn. Until then it is estimated from its length. */
  aspect?: number;
  /** The node in focus: always named, and placed first. */
  first?: boolean;
}
/**
 * Where a name sits: above its point (0), below it (2), to its right (3) or left (4), or for a chapter on the ring,
 * outside it, pointing away from its centre like the numbers on a clock (1), or inside it (-1), when outside would run
 * off the screen or under a panel.
 */
export type Side = -1 | 0 | 1 | 2 | 3 | 4;
/** The fixed directions on screen (y down) of the places around a point. */
const AROUND: Partial<Record<Side, [number, number]>> = { 0: [0, -1], 2: [0, 1], 3: [1, 0], 4: [-1, 0] };
/** A screen rectangle, in CSS px from the canvas's top left. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** CSS px between a chapter's point and its name. */
const GAP = 5;
/**
 * Chapters further round the back of the ring than this (the cosine of their bearing from the camera's) go unnamed:
 * their names would be small, and in the crown they would sit inside it.
 */
const FAR = -0.3;

/** World units per CSS pixel at a distance from the camera. */
const worldPerPx = (d: number, v: LabelView) => (2 * d * Math.tan((v.camera.fov * Math.PI) / 360)) / v.height;

/** Font size on screen: at home it falls off with depth as his does, and it grows gently as you zoom in. */
export const labelPx = (d: number, v: LabelView) => Math.min(26, Math.max(6.5, 9 * (v.distance / d) * Math.pow(v.home / v.distance, 0.35)));

/** The same as a world height, for sizing the sprite. */
export const labelHeight = (d: number, v: LabelView) => labelPx(d, v) * worldPerPx(d, v);

const p = new THREE.Vector3();
const q = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

/** The way out from the ring's centre through a point, as a direction on screen (unit length, y down). */
function outwardOnScreen(at: THREE.Vector3, v: LabelView): [number, number] {
  const len = Math.hypot(at.x, at.z) || 1;
  p.copy(at).project(v.camera);
  q.set(at.x + (at.x / len) * 10, at.y, at.z + (at.z / len) * 10).project(v.camera);
  const sx = (q.x - p.x) * v.width;
  const sy = (p.y - q.y) * v.height;
  const n = Math.hypot(sx, sy);
  // Seen edge-on, the way out has no direction on screen: the name goes below.
  return n < 1e-6 ? [0, 1] : [sx / n, sy / n];
}

/** How far, in label heights, from a box's centre to its edge in direction (sx, sy), for a box `aspect` heights wide. */
const toEdge = (sx: number, sy: number, aspect: number) => Math.min(aspect / 2 / Math.max(Math.abs(sx), 1e-6), 0.5 / Math.max(Math.abs(sy), 1e-6));

/** The direction on screen (unit length, y down) from a point to its name. */
function dirOf(side: Side, at: THREE.Vector3, v: LabelView): [number, number] {
  if (side !== 1 && side !== -1) return AROUND[side]!;
  const [ox, oy] = outwardOnScreen(at, v);
  return [ox * side, oy * side];
}

/**
 * Puts a name beside its point at its present size: just above it, or with its nearest edge a few pixels from the point
 * in the direction of `side`, so it grows away from the point and, for a chapter, never lies across the ring.
 */
export function anchorLabel(l: THREE.Sprite, r: number, at: THREE.Vector3, v: LabelView, side: Side = 0) {
  if (side === 0) {
    l.center.set(0.5, 0.5);
    l.position.set(0, r + l.scale.y * 0.95, 0);
    return;
  }
  const aspect = l.scale.x / l.scale.y;
  const [sx, sy] = dirOf(side, at, v);
  const t = toEdge(sx, sy, aspect);
  // The sprite's anchor is the point on its edge facing the node.
  l.center.set(0.5 - (sx * t) / aspect, 0.5 + sy * t);
  const g = r + GAP * worldPerPx(at.distanceTo(v.camera.position), v);
  right.setFromMatrixColumn(v.camera.matrixWorld, 0);
  up.setFromMatrixColumn(v.camera.matrixWorld, 1);
  l.position.copy(right).multiplyScalar(sx * g).addScaledVector(up, -sy * g);
}

/** Sizes a name for this frame, for the screen, and puts it beside its point. */
export function placeLabel(l: THREE.Sprite, r: number, at: THREE.Vector3, v: LabelView, side: Side = 0) {
  const h = labelHeight(at.distanceTo(v.camera.position), v);
  l.scale.set((l.scale.x / l.scale.y) * h, h, 1);
  anchorLabel(l, r, at, v, side);
}

/** Sets a label's height for this frame, keeping it just above its point. */
export const sizeLabel = (l: THREE.Sprite, r: number, at: THREE.Vector3, v: LabelView) => placeLabel(l, r, at, v);

/** Where a name would be on screen, in CSS px. */
function boxOf(hub: Hub, side: Side, v: LabelView) {
  const d = hub.at.distanceTo(v.camera.position);
  p.copy(hub.at).project(v.camera);
  if (p.z > 1) return null;
  const perPx = worldPerPx(d, v);
  const px = hub.size ? hub.size / perPx : labelPx(d, v);
  const w = (hub.aspect ?? hub.text.length * 0.56) * px;
  const x = ((p.x + 1) / 2) * v.width;
  const y = ((1 - p.y) / 2) * v.height;
  const rPx = hub.r / perPx;
  if (side === 0) return { x, y: y - rPx - px, w, h: px, d };
  const [sx, sy] = dirOf(side, hub.at, v);
  const out = rPx + GAP + toEdge(sx, sy, w / px) * px;
  return { x: x + sx * out, y: y + sy * out, w, h: px, d };
}

/**
 * The labels to show right now, and on which side: nearest first, each only if it clears those already placed and any
 * panel over the graph, so the near chapters are always named and the far side thins out. A chapter's name goes outside
 * the ring, or inside only where outside would run off the screen or under a panel; a name crowded out by its
 * neighbours waits its turn instead. Labels already showing get a head start, and one inside moves out only once there
 * is room to spare, which stops them flickering as the ring turns. A new one never fades in over one still fading out.
 */
export function pickLabels(hubs: Hub[], shown: ReadonlyMap<string, Side>, v: LabelView, most: number, blocked: Rect[] = []): Map<string, Side> {
  const cam = v.camera.position;
  const camLen = Math.hypot(cam.x, cam.z) || 1;
  type Box = { id: string; side: Side; x: number; y: number; w: number; h: number; rank: number; showing: boolean };
  const hit = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  const covered = (b: Box) => blocked.some((r) => b.x + b.w / 2 > r.x0 && b.x - b.w / 2 < r.x1 && b.y + b.h / 2 > r.y0 && b.y - b.h / 2 < r.y1);
  const fits = (b: Box, slack = 0) => b.x - b.w / 2 - slack >= 0 && b.x + b.w / 2 + slack <= v.width && b.y - b.h / 2 >= 0 && b.y + b.h / 2 <= v.height && !covered({ ...b, w: b.w + slack * 2 });
  // Each candidate in the one place it may go.
  const boxes = hubs.flatMap((hub) => {
    if (hub.rim && (hub.at.x * cam.x + hub.at.z * cam.z) / ((Math.hypot(hub.at.x, hub.at.z) || 1) * camLen) < FAR) return [];
    const was = shown.get(hub.id);
    const make = (side: Side): Box | null => {
      const b = boxOf(hub, side, v);
      return b && { id: hub.id, side, x: b.x, y: b.y, w: b.w + 14, h: side === 0 ? b.h * 2 + 4 : b.h * 1.5 + 4, rank: b.d * (was !== undefined ? 0.8 : 1), showing: !!hub.showing };
    };
    if (!hub.rim) {
      const b = make(0);
      return b && fits(b) ? [b] : [];
    }
    // Coming back out from inside needs 24px to spare, so a name at the edge of the room doesn't flick in and out.
    const out = make(1);
    if (out && fits(out, was === -1 ? 24 : 0)) return [out];
    const inside = make(-1);
    if (inside && fits(inside)) return [inside];
    return out && fits(out) ? [out] : [];
  });
  boxes.sort((a, b) => a.rank - b.rank);
  const kept: Box[] = [];
  for (const b of boxes) {
    if (kept.length >= most) break;
    if (kept.some((k) => hit(k, b))) continue;
    if (!b.showing && boxes.some((o) => o.showing && o !== b && !kept.includes(o) && hit(o, b))) continue;
    kept.push(b);
  }
  return new Map(kept.map((b) => [b.id, b.side]));
}

/**
 * Names in a focused or highlighted neighbourhood, where all of them are wanted: the node in focus first, then nearest
 * first, each in the first place around its point (its last place, above, below, right, left) that clears the names
 * already placed, the relation tags and the panels. A name with no room waits until hovered or brought closer.
 */
export function pickAround(hubs: Hub[], was: ReadonlyMap<string, Side>, v: LabelView, blocked: Rect[] = []): Map<string, Side> {
  type Box = { x: number; y: number; w: number; h: number };
  const hit = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  const free = (b: Box) =>
    b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= v.width && b.y - b.h / 2 >= 0 && b.y + b.h / 2 <= v.height && !blocked.some((r) => b.x + b.w / 2 > r.x0 && b.x - b.w / 2 < r.x1 && b.y + b.h / 2 > r.y0 && b.y - b.h / 2 < r.y1);
  const order = hubs.map((hub) => ({ hub, d: hub.at.distanceTo(v.camera.position) })).sort((a, b) => Number(!!b.hub.first) - Number(!!a.hub.first) || a.d - b.d);
  const kept: Box[] = [];
  const out = new Map<string, Side>();
  for (const { hub } of order) {
    const last = was.get(hub.id);
    const places = [...new Set<Side>([...(last !== undefined && AROUND[last] ? [last] : []), 0, 2, 3, 4])];
    let chosen: [Side, Box] | null = null;
    for (const side of places) {
      const b = boxOf(hub, side, v);
      if (!b) continue;
      const box = { x: b.x, y: b.y, w: b.w + 8, h: b.h + 4 };
      if (free(box) && !kept.some((k) => hit(k, box))) {
        chosen = [side, box];
        break;
      }
    }
    if (!chosen && hub.first) {
      const b = boxOf(hub, 0, v);
      if (b) chosen = [0, { x: b.x, y: b.y, w: b.w + 8, h: b.h + 4 }];
    }
    if (!chosen) continue;
    kept.push(chosen[1]);
    out.set(hub.id, chosen[0]);
  }
  return out;
}

/** A sprite's rectangle on screen, in CSS px from the canvas's top left. */
export function spriteRect(s: THREE.Sprite, v: LabelView): Rect | null {
  s.getWorldPosition(p);
  const d = p.distanceTo(v.camera.position);
  p.project(v.camera);
  if (p.z > 1) return null;
  s.getWorldScale(q);
  const perPx = worldPerPx(d, v);
  const [w, h] = [q.x / perPx, q.y / perPx];
  const [x, y] = [((p.x + 1) / 2) * v.width, ((1 - p.y) / 2) * v.height];
  return { x0: x - s.center.x * w, x1: x + (1 - s.center.x) * w, y0: y - (1 - s.center.y) * h, y1: y + s.center.y * h };
}

/** Candidates for a name: every chapter, and any other point the camera has come close to. */
export function hubsNear(visuals: Map<string, { kind: string; group: THREE.Group; r: number; label: THREE.Sprite | null; labelSpec: { text: string; size: number } | null; labelOpacity: number }>, v: LabelView) {
  const hubs: Hub[] = [];
  for (const [id, { kind, group, r, label, labelSpec, labelOpacity }] of visuals) {
    if (!group.parent || !labelSpec) continue;
    const showing = labelOpacity > 0.05;
    const aspect = label ? label.scale.x / label.scale.y : undefined;
    if (kind === "chapter") hubs.push({ id, text: labelSpec.text, at: group.position, r, rim: true, showing, aspect });
    else if (group.position.distanceTo(v.camera.position) < 600) hubs.push({ id, text: labelSpec.text, at: group.position, r, size: labelSpec.size, showing, aspect });
  }
  return hubs;
}
