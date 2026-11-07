# Writing guide for the readings

You are writing the English of the Tirukkural for a public site. Readers will see your words as the book itself, so being right matters more than being quick. Each couplet gets two things: a **plain reading** and **Parimelazhagar's reading**. The project owner reads Tamil and has approved the examples below, so match them.

## What you have

- Your source file in `annotation/readings/`, with each couplet's Tamil, his gloss and notes, and its links. Read it a chapter at a time: `grep -n "======== CHAPTER"` gives the line numbers.
- `data/readings/chapters/008.json`, `038.json` and `133.json`: approved chapters. Read 008 and 133 before you start.
- `node content/pipeline/readings-check.ts <chapter>`: run it after each chapter until it says clean.

Do not read `data/eval/` or anything else that holds an old English translation. Work from the Tamil and the commentary.

## The plain reading

What the couplet says, in words a person would use today. This is the site's main text.

1. **Start from the Tamil.** The commentary helps you read it, but it doesn't decide what you write.
2. **Add nothing.** No fate, god, karma, caste, household or setting that the Tamil doesn't have. If he supplies it, it goes in his reading, not this one.
3. **Keep the images.** Bones, salt, a dead tree: keep them. Don't explain them away.
4. **Keep the hard edges.** If a couplet is harsh, old-fashioned or uncomfortable, say so plainly. Don't soften, modernise or apologise for it, and don't add a lesson.
5. **Say it in one or two short sentences**, under 200 characters. Use "you" for general advice. Use "they" or "someone" when the Tamil has no gender. Use he or she when it does.
6. **Plain doesn't mean modern.** No bosses, apps or offices. A ruler stays a ruler.

## Key words

Use these every time, so that the same Tamil word reads the same across the book. The checker enforces the first two.

| Tamil | English |
|---|---|
| அன்பு | loving-kindness (except K911 and K1276, where it is love) |
| காமம் | desire |
| அருள் | compassion |
| அறம் | righteousness |
| பொருள், when it means wealth | wealth |
| ஊழ், பால், விதி | fate |
| ஊடல், புலவி | sulking, or a lovers’ quarrel |
| அரசன், வேந்தன், இறை, மன்னன் | ruler |
| அமைச்சு | minister |
| ஒற்று | spy |
| அந்தணர் | sages |
| பார்ப்பான் | Brahmin |
| தெய்வம், கடவுள் | god |

Where a word has no entry, choose the plainest accurate English. If you must keep a Tamil word, romanise it with `toRevisedIast` from `pipeline/lib/tamilToIast.ts`, in lowercase.

## Parimelazhagar's reading

What he says, paraphrased in plain English, under 380 characters. These are not his exact words.

- Use his gloss and his notes. Leave out grammar, metre and citations of other works.
- **Keep what he says, even where it is uncomfortable or narrow:** varna, karma, heaven, household duties, the rule of kings. Don't soften him or argue with him.
- Use the same key words as the plain reading, but keep his definitions. In chapter 8 he says loving-kindness is for your own people, and his reading says so.
- If he rejects another reading, say "He rejects…".
- Lines labelled தொடரமைப்பு, word lists and numbered footnotes are the edition's, not his.
- Refer to him as "he". Write his reasoning in the present tense.

## Tag and note

Compare his reading with your plain reading.

- `agrees`: he says the same thing, perhaps with small detail.
- `adds`: same core, plus something the words don't say, such as a setting, a reason or a doctrine.
- `differs`: he means something else. A note is then required.

`note` is optional otherwise, under 240 characters. Use it only when a reader would be misled without it, or where the Tamil can go two ways. Name what differs and stop.

## Chapter title and note

`title` is a short plain English name for the chapter, from its Tamil name, under 48 characters. Don't copy an old translation's title. `note` is his introduction to the chapter in a sentence or two, under 260 characters. Every chapter has one.

## Part 3 (couplets 1081 onwards)

- `context`: who is speaking and why, from his context line, in plain English. Example: "She has been sulking without cause. Her friend asks why, and she answers." When he says இதுவுமது (the same), continue naturally: "He goes on, to himself."
- `speaker`: `he`, `she` or `maid`, as his context line shows. Use `maid` for the friend (தோழி) when she is the one speaking. Trust his context line.
- Write the couplet in the speaker's voice.

## Links

Each couplet may list links from the old graph. Every one needs a decision. Judge it against the Tamil and your plain reading, not the old quote.

- **Keep it:** give a `quote`, the shortest exact phrase from your plain reading that carries the point. The checker rejects anything that isn't word for word.
- **Reword it:** also give a new `reason` if the old one no longer fits. It must if it uses words the Tamil doesn't have, or an old term your reading has replaced, such as "Destiny" for fate, "prince" for ruler or "Bouderie" for sulking. One plain sentence, under 170 characters, specific to this couplet. Don't start with "This couplet".
- **Remove it:** give `remove` with a short reason, if the link only existed because of the old English. An image that isn't in the Tamil goes. A link whose idea isn't in the Tamil goes.

Don't bend a reading to save a link. Don't remove a link only because the wording changed.

## Sensitive

Copy `sensitive` onto any couplet marked "Sensitive already", word for word. Add it to a new couplet only if your plain reading could hurt someone in distress: counsel to endure mistreatment, views that demean women or people of low birth, shaming of the poor or sick, or treating death as a way out of shame or suffering.

## Writing

Plain, specific and short. Curly quotes and apostrophes (’ “ ”), never straight ones. No dashes as punctuation: use a full stop or comma. No "Behold", "thou", "doth" or other old forms.

## Output

One file per chapter, `data/readings/chapters/NNN.json`, with the chapter number padded to three digits.

```json
{
  "chapter": 133,
  "title": "The Joy of Sulking",
  "note": "When sulking has made union sweeter, she and he each delight in the sulking.",
  "couplets": [
    {
      "n": 1321,
      "plain": "He has done nothing wrong, yet sulking is what draws out his tenderness.",
      "pm": "He has no fault, but the tenderness he shows me makes me sulk…",
      "tag": "differs",
      "note": "The Tamil can go either way…",
      "context": "She has been sulking without cause. Her friend asks why, and she answers.",
      "speaker": "she",
      "links": [
        { "id": "abc123", "quote": "sulking is what draws out his tenderness" },
        { "id": "def456", "quote": "…", "reason": "A new reason." },
        { "id": "789abc", "remove": "The image isn’t in the Tamil." }
      ]
    }
  ],
  "ideaLinks": [
    { "id": "012def", "quote": "…" }
  ]
}
```

`ideaLinks` covers the links listed at the end of a chapter as "Idea link". They follow the same rules, and the quote comes from a cited couplet in this chapter. Use `[]` if a chapter has none.
