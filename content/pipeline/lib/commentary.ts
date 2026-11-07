/**
 * Parimelazhagar's commentary, from the Tamil Wikisource edition.
 *
 * The edition's headings can't be trusted: K1101 is headed 1, K1323 is headed
 * 1233 and K947 is headed 497. So each section is assigned by matching the verse
 * printed inside it, and the heading number is used only to break a tie.
 */
export interface CommentaryEntry {
  n: number;
  /** The line that says who is speaking and why. Part 3 has one for most couplets. */
  context: string | null;
  /** His word-by-word gloss. */
  gloss: string[];
  /** His explanation, and any summing-up. */
  notes: string[];
}

export interface Commentary {
  entries: CommentaryEntry[];
  /** His introduction to each chapter, by chapter number. */
  prefaces: Record<number, string>;
}

const HEADING = /^[ \t]*=+[ \t]*(?:<FONT[^>]*>[ \t]*)?(?:திருக்)?குறள்[ \t]*:?[ \t]*(\d+)/m;
const SPLIT = new RegExp(`(?=${HEADING.source.replace('(\\d+)', '\\d+')})`, 'm');

const strip = (s: string): string =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/'''|''/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\{\{(?:red|green)\|/g, '')
    .replace(/\{\{[^{}\n]*\}\}/g, '')
    .replace(/\{\{|\}\}/g, '')
    .replace(/^.*\bsup\|.*$/gm, '');

const lettersOf = (s: string): string => s.normalize('NFC').replace(/[^஀-௿]/g, '');

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

/** How much of the couplet appears in this stretch of text, from 0 to 1. */
function coverage(couplet: Set<string>, zone: Set<string>): number {
  let hit = 0;
  for (const t of couplet) if (zone.has(t)) hit++;
  return couplet.size === 0 ? 0 : hit / couplet.size;
}

/** Most entries open with இதன்பொருள், but about 200 open with just his name. */
const GLOSS_START = /இதன்\s?பொருள்|^[;:\s]*பரிமேலழகர்\s*உரை(?!\s*விளக்கம்|விளக்கம்)/;
/** Failing that, the first line of the form "phrase = meaning". */
const GLOSS_LINE = /[஀-௿]\s*=\s*[஀-௿]/;
const NOTE_START = /(?:உரை\s?விளக்கம்|^விளக்கம்|பரிமேலழகர்\s*விளக்கம்)/;
/** Editors' lines, not his: the prose order, word lists and the closing formula. */
const EDITORIAL = /^(?:\[?தொடரமைப்பு|\[?அருஞ்சொற்|பரிமேலழகர் உரை:?$|தெய்வப்புலமை|'?தெய்வப்புலவர்|\d+\.|[{}])|(?:முற்றும்|முற்றிற்று|முற்றுப்பெற்றது)\.?$|^\S+-\s?\d+$/;
const END_OF_ENTRY = /^(?:=|ஈண்டுப் பிரிவினை|ஊழியல் முற்றிற்று|அறத்துப்பால் முற்றிற்று|கற்பியல் முற்றிற்று|காமத்துப்பால் முற்றிற்று|திருக்குறள் பரிமேலழகர் உரை முற்று)/;

const tidy = (line: string): string =>
  line
    .replace(/^[;:\s]+/, '')
    .replace(/^பரிமேலழகர்\s*(?:உரை)?\s*(?:\(?இதன்\s?பொருள்\)?)?\s*(?:விளக்கம்)?\s*:?\s*/, '')
    .replace(/^பரிமேலழகர் உரைவிளக்கம்\s*:?\s*/, '')
    .replace(/^திருக்குறள்\s*பரிமேலழகர்\s*உரை\s*:?\s*/, '')
    .replace(/^\(?இதன்\s?பொருள்\)?\s*:?\)?\s*/, '')
    .replace(/^உரை\s?விளக்கம்\s*:?\s*/, '')
    .replace(/^விளக்கம்\s*:?\s*/, '')
    .replace(/,?\s*எ-று\.?/g, '.')
    // Footnote marks. A ❖ can sit mid-sentence, so it mustn't take the rest of the line with it.
    .replace(/[❖@$♥♣♠♦¶↑†‡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function readEntry(n: number, section: string): CommentaryEntry {
  const lines = strip(section).split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
  const marked = lines.findIndex((l) => GLOSS_START.test(l));
  const start = marked >= 0 ? marked : lines.findIndex((l) => GLOSS_LINE.test(l));
  const before = start < 0 ? lines : lines.slice(0, start);
  const contextLine = before.find((l) => /^[:;\s]*[([]/.test(l) && !/தொடரமைப்பு/.test(l) && /[஀-௿]{3}/.test(l));
  const context = contextLine === undefined ? null : contextLine.replace(/^[:;\s]*[([]\s*/, '').replace(/\s*[)\]]\s*$/, '').trim();

  const gloss: string[] = [];
  const notes: string[] = [];
  let inNotes = false;
  for (const raw of start < 0 ? [] : lines.slice(start)) {
    const flat = raw.replace(/^[;:\s]+/, '');
    if (END_OF_ENTRY.test(flat)) break;
    // K304 labels its gloss as a note, so a line that glosses a phrase is never the note.
    if (NOTE_START.test(flat) && !GLOSS_LINE.test(flat)) inNotes = true;
    const line = tidy(raw);
    if (line === '' || EDITORIAL.test(line) || !/[஀-௿]{2}/.test(line)) continue;
    (inNotes ? notes : gloss).push(line);
  }
  return { n, context, gloss, notes };
}

/**
 * His introduction sits on the chapter's own page, before the first verse and after its label.
 * The opening words vary (அஃதாவது, இனி, இதனுள்…) and so do the headings, so neither can be matched on.
 */
function preface(page: string): string {
  const first = HEADING.exec(page);
  const lead = (first === null ? page : page.slice(0, first.index)).replace(/^[\s\S]*(?:முன்னுரை|அதிகாரவிளக்கம்)/, '');
  const lines = strip(lead).split('\n').map((l) => l.replace(/^[;:\s]+/, '').trim()).filter((l) => l !== '' && !l.startsWith('=') && !l.startsWith('{{'));
  return lines.join(' ').replace(/^[^\s:]+\s*:\s*/, '').replace(/\s+/g, ' ').trim();
}

export function parseCommentary(pages: Record<string, { text: string }>, couplets: { n: number; tamil: [string, string] }[]): Commentary {
  const verses = couplets.map((c) => ({ n: c.n, grams: trigrams(lettersOf(c.tamil.join(''))) }));
  const byN = new Map<number, { section: string; score: number }>();
  const prefaces: Record<number, string> = {};

  for (const [title, { text }] of Object.entries(pages)) {
    const chapter = /\/(\d+)\.[^/]*$/.exec(title);
    if (chapter !== null) prefaces[Number(chapter[1])] = preface(text);
    const parts = text.split(SPLIT).filter((p) => p !== undefined);
    for (const part of parts) {
      const heading = HEADING.exec(part);
      if (heading === null || heading.index > 0) continue;
      const zone = trigrams(lettersOf(strip(part.slice(0, 900))));
      const stated = Number(heading[1] ?? 0);
      let best = { n: 0, score: 0 };
      for (const v of verses) {
        const score = coverage(v.grams, zone) + (v.n === stated ? 0.01 : 0);
        if (score > best.score) best = { n: v.n, score };
      }
      if (best.score < 0.5) throw new Error(`no verse found for section headed ${heading[1]}: ${part.slice(0, 80)}`);
      const held = byN.get(best.n);
      if (held === undefined || best.score > held.score) byN.set(best.n, { section: part, score: best.score });
    }
  }

  const entries = couplets.map((c) => {
    const held = byN.get(c.n);
    if (held === undefined) throw new Error(`no commentary for K${c.n}`);
    return readEntry(c.n, held.section);
  });
  return { entries, prefaces };
}
