"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CircleHelp, CornerDownLeft, MessagesSquare, Monitor, NotebookPen, Search, Settings, House } from "lucide-react";
import { useGita } from "@/lib/store/useGitaStore";
import { searchIndex, type SearchHit } from "@/lib/graphrag/search";
import { searchThoughts } from "@/lib/store/thoughtModel";
import { thoughtNodeId } from "@/lib/graph/graphStore";
import { typeName } from "@/lib/graph/palette";
import { nodeSub, nodeTitle } from "@/components/graph/NodePicker";
import { askPartha } from "@/components/chat/GraphRagChatbot";
import { NodeGlyph } from "@/components/ui/primitives";
import { useModal } from "@/lib/hooks/useModal";
import { VIEWS } from "./views";
import { OLD_VIEW } from "@/kural/reader";

interface Item {
  id: string;
  group: string;
  title: string;
  sub?: string;
  icon: ReactNode;
  hint?: string;
  run: () => void;
}

// Ideas, states and situations first: they are hubs that lead to many verses.
const GROUP_ORDER = ["emotion", "concept", "dilemma", "character", "chapter", "verse"];
const GROUP_NAME: Record<string, string> = { verse: "Couplets", concept: "Concepts", emotion: "States of mind", dilemma: "Life situations", character: "Characters", chapter: "Chapters" };

