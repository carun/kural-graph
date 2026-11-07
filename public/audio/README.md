# Recordings of the couplets

Put a recording here and the site plays it. Until then, readers hear their device's voice, and the player says which they are getting: "Recording" or "Read by your device". You can add recordings a few at a time, in any order, for as long as you like.

## Naming

| What | File name | Example |
|---|---|---|
| One couplet | The couplet's number, four digits | `0380.mp3` is Kural 380. `0001.mp3` is Kural 1. |
| A whole chapter (optional) | `chapter-`, then the chapter's number, three digits | `chapter-038.mp3` is chapter 38. |

Numbers run from `0001` to `1330` and from `chapter-001` to `chapter-133`. The name has to be exact: `380.mp3` or `0380.MP3` won't be found, and that couplet will quietly stay with the device's voice.

## Format

- MP3, mono, 44.1 kHz, constant 96 kbps. Speech gains nothing from stereo or a higher rate.
- 96 kbps is 12 KB a second, so a 15-second couplet is about 180 KB. All 1,330 at that length would be about 240 MB.
- Leave a quarter of a second of quiet at each end. With "Continue automatically" on, the couplets play one after another, and that pause is the only gap between them.
- Keep the level the same from one session to the next. The commands below even it out.
- Cloudflare refuses any file over 25 MiB, which at this rate is about 35 minutes. Every recording counts towards its limit of 20,000 files for the whole site.

## Adding one couplet

Convert it, from the top of this repository:

```sh
ffmpeg -i ~/recordings/380.wav -ac 1 -ar 44100 -b:a 96k -af loudnorm=I=-16:TP=-1.5:LRA=11 public/audio/0380.mp3
```

That's all: no code or data changes, because every couplet already points at its own file. To hear it, run `npm run dev`, open Kural 380 and press Listen. The player should say "Recording". Then commit the file and deploy.

## Adding many at once

Name your files by the couplet's number, such as `380.wav` or `1.wav`, put them in one folder, and run this in bash (not fish) from the top of this repository:

```sh
for f in ~/recordings/*.wav; do
  n=$(basename "$f" .wav)
  ffmpeg -n -loglevel error -i "$f" -ac 1 -ar 44100 -b:a 96k -af loudnorm=I=-16:TP=-1.5:LRA=11 "public/audio/$(printf %04d "$((10#$n))").mp3"
done
```

`-n` skips any file that already exists, so you can rerun it as the folder grows. To redo a recording, delete its MP3 first. Then see which couplets are done:

```sh
ls public/audio/[0-9]*.mp3 | wc -l
```

## Adding a whole chapter

Unlike a couplet, a whole-chapter recording has to go into the data as well, because the player only offers one that exists.

1. Save it as, for example, `public/audio/chapter-038.mp3`, with the same format and commands as above.
2. Regenerate the data, which notices every `chapter-*.mp3` here:

   ```sh
   cd ../tirukkural-kb && node pipeline/export-fork.ts && cd ../kural-graph && node scripts/build-layout.mjs
   ```

3. Commit the recording and `public/data/`, and deploy.

While a chapter plays, the map and reader follow along by guessing each couplet's place from its share of the recording, and the player marks this "approximate". Read the couplets at an even pace and it will stay close.

To remove a chapter recording, delete the file and regenerate the data.

## Good to know

- A file that won't play isn't an error. The site treats it as missing and the device reads the couplet instead, so a bad file can go unnoticed. Listen to each batch once.
- Recordings aren't saved for offline use. With no connection, readers hear the device's voice.
- Commentaries are always read by the device's voice. Only couplets and whole chapters have recordings.
