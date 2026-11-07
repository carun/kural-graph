/**
 * Tamil script to the revised IAST defined in the essay "Roman Script for
 * Indian Words" (https://arunc.dev/essays/fix-iast-and-use-in-india-and-not-english/).
 *
 * It differs from standard IAST and ISO 15919 on purpose:
 *   - t = ட and ṭ = த; d = voiced ட and ḍ = voiced த (swapped from standard).
 *   - Hard consonants க ச ட த ப take their phonetic value mid-word.
 *   - Short e/o and long ē/ō are distinct. Output is always lowercase.
 *
 * Calls the essay leaves open, as decided by its author:
 *   - ச at the start of a word is always hard: c. "siṟappu" is a modern mispronunciation.
 *   - ச mid-word is s between vowels, j after a nasal, cc when doubled.
 *   - ற is not a hard consonant here, so ஒன்று is oṉṟu.
 *   - த after ந் is always ḍ, even across a metrical space.
 *
 * Voicing is context-dependent going forwards, but each roman letter still maps
 * to exactly one Tamil letter, so the conversion is reversible for Kural text.
 * Grantha ஜ and ஸ are the exception: they share j and s with ச. The Kural has
 * none, and stage 3 fails if any appear in the lines it round-trips.
 */

type Hard = 'க' | 'ச' | 'ட' | 'த' | 'ப';

/** Word start, doubled, or after a stop. */
const PRIMARY: Record<Hard, string> = { க: 'k', ச: 'c', ட: 't', த: 'ṭ', ப: 'p' };
/** Between vowels, or after ய ர ல ழ ள வ. */
const VOICED: Record<Hard, string> = { க: 'g', ச: 's', ட: 'd', த: 'ḍ', ப: 'b' };
/** After a nasal. */
const AFTER_NASAL: Record<Hard, string> = { க: 'g', ச: 'j', ட: 'd', த: 'ḍ', ப: 'b' };

const NASALS: Record<string, string> = { ங: 'ṅ', ஞ: 'ñ', ண: 'ṇ', ந: 'n', ம: 'm', ன: 'ṉ' };
const SONORANTS: Record<string, string> = { ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'ḻ', ள: 'ḷ' };
const OTHERS: Record<string, string> = { ற: 'ṟ' };
const GRANTHA: Record<string, string> = { ஜ: 'j', ஷ: 'ṣ', ஸ: 's', ஹ: 'h', ஶ: 'ś' };

const VOWELS: Record<string, string> = {
  அ: 'a', ஆ: 'ā', இ: 'i', ஈ: 'ī', உ: 'u', ஊ: 'ū',
  எ: 'e', ஏ: 'ē', ஐ: 'ai', ஒ: 'o', ஓ: 'ō', ஔ: 'au',
};
const SIGNS: Record<string, string> = {
  'ா': 'ā', 'ி': 'i', 'ீ': 'ī', 'ு': 'u', 'ூ': 'ū',
  'ெ': 'e', 'ே': 'ē', 'ை': 'ai', 'ொ': 'o', 'ோ': 'ō', 'ௌ': 'au',
};
const PULLI = '்';
const AYTHAM = 'ஃ';

/**
 * The text's spaces are metrical, so a nasal with pulli before its matching
 * stop across a space is read as one continuous sound, whether the space falls
 * inside a word (முந் துறும்) or between two (சூழினுந் தான்). ண் and ம் are left
 * out because they end ordinary words.
 */
const JOINS_ACROSS_SPACE: Record<string, Hard> = { ந: 'த', ங: 'க', ஞ: 'ச' };

const isHard = (c: string): c is Hard => c in PRIMARY;
const isConsonant = (c: string): boolean =>
  isHard(c) || c in NASALS || c in SONORANTS || c in OTHERS || c in GRANTHA;

type Unit =
  | { kind: 'consonant'; letter: string; vowel: string | null }
  | { kind: 'vowel'; roman: string }
  | { kind: 'aytham' }
  | { kind: 'other'; text: string };

function toUnits(word: string): Unit[] {
  const units: Unit[] = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const next = chars[i + 1] ?? '';
    if (isConsonant(c)) {
      if (next === PULLI) {
        units.push({ kind: 'consonant', letter: c, vowel: null });
        i++;
      } else if (next in SIGNS) {
        units.push({ kind: 'consonant', letter: c, vowel: SIGNS[next]! });
        i++;
      } else {
        units.push({ kind: 'consonant', letter: c, vowel: 'a' });
      }
    } else if (c in VOWELS) {
      units.push({ kind: 'vowel', roman: VOWELS[c]! });
    } else if (c === AYTHAM) {
      units.push({ kind: 'aytham' });
    } else {
      units.push({ kind: 'other', text: c });
    }
  }
  return units;
}

