"use client";
import { useState } from "react";
import { ArrowLeft, Check, MessagesSquare, NotebookPen, Play } from "lucide-react";
import { useGita } from "@/lib/store/useGitaStore";
import { useDraft } from "@/lib/store/draftStore";
import { audio } from "@/lib/store/audioStore";
import { lessonDoneAt, markLessonDone } from "@/lib/store/readingPosition";
import type { ConnectionRelation } from "@/lib/types";
import { askPartha } from "@/components/chat/GraphRagChatbot";
import { AIYAR } from "@/kural/reader";

const VERSE = "K_100";

/** The three ways to answer, each kept as the relation of the note to the verse. Disagreement is welcome. */
const RESPONSES: { label: string; starter: string; relation: ConnectionRelation }[] = [
  { label: "I understand this as…", starter: "I understand this as ", relation: "relates_to" },
  { label: "I disagree, or I'm unsure…", starter: "I'm not sure about this, because ", relation: "questions" },
  { label: "This reminds me of…", starter: "This reminds me of ", relation: "reminds_me_of" },
];

function Step({ n, title, kind, children }: { n: number; title: string; kind?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3" aria-labelledby={`lesson-step-${n}`}>
      <span className="num mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-line-2 text-[12.5px] font-medium text-text-3" aria-hidden>
        {n}
      </span>
      <div className="min-w-0">
        <h2 id={`lesson-step-${n}`} className="text-[16px] font-semibold text-text">
          {title}
          {kind && <span className="ml-2 align-middle text-[11.5px] font-normal text-text-3">{kind}</span>}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

/**
 * "Start here": one short, complete lesson on Kural 100. Source text and translation come from the data with their
 * attribution; the explanation and example are labelled as editorial (a draft for review, not a translation). It ends
 * in the person's own words and a clear next step.
 */
export function Lesson({ onClose }: { onClose: () => void }) {
  const verse = useGita((s) => s.versesById.get(VERSE));
  const versesDoc = useGita((s) => s.versesDoc);
  const enAuthor = useGita((s) => s.enAuthor);
  const [done, setDone] = useState(lessonDoneAt);
  if (!verse || !versesDoc) return null;
  const author = versesDoc.authors.find((a) => a.id === enAuthor);
  const translation = verse.translations.en?.[String(enAuthor)] || Object.values(verse.translations.en || {})[0] || "";
  const chapter = versesDoc.chapters.find((c) => c.number === verse.chapter);
  const his = verse.translations.en?.["2"];

  const respond = (r: (typeof RESPONSES)[number]) => {
    const kind = useDraft.getState().startVerseNote(VERSE, r.relation);
    if (kind === "new") useDraft.getState().setText(r.starter);
    markLessonDone();
    setDone(Date.now());
    const g = useGita.getState();
    g.openLesson(false);
    g.setView("manas");
  };
  const finish = () => {
    markLessonDone();
    setDone(Date.now());
  };

  return (
    <div className="mx-auto max-w-[680px] px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
      <button className="btn btn-ghost -ml-3 max-sm:h-11" onClick={onClose}>
        <ArrowLeft size={15} /> Back to reading
      </button>
      <header className="mt-4">
        <div className="label">Start here · one idea · about five minutes</div>
        <h1 className="serif mt-2 text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] text-text sm:text-[34px]">Harsh words, when sweet ones are there</h1>
        {done && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-text-3">
            <Check size={14} className="text-good" /> You finished this on {new Date(done).toLocaleDateString(undefined, { dateStyle: "medium" })}. It&apos;s here whenever you want to return.
          </p>
        )}
      </header>

      <div className="mt-8 space-y-9">
        <Step n={1} title="A question to hold">
          <p className="reading">When a kind way of saying something is within reach, why do we so often pick the harsh one?</p>
        </Step>

        <Step n={2} title="The setting" kind="Context">
          <p className="reading">The Kural is 1,330 couplets in 133 chapters of ten. This one closes chapter {verse.chapter}, “{chapter?.title}”. parimēlaḻagar opens the chapter like this:</p>
          <p className="reading mt-2 border-l-2 border-line pl-3">{chapter?.summary.en}</p>
          <p className="mt-2 text-[12px] text-text-3">parimēlaḻagar, paraphrased in English by an AI.</p>
        </Step>

        <Step n={3} title="The couplet" kind={`Kural ${verse.ref} · source`}>
          <div className="rounded-3 border border-line bg-surface p-4 sm:p-5">
            <div className="deva text-[19px] leading-[1.8] text-text [overflow-wrap:anywhere]">
              {verse.sanskrit.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div className="serif mt-1.5 text-[14px] leading-[1.55] text-text-3 [overflow-wrap:anywhere]">{verse.iast.join(" ")}</div>
            <p className="serif mt-3 border-t border-line pt-3 text-[16.5px] leading-[1.65] text-text">{translation}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
              <span>{enAuthor === AIYAR ? author?.name : `${author?.name ?? "Plain reading"}, written by an AI`}</span>
              <button className="btn btn-sm btn-ghost max-sm:h-10" onClick={() => audio.playVerse(VERSE)}>
                <Play size={13} /> Listen
              </button>
            </div>
          </div>
        </Step>

        <Step n={4} title="In plain words" kind="Explanation · editorial draft, not a translation">
          <p className="reading">
            Two fruits are within reach, one ripe and one not, and no one would pick the unripe one. The couplet says harsh words are that same choice. The sweet words were there too, and you passed them by.
          </p>
          {his && (
            <>
              <p className="reading mt-2 border-l-2 border-line pl-3">{his}</p>
              <p className="mt-2 text-[12px] text-text-3">parimēlaḻagar, paraphrased in English by an AI. Open the couplet to read his Tamil.</p>
            </>
          )}
        </Step>

        <Step n={5} title="An everyday example" kind="Editorial draft">
          <p className="reading">
            A friend shows you something they made, and it has a fault. “This doesn’t work” and “this part could be stronger, and here is why” both tell the truth, and both are in your mouth at that moment. Only one of them is the ripe fruit.
          </p>
        </Step>

        <Step n={6} title="In your own words">
          <p className="reading">How would you put this, or where do you disagree? Your answer is saved as a note on this couplet, in your own words. You can change it or remove the connection later.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {RESPONSES.map((r) => (
              <button key={r.label} className="btn max-sm:h-11 max-sm:justify-start" onClick={() => respond(r)}>
                <NotebookPen size={14} /> {r.label}
              </button>
            ))}
          </div>
        </Step>

        <section className="rounded-3 border border-line bg-surface-2 p-4 sm:p-5" aria-label="What next">
          <h2 className="text-[15px] font-semibold text-text">{done ? "Where to go next" : "When you're ready"}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn max-sm:h-11" onClick={() => (useGita.getState().openChapter(verse.chapter), useGita.getState().select(VERSE, { fly: false }))}>
              Read it in chapter {verse.chapter}
            </button>
            <button className="btn max-sm:h-11" onClick={() => askPartha("Explain Kural 100 in simple words for someone new to the Kural.")}>
              <MessagesSquare size={14} /> Ask about it
            </button>
            <button className="btn max-sm:h-11" onClick={() => (useGita.getState().openChapter(13), useGita.getState().select("K_129", { fly: false }))}>
              Next idea: Kural 129, the scar a tongue leaves
            </button>
            {!done && (
              <button className="btn btn-ghost max-sm:h-11" onClick={finish}>
                <Check size={14} /> I&apos;m done for now
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
