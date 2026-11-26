"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue } from "framer-motion";
import { useGita } from "@/lib/store/useGitaStore";
import { useIsDesktop, useIsMobile, useReducedMotion } from "@/lib/hooks/useMedia";
import { useElementHeight } from "@/lib/hooks/useElementHeight";
import { useSheetDrag } from "@/lib/hooks/useSheetDrag";
import { VerseExplorer } from "@/components/reader/VerseExplorer";
import { NodeInspector } from "@/components/graph/NodeInspector";
import { GraphRagChatbot } from "@/components/chat/GraphRagChatbot";
import { FocusSwitch } from "@/components/graph/GraphHud";

/**
 * The right-hand dock holds two things the user moves between constantly: Details (whatever node is selected) and
 * Ask (the companion). Both stay mounted so a streaming answer survives tab switches.
 *   ≥1024px  an in-flow column beside the view, so the canvas re-centres instead of being covered
 *   768–1023 an overlay panel on the right
 *   <768px   a bottom sheet that snaps to peek (graph views only), half or full, dragged from anywhere on it
 */
export const SHEET_HEIGHT = { peek: "min(max(34%, 220px), 300px)", half: "min(max(58%, 440px), calc(100% - 8px))", full: "calc(100% - 8px)" } as const;
/** Pixel height of the phone sheet at a snap, for a canvas of height h (mirrors SHEET_HEIGHT). */
export const sheetPx = (snap: keyof typeof SHEET_HEIGHT, h: number) => (snap === "peek" ? Math.min(Math.max(0.34 * h, 220), 300) : snap === "half" ? Math.min(Math.max(0.58 * h, 440), h - 8) : h - 8);
type Snap = keyof typeof SHEET_HEIGHT;
/** Fully open first: the order of their offsets from the top. */
const SNAPS: Snap[] = ["full", "half", "peek"];
const SPRING = { type: "spring", stiffness: 380, damping: 38 } as const;
/** px/s: faster than this, a release is a flick and moves on one snap in its direction, however short the swipe. */
const FLICK = 300;
/** px of sheet travel (after the ~15px the browser holds back): a slower pull this far, still heading that way when
 * let go, also moves on one snap. */
const PULL = 24;
/**
 * How much of the phone sheet is showing, in px, frame by frame as it is dragged, glides or slides in and out (0 when
 * there is none). The 3D graph follows it, so the picture above the sheet moves with it instead of jumping.
 */
export const sheetShowing = motionValue(0);

