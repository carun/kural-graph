// Commentaries: reading one word across traditions, and preparing text for a device voice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findExcerpts, latinStemPattern, matcherFor, regexFor, splitHits, stemToDeva } from "../src/lib/commentary/lens.ts";
import { chunkText, pickVoice, speechText, translationText } from "../src/lib/commentary/speech.ts";

test("stems in the holy-bhagavad-gita.org style convert to Devanagari", () => {
  assert.equal(stemToDeva("karm"), "कर्म");
  assert.equal(stemToDeva("adhikār"), "अधिकार");
  assert.equal(stemToDeva("phal"), "फल");
  assert.equal(stemToDeva("kṣhetr"), "क्षेत्र");
  assert.equal(stemToDeva("dhṛitarāśhtr"), "धृतराश्त्र");
  assert.equal(stemToDeva("āchāry"), "आचार्य");
  assert.equal(stemToDeva("ichchhām"), "इच्छाम");
});

test("a Sanskrit commentary is searched in Devanagari, inside sandhi too", () => {
  const re = regexFor(matcherFor(["karm"]), "sa");
  const text = "कर्मण्येवाधिकारस्ते न ज्ञाननिष्ठायाम्। तत्र च कर्म कुर्वतः फलेषु अधिकारो मा भूत्।";
  const hits = splitHits(text, re).filter((s) => s.hit).map((s) => s.t);
  assert.deepEqual(hits, ["कर्मण्येवाधिकारस्ते", "कर्म"]);
});

test("English commentaries match with or without diacritics (Gambirananda writes 'adhikarah')", () => {
  const re = regexFor(matcherFor(["adhikār"]), "en");
  assert.ok(re);
  const gambirananda = "Te, your; adhikarah, right; is karmani eva, for action alone, not for steadfastness in Knowledge.";
  assert.deepEqual(splitHits(gambirananda, re).filter((s) => s.hit).map((s) => s.t), ["adhikarah"]);
  assert.match("your adhikāraḥ is to act", regexFor(matcherFor(["adhikār"]), "en")!);
  // Word starts only: "karm" must not match inside "Sukarma"-like words, but matches "Karma" and "karmaṇi".
  const k = regexFor(matcherFor(["karm"]), "en")!;
  assert.equal(splitHits("Karma yoga and karmaṇi, not Sukarman", k).filter((s) => s.hit).length, 2);
  assert.ok(latinStemPattern("kṣhetr").startsWith("k(?:"));
});

test("particles without a stem have no matcher", () => {
  const m = matcherFor([]);
  assert.equal(m.deva, null);
  assert.equal(m.latin, null);
});

test("excerpts are the sentences that discuss the word, trimmed around it when long", () => {
  const re = regexFor(matcherFor(["phal"]), "en");
  const text = "You have a right to action. Never to its phala, the fruits. " + "Long ".repeat(80) + "phala again here. Nothing else.";
  const ex = findExcerpts(text, re, 3, 120);
  assert.equal(ex.length, 2);
  assert.ok(ex[0].includes("phala, the fruits"));
  assert.ok(ex[1].startsWith("… ") && ex[1].includes("phala again"));
});

test("Sivananda's word-by-word gloss is skipped and Devanagari removed before reading English aloud", () => {
  const t = speechText({ lang: "en", text: "2.47 कर्मणि in work? एव only? अधिकारः right? Commentary When you work, do not hope for the fruit? or for anything (BG 2.47)." });
  assert.equal(t, "When you work, do not hope for the fruit, or for anything (BG 2 47).");
});

test("a translator's words reach the voice as written: questions and brackets stay, only line breaks go", () => {
  assert.equal(translationText("Goddess? or peafowl rare?\nShe whose ears rich jewels wear,"), "Goddess? or peafowl rare? She whose ears rich jewels wear,");
  assert.equal(translationText("divisions of men [enemies, strangers and friends] is a virtue."), "divisions of men [enemies, strangers and friends] is a virtue.");
});

test("Hindi text keeps its sentences; long text is cut into sentence-sized chunks", () => {
  const hi = speechText({ lang: "hi", text: "2.47।। व्याख्या-- 'कर्मण्येवाधिकारस्ते'-- कर्तव्य कर्मका पालन करनेमें ही तेरा अधिकार है।। इसमें तू स्वतन्त्र है।" });
  assert.ok(hi.startsWith("व्याख्या, "));
  const chunks = chunkText(`${"A short sentence. ".repeat(30)}${"word ".repeat(120)}`, 100);
  assert.ok(chunks.every((c) => c.length <= 100), "every chunk fits");
  assert.ok(chunks[0].endsWith("."), "sentence boundaries are preferred");
  assert.equal(chunks.join(" ").replace(/\s+/g, " ").trim().split(" ").length, 30 * 3 + 120, "nothing is dropped");
});

test("voices: US English for English, Hindi for Hindi and Sanskrit, natural voices preferred", () => {
  const voices = [
    { lang: "en-IN", name: "Microsoft Neerja Online (Natural)" },
    { lang: "en-US", name: "Microsoft David" },
    { lang: "en-US", name: "Microsoft Aria Online (Natural)" },
    { lang: "hi-IN", name: "Microsoft Kalpana" },
  ];
  assert.equal(pickVoice(voices, "en")?.name, "Microsoft Aria Online (Natural)");
  // Android writes en_US, and speech-dispatcher on Linux en-us.
  assert.equal(pickVoice([{ lang: "en_IN", name: "India" }, { lang: "en_US", name: "US" }], "en")?.name, "US");
  assert.equal(pickVoice([{ lang: "en-in", name: "India" }, { lang: "en-us", name: "US" }], "en")?.name, "US");
  // Any English beats silence.
  assert.equal(pickVoice([{ lang: "en-IN", name: "India" }, { lang: "en-GB", name: "UK" }], "en")?.name, "UK");
  assert.equal(pickVoice([{ lang: "en-IN", name: "India" }], "en")?.name, "India");
  assert.equal(pickVoice(voices, "hi")?.name, "Microsoft Kalpana");
  assert.equal(pickVoice(voices, "sa"), null);
  assert.equal(pickVoice([...voices, { lang: "ta-IN", name: "Microsoft Valluvar" }], "sa")?.name, "Microsoft Valluvar");
  assert.equal(pickVoice([{ lang: "en-US", name: "x" }], "hi"), null);
});
