// The answer Ask writes with no model: nothing but the graph, in the order a reader needs it. It never tells someone
// what they feel, and a situation gets its walk, because the graph's general answers can be wrong for someone in it.
import type { Chain } from "@/lib/types";
import { FEELINGS_NOTE, HELPLINE_LINE, HELPLINE_URL, OLD_VIEW_NOTE, isSensitive, type Walk } from "./walk";
import type { Tension } from "./tensions";

interface Ranked {
  id: string;
  reasons: string[];
}

export interface ComposeInput {
  concern: "self-harm" | "abuse" | null;
  held?: unknown;
  walk?: Walk;
  seeds: { id: string }[];
  verses: Ranked[];
  chains: Chain[];
  tensions: Tension[];
  subgraph: { nodes: string[] };
  timings: { total: number };
}

export interface ComposeGraph {
  node: (id: string) => object | undefined;
  /** The plain reading and the romanised first line of a couplet. */
  couplet: (id: string) => { ref: string; text: string; roman: string } | undefined;
}

type Named = { id: string; type: string; label: string; sa?: string; en?: string; desc?: string };

const short = (t: string) => (t.length > 260 ? `${t.slice(0, 257).replace(/\s+\S*$/, "")}…` : t);

function tag(n: Named): string {
  return n.type === "Emotion" ? `[Emotion: ${n.label}]` : n.type === "SanskritConcept" ? `[Concept: ${n.label}]` : n.type === "LifeDilemma" ? `[Dilemma: ${n.label}]` : "";
}

function coupletLine(g: ComposeGraph, id: string, why?: string): string | null {
  const c = g.couplet(id);
  if (!c) return null;
  const notes = [why, isSensitive(g.node(id)) ? OLD_VIEW_NOTE : ""].filter(Boolean).join(" ");
  return `- **[K${c.ref}]** *${c.roman}*: “${short(c.text)}”${notes ? `\n  <small>${notes}</small>` : ""}`;
}

function tensionLines(g: ComposeGraph, tensions: Tension[]): string[] {
  if (!tensions.length) return [];
  const lines = ["\n### Where it pulls two ways"];
  for (const t of tensions) {
    lines.push(t.reason);
    for (const id of [t.a, t.b]) {
      const line = coupletLine(g, id);
      if (line) lines.push(line);
    }
  }
  return lines;
}

function walkLines(g: ComposeGraph, w: Walk): string[] {
  const named = (id: string) => g.node(id) as Named | undefined;
  const lines = [`The Kural speaks to this situation: **${w.situation.label}** [Dilemma: ${w.situation.label}].`];
  if (w.feelings.length) {
    lines.push("\n### It can feel like", `*${FEELINGS_NOTE}*`);
    for (const f of w.feelings) lines.push(`- **${f.label}**: ${f.reason}`);
  }
  if (w.ways.length) {
    lines.push("\n### What the Kural says");
    for (const way of w.ways) {
      const n = named(way.id);
      lines.push(`- **${way.label}** ${n ? tag(n) : ""}: ${way.reason} <small>${way.stated ? "Stated in the text." : "Inferred."}</small>`);
    }
    lines.push("\n### Where it says so");
    for (const id of new Set(w.ways.flatMap((x) => x.couplets))) {
      const line = coupletLine(g, id);
      if (line) lines.push(line);
    }
  }
  if (w.also.length) {
    lines.push("\n### Other couplets on this");
    for (const id of w.also) {
      const line = coupletLine(g, id);
      if (line) lines.push(line);
    }
  }
  if (w.silent) lines.push("\n### What the Kural doesn’t offer", w.silent);
  lines.push(`\n<small>${HELPLINE_LINE} ${HELPLINE_URL.replace("https://", "")}.</small>`);
  return lines;
}

export function composeAnswer(g: ComposeGraph, r: ComposeInput): string {
  // Support is already on screen above this, and nothing here should compete with it.
  if (r.held) return "The couplets are set aside for now. Please reach out to one of the people above first.";

  const lines: string[] = [];
  if (r.walk) {
    lines.push(...walkLines(g, r.walk));
  } else {
    const lead = r.seeds.map((s) => g.node(s.id) as Named | undefined).find((n) => n?.type === "Emotion" || n?.type === "SanskritConcept");
    if (lead) lines.push(`**${lead.label}**${lead.sa ? ` (${lead.sa})` : ""} ${tag(lead)}. ${lead.desc ?? ""}`);
    else lines.push("Here is what the knowledge graph surfaces for your question.");
    const couplets = r.verses.slice(0, 4).flatMap((v) => coupletLine(g, v.id, v.reasons.find((x) => x.includes(": "))) ?? []);
    if (couplets.length) lines.push("\n### What the Kural says", ...couplets);
    else lines.push("\nThe Kural doesn’t seem to speak to this. Try other words, or look through Read.");
    lines.push(...tensionLines(g, r.tensions));
    const chain = r.chains[0];
    if (chain) {
      lines.push(`\n### How one thing leads to another: ${chain.title}`, chain.summary);
      lines.push(chain.steps.map((s) => (g.node(s) as Named | undefined)?.label || s).join(" → "));
    }
  }
  lines.push(`\n<small>Composed offline from ${r.subgraph.nodes.length} connected points in ${r.timings.total.toFixed(0)} ms. Connect a language model in Settings for a written answer.</small>`);
  return lines.join("\n");
}
