"use client";
// The walk and the tensions, drawn with his Lineage parts: the same cards and lines on the canvas, the same rows in lists.
import { memo, useMemo } from "react";
import { create } from "zustand";
import { Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import type { GitaGraphs } from "@/lib/graph/graphStore";
import { useGita } from "@/lib/store/useGitaStore";
import type { GraphNode } from "@/lib/types";
import { NodeGlyph, SectionLabel } from "@/components/ui/primitives";
import { FEELINGS_NOTE, HELPLINE_LINE, HELPLINE_URL, type Walk } from "./walk";
import { allTensions, tensionsTouching, type Tension } from "./tensions";

// ── the walk on the canvas ──
const COL_GAP = 104;
const CORE_W = 340;
const FEELING_W = 280;
const WAY_W = 300;
const COUPLET_W = 280;
const NOTE_W = COUPLET_W;
const CARD_GAP = 8;
const GROUP_GAP = 22;
const HEADING_H = 26;
const CHAR_W = 6.1;
const LINE_H = 17;

const linesOf = (text: string, width: number) => Math.ceil(text.length / ((width - 26) / CHAR_W));
/** Cards here show a whole reason, never a clipped one, so each is laid out by how much it has to say. */
export const cardHeight = (text: string, width: number, extra: number) => 22 + extra + linesOf(text, width) * LINE_H;

const coreEdge = (id: string, source: string, target: string, ours?: boolean): Edge => ({
  id,
  source,
  target,
  style: { stroke: ours ? "var(--line-3)" : "var(--accent-line)", strokeWidth: ours ? 1.1 : 1.4, strokeDasharray: ours ? "4 4" : undefined },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: ours ? "var(--text-4)" : "var(--accent)" },
});

interface Card {
  id: string;
  type: string;
  width: number;
  height: number;
  data: Record<string, unknown>;
}

/** One column of the walk: a heading and its cards, stacked around the middle, because a walk reads across. */
function column(x: number, groups: { title: string; note?: string; cards: Card[] }[]): Node[] {
  const heights = groups.map((g) => (g.title ? HEADING_H : 0) + (g.note ? LINE_H : 0) + g.cards.reduce((s, c) => s + c.height + CARD_GAP, 0));
  let y = -(heights.reduce((a, b) => a + b, 0) + GROUP_GAP * (groups.length - 1)) / 2;
  const nodes: Node[] = [];
  groups.forEach((g, i) => {
    if (g.title) {
      nodes.push({ id: `head-${x}-${i}`, type: "heading", position: { x, y }, data: { role: "down", kind: "heading", title: g.title, subtitle: g.note, w: g.cards[0]?.width }, draggable: false, selectable: false });
      y += HEADING_H + (g.note ? LINE_H : 0);
    }
    for (const c of g.cards) {
      nodes.push({ id: c.id, type: c.type, position: { x, y }, data: c.data, draggable: false, selectable: false });
      y += c.height + CARD_GAP;
    }
    y += GROUP_GAP;
  });
  return nodes;
}