function hardLetter(letter: Hard, prev: Unit | undefined, vowel: string | null, prevWordEnd: string | null): string {
  if (vowel === null) return PRIMARY[letter];
  if (prev === undefined || prev.kind === 'other') {
    return prevWordEnd !== null && JOINS_ACROSS_SPACE[prevWordEnd] === letter
      ? AFTER_NASAL[letter]
      : PRIMARY[letter];
  }
  if (prev.kind === 'vowel') return VOICED[letter];
  if (prev.kind === 'aytham') return PRIMARY[letter];
  if (prev.vowel !== null) return VOICED[letter];
  if (prev.letter in NASALS) return AFTER_NASAL[letter];
  if (prev.letter in SONORANTS) return VOICED[letter];
  return PRIMARY[letter];
}

function romaniseWord(word: string, prevWordEnd: string | null): { text: string; endsWith: string | null } {
  const units = toUnits(word);
  const out: string[] = [];
  units.forEach((unit, i) => {
    const prev = units[i - 1];
    switch (unit.kind) {
      case 'other':
        out.push(unit.text);
        break;
      case 'aytham':
        out.push('ḵ');
        break;
      case 'vowel':
        // A vowel letter inside a word marks a junction. Without the hyphen
        // அன்புஈனும் would read back as a different spelling.
        if (prev !== undefined && prev.kind !== 'other') out.push('-');
        out.push(unit.roman);
        break;
      case 'consonant': {
        const { letter, vowel } = unit;
        const roman = isHard(letter)
          ? hardLetter(letter, prev, vowel, prevWordEnd)
          : (NASALS[letter] ?? SONORANTS[letter] ?? OTHERS[letter] ?? GRANTHA[letter])!;
        out.push(roman + (vowel ?? ''));
      }
    }
  });
  const last = units.findLast((u) => u.kind !== 'other');
  const endsWith = last?.kind === 'consonant' && last.vowel === null ? last.letter : null;
  return { text: out.join(''), endsWith };
}

export const normaliseTamil = (line: string): string =>
  line.normalize('NFC').trim().replace(/\s+/g, ' ');

export function toRevisedIast(line: string): string {
  let prevWordEnd: string | null = null;
  return normaliseTamil(line)
    .split(' ')
    .map((word) => {
      const { text, endsWith } = romaniseWord(word, prevWordEnd);
      prevWordEnd = endsWith;
      return text;
    })
    .join(' ');
}

const ROMAN_TO_TAMIL: Record<string, string> = {
  k: 'க', g: 'க', c: 'ச', s: 'ச', j: 'ச', t: 'ட', d: 'ட', ṭ: 'த', ḍ: 'த', p: 'ப', b: 'ப',
  ...Object.fromEntries(Object.entries({ ...NASALS, ...SONORANTS, ...OTHERS }).map(([k, v]) => [v, k])),
};
const ROMAN_VOWELS = ['ai', 'au', 'ā', 'ī', 'ū', 'ē', 'ō', 'a', 'i', 'u', 'e', 'o'];
const VOWEL_LETTER = Object.fromEntries(Object.entries(VOWELS).map(([k, v]) => [v, k]));
const VOWEL_SIGN = Object.fromEntries(Object.entries(SIGNS).map(([k, v]) => [v, k]));

/** The inverse, used to prove nothing was lost. Not for Grantha text. */
export function fromRevisedIast(roman: string): string {
  const matchVowel = (at: number) => ROMAN_VOWELS.find((v) => roman.startsWith(v, at));
  const out: string[] = [];
  for (let i = 0; i < roman.length; ) {
    const c = roman[i]!;
    if (c === '-') {
      i++;
    } else if (c === 'ḵ') {
      out.push(AYTHAM);
      i++;
    } else if (c in ROMAN_TO_TAMIL) {
      const v = matchVowel(i + 1);
      if (v === undefined) {
        out.push(ROMAN_TO_TAMIL[c]! + PULLI);
        i++;
      } else {
        out.push(ROMAN_TO_TAMIL[c]! + (v === 'a' ? '' : VOWEL_SIGN[v]!));
        i += 1 + v.length;
      }
    } else {
      const v = matchVowel(i);
      out.push(v === undefined ? c : VOWEL_LETTER[v]!);
      i += v === undefined ? 1 : v.length;
    }
  }
  return out.join('').normalize('NFC');
}

const STANDARD_HARD: Record<Hard, string> = { க: 'k', ச: 'c', ட: 'ṭ', த: 't', ப: 'p' };

/** Letter-for-letter standard form. Search index only, never displayed. */
export function toLetterForLetter(line: string): string {
  return normaliseTamil(line)
    .split(' ')
    .map((word) =>
      toUnits(word)
        .map((u) => {
          if (u.kind === 'other') return u.text;
          if (u.kind === 'aytham') return 'ḵ';
          if (u.kind === 'vowel') return u.roman;
          const base = isHard(u.letter)
            ? STANDARD_HARD[u.letter]
            : (NASALS[u.letter] ?? SONORANTS[u.letter] ?? OTHERS[u.letter] ?? GRANTHA[u.letter])!;
          return base + (u.vowel ?? '');
        })
        .join(''),
    )
    .join(' ');
}

/** Plain ASCII for matching what people type: aṉbu to anbu, aṟam to aram. */
export const foldToAscii = (roman: string): string =>
  roman.normalize('NFD').replace(/\p{M}/gu, '').replace(/-/g, ' ').toLowerCase();