export function RightDock() {
  const selectedId = useGita((s) => s.selectedId);
  const chatOpen = useGita((s) => s.chatOpen);
  const dockTab = useGita((s) => s.dockTab);
  const setDockTab = useGita((s) => s.setDockTab);
  const select = useGita((s) => s.select);
  const setChatOpen = useGita((s) => s.setChatOpen);
  const desktop = useIsDesktop();
  const mobile = useIsMobile();
  const snap = useGita((s) => s.sheetSnap);
  const setSnap = useGita((s) => s.setSheetSnap);
  const sheetSize = useGita((s) => s.sheetSize);
  const setSheetSize = useGita((s) => s.setSheetSize);
  const view = useGita((s) => s.view);
  const reduced = useReducedMotion();
  // In the graph views the sheet first peeks, so the selection and its connections stay visible above it. Elsewhere
  // it opens at the size it was last left at.
  const graphView = view === "cosmos" || view === "darshana";
  const rest = graphView ? "peek" : sheetSize;

  const hasDetails = !!selectedId;
  const open = hasDetails || chatOpen;
  const tab = !hasDetails ? "ask" : !chatOpen ? "details" : dockTab;
  // Asking is a reading task: give it the full sheet on phones.
  useEffect(() => {
    if (chatOpen && dockTab === "ask") setSnap("full");
  }, [chatOpen, dockTab, setSnap]);
  useEffect(() => {
    if (!open || (snap === "peek" && !graphView)) setSnap(rest);
  }, [open, rest, graphView, snap, setSnap]);
  // Opening something new in a graph view returns to the peek.
  useEffect(() => {
    if (selectedId && graphView && !chatOpen) setSnap("peek");
  }, [selectedId, graphView, chatOpen, setSnap]);

  const closeDetails = () => select(null);
  const both = hasDetails && chatOpen;

  // Phones: the sheet is always full height, and a snap is how far it sits below that (a transform, so moving it
  // never lays out its contents again). H is the height of the area it slides in.
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const H = useElementHeight(area);
  const y = useMotionValue(0);
  // The slide in and out (the wrapper's own offset), apart from the snap, so a drag never fights it.
  const enter = useMotionValue(0);
  const offset = (s: Snap) => sheetPx("full", H) - sheetPx(s, H);
  /** Where a release already sent the sheet: the snap change that follows must not start it over. */
  const aimed = useRef<number | null>(null);
  // A flick carries its speed into the glide, so letting go never stalls the sheet.
  const glide = (s: Snap, velocity = 0) => {
    aimed.current = offset(s);
    if (reduced) y.jump(offset(s));
    else animate(y, offset(s), { ...SPRING, velocity });
  };
  // Opening, it starts at its snap (the wrapper below slides it in); after that it glides between snaps.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (!H) return;
    const target = sheetPx("full", H) - sheetPx(snap, H);
    const sent = aimed.current === target;
    aimed.current = null;
    if (!open) wasOpen.current = false;
    else if (!wasOpen.current) {
      wasOpen.current = true;
      enter.jump(H);
      y.jump(target);
    } else if (sent) return;
    else if (reduced) y.jump(target);
    else animate(y, target, SPRING);
  }, [open, snap, H, reduced, y, enter]);
  // Until it has finished sliding out, the sheet still covers the graph.
  const [present, setPresent] = useState(false);
  useLayoutEffect(() => {
    if (open) setPresent(true);
  }, [open]);
  useEffect(() => {
    const update = () => sheetShowing.set(mobile && present && H ? Math.max(0, sheetPx("full", H) - enter.get() - y.get()) : 0);
    update();
    const offY = y.on("change", update);
    const offEnter = enter.on("change", update);
    return () => (offY(), offEnter());
  }, [mobile, present, H, y, enter]);

  const lowest: Snap = graphView && tab !== "ask" ? "peek" : "half";
  const allowed = SNAPS.filter((s) => s !== "peek" || lowest === "peek");
  const dismiss = () => {
    if (tab === "ask") setChatOpen(false);
    else closeDetails();
    // With Details and Ask both open, the other one stays: put the sheet back where it was.
    if (both) glide(snap);
  };
  const settle = (target: Snap, velocity = 0) => {
    // What the reader chooses for reading is remembered; the graph views and Ask size themselves.
    if (!graphView && tab === "details" && target !== "peek") setSheetSize(target);
    glide(target, velocity);
    if (target !== snap) setSnap(target);
  };
  useSheetDrag(sheet, {
    y,
    // Below full, any vertical swipe moves the sheet. Full, it scrolls its content, until pulled down from the top.
    shouldDrag: (dy, scroller) => snap !== "full" || (dy > 0 && (!scroller || scroller.scrollTop <= 0)),
    // One deliberate swipe is enough: a flick, or a pull of PULL px, goes on to the next snap that way. Closing takes a
    // flick down from the lowest snap or a long pull below it; anything less settles back.
    onRelease: (v) => {
      const cur = y.get();
      const moved = cur - offset(snap);
      const at = allowed.map((s) => [s, offset(s)] as const);
      const farBelow = cur - offset(lowest) > Math.min(120, 0.3 * sheetPx(lowest, H));
      let target: Snap | undefined;
      if (v < -FLICK || (moved < -PULL && v <= 0)) target = [...at].reverse().find(([, o]) => o < cur - 4)?.[0] ?? "full";
      else if (v > FLICK || (moved > PULL && v >= 0)) target = at.find(([, o]) => o > cur + 4)?.[0] ?? (v > FLICK || farBelow ? undefined : lowest);
      else if (!farBelow) target = at.reduce((a, b) => (Math.abs(b[1] - cur) < Math.abs(a[1] - cur) ? b : a))[0];
      if (target) settle(target, v);
      else dismiss();
    },
  });

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      {both && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
          <div className="seg w-full" role="tablist" aria-label="Panel">
            <button role="tab" aria-selected={tab === "details"} className="flex-1" onClick={() => setDockTab("details")}>
              Details
            </button>
            <button role="tab" aria-selected={tab === "ask"} className="flex-1" onClick={() => setDockTab("ask")}>
              Ask
            </button>
          </div>
        </div>
      )}
      <div className={`min-h-0 flex-1 ${tab === "details" ? "" : "hidden"}`}>
        {selectedId && (selectedId.startsWith("K_") ? <VerseExplorer verseId={selectedId} onClose={closeDetails} /> : <NodeInspector nodeId={selectedId} onClose={closeDetails} />)}
      </div>
      {chatOpen && (
        <div className={`min-h-0 flex-1 ${tab === "ask" ? "" : "hidden"}`}>
          <GraphRagChatbot onClose={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  );

  if (mobile) {
    return (
      <div ref={setArea} className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        <AnimatePresence onExitComplete={() => setPresent(false)}>
          {open && (
            <motion.div key="sheet" className="absolute inset-x-0 bottom-0 h-[calc(100%-8px)]" style={{ y: enter }} initial={{ y: H }} animate={{ y: 0 }} exit={{ y: H }} transition={SPRING}>
              <motion.aside
                ref={setSheet}
                role="dialog"
                aria-label={tab === "ask" ? "Ask" : "Details"}
                className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-t-[16px] border-t border-line-2 bg-surface shadow-[var(--shadow-3)]"
                // Peek: about a third of the screen (the graph stays visible). Half: at least 440px, so a short phone
                // still shows a verse's meaning and first action. Full: nearly the whole screen.
                style={{ y }}
              >
                <button
                  className="flex h-8 w-full shrink-0 touch-none items-center justify-center"
                  onClick={() => settle(snap === "peek" ? "half" : snap === "half" ? "full" : lowest)}
                  aria-label={snap === "full" ? "Collapse panel" : "Expand panel"}
                >
                  <span className="h-1 w-9 rounded-full bg-line-3" />
                </button>
                {view === "cosmos" && tab === "details" && <FocusSwitch className="shrink-0 border-b border-line px-4 pb-2" />}
                <div className="min-h-0 flex-1">{body}</div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="dock"
          aria-label={tab === "ask" ? "Ask" : "Details"}
          className={
            desktop
              ? "relative z-20 h-full w-[400px] shrink-0 overflow-hidden border-l border-line bg-surface xl:w-[440px]"
              : "absolute inset-y-0 right-0 z-20 w-[400px] overflow-hidden border-l border-line bg-surface shadow-[var(--shadow-3)]"
          }
          initial={desktop ? { width: 0, opacity: 0 } : { x: 24, opacity: 0 }}
          animate={desktop ? { width: "auto", opacity: 1 } : { x: 0, opacity: 1 }}
          exit={desktop ? { width: 0, opacity: 0 } : { x: 24, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="h-full w-[400px] xl:w-[440px]">{body}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
