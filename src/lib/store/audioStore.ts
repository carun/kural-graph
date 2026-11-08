"use client";
// Shravana — the persistent recitation engine. Plays the project's own recordings from /audio/ (one per couplet, and
// whole chapters where they exist), falls back to the device's voice where there is none, and keeps the graph in sync.
import { create } from "zustand";
import { useGita } from "./useGitaStore";
import { loadCommentary } from "@/lib/data/loader";
import { COMMENTATORS } from "@/lib/commentary/traditions";
import { chunkText, pickVoice, speechText, translationText } from "@/lib/commentary/speech";

export type AudioSource = "recitation" | "chapter" | "speech" | "commentary" | null;

/** A commentary or translation being read aloud by the device's voice. */
export interface CommentaryReading {
  authorId: number;
  name: string;
  lang: "en" | "hi" | "sa";
  part: number;
  parts: number;
}

const AFTER_KEY = "gitaviswa:commentary-after";
const storedAfter = (): boolean => {
  try {
    return !!localStorage.getItem(AFTER_KEY);
  } catch {
    return false;
  }
};

// Android starts its speech engine only when a page first asks for voices, and the list can take seconds to come. Ask
// as the page loads, so the first Listen doesn't wait for it: that first wait is what made the first press find no voice.
if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();

/**
 * Voices load asynchronously in some browsers; wait for them. Only a list with voices in it ends the wait:
 * `voiceschanged` can arrive with an empty one, and some browsers fill the list without firing it, so look as well.
 */
function voicesReady(wait = 5000): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((res) => {
    const check = () => speechSynthesis.getVoices().length && done();
    const done = () => {
      clearTimeout(t);
      clearInterval(poll);
      speechSynthesis.removeEventListener("voiceschanged", check);
      res(speechSynthesis.getVoices());
    };
    const t = setTimeout(done, wait);
    const poll = setInterval(check, 250);
    speechSynthesis.addEventListener("voiceschanged", check);
  });
}

interface AudioState {
  verseId: string | null;
  chapter: number | null;
  mode: "verse" | "chapter";
  playing: boolean;
  loading: boolean;
  autoAdvance: boolean;
  follow: boolean;
  rate: number;
  source: AudioSource;
  sourceLabel: string;
  /** Said plainly in the player, without being an error: what the device can't do, or why playback changed. */
  note: string;
  currentTime: number;
  duration: number;
  approx: boolean;
  error?: string;
  /** Read the translation chosen on the page aloud after each verse (one-verse-at-a-time mode). */
  commentaryAfter: boolean;
  reading: CommentaryReading | null;
}

export const useAudio = create<AudioState>(() => ({
  verseId: null,
  chapter: null,
  mode: "verse",
  playing: false,
  loading: false,
  autoAdvance: true,
  follow: true,
  rate: 1,
  source: null,
  sourceLabel: "",
  note: "",
  currentTime: 0,
  duration: 0,
  approx: false,
  commentaryAfter: storedAfter(),
  reading: null,
}));

const set = useAudio.setState;
const st = () => useAudio.getState();

/** Switch the reading after each verse on or off. Remembered on this device. */
export function setCommentaryAfter(on: boolean) {
  set({ commentaryAfter: on });
  try {
    if (on) localStorage.setItem(AFTER_KEY, "1");
    else localStorage.removeItem(AFTER_KEY);
  } catch {}
}

