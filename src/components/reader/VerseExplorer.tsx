"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, MessagesSquare, NotebookPen, Orbit, Pause, Play, Waypoints, X } from "lucide-react";
import { useGita, type ScriptChoice } from "@/lib/store/useGitaStore";
import { audio, useAudio } from "@/lib/store/audioStore";
import { useDraft } from "@/lib/store/draftStore";
import { useConnection } from "@/lib/store/settingsStore";
import { neighbors } from "@/lib/graph/graphStore";
import { RELATIONS } from "@/lib/graph/relations";
import { SCRIPT_INFO, TRANSLATION_LANGS, isRegionalScript, transliterate, type RegionalScript } from "@/lib/indic/scripts";
import { cacheTranslation, getCachedTranslation } from "@/lib/store/personalStore";
import { streamFromApi } from "@/lib/llm/browser";
import type { Verse } from "@/lib/types";
import { askPartha } from "@/components/chat/GraphRagChatbot";
import { NodeGlyph, Notice, SectionLabel } from "@/components/ui/primitives";
import { PadacchedaLexicon } from "./PadacchedaLexicon";
import { Perspectives } from "./Perspectives";
import { IastKey, OldView, englishBy } from "@/kural/reader";

const SPEAKER: Record<string, string> = { tiruvalluvar: "Tiruvalluvar", he: "He", she: "She", friend: "The Friend" };
const PRIMARY_SCRIPTS: { id: ScriptChoice; label: string }[] = [
  { id: "deva", label: "தமிழ்" },
  { id: "iast", label: "Revised IAST" },
  { id: "phonetic", label: "Phonetic" },
];
const REGIONAL = Object.keys(SCRIPT_INFO) as RegionalScript[];

export function ScriptPicker({ compact = false, nowrap = false }: { compact?: boolean; nowrap?: boolean }) {
  const script = useGita((s) => s.script);
  const setScript = useGita((s) => s.setScript);
  const regional = isRegionalScript(script);
  return (
    <div className={`flex items-center gap-1.5 ${nowrap ? "" : "flex-wrap"}`}>
      <div className="seg" role="radiogroup" aria-label="Script">
        {PRIMARY_SCRIPTS.map((s) => (
          <button key={s.id} role="radio" aria-checked={script === s.id} onClick={() => setScript(s.id)} className={s.id === "deva" ? "deva !text-[13px]" : ""}>
            {s.label}
          </button>
        ))}
      </div>
      <select className={`field field-sm !w-auto ${regional ? "!border-accent-line text-text" : "text-text-3"} ${compact ? "max-w-[9rem]" : ""}`} aria-label="Regional script" value={regional ? script : ""} onChange={(e) => e.target.value && setScript(e.target.value as ScriptChoice)}>
        <option value="">Other scripts</option>
        {REGIONAL.map((s) => (
          <option key={s} value={s}>
            {SCRIPT_INFO[s].name} · {SCRIPT_INFO[s].native}
          </option>
        ))}
      </select>
    </div>
  );
}

export function verseLines(verse: Verse, script: ScriptChoice) {
  return script === "iast" ? verse.iast : script === "phonetic" ? verse.transliteration : isRegionalScript(script) ? verse.sanskrit.map((l) => transliterate(l, script)) : verse.sanskrit;
}

function SanskritBlock({ verse, script }: { verse: Verse; script: ScriptChoice }) {
  const lines = verseLines(verse, script);
  const head = verse.uvacha ? (script === "iast" ? verse.uvacha.iast : script === "phonetic" ? verse.uvacha.iast.normalize("NFD").replace(/\p{M}/gu, "") : isRegionalScript(script) ? transliterate(verse.uvacha.sa, script) : verse.uvacha.sa) : null;
  const cls = script === "deva" ? "deva text-[18px] leading-[1.85]" : isRegionalScript(script) ? "indic text-[19px]" : "serif text-[17px] italic leading-[1.6]";
  return (
    <div>
      {head && <div className={`${script === "deva" ? "deva" : isRegionalScript(script) ? "indic" : "serif italic"} mb-1 text-[13.5px] text-text-3`}>{head}</div>}
      <div className={`${cls} text-text`}>
        {lines.map((l, i) => (
          <div key={i} className="pl-4 -indent-4">{l}</div>
        ))}
      </div>
      {script === "deva" && <div className="serif mt-2 text-[14px] italic leading-[1.55] text-text-3">{verse.iast.join(" ")}</div>}
    </div>
  );
}

