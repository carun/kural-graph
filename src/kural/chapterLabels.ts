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
}

/** World units per CSS pixel at a distance from the camera. */
const worldPerPx = (d: number, v: LabelView) => (2 * d * Math.tan((v.camera.fov * Math.PI) / 360)) / v.height;

/** Font size on screen: at home it falls off with depth as his does, and it grows gently as you zoom in. */
export const labelPx = (d: number, v: LabelView) => Math.min(26, Math.max(6.5, 9 * (v.distance / d) * Math.pow(v.home / v.distance, 0.35)));

/** The same as a world height, for sizing the sprite. */
export const labelHeight = (d: number, v: LabelView) => labelPx(d, v) * worldPerPx(d, v);

/** Sets a label's height for this frame, keeping it just above its point. */
export function sizeLabel(l: THREE.Sprite, r: number, at: THREE.Vector3, v: LabelView) {
  const h = labelHeight(at.distanceTo(v.camera.position), v);
  l.scale.set((l.scale.x / l.scale.y) * h, h, 1);
  l.position.y = r + h * 0.95;
}

const at = new THREE.Vector3();

/**
 * The labels to show right now: nearest first, each only if it clears those already placed, so the near chapters are
 * always named and the far side thins out. Labels already showing get a head start, which stops them flickering as the
 * ring turns.
 */
export function pickLabels(hubs: Hub[], shown: ReadonlySet<string>, v: LabelView, most: number) {
  const boxes = hubs.flatMap((hub) => {
    const d = hub.at.distanceTo(v.camera.position);
    at.copy(hub.at).project(v.camera);
    if (at.z > 1) return [];
    const px = hub.size ? hub.size / worldPerPx(d, v) : labelPx(d, v);
    const x = ((at.x + 1) / 2) * v.width;
    const y = ((1 - at.y) / 2) * v.height - hub.r / worldPerPx(d, v) - px;
    const w = hub.text.length * px * 0.53;
    if (x - w / 2 < 0 || x + w / 2 > v.width || y < 0 || y > v.height) return [];
    return [{ id: hub.id, x, y, w: w + 14, h: px * 2 + 4, rank: d * (shown.has(hub.id) ? 0.8 : 1) }];
  });
  boxes.sort((a, b) => a.rank - b.rank);
  const kept: typeof boxes = [];
  for (const b of boxes) {
    if (kept.length >= most) break;
    if (!kept.some((k) => Math.abs(k.x - b.x) * 2 < k.w + b.w && Math.abs(k.y - b.y) * 2 < k.h + b.h)) kept.push(b);
  }
  return new Set(kept.map((b) => b.id));
}

/** Candidates for a name: every chapter, and any other point the camera has come close to. */
export function hubsNear(visuals: Map<string, { kind: string; group: THREE.Group; r: number; labelSpec: { text: string; size: number } | null }>, v: LabelView) {
  const hubs: Hub[] = [];
  for (const [id, { kind, group, r, labelSpec }] of visuals) {
    if (!group.parent || !labelSpec) continue;
    if (kind === "chapter") hubs.push({ id, text: labelSpec.text, at: group.position, r });
    else if (group.position.distanceTo(v.camera.position) < 600) hubs.push({ id, text: labelSpec.text, at: group.position, r, size: labelSpec.size });
  }
  return hubs;
}
