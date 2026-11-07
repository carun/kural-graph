# Annotation guide

This is the guide the original links were written to, when the site used Aiyar's 1916 English. The rules for what makes a good link still hold. The current text and quotes are governed by [READINGS.md](READINGS.md).

You are annotating couplets of the Tirukkural in V. V. S. Aiyar's 1916 English. Your work becomes a knowledge graph that readers will explore, and readers see your reasons. Being right matters more than being thorough.

## What you have

- `annotation/corpus.txt`: Aiyar's text with his notes. Read all of it before you start, because you need the whole work in mind to judge one couplet.
- `annotation/corpus-tamil.txt`: the Tamil, with the same numbering. Check it whenever Aiyar's wording is unclear. Where he is loose, the Tamil decides what the couplet is about, but your quotes still come from Aiyar.
- `data/ontology/vocabulary.yaml`: the only IDs you may use. Read the definitions and boundary notes, not just the labels.
- `node content/pipeline/annotate-check.ts <shard>`: run this until it reports no problems.

Do not read anything under `data/eval/`.

## The three rules

1. **"No edge" is a good answer.** There are no quotas. A couplet with one true edge beats one with four weak ones. Do not reach for an idea because a word happens to appear.
2. **Every edge must survive this question:** would a careful reader, shown only this couplet and your reason, agree? If you have to argue for it, leave it out.
3. **Tag what the couplet says, not what it reminds you of.** Other links belong to a later pass.

## Output

Write one JSON file, `data/annotations/<shard>.json`:

```json
{
  "shard": "shard-01",
  "chapters": [1, 2],
  "couplets": [
    {
      "n": 301,
      "gloss": "Holding back anger only counts when you could actually hurt someone; when you can't, it hardly matters.",
      "keywords": ["self-control", "power over others", "restraint"],
      "edges": [
        { "type": "COMMENDS", "target": "quality:…", "basis": "explicit", "reason": "…", "quote": "…" }
      ]
    }
  ],
  "ideaLinks": [],
  "proposals": []
}
```

Every couplet in your chapters needs an entry, even with no edges. Each may also have a `sensitive` field: see below.

## Couplet edges

At most 4 per couplet, not counting `ENUMERATES`.

### COMMENDS and CONDEMNS (target: quality or theme)

The couplet urges this, praises it, or shows its rewards; or it warns against this, or shows its cost. Nearly every couplet does one or the other. This is your main tool.

- Tag what is being judged, not everything named. "Anger" in a couplet about mastering anger gets `CONDEMNS` on anger. Tag self-control too only if the couplet also praises it.
- A couplet that praises the absence of a vice condemns the vice. Don't invent a virtue for it unless the vocabulary has one and the couplet is about it.
- Irony and hyperbole are common. Read for what is meant. Kural 1062 curses the Creator in order to condemn a world where people must beg: the target is the injustice, not faith.

### DEFINES (target: quality or theme)

The couplet says what something is, in the manner of "X is Y", or gives its essential test. It is much rarer than COMMENDS. Kural 34, "Be pure in heart: all righteousness is contained in this one commandment", defines righteousness. A couplet that only praises something does not define it.

### ENUMERATES (target: quality or theme)

The couplet lists items by name: one edge per item. Kural 35 lists envy, greed, anger and harsh words. Kural 381 lists the six things a state needs. Use it only for an actual list, and never for a pair joined in passing.

### ADDRESSES (target: role)

The couplet is directed at, or is specifically about, someone in this position. The prince chapters address the prince. Do not tag a role for a couplet addressed to everyone, which most of Part 1 is. "He who…" and "the man who…" are general and carry no role.

### GUIDES (target: situation)

Someone in this situation today could take real direction from this couplet. Apply it strictly: the situation must fit without stretching. A couplet about a prince's spies does not guide someone "deciding whether to trust a colleague" unless its point really transfers. Most couplets have no `GUIDES` edge, and that is fine.

