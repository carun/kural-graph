// Offline Tamil → other Indic script transliteration (Brahmic blocks share the ISCII-derived layout,
// so most characters map by a fixed code-point offset; gaps are patched per script).

export type RegionalScript = "devanagari" | "odia" | "bengali" | "gujarati" | "telugu" | "kannada" | "malayalam";

export const SCRIPT_INFO: Record<RegionalScript, { name: string; native: string; lang: string; offset: number; font: string }> = {
  devanagari: { name: "Hindi", native: "हिन्दी", lang: "Hindi", offset: 0, font: "var(--font-indic)" },
  bengali: { name: "Bengali", native: "বাংলা", lang: "Bengali", offset: 0x0980 - 0x0900, font: "var(--font-indic)" },
  gujarati: { name: "Gujarati", native: "ગુજરાતી", lang: "Gujarati", offset: 0x0a80 - 0x0900, font: "var(--font-indic)" },
  odia: { name: "Odia", native: "ଓଡ଼ିଆ", lang: "Odia", offset: 0x0b00 - 0x0900, font: "var(--font-indic)" },
  telugu: { name: "Telugu", native: "తెలుగు", lang: "Telugu", offset: 0x0c00 - 0x0900, font: "var(--font-indic)" },
  kannada: { name: "Kannada", native: "ಕನ್ನಡ", lang: "Kannada", offset: 0x0c80 - 0x0900, font: "var(--font-indic)" },
  malayalam: { name: "Malayalam", native: "മലയാളം", lang: "Malayalam", offset: 0x0d00 - 0x0900, font: "var(--font-indic)" },
};

/** Languages offered for on-demand (LLM) meaning translation. English is the only one that ships with the site. */
export const TRANSLATION_LANGS = [
  { id: "en", name: "English", native: "English" },
  { id: "hi", name: "Hindi", native: "हिन्दी" },
  { id: "mr", name: "Marathi", native: "मराठी" },
  { id: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { id: "bn", name: "Bengali", native: "বাংলা" },
  { id: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { id: "ta", name: "Tamil", native: "தமிழ்" },
  { id: "te", name: "Telugu", native: "తెలుగు" },
  { id: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { id: "ml", name: "Malayalam", native: "മലയാളം" },
];

// Tamil letters whose straight offset lands on an unassigned slot, or on a letter fonts rarely carry → replacement.
// Bengali, Gujarati and Odia have no short e or o, and no ன, ற or ழ: the nearest letter stands in, so ள and ழ merge there.
// Telugu's own letter for ழ (U+0C34) is missing from many fonts; ళ is how Telugu itself spells தமிழ். Kannada keeps ழ at U+0CDE.
const PATCH: Partial<Record<RegionalScript, Record<string, string>>> = {
  bengali: { "எ": "এ", "ஒ": "ও", "ெ": "ে", "ொ": "ো", "ன": "ন", "ற": "র", "ள": "ল", "ழ": "ল", "வ": "ব", "ய": "য়" },
  gujarati: { "எ": "એ", "ஒ": "ઓ", "ெ": "ે", "ொ": "ો", "ன": "ન", "ற": "ર", "ழ": "ળ" },
  odia: { "எ": "ଏ", "ஒ": "ଓ", "ெ": "େ", "ொ": "ୋ", "ன": "ନ", "ற": "ର", "ழ": "ଳ", "வ": "ବ", "ய": "ୟ" },
  telugu: { "ன": "న", "ழ": "ళ" },
  kannada: { "ன": "ನ", "ழ": "ೞ" },
  malayalam: { "ன": "ന" },
};

// Offsets above count from the Devanagari block, which is where Tamil's letters are first moved to.
const TAMIL = 0x0b80 - 0x0900;

export function transliterate(text: string, script: RegionalScript): string {
  const info = SCRIPT_INFO[script];
  const patch = PATCH[script] || {};
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (patch[ch] !== undefined) out += patch[ch];
    else if (cp >= 0x0b80 && cp <= 0x0bff) out += String.fromCodePoint(cp - TAMIL + info.offset);
    else out += ch;
  }
  return out;
}

export const isRegionalScript = (s: string): s is RegionalScript => s in SCRIPT_INFO;
