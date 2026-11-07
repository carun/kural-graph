# Merging updates from GitaViśva

This repository is a fork of Himanshu Mohanty's [GitaViśva](https://github.com/HimanshuMohanty-Git24/gitaviswa). We keep it mergeable so that his improvements reach this site.

| Remote | Repository | Branch |
|---|---|---|
| `origin` | `git@github.com:carun/kural-graph.git` | `kural`, ours |
| `upstream` | `git@github.com:HimanshuMohanty-Git24/gitaviswa.git` | `main`, his |

If `upstream` is missing: `git remote add upstream git@github.com:HimanshuMohanty-Git24/gitaviswa.git`.

## The merge

```sh
git checkout kural
git fetch upstream
git log --oneline kural..upstream/main    # what's new
git merge upstream/main
```

Read his commits first. His code changes are what we want, and his Gita content is what we don't.

## When his data conflicts: keep ours

Everything in `public/data/` is generated from `content/`. Never merge his data into it, and never hand-edit it.

His data files have different names from ours (`gita-verses.json`, `commentary/BG_2.47.json`), and we deleted his. When he changes one, Git reports a modify/delete conflict. Keep them deleted:

```sh
git status --porcelain | awk '/^(DU|UD) public\/(data|images)\// {print $2}' | xargs -r git rm --quiet
```

Pictures we share a name with, such as `hero-1280.webp`, conflict the other way. Keep ours, after the command above:

```sh
git checkout --ours -- public/images/home public/og.jpg public/favicon.svg
git add public/images/home public/og.jpg public/favicon.svg
```

If he renames a field in the data, the app and our data will no longer agree. Change `content/pipeline/export-fork.ts` to write the new shape, then regenerate:

```sh
npm run data
```

## When his code conflicts

Take his change and put ours back on top of it. Our own logic lives in new files under `src/kural/`, called from a line or two in his code, so most of these conflicts are a line of wording or an id.

These differ most from his, so expect conflicts here first. For the present list, run `git diff upstream/main --stat -- src`.

| Files | What we changed |
|---|---|
| `src/components/home/*` | All the words and pictures. Keep his layout and motion. |
| `src/lib/graphrag/*`, `src/lib/llm/*`, `src/components/chat/*` | Couplet citations, safety, and model calls made from the browser. |
| `src/components/graph/*` | 133 chapters, couplet ids, the galaxy and lotus shapes, walks in Lineage. |
| `src/components/reader/*` | The readings, parimēlaḻagar and the Tamil type. |
| `src/lib/store/useGitaStore.ts`, `src/lib/store/audioStore.ts` | Couplet ids, and recordings with the device's voice as a fallback. |
| `src/components/settings/ByokSettingsModal.tsx`, `src/lib/store/settingsStore.ts` | Keys kept in the browser. |
| `src/app/api/*` | We deleted these: this is a static site. If he changes one, keep it deleted and bring the change into `src/lib/llm/` if it matters. |

His names stay on purpose, because renaming them would make every merge conflict: `useGita`, `VerseExplorer`, `verse`, `sa`, `SanskritConcept`, `.deva` (now Tamil type), the `gitaviswa:` storage keys, and his view ids such as `cosmos` and `adhyayana`. Readers never see them, so leave them alone, and leave his comments too.

Scripts that build his data, such as `scripts/build-gita-knowledge-graph.mjs` and `scripts/ontology/`, are his and aren't used here. `scripts/verify-graph.mjs` still checks his rules, so it fails on our data. Take his changes to these without reading them closely.

## Before you push the merge

```sh
npx tsc --noEmit
npm test
npm run build
```

Then open the site and look at what he changed. Anything new he added may carry Gita words, so search what readers can see:

```sh
git diff kural@{1} kural -- src | grep -E '^\+' | grep -iE 'gita|krishna|arjuna|sanskrit|devanagari|bhagavad|śloka|sloka|adhy[aā]ya|yoga|verse'
```

Nothing a reader sees may name the Gita, and "verse" becomes "couplet". Credit to him stays in `NOTICE`, the licence and the About page. New features need checking against the rules in `README.md`.
