import type { Chapter, Verse } from "@/lib/types";

/** What the Kural's data adds to his verse record. */
export type ReadingTag = "agrees" | "adds" | "differs";
export type KuralVerse = Verse & { sensitive?: boolean; reading?: { tag: ReadingTag; note?: string } };

export const TAG_LABEL: Record<ReadingTag, string> = {
  agrees: "Agrees with the plain reading",
  adds: "Adds to the words",
  differs: "Reads it differently",
};

export const OLD_VIEW = "An old view, given here as the text has it.";

/** Shown under any quoted couplet that holds a view readers shouldn't take as ours. */
export function OldView({ verse, className = "" }: { verse: Verse; className?: string }) {
  if (!(verse as KuralVerse).sensitive) return null;
  return <p className={`text-[12px] leading-4 text-text-3 ${className}`}>{OLD_VIEW}</p>;
}

/** The translations no AI wrote, by author id in the data. */
const OWN_WORDS: Record<number, string> = {
  4: "V. V. S. Aiyar’s translation of 1916, in his own words.",
  5: "G. U. Pope’s verse translation of 1886, in his own words.",
  6: "W. H. Drew and J. Lazarus’s translation of 1885, in their own words.",
};

export const inOwnWords = (authorId: number) => authorId in OWN_WORDS;

/** Who wrote the English of a reading, by author id in the data. */
export const englishBy = (authorId: number) => OWN_WORDS[authorId] ?? (authorId === 1 ? "An AI wrote this English, not a scholar or translator." : "Paraphrased in English by an AI. These are not his exact words.");

/** The note closes the English commentary in the data. Taken off so it can be set apart, as a note. */
export const withoutNote = (text: string, note?: string) => (note && text.endsWith(note) ? text.slice(0, -note.length).trimEnd() : text);

export const PARTS = [
  { n: 1, title: "Righteousness", tamil: "அறத்துப்பால்", first: 1, last: 38 },
  { n: 2, title: "Wealth", tamil: "பொருட்பால்", first: 39, last: 108 },
  { n: 3, title: "Desire", tamil: "காமத்துப்பால்", first: 109, last: 133 },
];

export const partOf = (chapter: number) => PARTS.find((p) => chapter >= p.first && chapter <= p.last)!;

/** Chapters under their Part, and within it under their division (`meaning` holds the division). */
export function chapterGroups(chapters: Chapter[]) {
  return PARTS.map((p) => {
    const divisions: { title: string; chapters: Chapter[] }[] = [];
    for (const c of chapters.filter((x) => x.number >= p.first && x.number <= p.last)) {
      const last = divisions[divisions.length - 1];
      if (last?.title === c.meaning) last.chapters.push(c);
      else divisions.push({ title: c.meaning, chapters: [c] });
    }
    return { ...p, divisions };
  });
}

const HARD = [
  ["க", "k", "g"],
  ["ச", "c", "s, or j after a nasal"],
  ["ட", "t", "d"],
  ["த", "ṭ", "ḍ"],
  ["ப", "p", "b"],
];

/** Standard IAST readers would take t for த, so the difference has to be stated. */
export function IastKey({ className = "" }: { className?: string }) {
  return (
    <details className={`text-[12.5px] text-text-3 ${className}`}>
      <summary className="cursor-pointer select-none hover:text-text-2">How to read the romanised Tamil</summary>
      <div className="mt-2 space-y-2 leading-5 text-text-2">
        <p>
          This is a{" "}
          <a className="text-accent-text underline" href="https://arunc.dev/essays/fix-iast-and-use-in-india-and-not-english/" target="_blank" rel="noreferrer">
            revised IAST
          </a>
          , not the standard scheme. <strong className="font-semibold text-text">t and ṭ are swapped</strong>, as are d and ḍ, and the hard consonants are spelled as they sound.
        </p>
        <table className="w-full max-w-sm border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-3 font-semibold text-text">Tamil</th>
              <th className="py-1 pr-3 font-semibold text-text">Word start, or doubled</th>
              <th className="py-1 font-semibold text-text">Between vowels, or after a nasal</th>
            </tr>
          </thead>
          <tbody>
            {HARD.map(([tamil, hard, soft]) => (
              <tr key={tamil} className="border-b border-line">
                <td lang="ta" className="deva py-1 pr-3">
                  {tamil}
                </td>
                <td className="py-1 pr-3">{hard}</td>
                <td className="py-1">{soft}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          e and o are short (<span lang="ta" className="deva">எ, ஒ</span>); ē and ō are long (<span lang="ta" className="deva">ஏ, ஓ</span>). A hyphen marks a vowel letter inside a word, as in <span lang="ta-Latn">aṉbu-īṉum</span>.
        </p>
      </div>
    </details>
  );
}
