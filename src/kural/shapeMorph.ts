import * as THREE from "three";
import type { GraphShape } from "./graphShape";

// The change of shape, and the batches it moves. Kept apart from graphShape.ts so the Display panel doesn't pull in three.
type Vec3 = [number, number, number];
type Point = { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number };
export const pointAt = (n: Point): Vec3 => [n.fx ?? n.x ?? 0, n.fy ?? n.y ?? 0, n.fz ?? n.z ?? 0];

/**
 * A line from a to b as `n` segments, written into `out` from segment `at`. In the galaxy (mix 0) it is straight. In the
 * lotus (mix 1) it bows up and in towards the stem, so the links read as a flower rather than a tangle.
 */
export function drawLine(out: Float32Array, at: number, a: Point, b: Point, n: number, mix: number) {
  const [ax, ay, az] = pointAt(a);
  const [bx, by, bz] = pointAt(b);
  const write = (i: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    out[i] = x0;
    out[i + 1] = y0;
    out[i + 2] = z0;
    out[i + 3] = x1;
    out[i + 4] = y1;
    out[i + 5] = z1;
  };
  if (n === 1) return write(at * 6, ax, ay, az, bx, by, bz);
  const [mx, my, mz] = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
  const rise = Math.max(ay, by) + 96 + Math.hypot(bx - ax, by - ay, bz - az) * 0.16;
  const [cx, cy, cz] = [mx * (1 - 0.55 * mix), my + (rise - my) * mix, mz * (1 - 0.55 * mix)];
  let [px, py, pz] = [ax, ay, az];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const [wa, wc, wb] = [(1 - t) * (1 - t), 2 * t * (1 - t), t * t];
    const [qx, qy, qz] = [wa * ax + wc * cx + wb * bx, wa * ay + wc * cy + wb * by, wa * az + wc * cz + wb * bz];
    write((at + k - 1) * 6, px, py, pz, qx, qy, qz);
    [px, py, pz] = [qx, qy, qz];
  }
}

export interface PointBatch<N> {
  im: THREE.InstancedMesh;
  list: N[];
}
export type PointState = "base" | "dim" | "focus";

/** Instanced spheres, one draw call per colour and state, using the same materials the single meshes would. */
export function pointBatches<N extends Point>(nodes: N[], style: (n: N) => { color: string; state: PointState; r: number } | null, geometry: THREE.BufferGeometry, material: (color: string, state: PointState) => THREE.Material) {
  const lists = new Map<string, { color: string; state: PointState; list: N[]; r: number[] }>();
  for (const n of nodes) {
    const s = style(n);
    if (!s) continue;
    const key = `${s.color}|${s.state}`;
    const b = lists.get(key) ?? { color: s.color, state: s.state, list: [], r: [] };
    b.list.push(n);
    b.r.push(s.r);
    lists.set(key, b);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const at = new THREE.Vector3();
  const group = new THREE.Group();
  const batches: PointBatch<N>[] = [];
  for (const { color, state, list, r } of lists.values()) {
    const im = new THREE.InstancedMesh(geometry, material(color, state), list.length);
    list.forEach((n, i) => im.setMatrixAt(i, m.compose(at.set(...pointAt(n)), q, size.setScalar(r[i]))));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    im.raycast = () => {};
    group.add(im);
    batches.push({ im, list });
  }
  return { group, batches };
}

/** Everything a change of shape has to carry along, and the glide itself. */
export class ShapeMorph<N extends Point> {
  /** How far the picture is from galaxy (0) to lotus (1). */
  mix: number;
  ring: THREE.Line | null = null;
  links: { attr: THREE.BufferAttribute; ends: [N, N, number, number][]; spokes: THREE.LineBasicMaterial | null; spokeAlpha: number } | null = null;
  verses: PointBatch<N>[] = [];
  ideas: PointBatch<N>[] = [];
  /** Where everything was before the layout changed, until the glide starts. */
  from: Map<N, Vec3> | null = null;
  private run: { items: { n: N; a: Vec3; b: Vec3 }[]; start: number; ms: number; mix: number; mixTo: number } | null = null;

  constructor(shape: GraphShape) {
    this.mix = shape === "lotus" ? 1 : 0;
  }

  remember(nodes: Iterable<N>) {
    this.from ??= new Map([...nodes].map((n) => [n, pointAt(n)]));
  }

  start(nodes: N[], shape: GraphShape, ms: number) {
    const from = this.from;
    this.from = null;
    this.run = from && { items: nodes.map((n) => ({ n, a: from.get(n) ?? pointAt(n), b: pointAt(n) })), start: performance.now(), ms, mix: this.mix, mixTo: shape === "lotus" ? 1 : 0 };
  }

  /** One frame. False when there is nothing to do. */
  step(place: (n: N) => void) {
    const m = this.run;
    if (!m) return false;
    const t = Math.min(1, (performance.now() - m.start) / m.ms);
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    for (const { n, a, b } of m.items) {
      n.fx = n.x = a[0] + (b[0] - a[0]) * e;
      n.fy = n.y = a[1] + (b[1] - a[1]) * e;
      n.fz = n.z = a[2] + (b[2] - a[2]) * e;
      place(n);
    }
    this.mix = m.mix + (m.mixTo - m.mix) * e;
    if (this.links) {
      const { attr, ends, spokes, spokeAlpha } = this.links;
      for (const [from, to, at, n] of ends) drawLine(attr.array as Float32Array, at, from, to, n, this.mix);
      attr.needsUpdate = true;
      if (spokes) spokes.opacity = spokeAlpha * (1 - this.mix);
    }
    for (const { im, list } of [...this.verses, ...this.ideas]) {
      list.forEach((n, i) => im.instanceMatrix.array.set(pointAt(n), i * 16 + 12));
      im.instanceMatrix.needsUpdate = true;
    }
    if (this.ring) this.ring.scale.y = 1 - this.mix;
    if (t >= 1) this.run = null;
    return true;
  }
}
