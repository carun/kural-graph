/**
 * Static content for the home page, so it paints before the couplet data arrives.
 * Tamil, romanisation and plain readings are copied verbatim from public/data/kural-verses.json (author 1), and
 * tests/home-content.test.ts holds them to it. Everything here is a couplet people know, none of it sensitive.
 */

/** Follows a couplet's number wherever a reading is quoted, as his page named the translator. */
export const HOME_TRANSLATOR = "plain reading written by an AI";

export interface HomeVerse {
  id: string;
  ref: string;
  sa: string[];
  iast: string[];
  en: string;
  /** Chip label in the verse switcher. */
  theme: string;
  /** Where the couplet comes from. We add no paraphrase of our own to a couplet. */
  gloss: string;
}

/** The couplet switcher: Kural 1 first, then other lines people carry with them. */
export const SPOTLIGHT: HomeVerse[] = [
  {
    id: "K_1",
    ref: "1",
    sa: ["அகர முதல எழுத்தெல்லாம் ஆதி", "பகவன் முதற்றே உலகு."],
    iast: ["agara muḍala eḻuṭṭellām āḍi", "pagavaṉ muḍaṟṟē ulagu."],
    en: "As all letters begin with A, the world begins with the First Lord.",
    theme: "Where it begins",
    gloss: "Chapter 1, Praising God",
  },
  {
    id: "K_391",
    ref: "391",
    sa: ["கற்க கசடறக் கற்பவை கற்றபின்", "நிற்க அதற்குத் தக."],
    iast: ["kaṟka kasadaṟak kaṟpavai kaṟṟabiṉ", "niṟka aḍaṟkuṭ ṭaga."],
    en: "Learn what should be learned, and learn it without flaw. Once you have learned it, live up to it.",
    theme: "Learn, then live it",
    gloss: "Chapter 40, Learning",
  },
  {
    id: "K_396",
    ref: "396",
    sa: ["தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக்", "கற்றனைத் தூறும் அறிவு."],
    iast: ["ṭottaṉaiṭ ṭūṟum maṇaṟkēṇi mānḍarkkuk", "kaṟṟaṉaiṭ ṭūṟum aṟivu."],
    en: "A well in the sand gives water as far as you dig. People’s understanding flows as far as they learn.",
    theme: "A well in the sand",
    gloss: "Chapter 40, Learning",
  },
  {
    id: "K_100",
    ref: "100",
    sa: ["இனிய உளவாக இன்னாத கூறல்", "கனிஇருப்பக் காய்கவர்ந் தற்று."],
    iast: ["iṉiya uḷavāga iṉṉāḍa kūṟal", "kaṉi-iruppak kāygavarn ḍaṟṟu."],
    en: "To speak harsh words when sweet ones are there is like picking unripe fruit when ripe fruit is there.",
    theme: "Ripe fruit",
    gloss: "Chapter 10, Speaking Sweet Words",
  },
  {
    id: "K_423",
    ref: "423",
    sa: ["எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்", "மெய்ப்பொருள் காண்ப தறிவு."],
    iast: ["epporuḷ yāryārvāyk kētpiṉum apporuḷ", "meypporuḷ kāṇba ṭaṟivu."],
    en: "Whatever you hear, from whoever’s mouth, understanding is seeing the reality in it.",
    theme: "See what is real",
    gloss: "Chapter 43, Having Understanding",
  },
  {
    id: "K_467",
    ref: "467",
    sa: ["எண்ணித் துணிக கருமம் துணிந்தபின்", "எண்ணுவம் என்பது இழுக்கு."],
    iast: ["eṇṇiṭ ṭuṇiga karumam ṭuṇinḍabiṉ", "eṇṇuvam eṉbaḍu iḻukku."],
    en: "Think, then commit to the task. To say you will think after you have committed is a mistake.",
    theme: "Think, then commit",
    gloss: "Chapter 47, Thinking Before You Act",
  },
  {
    id: "K_595",
    ref: "595",
    sa: ["வெள்ளத் தனைய மலர்நீட்டம் மாந்தர்தம்", "உள்ளத் தனையது உயர்வு."],
    iast: ["veḷḷaṭ ṭaṉaiya malarnīttam mānḍarḍam", "uḷḷaṭ ṭaṉaiyaḍu uyarvu."],
    en: "The stem of a water flower is as long as the water is deep. People rise as high as their spirit.",
    theme: "As high as your spirit",
    gloss: "Chapter 60, Having Drive",
  },
  {
    id: "K_786",
    ref: "786",
    sa: ["முகநக நட்பது நட்பன்று நெஞ்சத்து", "அகநக நட்பது நட்பு."],
    iast: ["muganaga natpaḍu natpaṉṟu neñjaṭṭu", "aganaga natpaḍu natpu."],
    en: "Friendship that makes the face smile is not friendship. Friendship makes the heart smile deep within.",
    theme: "A smile in the heart",
    gloss: "Chapter 79, Friendship",
  },
];

