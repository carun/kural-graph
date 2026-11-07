"use client";
import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, MessagesSquare, Orbit, Play, Spline, Waypoints, X } from "lucide-react";
import { useGita } from "@/lib/store/useGitaStore";
import { audio } from "@/lib/store/audioStore";
import { isSuggestedEdge, neighbors, type Neighbor } from "@/lib/graph/graphStore";
import { RELATIONS } from "@/lib/graph/relations";
import { typeName } from "@/lib/graph/palette";
import type { RelationType } from "@/lib/types";
import { askPartha } from "@/components/chat/GraphRagChatbot";
import { NodeGlyph, SectionLabel } from "@/components/ui/primitives";
import { ThoughtDetail } from "@/components/manas/ThoughtDetail";
import { ideaSections } from "@/kural/sections";
import { IdeaTensions, WalkDetails } from "@/kural/walkFlow";
import { isSensitive, walkFrom } from "@/kural/walk";
import { basisNote } from "@/kural/wording";

const PREVIEW = 6;

function Row({ n, onClick }: { n: Neighbor; onClick: () => void }) {
  const reason = typeof n.props?.why === "string" ? n.props.why : "";
  const why = reason || (n.node.type === "Verse" ? n.node.snippet : "en" in n.node ? n.node.en : "");
  const basis = reason ? basisNote(n.props) : "";
  return (
    <li>
      <button className="row" onClick={onClick}>
        <NodeGlyph node={n.node} className="mt-1.5" />
        <span className="min-w-0 flex-1 text-[13px] leading-5">
          <span className="font-medium text-text">{n.node.type === "Verse" ? `Kural ${n.node.ref}` : n.node.label}</span>
          {why && <span className={`block text-[12px] leading-4 text-text-3 ${reason ? "" : "line-clamp-2"}`}>{why}</span>}
          {basis && <span className="block text-[11.5px] leading-4 text-text-4">{basis}</span>}
        </span>
      </button>
    </li>
  );
}

function Section({ title, list, onPick }: { title: string; list: Neighbor[]; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, PREVIEW);
  return (
    <section>
      <SectionLabel count={list.length}>{title}</SectionLabel>
      <ul className="-mx-2.5">
        {shown.map((x) => (
          <Row key={x.key} n={x} onClick={() => onPick(x.id)} />
        ))}
      </ul>
      {list.length > PREVIEW && (
        <button className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-text-2 hover:text-text" onClick={() => setAll(!all)} aria-expanded={all}>
          <ChevronDown size={14} className={all ? "rotate-180" : ""} />
          {all ? "Show fewer" : `Show all ${list.length}`}
        </button>
      )}
    </section>
  );
}