class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private chapterSourceIdx = 0;
  private speaking = false;
  /** Recordings that didn't load this session, so a replay or the next pass goes straight to the device's voice. */
  private missing = new Set<string>();
  private primed = false;

  private ensure(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = "auto";
    el.addEventListener("playing", () => set({ playing: true, loading: false }));
    // Only while the element is what's playing: pausing it to hand over to the device's voice fires this after speech starts.
    el.addEventListener("pause", () => (st().source === "recitation" || st().source === "chapter") && set({ playing: false }));
    el.addEventListener("waiting", () => set({ loading: true }));
    el.addEventListener("ended", () => this.onEnded());
    el.addEventListener("error", () => this.onError());
    el.addEventListener("loadedmetadata", () => set({ duration: el.duration || 0 }));
    el.addEventListener("timeupdate", () => this.onTime());
    this.el = el;
    this.bindMediaSession();
    return el;
  }

  private bindMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => this.toggle());
    ms.setActionHandler("pause", () => this.toggle());
    ms.setActionHandler("nexttrack", () => this.next());
    ms.setActionHandler("previoustrack", () => this.prev());
  }

  private meta(title: string, album: string) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Tirukkural · Kural Graph", album });
  }

  /** The chapter last followed, to tell the audio moving on from someone having gone to read elsewhere. */
  private followed: number | null = null;

  private follow(id: string) {
    if (!st().follow) return;
    const g = useGita.getState();
    g.fly(id);
    const chapter = g.versesById.get(id)?.chapter;
    if (!chapter) return;
    // Read moves with the audio, unless someone there has gone to another chapter. Not openChapter: that would change the view.
    if (g.view !== "adhyayana" || g.readerChapter === this.followed) useGita.setState({ readerChapter: chapter });
    this.followed = chapter;
  }

  /** iOS only lets speech start from a tap, and the fallback starts after a failed load, so unlock it during the tap. */
  private primeSpeech() {
    if (this.primed || typeof speechSynthesis === "undefined") return;
    this.primed = true;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  /** The commentary being read: its chunks, voice, and a token that retires stale utterance callbacks. */
  private reading: { verseId: string; authorId: number; parts: string[]; voice: SpeechSynthesisVoice; lang: "en" | "hi" | "sa"; thenNext: boolean; tok: number } | null = null;
  /** Bumped by every stop, so an async step that resolves later knows it has been superseded. */
  private gen = 0;
  /** How to carry on after a pause, while speech is paused. */
  private resumeSpeech: (() => void) | null = null;

  private stopSpeech() {
    this.gen++;
    this.reading = null;
    this.resumeSpeech = null;
    if (this.speaking && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.speaking = false;
    if (st().reading) set({ reading: null });
  }

  /**
   * Read a commentary or translation aloud with the device's voice (English; Tamil, "sa" in the data, with a Tamil voice).
   * `thenNext`: this is the "after each verse" step, so continue to the next verse when done.
   */
  async readCommentary(verseId: string, authorId: number, { thenNext = false }: { thenNext?: boolean } = {}) {
    if (typeof speechSynthesis === "undefined") return set({ error: "This browser can't read text aloud." });
    const g = useGita.getState();
    const v = g.versesById.get(verseId);
    this.el?.pause();
    this.stopSpeech();
    const my = this.gen;
    set({ verseId, chapter: v?.chapter ?? null, mode: "verse", loading: true, playing: false, error: undefined, note: "", source: "commentary", sourceLabel: "", approx: false, currentTime: 0, duration: 0 });
    // A translator has no commentary entry: their words are in the verse, so reading them needs no network.
    const doc = v?.commentaryAuthors.includes(authorId) ? await loadCommentary(verseId) : null;
    if (my !== this.gen) return;
    const e = doc?.commentaries.find((c) => c.authorId === authorId);
    const words = v?.translations.en?.[String(authorId)];
    const text = e && !e.none && !e.seeAlso ? { lang: e.lang, said: speechText(e) } : !e && words ? { lang: "en" as const, said: translationText(words) } : null;
    const name = COMMENTATORS[authorId]?.name ?? e?.author ?? g.versesDoc?.authors.find((a) => a.id === authorId)?.name ?? "This commentator";
    if (!text) {
      set({ loading: false });
      if (thenNext) return this.afterCommentary();
      return set({ error: e?.seeAlso ? `${name} discusses this couplet under Kural ${e.seeAlso.slice(2)}.` : `${name} has no commentary on this couplet.` });
    }
    const voices = await voicesReady();
    if (my !== this.gen) return;
    const voice = pickVoice(voices, text.lang);
    if (!voice) return set({ loading: false, error: text.lang === "en" ? "No English voice is available on this device." : "This device has no Tamil voice, so this can't be read aloud." });
    const parts = chunkText(text.said);
    if (!parts.length) return thenNext ? this.afterCommentary() : set({ loading: false });
    this.reading = { verseId, authorId, parts, voice, lang: text.lang, thenNext, tok: 0 };
    this.speaking = true;
    set({ loading: false, playing: true, sourceLabel: `${voice.name}, this device's voice`, reading: { authorId, name, lang: text.lang, part: 0, parts: parts.length } });
    this.meta(`${name} on Kural ${v?.ref ?? verseId.slice(2)}`, "Read aloud");
    this.sayPart(0);
  }

  /**
   * Stop the voice and keep how to carry on. speechSynthesis.pause() can't do this: on Android it ends the utterance,
   * which runs on to the next step and leaves resume() nothing to resume. A passage is short enough to start again.
   */
  private pauseSpeech() {
    const s = st();
    const r = this.reading;
    if (r) {
      const part = s.reading?.part ?? 0;
      r.tok++;
      this.resumeSpeech = () => {
        this.speaking = true;
        set({ playing: true });
        this.sayPart(part);
      };
    } else {
      this.gen++;
      this.resumeSpeech = () => s.verseId && void this.speak(s.verseId);
    }
    speechSynthesis.cancel();
    this.speaking = false;
    set({ playing: false });
  }

  private sayPart(i: number) {
    const r = this.reading;
    if (!r) return;
    if (i >= r.parts.length) {
      const thenNext = r.thenNext;
      this.reading = null;
      this.speaking = false;
      set({ playing: false, reading: null });
      if (thenNext) this.afterCommentary();
      return;
    }
    const tok = ++r.tok;
    const u = new SpeechSynthesisUtterance(r.parts[i]);
    u.voice = r.voice;
    u.lang = r.voice.lang;
    u.rate = (r.lang === "en" ? 1 : 0.95) * st().rate;
    u.onend = () => {
      if (this.reading === r && r.tok === tok) this.sayPart(i + 1);
    };
    u.onerror = (ev) => {
      if (this.reading !== r || r.tok !== tok || ev.error === "interrupted" || ev.error === "canceled") return;
      this.speaking = false;
      set({ playing: false, error: "The device voice stopped reading." });
    };
    const cur = st().reading;
    if (cur) set({ reading: { ...cur, part: i } });
    speechSynthesis.speak(u);
  }

  /** After a commentary read between verses: go on, unless continuing is switched off. */
  private afterCommentary() {
    if (st().autoAdvance) this.next();
    else set({ playing: false });
  }

  playVerse(id: string, note = "") {
    const g = useGita.getState();
    const v = g.versesById.get(id);
    if (!v) return;
    this.stopSpeech();
    this.primeSpeech();
    const ch = g.versesDoc?.chapters.find((c) => c.number === v.chapter);
    set({ verseId: id, chapter: v.chapter, mode: "verse", loading: true, error: undefined, note, source: "recitation", sourceLabel: "Recording", approx: false, currentTime: 0, duration: 0 });
    const el = this.ensure();
    const url = v.audio.verse[0];
    this.meta(`Kural ${v.ref}`, ch ? `Chapter ${ch.number} · ${ch.title}` : "");
    this.follow(id);
    if (!url || this.missing.has(url)) return void this.speak(id);
    el.src = url;
    el.playbackRate = st().rate;
    el.play().catch((e) => this.noRecording(id, e));
  }

  /** A couplet's recording didn't play. Most haven't been made yet, so this isn't an error: the device reads it instead. */
  private noRecording(id: string, e?: unknown) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "AbortError") return; // The next couplet took over before this one loaded.
    const s = st();
    if (s.source !== "recitation" || s.verseId !== id) return; // Already handled: this fires from play() and from the element.
    const url = useGita.getState().versesById.get(id)?.audio.verse[0];
    if (url && name !== "NotAllowedError") this.missing.add(url);
    void this.speak(id);
  }

  playChapter(n: number, sourceIdx = 0) {
    const g = useGita.getState();
    const ch = g.versesDoc?.chapters.find((c) => c.number === n);
    if (!ch) return;
    this.stopSpeech();
    this.primeSpeech();
    const src = ch.audio[sourceIdx];
    if (!src) return this.playVerse(`K_${(n - 1) * 10 + 1}`, "This chapter has no recording of its own yet, so its couplets play one at a time.");
    this.chapterSourceIdx = sourceIdx;
    set({ chapter: n, mode: "chapter", loading: true, error: undefined, note: "", source: "chapter", sourceLabel: src.source, approx: true, verseId: `K_${(n - 1) * 10 + 1}`, currentTime: 0, duration: src.duration || 0 });
    const el = this.ensure();
    el.src = src.url;
    el.playbackRate = st().rate;
    el.play().catch(() => this.onError());
    this.meta(`Chapter ${n} · ${ch.title}`, src.title);
    this.follow(`K_${(n - 1) * 10 + 1}`);
  }

  /**
   * No recording, or offline: the device reads the couplet. Tamil needs a Tamil voice. A device without one says so
   * and reads the plain reading in English, so that listening still works, rather than mangling the Tamil.
   */
  async speak(id: string) {
    const v = useGita.getState().versesById.get(id);
    if (!v || typeof speechSynthesis === "undefined") {
      set({ loading: false, playing: false, error: "There is no recording of this couplet yet, and this browser can't read aloud." });
      return;
    }
    this.el?.pause();
    this.stopSpeech();
    speechSynthesis.cancel();
    const my = this.gen;
    const kept = st().note;
    set({ verseId: id, chapter: v.chapter, loading: true, playing: false, source: "speech", sourceLabel: "Read by your device", mode: "verse", error: undefined, approx: false, currentTime: 0, duration: 0 });
    const voices = await voicesReady();
    if (my !== this.gen) return;
    const tamil = pickVoice(voices, "sa");
    const voice = tamil ?? pickVoice(voices, "en");
    if (!voice) return set({ loading: false, error: "There is no recording of this couplet yet, and this device has no voice to read it." });
    const u = new SpeechSynthesisUtterance(tamil ? v.sanskrit.join(" ") : v.translations.en["1"]);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = (tamil ? 0.78 : 1) * st().rate;
    u.onend = () => {
      if (my !== this.gen) return;
      this.speaking = false;
      set({ playing: false });
      this.onEnded(tamil ? undefined : 1);
    };
    u.onerror = (ev) => {
      if (my !== this.gen || ev.error === "interrupted" || ev.error === "canceled") return;
      this.speaking = false;
      set({ playing: false, error: "The device voice stopped reading." });
    };
    this.speaking = true;
    speechSynthesis.speak(u);
    set({ playing: true, loading: false, sourceLabel: `Read by your device (${voice.name})`, note: tamil ? kept : "This device has no Tamil voice, so it is reading the plain reading in English." });
    this.follow(id);
  }

  toggle() {
    const s = st();
    if (s.source === "commentary" || s.source === "speech") {
      const resume = this.resumeSpeech;
      this.resumeSpeech = null;
      if (resume) resume();
      else if (s.playing) this.pauseSpeech();
      else if (s.loading) return;
      else if (s.source === "speech" && s.verseId) void this.speak(s.verseId);
      else if (s.verseId && s.reading) void this.readCommentary(s.verseId, s.reading.authorId, { thenNext: this.reading?.thenNext });
      else if (s.verseId) this.playVerse(s.verseId);
      return;
    }
    if (!this.el || !this.el.src) {
      const sel = useGita.getState().selectedId;
      return this.playVerse(sel?.startsWith("K_") ? sel : "K_1");
    }
    if (this.el.paused) this.el.play().catch(() => this.onError());
    else this.el.pause();
  }

  stop() {
    this.stopSpeech();
    this.el?.pause();
    set({ playing: false });
  }

  /** End the listening session entirely (hides the player). */
  dismiss() {
    this.stop();
    if (this.el) {
      this.el.removeAttribute("src");
      this.el.load();
    }
    set({ verseId: null, chapter: null, currentTime: 0, duration: 0, error: undefined, note: "", loading: false, source: null, sourceLabel: "" });
  }

  private neighbour(delta: number): string | null {
    const s = st();
    const verses = useGita.getState().versesDoc?.verses;
    if (!verses || !s.verseId) return null;
    const i = verses.findIndex((v) => v.id === s.verseId);
    return verses[i + delta]?.id ?? null;
  }

  next() {
    const s = st();
    if (s.mode === "chapter" && s.chapter) return s.chapter < 133 ? this.playChapter(s.chapter + 1) : this.stop();
    const id = this.neighbour(1);
    if (id) this.playVerse(id);
  }

  prev() {
    const s = st();
    if (s.mode === "chapter" && s.chapter) return s.chapter > 1 ? this.playChapter(s.chapter - 1) : undefined;
    const id = this.neighbour(-1);
    if (id) this.playVerse(id);
  }

  seek(frac: number) {
    const r = this.reading;
    if (st().source === "commentary" && r) {
      // Jump to a passage: retire the current utterance's callbacks, then read from there.
      r.tok++;
      this.resumeSpeech = null;
      this.speaking = true;
      speechSynthesis.cancel();
      set({ playing: true });
      return this.sayPart(Math.min(r.parts.length - 1, Math.max(0, Math.floor(frac * r.parts.length))));
    }
    if (this.el && this.el.duration) this.el.currentTime = frac * this.el.duration;
  }

  setRate(rate: number) {
    set({ rate });
    if (this.el) this.el.playbackRate = rate;
  }

  /** `alreadyRead`: whose English the device has just read in place of the Tamil, so it isn't read twice. */
  private onEnded(alreadyRead?: number) {
    const s = st();
    const chosen = useGita.getState().enAuthor;
    // The chosen translation after each verse: read it, then afterCommentary() continues.
    if (s.mode === "verse" && s.commentaryAfter && s.verseId && s.source !== "commentary" && chosen !== alreadyRead) return void this.readCommentary(s.verseId, chosen, { thenNext: true });
    if (!s.autoAdvance) return set({ playing: false });
    this.next();
  }

  private onError() {
    const s = st();
    if (s.mode === "chapter" && s.chapter) {
      const ch = useGita.getState().versesDoc?.chapters.find((c) => c.number === s.chapter);
      if (ch && this.chapterSourceIdx + 1 < ch.audio.length) return this.playChapter(s.chapter, this.chapterSourceIdx + 1);
      return this.playVerse(`K_${(s.chapter - 1) * 10 + 1}`, "The chapter recording could not be reached, so its couplets play one at a time.");
    }
    if (s.verseId) this.noRecording(s.verseId);
  }

  /** In chapter mode, estimate the verse being chanted from the syllable-proportional offsets. */
  private onTime() {
    const el = this.el!;
    set({ currentTime: el.currentTime, duration: el.duration || st().duration });
    const s = st();
    if (s.mode !== "chapter" || !s.chapter || !el.duration) return;
    const frac = el.currentTime / el.duration;
    const verses = useGita.getState().versesDoc?.verses.filter((v) => v.chapter === s.chapter) || [];
    let cur = verses[0];
    for (const v of verses) if (v.audio.chapterFrac <= frac) cur = v;
    if (cur && cur.id !== s.verseId) {
      set({ verseId: cur.id });
      this.follow(cur.id);
    }
  }
}

export const audio = new AudioEngine();
