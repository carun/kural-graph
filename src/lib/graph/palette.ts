import type { GraphNode, NodeLabel } from "@/lib/types";

/**
 * Visual encoding for node kinds — the single source of truth for the 3D cosmos, the 2D lineage, legends and chips.
 *
 * Identity is never carried by hue alone. Three categorical hues (blue · orange · aqua, validated all-pairs for
 * protan/deutan in both themes) mark the ontology a reader most needs to tell apart: concepts (the Kural's themes, roles
 * and images), afflictive states (its vices and feelings) and healing states (its virtues). Everything else is separated by form: chapters are large amber hubs with a halo ring and permanent
 * labels; life situations are hollow rings; verses are small neutral points; characters and reflections are neutral.
 * DOM surfaces use the matching `--n-*` CSS variables so they follow the active theme automatically.
 */
export type NodeKind = "chapter" | "verse" | "concept" | "afflictive" | "healing" | "character" | "dilemma" | "personal";
export type NodeShape = "hub" | "point" | "sphere" | "ring" | "halo";

export const KIND_META: Record<NodeKind, { label: string; shape: NodeShape; hint: string }> = {
  chapter: { label: "Chapters", shape: "hub", hint: "The 133 chapters, the hubs every couplet belongs to" },
  verse: { label: "Couplets", shape: "point", hint: "All 1,330 couplets, clustered around their chapter" },
  concept: { label: "Concepts", shape: "sphere", hint: "Themes, roles and images such as wealth, the minister and the lamp" },
  afflictive: { label: "Vices and feelings", shape: "sphere", hint: "Anger, envy, grief and the other states the Kural warns of or gives voice to" },
  healing: { label: "Virtues", shape: "sphere", hint: "Compassion, truthfulness, forgiveness: the states it commends" },
  dilemma: { label: "Life situations", shape: "ring", hint: "Everyday situations the couplets speak to" },
  character: { label: "Characters", shape: "sphere", hint: "The poet, and the three who speak in Part 3" },
  personal: { label: "My reflections", shape: "halo", hint: "Your journal entries, stored only in this browser" },
};

export const KIND_ORDER: NodeKind[] = ["chapter", "verse", "concept", "afflictive", "healing", "dilemma", "character", "personal"];

export const NODE_HEX: Record<"dark" | "light", Record<NodeKind, string>> = {
  dark: {
    chapter: "#e3a44b",
    verse: "#9c9488",
    concept: "#3987e5",
    afflictive: "#d95926",
    healing: "#199e70",
    dilemma: "#9085e9",
    character: "#ddd6ca",
    personal: "#f4f1eb",
  },
  light: {
    chapter: "#9a5a0c",
    verse: "#8f887d",
    concept: "#2a78d6",
    afflictive: "#eb6834",
    healing: "#1baf7a",
    dilemma: "#6250d6",
    character: "#4a453e",
    personal: "#1b1a17",
  },
};

export function nodeKind(n: GraphNode): NodeKind {
  switch (n.type) {
    case "Chapter":
      return "chapter";
    case "Verse":
      return "verse";
    case "SanskritConcept":
      return "concept";
    case "Emotion":
      return n.valence === "healing" ? "healing" : "afflictive";
    case "LifeDilemma":
      return "dilemma";
    case "Character":
      return "character";
    default:
      return "personal";
  }
}

/** Which graph layer (node label) a kind belongs to — both state kinds live on the Emotion layer. */
export const KIND_LAYER: Record<NodeKind, NodeLabel> = {
  chapter: "Chapter",
  verse: "Verse",
  concept: "SanskritConcept",
  afflictive: "Emotion",
  healing: "Emotion",
  dilemma: "LifeDilemma",
  character: "Character",
  personal: "PersonalThought",
};

export const kindVar = (k: NodeKind) => `var(--n-${k})`;
export const nodeVar = (n: GraphNode) => kindVar(nodeKind(n));
export const nodeHex = (n: GraphNode, dark: boolean) => NODE_HEX[dark ? "dark" : "light"][nodeKind(n)];

/** Singular, human type name for headers and badges. */
export function typeName(n: GraphNode): string {
  switch (n.type) {
    case "Chapter":
      return "Chapter";
    case "Verse":
      return "Couplet";
    case "SanskritConcept":
      return { theme: "Theme", role: "Role", image: "Image" }[n.category] ?? "Concept";
    case "Emotion":
      return n.valence === "healing" ? "Virtue" : (n as { polarity?: string }).polarity === "vice" ? "Vice" : "Feeling";
    case "LifeDilemma":
      return "Life situation";
    case "Character":
      return "Character";
    default:
      return "Reflection";
  }
}