export function NodeInspector({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const graphs = useGita((s) => s.graphs);
  const versesDoc = useGita((s) => s.versesDoc);
  const view = useGita((s) => s.view);
  const select = useGita((s) => s.select);
  const highlight = useGita((s) => s.highlight);
  const setHighlight = useGita((s) => s.setHighlight);
  const n = graphs?.nodeById.get(nodeId);
  const nb = useMemo(() => (graphs ? neighbors(graphs, nodeId) : []), [graphs, nodeId]);
  if (!n || !graphs) return null;

  // Each neighbour once per section (two relations between the same pair, e.g. both directions, would repeat it).
  const of = (types: RelationType[], outgoing?: boolean) => {
    const seen = new Set<string>();
    return nb.filter((x) => types.includes(x.type) && (outgoing === undefined || x.outgoing === outgoing) && !seen.has(x.id) && !!seen.add(x.id));
  };
  const sections: [string, Neighbor[]][] = [];
  switch (n.type) {
    case "Emotion":
    case "SanskritConcept":
      sections.push(...ideaSections(nb));
      break;
    case "LifeDilemma":
      // Shown by <WalkDetails />: what the walk shows, in its order, so a couplet it holds back can't return here.
      break;
    case "Character":
      sections.push(["In conversation with", of(["ADDRESSES"])], ["Named in", of(["MENTIONS_CHARACTER"], false)]);
      break;
    case "Chapter":
      sections.push(["Main themes", of(["EXPOUNDS"], true)], ["Neighbouring chapters", of(["NEXT_CHAPTER"])]);
      break;
    case "PersonalThought":
      // Shown by <ThoughtDetail />: the text (editable), its history, and kept / suggested / declined connections kept apart.
      break;
  }
  // Only connections the person kept; unconfirmed suggestions are not presented as their view.
  if (n.type !== "PersonalThought") sections.push(["In my thoughts", nb.filter((x) => !x.outgoing && RELATIONS[x.type].group === "personal" && !isSuggestedEdge(x.props))]);
  const chapter = n.type === "Chapter" ? versesDoc?.chapters.find((c) => c.number === n.number) : null;
  const walk = n.type === "LifeDilemma" ? walkFrom(graphs, n.id) : null;
  const spokenByChapter = n.type === "Character" ? Array.from({ length: versesDoc?.chapters.length ?? 133 }, (_, i) => of(["SPOKE"], true).filter((x) => x.node.type === "Verse" && x.node.chapter === i + 1).length) : null;
  const maxSpoken = spokenByChapter ? Math.max(1, ...spokenByChapter) : 1;
  const hoodLabel = `Connections of ${n.type === "Chapter" ? `chapter ${n.number}` : n.label}`;
  const hoodOn = highlight?.label === hoodLabel;
  const lightAll = () => {
    if (hoodOn) return setHighlight(null);
    setHighlight({ nodes: new Set([n.id, ...nb.map((x) => x.id)]), edges: new Set(nb.map((x) => x.key)), label: hoodLabel, source: "search" });
    if (view !== "cosmos") useGita.getState().setView("cosmos");
  };
  const desc = "desc" in n ? n.desc : n.type === "Chapter" ? chapter?.summary.en : n.type === "PersonalThought" ? n.text : "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
        <NodeGlyph node={n} />
        <div className="min-w-0 flex-1">
          <div className="label">{typeName(n)}</div>
          <div className="truncate text-[14px] font-semibold leading-5 text-text">{n.type === "Chapter" ? `Chapter ${n.number}` : n.label}</div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.015em] text-text">{n.type === "Chapter" ? n.title : n.label}</h2>
        {("sa" in n || n.type === "Chapter") && <div className="deva mt-1 text-[18px] text-text-2">{n.type === "Chapter" ? n.name : "sa" in n ? n.sa : ""}</div>}
        {"en" in n && <div className="serif mt-0.5 text-[15px] text-text-3">{n.en}</div>}
        {n.type === "Chapter" && <div className="serif mt-0.5 text-[15px] italic text-text-3">{n.meaning}</div>}
        {n.type === "Character" && <div className="mt-1 text-[13px] text-text-3">{n.role}</div>}
        {n.type === "Emotion" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip capitalize">{(n as { polarity?: string }).polarity === "state" ? "state of mind" : (n as { polarity?: string }).polarity}</span>
            {(n as { feeling?: boolean }).feeling && <span className="chip">Feeling</span>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {view !== "darshana" && (
            <button className="btn" onClick={() => useGita.getState().focusLineage(n.id)} title={n.type === "PersonalThought" ? "This thought and its connections, on a small map" : "What leads to this, and what follows from it"}>
              <Waypoints size={14} /> {n.type === "PersonalThought" ? "My map" : "Lineage"}
            </button>
          )}
          <button className="btn" aria-pressed={hoodOn} onClick={lightAll} title="Light up everything connected to this node in the 3D graph">
            <Spline size={14} /> {hoodOn ? "Clear highlight" : "Highlight connections"}
          </button>
          {view !== "cosmos" && !hoodOn && (
            <button className="btn" onClick={() => (useGita.getState().setView("cosmos"), useGita.getState().fly(n.id))}>
              <Orbit size={14} /> In graph
            </button>
          )}
          {n.type === "Chapter" && (
            <>
              <button className="btn" onClick={() => useGita.getState().openChapter(n.number)}>
                <BookOpen size={14} /> Read
              </button>
              <button className="btn" onClick={() => audio.playChapter(n.number)}>
                <Play size={14} /> Listen
              </button>
            </>
          )}
          {n.type !== "PersonalThought" && (
            <button className="btn" onClick={() => askPartha(n.type === "Chapter" ? `Summarise Chapter ${n.number} (${n.title}) and its key couplets.` : n.type === "LifeDilemma" ? n.label : `What does the Kural say about ${n.label}?`)}>
              <MessagesSquare size={14} /> Ask
            </button>
          )}
        </div>

        {/* A situation's definition says what the Kural concludes, which its walk then has to earn. */}
        {desc && n.type !== "PersonalThought" && n.type !== "LifeDilemma" && <p className="reading mt-5">{desc}</p>}
        {n.type === "PersonalThought" && <ThoughtDetail nodeId={n.id} />}
        {walk && <WalkDetails walk={walk} onPick={(id) => select(id, { fly: view === "cosmos" })} />}
        {n.type === "Emotion" && n.modern && (
          <p className="mt-3 text-[13px] leading-5 text-text-3">
            <span className="font-medium text-text-2">In modern terms: </span>
            {n.modern}
          </p>
        )}

        {spokenByChapter && spokenByChapter.some(Boolean) && (
          <section className="mt-6">
            <SectionLabel>Couplets spoken, by chapter</SectionLabel>
            <div className="flex h-16 items-end gap-px" role="img" aria-label={`Couplets spoken per chapter: ${spokenByChapter.flatMap((c, i) => (c ? [`chapter ${i + 1}: ${c}`] : [])).join(", ")}`}>
              {spokenByChapter.map((c, i) => (
                <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(c ? 6 : 2, (c / maxSpoken) * 100)}%`, background: c ? "var(--n-character)" : "var(--line-2)", opacity: c ? 0.85 : 1 }} title={`Chapter ${i + 1}: ${c}`} />
              ))}
            </div>
            <div className="num mt-1 flex justify-between text-[11px] text-text-3">
              <span>1</span>
              <span>67</span>
              <span>133</span>
            </div>
          </section>
        )}

        <div className="mt-7 space-y-6">
          {(n.type === "Emotion" || n.type === "SanskritConcept") && <IdeaTensions verses={nb.filter((x) => x.node.type === "Verse" && !isSensitive(x.node)).map((x) => x.id)} />}
          {sections
            .filter(([, l]) => l.length)
            .map(([title, list]) => (
              <Section key={title} title={title} list={list} onPick={(id) => select(id, { fly: view === "cosmos" })} />
            ))}
        </div>
      </div>
    </div>
  );
}