export function walkLayout(g: GitaGraphs, walk: Walk): { nodes: Node[]; edges: Edge[] } {
  const node = (id: string) => g.nodeById.get(id);
  const edges: Edge[] = [];
  const verseCard = (id: string, prefix: string): Card[] => {
    const n = node(id);
    if (n?.type !== "Verse") return [];
    return [{ id: `${prefix}-${id}`, type: "verse", width: COUPLET_W, height: cardHeight(n.snippet, COUPLET_W, 48), data: { role: "down", nodeId: id, kind: "verse", title: `Kural ${n.ref}`, sa: n.sa, subtitle: n.snippet, full: true, w: COUPLET_W, node: n } }];
  };

  const feelings: Card[] = walk.feelings.map((f) => ({ id: `f-${f.id}`, type: "entity", width: FEELING_W, height: cardHeight(f.reason, FEELING_W, 26), data: { role: "down", nodeId: f.id, kind: "entity", title: f.label, subtitle: f.reason, full: true, w: FEELING_W, node: node(f.id) } }));
  const ways: Card[] = walk.ways.map((w) => ({ id: `w-${w.id}`, type: "entity", width: WAY_W, height: cardHeight(w.reason, WAY_W, 44), data: { role: "down", nodeId: w.id, kind: "entity", title: w.label, subtitle: w.reason, full: true, basis: w.stated ? "Stated in the text." : "Inferred.", w: WAY_W, node: node(w.id) } }));
  const cited = [...new Set(walk.ways.flatMap((w) => w.couplets))].flatMap((id) => verseCard(id, "c"));
  const others = walk.also.flatMap((id) => verseCard(id, "o"));

  for (const f of walk.feelings) edges.push(coreEdge(`e-f-${f.id}`, "core", `f-${f.id}`, true));
  for (const w of walk.ways) {
    if (w.direct || !w.answers.length) edges.push(coreEdge(`e-w-${w.id}`, "core", `w-${w.id}`));
    for (const f of w.answers) edges.push(coreEdge(`e-${f}-${w.id}`, `f-${f}`, `w-${w.id}`));
    for (const n of w.couplets) if (node(n)) edges.push(coreEdge(`e-${w.id}-${n}`, `w-${w.id}`, `c-${n}`));
  }

  const coreH = 72;
  // Only the situation: a definition says what the Kural concludes, which the walk then has to earn.
  const nodes: Node[] = [{ id: "core", type: "core", position: { x: 0, y: -coreH / 2 }, data: { role: "core", nodeId: walk.situation.id, kind: "core-entity", title: walk.situation.label, kicker: "You are here", node: node(walk.situation.id) }, draggable: false, selectable: false }];
  let x = CORE_W + COL_GAP;
  nodes.push(...column(x, [{ title: "It can feel like", note: FEELINGS_NOTE, cards: feelings }]));
  x += FEELING_W + COL_GAP;
  if (ways.length) {
    nodes.push(...column(x, [{ title: "What the Kural says", cards: ways }]));
    x += WAY_W + COL_GAP;
  }
  // The note closes the last column, after the couplets. A column of its own ran off the edge of most screens.
  const silent: Card[] = walk.silent ? [{ id: "silent", type: "walknote", width: NOTE_W, height: cardHeight(walk.silent, NOTE_W, 30), data: { role: "down", kind: "walknote", title: "What the Kural doesn’t offer", subtitle: walk.silent, full: true, w: NOTE_W } }] : [];
  const last = [...(cited.length ? [{ title: "Where it says so", cards: cited }] : []), ...(others.length ? [{ title: "Other couplets on this", cards: others }] : []), ...(silent.length ? [{ title: "", cards: silent }] : [])];
  if (last.length) nodes.push(...column(x, last));
  return { nodes, edges };
}

export const WalkNoteView = memo(function WalkNoteView({ data }: NodeProps<Node<{ title: string; subtitle: string }>>) {
  return (
    <div className="cursor-default rounded-2 border border-dashed border-line-3 bg-bg px-3 py-2.5" style={{ width: NOTE_W }}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="text-[13.5px] font-medium text-text">{data.title}</div>
      <p className="mt-1 text-[12.5px] leading-[1.05rem] text-text-2">{data.subtitle}</p>
    </div>
  );
});

// ── the walk as a list, for phones and for the details panel ──
export function Helpline() {
  return (
    <p className="text-[12px] leading-5 text-text-3">
      {HELPLINE_LINE}{" "}
      <a className="font-medium text-text-2 underline underline-offset-2" href={HELPLINE_URL} target="_blank" rel="noreferrer">
        findahelpline.com
      </a>
      .
    </p>
  );
}

function Row({ node, title, text, note, sa, onClick }: { node?: GraphNode; title: string; text: string; note?: string; sa?: string; onClick: () => void }) {
  return (
    <li>
      <button className="row" onClick={onClick}>
        <NodeGlyph node={node} className="mt-1.5" />
        <span className="min-w-0 flex-1 text-[13px] leading-5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-medium text-text">{title}</span>
            {sa && <span className="deva truncate text-[12.5px] !leading-5 text-text-3">{sa}</span>}
          </span>
          <span className="block text-[12px] leading-4 text-text-3">{text}</span>
          {note && <span className="block text-[11.5px] leading-4 text-text-4">{note}</span>}
        </span>
      </button>
    </li>
  );
}

