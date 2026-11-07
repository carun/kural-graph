# Kural Graph

The Tirukkural as a knowledge graph you can read, explore and question: all 1,330 couplets in 133 chapters, in Tamil, romanised and in plain English, with Parimelazhagar's commentary, and the ideas, states of mind and life situations that connect them.

**This is a fork of [GitaViśva](https://github.com/HimanshuMohanty-Git24/gitaviswa) by Himanshu Mohanty, used under the MIT licence.** The interface, the graph and nearly all the code are his, and they are the reason this site looks and works as well as it does. What's ours is the content and the changes the Kural needs. We keep the fork close to his so that we can go on merging his updates: see [UPSTREAM.md](UPSTREAM.md).

**An AI wrote the English.** The plain readings, the paraphrases of Parimelazhagar and the links between couplets were written by Anthropic's Claude, not by a scholar or translator, and no person has reviewed the links yet. The site says so to its readers. Treat them as a reading of the text and not as authority.

## What it does

| View | |
|---|---|
| Home | What the Kural is, and a way into everything else. |
| Explore | The whole book as one 3D graph, as a galaxy or a lotus. |
| Lineage | Follow one couplet or idea to what it connects to, or walk from a situation through what it can feel like to the couplets that speak to it. |
| Read | Chapter by chapter, with the Tamil, its romanisation, a plain reading and Parimelazhagar in English and in his Tamil. |
| Reflect | Write what's on your mind and see what it touches. It stays in your browser. |
| Ask | Answers composed from the graph, offline. Connect a language model with your own key for written answers. |

Search is under Ctrl K. Couplets can be listened to: see [public/audio/README.md](public/audio/README.md).

## Running it

You need Node 24.

```sh
npm install
npm run dev          # http://localhost:3000
npm test
npx tsc --noEmit
npm run build        # the static site, in out/
npm run preview      # that build on a local Cloudflare server
```

`npm run deploy` publishes to Cloudflare. If the site moves, change the address in `src/app/layout.tsx` or set `NEXT_PUBLIC_SITE_URL`, because link previews need it. It's a static site with no server, so there is nothing else to run. Every view but written answers works offline after the first visit. There's no analytics and nothing is sent anywhere unless someone connects a model, and then only what they choose goes straight from their browser to the provider they chose.

## Where the content comes from

Everything readers see in the book comes from the content repository, `tirukkural-kb`, which sits beside this one. Its `pipeline/export-fork.ts` writes `public/data/`. **Never edit `public/data/` by hand:** change the content there and regenerate.

```sh
cd ../tirukkural-kb && node pipeline/export-fork.ts && cd ../kural-graph && node scripts/build-layout.mjs
```

Run `npm test` afterwards. `tests/home-content.test.ts` checks that the couplets and counts quoted on the home page still match the data, and it tells you what to update in `src/components/home/homeContent.ts`.

## Rules for changes

1. **Keep the diff small.** Every line changed is a line that can conflict with his. Keep his names, comments and design. Put Kural logic in new files under `src/kural/`.
2. **Never reword a reading, reason, note or definition** here. They belong to the content repository.
3. **Safety.** Sensitive couplets stay off walks and Reflect, and crisis support comes before any couplet. Feelings on a situation are marked "Our suggestion, not the Kural’s words".
4. **Honesty.** Readers are told that an AI wrote the English and that no person has reviewed the links.
5. **Offline first.** No analytics and no third-party requests. Only model answers need a network.
6. **Model safety.** Invented citations are dropped, keys go only to the chosen provider, and nothing goes to a model unless one is connected and the person asks.
7. **No trace of the Gita in anything a reader sees.** "Verse" becomes "couplet". Credit to him stays in `NOTICE`, the licence and the About page.
8. **Words.** Part 3 is Desire, never Love. அன்பு is loving-kindness. The table of key words is in `annotation/READINGS.md` in the content repository. Copy is plain and short, with no dashes as punctuation.

## The pictures

The pictures on the home page are painted by a program: `scripts/home-art/scenes.js`, run by `paint.mjs`, which needs Playwright and fonts from `tirukkural-kb`. The night sky is the real graph, drawn from `public/data/`.

They are stand-ins, and they sit where his paintings sat. To use a real painting:

```sh
node scripts/home-art/swap.mjs hero ~/paintings/dusk.png
```

That crops it from the centre and writes every width. Supply at least the size below, in these proportions. Then change the alt text in `src/components/home/Home.tsx` (for the Parts, `homeContent.ts`), and the footer's note about the pictures.

| Slot | Where it shows | Size (px) | Files written |
|---|---|---|---|
| `hero` | Top of the page, wide screens. Leave the left half dark, for the words. | 1672 × 941 | `hero-828`, `-1280`, `-1672` |
| `heroPortrait` | Top of the page, phones. Words cover the top 60%. | 1120 × 1400 | `hero-portrait-750`, `-1120` |
| `fightOrFlight` | Beside "The Kural is about the life you are already living" | 1080 × 607 | `leaves-720`, `-1080` |
| `cosmicWide` | Above the live map, wide screens | 1911 × 819 | `night-wide-1280`, `-1911` |
| `cosmic` | Above the live map, phones | 1280 × 720 | `night-828`, `-1280` |
| `ch01` | Part 1, Righteousness | 960 × 720 | `part-righteousness-640`, `-960` |
| `ch02` | Part 2, Wealth | 960 × 720 | `part-wealth-640`, `-960` |
| `ch18` | Part 3, Desire | 960 × 720 | `part-desire-640`, `-960` |
| `setting` | "Your first five minutes". Words sit on the left, and it is cropped wide on a computer. | 1200 × 800 | `setting-768`, `-1200` |
| `lamp` | "Write what is on your mind" | 900 × 900 | `lamp-560`, `-900` |
| `dusk` | The closing call. Words sit on the left. | 1200 × 630 | `dusk-800`, `-1200` |

All are WebP files in `public/images/home/`. `public/og.jpg` is the picture for link previews, 1200 × 630, painted with the name on it.

## Licence

MIT, as his is: see [LICENSE](LICENSE), which keeps his copyright. [NOTICE](NOTICE) gives the sources of the texts. `public/third-party-notices.txt` covers the software, fonts and search model the site ships, and `node scripts/licences.mjs` rebuilds it after a change of dependencies.
