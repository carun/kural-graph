declare module 'd3-force-3d' {
  export interface SimNode {
    id: string;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
  }
  export interface SimLink {
    source: string | SimNode;
    target: string | SimNode;
    type: string;
  }
  interface Force {
    (alpha: number): void;
    initialize?(nodes: SimNode[]): void;
  }
  interface LinkForce extends Force {
    id(accessor: (node: SimNode) => string): LinkForce;
    distance(accessor: (link: SimLink) => number): LinkForce;
    strength(accessor: (link: SimLink) => number): LinkForce;
  }
  interface ManyBodyForce extends Force {
    strength(value: number): ManyBodyForce;
    distanceMax(value: number): ManyBodyForce;
  }
  interface Simulation {
    alphaDecay(value: number): Simulation;
    velocityDecay(value: number): Simulation;
    force(name: string, force: Force): Simulation;
    stop(): Simulation;
    tick(): Simulation;
  }
  export function forceSimulation(nodes: SimNode[], dimensions: number): Simulation;
  export function forceLink(links: SimLink[]): LinkForce;
  export function forceManyBody(): ManyBodyForce;
  export function forceCenter(): Force;
}
