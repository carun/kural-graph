import { BookOpen, NotebookPen, Orbit, Waypoints, type LucideIcon } from "lucide-react";
import type { ViewMode } from "@/lib/types";

/**
 * The four places in GitaViśva. Interface labels are plain English; the Sanskrit names stay as a secondary layer.
 * The `id`s are the URL values (?view=…) and are kept stable for existing deep links.
 */
export interface ViewInfo {
  id: ViewMode;
  name: string;
  icon: LucideIcon;
  /** one-line purpose, shown in the guide, tooltips and the command palette */
  blurb: string;
}

export const VIEWS: ViewInfo[] = [
  { id: "cosmos", name: "Explore", icon: Orbit, blurb: "See the whole Kural as one graph: chapters, couplets, ideas, states of mind and life situations." },
  { id: "darshana", name: "Lineage", icon: Waypoints, blurb: "Focus on one couplet or idea and follow what leads to it and what follows from it." },
  { id: "adhyayana", name: "Read", icon: BookOpen, blurb: "Read chapter by chapter with romanised Tamil, English readings, commentary and recitation." },
  { id: "manas", name: "Reflect", icon: NotebookPen, blurb: "Write what is on your mind and see which states, situations and couplets it maps to. Private to this browser." },
];

export const viewInfo = (id: ViewMode) => VIEWS.find((v) => v.id === id)!;
