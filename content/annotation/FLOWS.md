# Writing guide for the flows

Someone comes to the site with a situation. The flows walk them through the book: from the situation, to what it tends to feel like, to what the Kural sets against that, to the couplets that say so. The flows also record how the book moves by itself: why each chapter follows the last, and threads that build one teaching across chapters.

Readers will see your words, and some will be in real trouble. Being right matters more than being thorough.

## Four rules

1. **The Kural decides.** Every link except `evokes` must be stated by a couplet you cite. Don't write a link because it is good advice, or true of life. The text has to say it.
2. **No link is a good answer.** There are no quotas. Three true links beat ten weak ones.
3. **Never invent comfort.** The Kural is not a self-help book. Where it offers no way through, say so plainly in `silent`. It says poverty is the worst suffering and offers little remedy. Don't soften that.
4. **Protect the reader.** Never walk someone who is being mistreated towards enduring it. If a situation could be abuse or coercion, don't resolve it through forgiveness, patience, forbearance or obedience. Couplets marked `[SENSITIVE]` can't be used in `answers`, `antidotes`, `resolves` or threads. The checker enforces this, and you should not look for ways round it.

## What you have

- `annotation/flows/corpus.txt`: every couplet with its Tamil and plain reading, by chapter. Read all of it before you start.
- `annotation/flows/ideas.txt`: every quality and theme, with definitions and boundaries.
- `annotation/flows/situations.txt`: every situation, and the couplets already linked to it.
- `annotation/flows/introductions.txt`: Parimelazhagar's introduction to each chapter, in Tamil and English.
- `annotation/READINGS.md`: the key-word table. Use the same English for the same Tamil.
- `node content/pipeline/flows-check.ts`: run it until it reports no problems in your file.

Don't read `data/eval/`. Don't change any file except the ones your brief names.

## Writing

- Reasons: one plain sentence, under 170 characters, specific to this couplet. Don't start with "This couplet" or "The verse". Don't lecture.
- Quotes: the shortest exact phrase from the **plain reading** that carries the point, at least three words, copied word for word.
- `basis`: `explicit` if the couplet says this in so many words, `inferred` if a reader has to take one step. More than one step means leave it out.
- Curly quotes and apostrophes (’ “ ”), never straight ones. No dashes as punctuation. Plain, modern English: "you" is fine.

## Feelings

Feelings are qualities in the vocabulary with `feeling: true`. Most are `polarity: state`, but anger and envy stay vices and also carry the flag, so that the book has only one Anger.

`data/annotations/flows-feelings.json`:

```json
{
  "feelings": [
    {
      "feeling": "quality:anger",
      "portrays": [{ "n": 304, "basis": "explicit", "reason": "…", "quote": "…" }],
      "answers": [{ "n": 301, "basis": "explicit", "reason": "…", "quote": "…" }]
    }
  ],
  "antidotes": [
    { "feeling": "quality:anger", "idea": "quality:self-control", "basis": "explicit", "couplets": [130], "reason": "…", "quote": "…" }
  ]
}
```

- `portrays`: the couplet shows this feeling from inside, or shows what it costs. The feeling must be what the couplet is about, not a word in passing.
- `answers`: the couplet says what to do with this feeling, or gives a way through it.
- `antidotes`: the text itself sets an idea against this feeling. The idea must be a virtue, a state or a theme, never a vice. Check the direction: the idea answers the feeling.

A feeling needs at least one couplet. Twelve in each list is plenty.

## Situations

`data/annotations/flows-situations.json`:

```json
{
  "situations": [
    {
      "situation": "situation:wanting-revenge",
      "evokes": [{ "feeling": "quality:anger", "reason": "…" }],
      "resolves": [{ "idea": "quality:self-control", "basis": "explicit", "couplets": [130], "reason": "…", "quote": "…" }]
    }
  ]
}
```

- `evokes`: one to three feelings a person commonly has in this situation. This is the one link that is ours and not the Kural's, and readers are told so. Use it for what is ordinary, and don't claim to know what anyone feels. The reason says why the feeling is common here, under 170 characters.
- `resolves`: up to three ideas the Kural itself offers for this situation, each citing the couplets that say so. Prefer couplets already linked to the situation.
- `silent`: use this when the Kural offers no way through, or only a hard one. Say in under 240 characters what it does say. A situation with no `resolves` must have `silent`. You can use both.
- `leaveOut`: couplets linked to this situation that are true of it, but wrong to offer someone living through it. They stay on the map, and walks and Reflect leave them out.
- `direct`: a walk also shows the general answers to each feeling you list in `evokes`, from `antidotes`. Set `"direct": true` if those would be wrong for someone in this situation, and the walk then shows only your `resolves`. Use it wherever a person may be being hurt by someone else, because the book's general answers to grief or losing heart ask them to bear it.

Every situation needs an entry. Take most care over these, where the wrong walk could do harm: `powerful-boss`, `power-over-others`, `struggling-to-get-by`, `having-to-ask-for-money`, `everything-going-wrong`, `wanting-to-walk-away`, `thinking-about-death`, `fate-against-you`, `ashamed-of-something-you-did`, `fight-with-your-partner`, `jealous-partner`, `love-not-returned`, `cant-let-go`, `drinking-too-much`, `cant-stop-gambling`.

## The book's own order

`data/annotations/flows-book.json`:

```json
{
  "chapters": [{ "chapter": 10, "after": 9, "reason": "…" }],
  "threads": [
    {
      "id": "what-to-do-with-anger",
      "title": "What to do with anger",
      "summary": "…",
      "steps": [{ "n": 301, "quote": "…", "why": "…" }]
    }
  ]
}
```

- `chapters`: Parimelazhagar often says why a chapter comes where it does. Record it only where he does: "பின் வைக்கப்பட்டது", "அதிகார முறைமை", or a reason his words plainly give. `after` is the chapter he names, usually the one before. Work from his Tamil, not only our English. If he gives no reason, leave the chapter out. Say whose view it is only if it reads oddly without that: these are all his.
- `threads`: 10 to 16 ordered runs of 4 to 8 couplets, from more than one chapter, that build a single teaching. Each step must add something to the last. A list of couplets on one topic is not a thread. `why` says what this step adds. Put the couplet where the thread arrives last.