/** Ctrl/⌘K: search across every verse, translation, gloss and node, or jump anywhere. */
export function CommandPalette() {
  const open = useGita((s) => s.paletteOpen);
  const setOpen = useGita((s) => s.setPaletteOpen);
  const index = useGita((s) => s.index);
  const graphs = useGita((s) => s.graphs);
  const versesDoc = useGita((s) => s.versesDoc);
  const select = useGita((s) => s.select);
  const thoughts = useGita((s) => s.thoughts);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModal(open, overlayRef, dialogRef, () => setOpen(false), inputRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useGita.getState().paletteOpen);
      } else if (e.key === "/" && !useGita.getState().paletteOpen) {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    let live = true;
    const t = q.trim();
    if (!t || !index) return setHits([]);
    const ref = t.match(/^(?:k|kural\s*)?(\d{1,4})$/i);
    searchIndex(index, t, { limit: 24 }).then((r) => {
      if (!live) return;
      const id = ref ? `K_${Number(ref[1])}` : null;
      // "38" is both a couplet and a chapter; "chapter 38" or "ch 38" is the chapter alone.
      const chapter = t.match(/^(?:(?:ch|chapter)\s*)?(\d{1,3})$/i);
      const chId = chapter ? `CH_${Number(chapter[1])}` : null;
      const direct = [...(id && graphs?.graph.hasNode(id) ? [{ id, kind: "verse" as const, score: 99, title: "" }] : []), ...(chId && graphs?.graph.hasNode(chId) ? [{ id: chId, kind: "chapter" as const, score: 98, title: "" }] : [])];
      setHits([...direct, ...r.hits.filter((h) => !direct.some((d) => d.id === h.id))]);
      setCursor(0);
    });
    return () => {
      live = false;
    };
  }, [q, index, graphs]);

  const close = () => setOpen(false);
  const items: Item[] = useMemo(() => {
    const s = useGita.getState;
    const t = q.trim();
    if (!t) {
      const nav: Item[] = [
        { id: "view:home", group: "Go to", title: "Home", sub: "What Kural Graph is, and ways in", icon: <House size={15} />, run: () => (s().select(null), s().setView("home")) },
        ...VIEWS.map((v) => ({ id: `view:${v.id}`, group: "Go to", title: v.name, sub: v.blurb, icon: <v.icon size={15} />, run: () => s().setView(v.id) })),
      ];
      const actions: Item[] = [
        { id: "act:ask", group: "Actions", title: "Ask a question", icon: <MessagesSquare size={15} />, run: () => s().setChatOpen(true) },
        { id: "act:theme", group: "Actions", title: "Switch theme", sub: "System, dark or light", icon: <Monitor size={15} />, run: () => s().setThemePref(({ auto: "dark", dark: "light", light: "auto" } as const)[s().themePref]) },
        { id: "act:settings", group: "Actions", title: "Settings", sub: "Language model, search, data", icon: <Settings size={15} />, run: () => s().setSettingsOpen(true) },
        { id: "act:guide", group: "Actions", title: "Open the guide", icon: <CircleHelp size={15} />, run: () => s().setWelcomeOpen(true) },
      ];
      const chapters: Item[] = (versesDoc?.chapters || []).map((c) => ({ id: `ch:${c.number}`, group: "Read a chapter", title: `${c.number}. ${c.title}`, sub: c.meaning, icon: <BookOpen size={15} />, run: () => s().openChapter(c.number) }));
      return [...nav, ...actions, ...chapters];
    }
    const nodes = [...hits]
      .map((h) => ({ h, n: graphs?.nodeById.get(h.id) }))
      .filter((x) => !!x.n)
      .sort((a, b) => Number(b.h.score >= 98) - Number(a.h.score >= 98) || (a.h.score >= 98 ? 0 : GROUP_ORDER.indexOf(a.h.kind) - GROUP_ORDER.indexOf(b.h.kind)) || b.h.score - a.h.score)
      .map(({ h, n }) => ({ id: h.id, group: GROUP_NAME[h.kind] || "Results", title: nodeTitle(n!), sub: n!.type === "Verse" ? ("sensitive" in n! ? `${n!.sa} · ${OLD_VIEW}` : n!.sa) : nodeSub(n!), icon: <NodeGlyph node={n!} />, hint: n!.type === "Emotion" ? typeName(n!) : undefined, run: () => (n!.type === "Chapter" ? useGita.getState().openChapter(n!.number) : select(h.id)) }) as Item);
    // Your own writing first, kept apart from scripture and never sent anywhere: matched locally, in this browser.
    const mine: Item[] = searchThoughts(thoughts, t, 5).map((m) => ({
      id: `mine:${m.thought.id}`,
      group: "My thoughts · on this device",
      title: m.snippet,
      sub: `${new Date(m.thought.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}${m.in === "earlier" ? " · in an earlier wording" : ""}`,
      icon: <NotebookPen size={15} />,
      run: () => select(thoughtNodeId(m.thought.id), { fly: false }),
    }));
    return [...mine, ...nodes, { id: "ask", group: "Ask", title: `Ask: “${t}”`, sub: "Get an answer grounded in the graph", icon: <MessagesSquare size={15} />, run: () => askPartha(t) }];
  }, [q, hits, graphs, versesDoc, select, thoughts]);

  const run = (it: Item) => {
    close();
    it.run();
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={overlayRef} className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] p-3 pt-[10vh] backdrop-blur-[2px] sm:p-4 sm:pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search" className="popover flex max-h-[76dvh] w-full max-w-[640px] flex-col overflow-hidden" initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.14 }}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="shrink-0 text-text-3" />
              <input
                ref={inputRef}
                className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-3 focus-visible:outline-none"
                placeholder="Search couplets, ideas, feelings, or type 380"
                value={q}
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                aria-activedescendant={items[cursor] ? `pal-${cursor}` : undefined}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  } else if (e.key === "Enter" && items[cursor]) {
                    e.preventDefault();
                    run(items[cursor]);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  }
                }}
              />
              <button className="kbd shrink-0" onClick={close} aria-label="Close search">
                Esc
              </button>
            </div>
            <div ref={listRef} id="palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {q.trim() && !index && <div className="px-3 py-6 text-center text-[13px] text-text-3">Preparing the search index…</div>}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                return (
                  <div key={it.id}>
                    {header && <div className="label px-2.5 pb-1 pt-3 first:pt-1.5">{header}</div>}
                    <button id={`pal-${i}`} data-index={i} role="option" aria-selected={i === cursor} className="row items-center !py-2" data-active={i === cursor} onMouseMove={() => cursor !== i && setCursor(i)} onClick={() => run(it)}>
                      <span className="flex w-5 shrink-0 justify-center text-text-3">{it.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-text">{it.title}</span>
                        {it.sub && <span className={`block truncate text-[12px] text-text-3 ${it.id.startsWith("K_") ? "deva !leading-5" : ""}`}>{it.sub}</span>}
                      </span>
                      {it.hint && <span className="shrink-0 text-[11.5px] text-text-3">{it.hint}</span>}
                      {i === cursor && <CornerDownLeft size={13} className="shrink-0 text-text-3" />}
                    </button>
                  </div>
                );
              })}
              {q.trim() && index && items.length === 1 && <div className="px-3 pb-2 pt-4 text-center text-[13px] text-text-3">No matches in your thoughts or the graph. Try a couplet number like 380 or a feeling like “restless”.</div>}
            </div>
            <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-text-3 sm:flex">
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> to move
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">Enter</kbd> to open
              </span>
              <span className="ml-auto">Searches your saved thoughts (on this device), romanised text, readings and ideas</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