/** The couplet quoted beside "why it matters": a small kindness, at the right moment, in an ordinary day. */
export const ARISE = {
  id: "K_102",
  ref: "102",
  sa: ["காலத்தி னாற்செய்த நன்றி சிறிதெனினும்", "ஞாலத்தின் மாணப் பெரிது."],
  en: "A good deed done at the right time, though small, is far greater than the world.",
};

/**
 * Life situations from the graph (LifeDilemma nodes), each with a walk. Gentle and common on purpose: this is a front
 * page, so none of these is a crisis, a `silent` walk or a situation with `leaveOut` couplets.
 */
export const SITUATIONS: { id: string; label: string }[] = [
  { id: "dilemma:you-tried-and-failed", label: "I tried hard and failed" },
  { id: "dilemma:work-unrecognised", label: "My work goes unrecognised" },
  { id: "dilemma:is-this-the-right-time", label: "Is this the right time?" },
  { id: "dilemma:feels-impossible", label: "It feels impossible" },
  { id: "dilemma:speaking-in-public", label: "I have to speak in public" },
  { id: "dilemma:looking-for-a-mentor", label: "I need someone wiser" },
  { id: "dilemma:friend-in-trouble", label: "A friend needs me" },
  { id: "dilemma:raising-children", label: "I want to do right by my children" },
];

export interface Scene {
  /** True when the quote is one sentence of a longer reading. */
  excerpt?: boolean;
  /** The chapter this Part opens at. */
  chapter: number;
  /** How many chapters it holds. */
  chapters: number;
  part: number;
  /** The Part's Tamil name. */
  name: string;
  title: string;
  verseId: string;
  ref: string;
  quote: string;
  image: "ch01" | "ch02" | "ch18";
  alt: string;
}

/** The book's three Parts, each with a couplet of its own. */
export const SCENES: Scene[] = [
  {
    part: 1,
    chapter: 1,
    chapters: 38,
    name: "அறத்துப்பால்",
    title: "Righteousness",
    verseId: "K_34",
    ref: "34",
    quote: "To be without stain in your mind is all of righteousness. Everything else is noise.",
    image: "ch01",
    alt: "Rain falls over a flooded rice field at dusk, with palmyra palms along the far bank and a break of gold in the cloud.",
  },
  {
    part: 2,
    chapter: 39,
    chapters: 70,
    name: "பொருட்பால்",
    title: "Wealth",
    verseId: "K_400",
    ref: "400",
    quote: "Learning is the great wealth that can’t be destroyed. All else is not wealth.",
    image: "ch02",
    alt: "Ripe ears of rice bow over against a low sun, with palmyra palms standing far off.",
  },
  {
    part: 3,
    chapter: 109,
    chapters: 25,
    name: "காமத்துப்பால்",
    title: "Desire",
    verseId: "K_1289",
    ref: "1289",
    quote: "Desire is softer than a flower. Few ever find it at its peak.",
    image: "ch18",
    alt: "A full moon rises over a lotus pond in the last rose light of the evening.",
  },
];

/** A chain from the graph, step by step. Labels are the graph's own. */
export const LADDER = {
  id: "from-a-kind-word",
  title: "From a sweet word to compassion",
  steps: [
    { id: "emotion:kind-speech", label: "Kind Speech" },
    { id: "emotion:righteousness", label: "Righteousness" },
    { id: "concept:wealth", label: "Wealth" },
    { id: "emotion:compassion", label: "Compassion" },
  ],
};

export const SAMPLE_QUESTIONS = ["What does the Kural say about anger?", "How do I choose a friend?", "Is it wrong to want wealth?"];

/** Shown while the graph data loads; matches public/data/kural-graph.json (stats). */
export const GRAPH_COUNTS_FALLBACK = { Chapter: 133, Verse: 1330, SanskritConcept: 117, Emotion: 129, LifeDilemma: 58, Character: 4, edges: 6862 };
