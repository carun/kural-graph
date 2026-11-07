import type { CommentaryEntry } from "@/lib/types";

/**
 * The interpretive traditions (darśanas / sampradāyas) the bundled commentaries come from, with a neutral one-line
 * account of how each reads the Gita. Commentator ids follow public/data/commentary: 1 to 16 from gita/gita, 101 to 104
 * the English and Hindi translations added by scripts/build-commentary-extras.mjs.
 */
export type TraditionId = "classical" | "modern";

export interface Tradition {
  id: TraditionId;
  name: string;
  /** Chip label. */
  short: string;
  /** Founding teacher and period, for orientation. */
  teacher: string;
  /** How this school reads the Gita, in plain words. */
  lens: string;
  /** CSS colour for the tradition's mark (reuses node-kind tokens so both themes stay legible). */
  color: string;
}

export const TRADITIONS: Tradition[] = [
  {
    id: "classical",
    name: "Classical commentary",
    short: "Classical",
    teacher: "parimēlaḻagar",
    lens: "",
    color: "var(--n-concept)",
  },
  {
    id: "modern",
    name: "Modern commentary",
    short: "Modern",
    teacher: "",
    lens: "",
    color: "var(--n-healing)",
  },
];

export const traditionById = (id: TraditionId) => TRADITIONS.find((t) => t.id === id)!;

export interface Commentator {
  tradition: TraditionId;
  /** Display name with diacritics. */
  name: string;
  work?: string;
  /** Translator, when the text shown is a translation of the original commentary. */
  translator?: string;
  note?: string;
}

export const COMMENTATORS: Record<number, Commentator> = {
  2: { tradition: "classical", name: "parimēlaḻagar", work: "Paraphrased in English by an AI. These are not his exact words." },
  3: { tradition: "classical", name: "parimēlaḻagar", work: "His 13th-century commentary, from Tamil Wikisource" },
  7: { tradition: "classical", name: "maṇakkudavar", work: "The oldest commentary that survives, from Project Madurai" },
  8: { tradition: "modern", name: "mu. varaḍarāsaṉār", work: "திருக்குறள் தெளிவுரை, from Tamil Wikisource" },
  9: { tradition: "modern", name: "mayilai civamuṭṭu", work: "திருக்குறள், இனிய எளிய உரை, from Tamil Wikisource. Parts 1 and 2 only" },
  10: { tradition: "modern", name: "ṭēvanēyap pāvāṇar", work: "திருக்குறள் தமிழ் மரபுரை, from the Tamil Digital Library" },
};

export type CommentaryLang = CommentaryEntry["lang"];
export const LANG_NAME: Record<CommentaryLang, string> = { en: "English", hi: "Hindi", sa: "Tamil" };

/** What to show for an entry, falling back to the data file's own fields for ids this table doesn't know. */
export function commentatorOf(e: CommentaryEntry): Commentator {
  const known = COMMENTATORS[e.authorId];
  if (known) return { ...known, translator: e.translator || known.translator };
  return { tradition: "classical", name: e.author.replace(/^(Sri|Swami|Shri|Dr\.) /, ""), work: e.work, translator: e.translator };
}
