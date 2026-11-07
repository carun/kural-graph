# Content

Everything readers see in the book starts here. `npm run data` turns this folder into `public/data/`, which the app reads. Never edit `public/data/` by hand: change the content here and regenerate.

```sh
npm run data
npm test
```

The first run downloads its sources into `content/.cache/`, which takes a few minutes because Wikisource is asked politely. After that it takes under a minute. Every download is checked against a hash in `pipeline/sources.lock.json` or a pinned revision, so a changed source stops the run instead of changing the book.

## What's here

| Folder | Holds |
|---|---|
| `data/clean/` | The texts. `tamil.json` and `parimelazhagar.json` are rebuilt from the downloads, with `tamil-fixes.yaml` applied. The other translators and commentators are hand-checked files, so edit those directly: each lists its corrections and sources. |
| `data/readings/` | The plain reading and parimēlaḻagar's reading of each chapter |
| `data/annotations/` | The links between couplets and ideas, and the feelings, walks and chains |
| `data/ontology/` | The ideas and what each one means |
| `data/eval/` | `walks.md`, which a test holds the walks to, and where the Tamil witnesses disagree |
| `annotation/` | The guides for writing annotations and readings, including the table of key words |
| `pipeline/` | The stages `run.ts` runs, `export-fork.ts`, which writes the app's format, and the checks below |

## Checks

```sh
node content/pipeline/vocabulary-check.ts
node content/pipeline/annotate-check.ts
node content/pipeline/flows-check.ts
node content/pipeline/readings-corpus.ts && node content/pipeline/readings-check.ts
```

`readings-check` reports 52 problems. They are links the audit changed after the readings were written, and they don't affect what the site shows.

`node content/pipeline/flows-print.ts` rewrites `walks.md`. Do that only after reading the changes, because it's the reviewed copy.

## Licence

The project's own content is under [CC BY-NC-SA 4.0](LICENSE): `data/annotations/`, `data/ontology/`, `data/readings/`, `data/eval/walks.md`, `annotation/`, and what `public/data/` generates from them. Commercial use needs the owner's permission: ask at <https://arunc.dev/contact/>.

The source texts keep their own terms:

| Text | File in `data/clean/` | Terms |
|---|---|---|
| The Tamil couplets | `tamil.json` | Ancient and in the public domain. This copy starts from [tk120404/thirukkural](https://github.com/tk120404/thirukkural), Apache-2.0 |
| parimēlaḻagar's Tamil | `parimelazhagar.json` | 13th century, from Tamil Wikisource, CC BY-SA |
| V. V. S. Aiyar, 1916 | `aiyar.json` | From Standard Ebooks, believed to be in the US public domain |
| G. U. Pope, 1886 | `pope.json` | Public domain |
| W. H. Drew and J. Lazarus, 1885 | `drew-lazarus.json` | Public domain |
| maṇakkudavar | `manakkudavar.json` | Medieval, from Project Madurai: free to distribute with its header, which `NOTICE` reproduces |
| mu. varaḍarāsaṉār | `varadarasanar.json` | From Tamil Wikisource, CC BY-SA. Nationalisation announced in 2009 |
| mayilai civamuṭṭu | `sivamuthu.json` | From Tamil Wikisource, CC BY-SA. Nationalised |
| ṭēvanēyap pāvāṇar | `pavanar.json` | Nationalised in 2006. From the Tamil Digital Library |

The code, including `pipeline/`, is under the [MIT licence](../LICENSE).

## Never commit the cache

`content/.cache/tamil-kural.json` holds fields that must never be committed or shipped: `mv`, `sp`, `mk`, `Translation`, `couplet` and `explanation`. The pipeline reads only the Tamil lines, numbering, chapter names and romanisation from it. Pope, Drew and Lazarus and mu. varaḍarāsaṉār come from their own public sources, not from those fields.