function CoupletRow({ g, id, onPick }: { g: GitaGraphs; id: string; onPick: (id: string) => void }) {
  const n = g.nodeById.get(id);
  return n?.type === "Verse" ? <Row node={n} title={`Kural ${n.ref}`} sa={n.sa} text={n.snippet} onClick={() => onPick(id)} /> : null;
}

/** Every step of a walk in reading order. Each way keeps its own couplets beside it, since a list has no lines to follow. */
export function WalkDetails({ walk, onPick }: { walk: Walk; onPick: (id: string) => void }) {
  const graphs = useGita((s) => s.graphs);
  if (!graphs) return null;
  return (
    <div className="mt-6 space-y-6">
      {walk.feelings.length > 0 && (
        <section>
          <SectionLabel>It can feel like</SectionLabel>
          <p className="-mt-1 mb-1 text-[12px] leading-4 text-text-3">{FEELINGS_NOTE}</p>
          <ul className="-mx-2.5">
            {walk.feelings.map((f) => (
              <Row key={f.id} node={graphs.nodeById.get(f.id)} title={f.label} text={f.reason} onClick={() => onPick(f.id)} />
            ))}
          </ul>
        </section>
      )}
      {walk.ways.length > 0 && (
        <section>
          <SectionLabel>What the Kural says</SectionLabel>
          <ul className="-mx-2.5 space-y-2">
            {walk.ways.map((w) => (
              <li key={w.id}>
                <ul>
                  <Row node={graphs.nodeById.get(w.id)} title={w.label} text={w.reason} note={w.stated ? "Stated in the text." : "Inferred."} onClick={() => onPick(w.id)} />
                </ul>
                {w.couplets.length > 0 && (
                  <ul className="ml-[15px] border-l border-line pl-1">
                    {w.couplets.map((id) => (
                      <CoupletRow key={id} g={graphs} id={id} onPick={onPick} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {walk.also.length > 0 && (
        <section>
          <SectionLabel>Other couplets on this</SectionLabel>
          <ul className="-mx-2.5">
            {walk.also.map((id) => (
              <CoupletRow key={id} g={graphs} id={id} onPick={onPick} />
            ))}
          </ul>
        </section>
      )}
      {walk.silent && (
        <section>
          <SectionLabel>What the Kural doesn’t offer</SectionLabel>
          <p className="text-[13.5px] leading-[1.55] text-text-2">{walk.silent}</p>
        </section>
      )}
      <Helpline />
    </div>
  );
}

/** The walk as a page, for narrow canvases and for readers who prefer a list. */
export function WalkList({ walk, go }: { walk: Walk; go: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto px-4 pb-10 pt-4">
      <div className="rounded-3 border border-accent-line bg-surface p-4">
        <div className="label">You are here</div>
        <div className="mt-1 text-[17px] font-semibold text-text">{walk.situation.label}</div>
      </div>
      <WalkDetails walk={walk} onPick={go} />
    </div>
  );
}

// ── the tensions ──
/** Asks Lineage to open a tension from elsewhere, as `lineageChain` does for a chain. */
export const useTensionRequest = create<{ key: string | null }>(() => ({ key: null }));
export function openTension(key: string) {
  useTensionRequest.setState({ key });
  useGita.getState().setView("darshana");
}

export const tensionTitle = (t: Tension) => `Kural ${t.a.slice(2)} and Kural ${t.b.slice(2)}`;

const TENSION_GAP = 180;

export function tensionLayout(g: GitaGraphs, t: Tension, versesById: Map<string, unknown>): { nodes: Node[]; edges: Edge[] } {
  const place = (id: string, x: number): Node => {
    const n = g.nodeById.get(id);
    return { id: `t-${id}`, type: "core", position: { x, y: -150 }, data: { role: "core", nodeId: id, kind: "core-verse", title: n?.type === "Verse" ? `Kural ${n.ref}` : id, verse: versesById.get(id), node: n }, draggable: false, selectable: false };
  };
  return {
    nodes: [place(t.a, 0), place(t.b, 400 + TENSION_GAP)],
    edges: [{ id: "tension", source: `t-${t.a}`, target: `t-${t.b}`, label: "is in tension with", style: { stroke: "var(--accent-line)", strokeWidth: 1.4, strokeDasharray: "6 4" }, labelStyle: { fill: "var(--text-2)", fontSize: 12 }, labelBgStyle: { fill: "var(--bg)" } }],
  };
}

const PICKER = "field field-sm !w-auto min-w-0 flex-1 max-sm:basis-[calc(50%-0.25rem)] sm:max-w-[15rem] sm:flex-none";
const brief = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

/** Beside his causal chains: the two ways in that are the Kural's own. */
export function WalkAndTensionPickers({ walkId, tensionKey, onWalk, onTension }: { walkId?: string; tensionKey?: string; onWalk: (id: string) => void; onTension: (key: string | null) => void }) {
  const graphData = useGita((s) => s.graphData);
  const graphs = useGita((s) => s.graphs);
  const situations = useMemo(() => graphData?.nodes.filter((n) => n.type === "LifeDilemma") ?? [], [graphData]);
  const tensions = useMemo(() => (graphs ? allTensions(graphs) : []), [graphs]);
  return (
    <>
      <select className={PICKER} aria-label="Start from what you are facing" value={walkId ?? ""} onChange={(e) => e.target.value && onWalk(e.target.value)}>
        <option value="">What are you facing?</option>
        {situations.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
          </option>
        ))}
      </select>
      <select className={PICKER} aria-label="Where it pulls two ways" value={tensionKey ?? ""} onChange={(e) => onTension(e.target.value || null)}>
        <option value="">Where it pulls two ways</option>
        {tensions.map((t) => (
          <option key={t.key} value={t.key}>
            {tensionTitle(t)}: {brief(t.reason)}
          </option>
        ))}
      </select>
    </>
  );
}

/** Pinned to the canvas, so the helpline and a tension's reason stay in view however far the reader pans. */
export function WalkAndTensionHud({ walking, tension }: { walking: boolean; tension?: Tension | null }) {
  if (!tension && !walking) return null;
  return (
    <div className="hud absolute bottom-3 left-3 max-w-[min(34rem,calc(100%-5rem))] px-4 py-3">
      {tension ? (
        <>
          <p className="serif text-[14px] leading-[1.5] text-text-2">{tension.reason}</p>
          <p className="mt-1.5 text-[12px] text-text-3">{tension.stated ? "Stated in the text." : "Inferred."} Weighing them is left to you.</p>
        </>
      ) : (
        <Helpline />
      )}
    </div>
  );
}

/** A tension as a list, for narrow canvases: the reason first, then both couplets to weigh. */
export function TensionList({ tension, go }: { tension: Tension; go: (id: string) => void }) {
  const graphs = useGita((s) => s.graphs);
  if (!graphs) return null;
  return (
    <div className="h-full overflow-y-auto px-4 pb-10 pt-4">
      <p className="serif text-[14.5px] leading-[1.55] text-text-2">{tension.reason}</p>
      <p className="mt-1 text-[12px] text-text-3">{tension.stated ? "Stated in the text." : "Inferred."} Weighing them is left to you.</p>
      <ul className="-mx-2.5 mt-4">
        <CoupletRow g={graphs} id={tension.a} onPick={go} />
        <CoupletRow g={graphs} id={tension.b} onPick={go} />
      </ul>
    </div>
  );
}

/** Where an idea's couplets pull two ways, listed on the idea so the disagreement is found where it matters. */
export function IdeaTensions({ verses }: { verses: string[] }) {
  const graphs = useGita((s) => s.graphs);
  if (!graphs) return null;
  const tensions = tensionsTouching(graphs, verses, 4);
  if (!tensions.length) return null;
  return (
    <section>
      <SectionLabel count={tensions.length}>Where it pulls two ways</SectionLabel>
      <ul className="-mx-2.5">
        {tensions.map((t) => (
          <Row key={t.key} node={graphs.nodeById.get(t.a)} title={tensionTitle(t)} text={t.reason} note={t.stated ? "Stated in the text." : "Inferred."} onClick={() => openTension(t.key)} />
        ))}
      </ul>
    </section>
  );
}
