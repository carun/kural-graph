"use client";
import { useGita } from "@/lib/store/useGitaStore";
import { RELATION_GROUPS, type RelationGroup } from "@/lib/graph/relations";
import { useGraphShape, type GraphColor, type GraphShape } from "@/kural/graphShape";

const COLOR_HELP: Record<GraphColor, string> = {
  label: "Each kind of node has its own colour and shape, as in the legend.",
  chapter: "Couplets shade from light (chapter 1) to deep (chapter 133), so you can see where in the book an idea is concentrated.",
  part: "Righteousness, Wealth and Desire each get a colour. An idea takes the colour of the Part most of its couplets come from, and stays grey if no Part has most of them.",
  community: "Louvain community detection groups nodes that link to each other more than to the rest. The eight largest groups get a colour.",
};

const SHAPE_HELP: Record<GraphShape, string> = {
  galaxy: "Chapters on a wheel, their couplets around them and the ideas gathered in the middle.",
  lotus: "Each chapter a petal of ten couplets around the rim, with the ideas rising above it in a dome.",
};

/** Display options for the cosmos: colour encoding and which families of relationships are drawn. */
export function DisplayPanel() {
  const edgeGroups = useGita((s) => s.edgeGroups);
  const toggleEdgeGroup = useGita((s) => s.toggleEdgeGroup);
  const colorBy = useGita((s) => s.colorBy as GraphColor);
  const setColorBy = useGita((s) => s.setColorBy as (c: GraphColor) => void);
  const communities = useGita((s) => s.communities);
  const shape = useGraphShape((s) => s.shape);
  const setShape = useGraphShape((s) => s.setShape);

  return (
    <div className="space-y-5">
      <section>
        <div className="label mb-2">Shape</div>
        <div className="seg w-full" role="radiogroup" aria-label="Shape">
          {(
            [
              ["galaxy", "Galaxy"],
              ["lotus", "Lotus"],
            ] as const
          ).map(([id, name]) => (
            <button key={id} role="radio" aria-checked={shape === id} className="flex-1" onClick={() => setShape(id)}>
              {name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.45] text-text-3">{SHAPE_HELP[shape]}</p>
      </section>
      <section>
        <div className="label mb-2">Colour nodes by</div>
        <div className="seg w-full" role="radiogroup" aria-label="Colour nodes by">
          {(
            [
              ["label", "Type"],
              ["chapter", "Chapter"],
              ["part", "Part"],
              ["community", "Community"],
            ] as const
          ).map(([id, name]) => (
            <button key={id} role="radio" aria-checked={colorBy === id} className="flex-1" onClick={() => setColorBy(id)}>
              {name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.45] text-text-3">{COLOR_HELP[colorBy]}</p>
        {colorBy === "community" && communities && (
          <p className="num mt-1 text-[12px] text-text-3">
            {communities.count} communities found, modularity {communities.modularity.toFixed(2)}
          </p>
        )}
      </section>
      <section>
        <div className="label mb-1">Relationships shown</div>
        <ul>
          {(Object.keys(RELATION_GROUPS) as RelationGroup[]).map((g) => (
            <li key={g}>
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-2)] px-1 py-2 hover:bg-surface-3">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={edgeGroups[g]} onChange={() => toggleEdgeGroup(g)} />
                <span className="min-w-0">
                  <span className="block text-[13px] text-text">{RELATION_GROUPS[g].label}</span>
                  <span className="block text-[12px] leading-4 text-text-3">{RELATION_GROUPS[g].hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