### USES_IMAGE (target: image)

The couplet uses this concrete image: a comparison, metaphor or picture that does work in the verse. Kural 1304 compares refusing to make peace to cutting the roots from a starving plant. A word in its plain sense is not an image: "the farmer ploughs" in the chapter on husbandry is literal.

## Basis

- `explicit`: the couplet says this in so many words.
- `inferred`: it follows, but a reader has to take a step. Use it honestly: it tells readers how far to trust the link.

If an inferred edge takes more than one step, drop it.

## Reason

Readers see this. One plain sentence, under 170 characters, saying why this couplet bears on this idea.

- Be specific to the couplet. A reason that could sit on any couplet in the chapter is worthless.
- Don't start with "This couplet" or "The verse". Don't repeat the idea's name as your whole reason. Don't lecture.
- Good: "Calls the eye that sees no kindness in others a sore, not an eye."
- Bad: "This couplet commends kindness."

## Quote

The shortest exact phrase from Aiyar's text that carries the point: words and punctuation exactly as printed, including his archaic spelling and curly apostrophes. The checker rejects anything that isn't verbatim. Copy it from the corpus; never retype it from memory.

## Gloss

A plain modern paraphrase, under 170 characters. It powers search and is never shown to readers, so write what the couplet means in the words someone would use today, not Aiyar's. Do not reuse his distinctive phrasing. Say what it means even where he is obscure, and check the Tamil if you aren't sure.

## Keywords

2 to 6 lowercase modern search terms that are not already obvious from the gloss. Think about what a person with this problem would type.

## Sensitive

Add `"sensitive": "<why, in a few words>"` only when the couplet could hurt someone in distress if offered as advice. Flagged couplets stay in the Read view, but the Reflect feature will not suggest them. Flag:

- Counsel to endure mistreatment that could reach someone being abused, including forgiveness, forbearance and a wife's patience.
- Views that demean women, sex workers, or people of low birth.
- Shaming of the poor, the sick, or people who beg.
- Anything that treats death or self-destruction as a way out of shame or suffering. Kurals 967, 969 and 1050 must be flagged; the checker enforces it.
- Praise of violence or of killing in anger.

Do not flag a couplet merely for being old-fashioned. The test is harm to a vulnerable reader, not your taste.

## Idea links

`ideaLinks` connect two ideas, and only when a couplet states the connection. They are the chains and logic of the book, and the most visible thing you will write, so hold them to the highest standard.

- `LEADS_TO`: A brings about B. Kural 74: love yields tenderness, and tenderness yields friendship.
- `REQUIRES`: A depends on B. Kural 757: compassion needs wealth to tend it.
- `OVERCOMES`: A defeats or removes B.
- `OPPOSES`: A and B are set against each other.

```json
{ "type": "LEADS_TO", "source": "quality:…", "target": "quality:…", "basis": "explicit",
  "reason": "…", "quote": "…", "couplets": [74] }
```

The quote must be verbatim from a cited couplet. Do not write a link because you believe it is true of life. The text must say it.

## Proposals

If the vocabulary truly has no home for something that matters, add it to `proposals` and move on: `{ "label": "...", "type": "quality", "why": "...", "couplets": [..] }`. Never invent an ID, and never force a couplet onto a poor fit. Expect to need very few of these.

## Worked examples

`data/annotations/pilot.json` is chapters 8 and 38, annotated as the standard to match, and they are finished: don't annotate them again. Read it before you start. Note its restraint: Kural 374 has no edges at all, because linking it to destiny takes a step the words don't, and Kural 373 is marked inferred because Aiyar's "Spirit" only makes sense through the Tamil.

## Common mistakes

- Tagging the chapter's topic on every couplet, when a given couplet is about something narrower.
- Tagging a word instead of a meaning.
- Treating Aiyar's "Behold the man who…" as a role.
- `GUIDES` edges that stretch, which are the most common way to get this wrong.
- Reasons copied from one couplet to the next with a word changed.