function Scansion({ verse }: { verse: Verse }) {
  return (
    <div className="mt-3 rounded-2 border border-line bg-surface-2 px-3 py-2.5" aria-label="Metre: guru and laghu syllables">
      <div className="label mb-1">Scansion: — heavy (guru), ∪ light (laghu)</div>
      <div className="space-y-0.5 text-[12px]">
        {verse.meter.scansion.map((p, i) => (
          <div key={i}>
            {[...p].map((w, j) => (
              <span key={j} className={w === "G" ? "scansion-g" : "scansion-l"}>
                {w === "G" ? "—" : "∪"}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Translation({ verse }: { verse: Verse }) {
  const versesDoc = useGita((s) => s.versesDoc);
  const lang = useGita((s) => s.translationLang);
  const setLang = useGita((s) => s.setTranslationLang);
  const enAuthor = useGita((s) => s.enAuthor);
  const setAuthors = useGita((s) => s.setAuthors);
  const setSettingsOpen = useGita((s) => s.setSettingsOpen);
  const conn = useConnection();
  const [regional, setRegional] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const authors = versesDoc?.authors || [];
  const langInfo = TRANSLATION_LANGS.find((l) => l.id === lang);

  useEffect(() => {
    if (lang === "en") return;
    let live = true;
    setRegional("");
    setErr("");
    getCachedTranslation(verse.id, lang).then((t) => live && t && setRegional(t));
    return () => {
      live = false;
    };
  }, [verse.id, lang]);

  const generate = async () => {
    if (!langInfo) return;
    setBusy(true);
    setErr("");
    const en = verse.translations.en?.[String(enAuthor)] || Object.values(verse.translations.en)[0];
    const r = await streamFromApi({ mode: "translate", question: `Translate the meaning of Tirukkural couplet ${verse.ref} into ${langInfo.name} (${langInfo.native} script).`, context: `Tamil: ${verse.sanskrit.join(" ")}\nRomanised: ${verse.iast.join(" ")}\nEnglish: ${en}`, onToken: (_t, full) => setRegional(full) });
    if (r.ok && r.text.trim()) await cacheTranslation(verse.id, lang, r.text.trim());
    else {
      setRegional("");
      setErr(r.error || "The translation could not be generated.");
    }
    setBusy(false);
  };

  const text = lang === "en" ? verse.translations.en?.[String(enAuthor)] : regional;
  const authorList = authors.filter((a) => lang === "en" && verse.translations.en?.[String(a.id)]);
  return (
    <section>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label mb-1 block">Language</span>
          <select className="field field-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
            {TRANSLATION_LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.id !== "en" ? " (generated)" : ""}
              </option>
            ))}
          </select>
        </label>
        {lang === "en" && (
          <label className="block min-w-0">
            <span className="label mb-1 block">Translator</span>
            <select className="field field-sm" value={enAuthor} onChange={(e) => setAuthors(Number(e.target.value))}>
              {authorList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {lang === "en" ? (
        <>
          <p className="reading mt-3 whitespace-pre-line !text-text">{text || "No reading by this translator for this couplet."}</p>
          <p className="mt-2 text-[11.5px] text-text-3">{englishBy(enAuthor)}</p>
        </>
      ) : regional ? (
        <>
          <p className="indic mt-3 whitespace-pre-line text-[16px] text-text">{regional}</p>
          <p className="mt-2 text-[11.5px] text-text-3">Generated by a language model and saved in this browser. Check important passages against a published translation.</p>
        </>
      ) : (
        <div className="mt-3">
          {conn ? (
            <Notice
              action={
                <button className="btn btn-sm" onClick={generate} disabled={busy}>
                  {busy && <LoaderCircle size={13} className="animate-spin" />}
                  {busy ? "Translating" : "Translate"}
                </button>
              }
            >
              {langInfo?.name} is generated on request by your language model and saved in this browser.
            </Notice>
          ) : (
            <Notice action={<button className="text-[12px] font-medium text-accent-text hover:underline" onClick={() => setSettingsOpen(true, "model")}>Connect</button>}>
              {langInfo?.name} meanings are generated by a language model. You can already read the couplet in other scripts above, offline.
            </Notice>
          )}
          {err && <p className="mt-2 text-[12.5px] text-danger">{err}</p>}
        </div>
      )}
    </section>
  );
}

function Connections({ verse }: { verse: Verse }) {
  const graphs = useGita((s) => s.graphs);
  const select = useGita((s) => s.select);
  const groups = useMemo(() => {
    if (!graphs) return [];
    const nb = neighbors(graphs, verse.id).filter((n) => !["BELONGS_TO", "NEXT_VERSE", "SPOKE", "NARRATED"].includes(n.type));
    const def: [string, (t: string) => boolean][] = [
      ["In dialogue with", (t) => t === "ANSWERS_QUESTION_IN"],
      ["Other couplets", (t) => ["ECHOES_VERSE", "CULMINATES_IN", "IN_TENSION_WITH", "QUALIFIES"].includes(t)],
      ["Life situations", (t) => t === "ADDRESSES_DILEMMA"],
      ["States of mind", (t) => ["HEALS", "CULTIVATES", "DEPICTS_STATE", "MENTIONS_STATE"].includes(t)],
      ["Concepts", (t) => t === "DEFINES_CONCEPT" || t === "MENTIONS_CONCEPT"],
      ["People named", (t) => t === "MENTIONS_CHARACTER"],
    ];
    return def.map(([title, f]) => [title, nb.filter((n) => f(n.type))] as const).filter(([, l]) => l.length);
  }, [graphs, verse.id]);
  if (!groups.length) return <p className="text-[13px] text-text-3">Beyond its chapter and the couplets either side, this couplet has no connections yet.</p>;
  return (
    <div className="space-y-5">
      {groups.map(([title, list]) => (
        <section key={title}>
          <SectionLabel count={list.length}>{title}</SectionLabel>
          <ul className="-mx-2.5">
            {list.map((n) => {
              const extra = n.props?.why || (n.props?.epithets ? `as ${n.props.epithets.join(", ")}` : n.props?.terms ? `word: ${n.props.terms.slice(0, 3).join(", ")}` : "");
              return (
                <li key={n.key}>
                  <button className="row" onClick={() => select(n.id)}>
                    <NodeGlyph node={n.node} className="mt-1.5" />
                    <span className="min-w-0 flex-1 text-[13px] leading-5">
                      <span className="text-text-3">{n.outgoing ? RELATIONS[n.type].verb : RELATIONS[n.type].inverse} </span>
                      <span className="font-medium text-text">{n.node.type === "Verse" ? `Kural ${n.node.ref}` : n.node.label}</span>
                      {extra && <span className="block text-[12px] leading-4 text-text-3">{String(extra)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[12px] leading-4 text-text-3">An AI drew these links and wrote their reasons. No person has reviewed them yet.</p>
    </div>
  );
}

export function VerseExplorer({ verseId, onClose }: { verseId: string; onClose: () => void }) {
  const verse = useGita((s) => s.versesById.get(verseId));
  const versesDoc = useGita((s) => s.versesDoc);
  const script = useGita((s) => s.script);
  const view = useGita((s) => s.view);
  const select = useGita((s) => s.select);
  const focusLineage = useGita((s) => s.focusLineage);
  const audioVerse = useAudio((s) => s.verseId);
  const playing = useAudio((s) => s.playing);
  const loading = useAudio((s) => s.loading);
  const enAuthor = useGita((s) => s.enAuthor);
  const [tab, setTab] = useState<"meaning" | "commentary" | "connections">("meaning");
  const [showMeter, setShowMeter] = useState(false);
  const graphs = useGita((s) => s.graphs);
  const connCount = useMemo(() => (graphs ? neighbors(graphs, verseId).filter((n) => !["BELONGS_TO", "NEXT_VERSE", "SPOKE", "NARRATED"].includes(n.type)).length : 0), [graphs, verseId]);
  if (!verse || !versesDoc) return null;
  const ch = versesDoc.chapters.find((c) => c.number === verse.chapter);
  const idx = versesDoc.verses.findIndex((v) => v.id === verse.id);
  const prev = versesDoc.verses[idx - 1];
  const next = versesDoc.verses[idx + 1];
  const isCurrent = audioVerse === verse.id;
  const isPlaying = isCurrent && playing;
  const quick = verse.translations.en?.[String(enAuthor)] || Object.values(verse.translations.en || {})[0] || "";
  const translator = versesDoc.authors.find((a) => a.id === enAuthor)?.name;
  // Begin a note about this verse in Reflect. The verse is kept as where the note began and as a connection you can change.
  const reflect = () => {
    useDraft.getState().startVerseNote(verse.id);
    const g = useGita.getState();
    g.select(null);
    g.setView("manas");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line pl-4 pr-2">
        <button className="min-w-0 flex-1 text-left" onClick={() => useGita.getState().openChapter(verse.chapter)} title={`Read chapter ${verse.chapter}`}>
          <div className="label truncate">
            Chapter {verse.chapter} · {ch?.title}
          </div>
          <div className="text-[14px] font-semibold leading-5 text-text">Couplet {verse.verse} of {ch?.verseCount}</div>
        </button>
        <button className="btn btn-ghost btn-icon" disabled={!prev} onClick={() => prev && select(prev.id, { fly: view === "cosmos" })} aria-label="Previous couplet" title={prev ? `Kural ${prev.ref}` : undefined}>
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-ghost btn-icon" disabled={!next} onClick={() => next && select(next.id, { fly: view === "cosmos" })} aria-label="Next couplet" title={next ? `Kural ${next.ref}` : undefined}>
          <ChevronRight size={16} />
        </button>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pb-6 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-text">Kural {verse.ref}</h2>
            {verse.meter.scansion.length ? (
              <button className="chip shrink-0" aria-pressed={showMeter} onClick={() => setShowMeter(!showMeter)} title="Show the metre (guru-laghu scansion)">
                {verse.meter.name}
              </button>
            ) : (
              <span className="chip shrink-0">{verse.meter.name}</span>
            )}
          </div>
          <div className="mt-0.5 text-[13px] text-text-3">
            {SPEAKER[verse.speaker]}
          </div>
          {verse.uvacha?.tr && verse.uvacha.tr !== SPEAKER[verse.speaker] && <p className="mt-1 text-[13px] leading-5 text-text-2">{verse.uvacha.tr}</p>}
          {!verse.canonical && <div className="mt-2"><Notice>This verse appears in some recensions but not in the traditional count of 700.</Notice></div>}

          {/* Phones: the meaning first, before scripts and study tools (the full Meaning tab follows below). */}
          {quick && (
            <div className="mt-3 md:hidden">
              <p className="serif line-clamp-4 text-[16px] leading-[1.6] text-text [overflow-wrap:anywhere]">{quick}</p>
              {translator && <div className="mt-1 text-[12px] text-text-3">Translation: {translator}</div>}
              <OldView verse={verse} className="mt-1" />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            <button className="btn btn-primary max-sm:h-11" onClick={reflect} title="Write what this couplet means to you, or where you disagree. Saved on this device.">
              <NotebookPen size={14} /> Reflect on this couplet
            </button>
            <button className="btn max-sm:h-11" aria-pressed={isPlaying} onClick={() => (isCurrent ? audio.toggle() : audio.playVerse(verse.id))}>
              {isCurrent && loading ? <LoaderCircle size={14} className="animate-spin" /> : isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? "Pause" : "Listen"}
            </button>
            {view !== "darshana" && (
              <button className="btn" onClick={() => focusLineage(verse.id)} title="Open in Lineage: what leads to this couplet and what follows from it">
                <Waypoints size={14} /> Lineage
              </button>
            )}
            {view !== "cosmos" && (
              <button className="btn" onClick={() => (useGita.getState().setView("cosmos"), useGita.getState().fly(verse.id))} title="Show this couplet in the 3D graph">
                <Orbit size={14} /> In graph
              </button>
            )}
            {view !== "adhyayana" && (
              <button className="btn" onClick={() => useGita.getState().openChapter(verse.chapter)} title={`Read chapter ${verse.chapter}`}>
                <BookOpen size={14} /> Read
              </button>
            )}
            <button className="btn" onClick={() => askPartha(`Explain Kural ${verse.ref}: its meaning in context and how to live it today.`)}>
              <MessagesSquare size={14} /> Ask
            </button>
          </div>

          <div className="mt-5 hidden md:block">
            <ScriptPicker compact />
          </div>
          <details className="group mt-4 md:hidden">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[13px] font-medium text-text-2">
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" /> Script options
            </summary>
            <div className="mt-3">
              <ScriptPicker compact />
            </div>
          </details>
          <div className="mt-4">
            <SanskritBlock verse={verse} script={script} />
            <OldView verse={verse} className="mt-2 max-md:hidden" />
            {(script === "deva" || script === "iast") && <IastKey className="mt-2" />}
            {showMeter && verse.meter.scansion.length > 0 && <Scansion verse={verse} />}
          </div>
        </div>

        <div className="sticky top-0 z-[1] border-b border-line bg-surface px-5">
          <div className="tabs !border-b-0" role="tablist">
            {(
              [
                ["meaning", "Meaning"],
                ["commentary", "Commentaries"],
                ["connections", `Connections${connCount ? ` ${connCount}` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-10 pt-5">
          {tab === "meaning" && (
            <div className="space-y-7">
              <Translation verse={verse} />
              <section>
                <SectionLabel>Word by word, in parimēlaḻagar’s Tamil</SectionLabel>
                <PadacchedaLexicon verse={verse} />
              </section>
            </div>
          )}
          {tab === "commentary" && <Perspectives verse={verse} />}
          {tab === "connections" && <Connections verse={verse} />}
        </div>
      </div>
    </div>
  );
}
