"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";

type Options = {
  /** The sheet's offset from its fully open position, in pixels. */
  y: MotionValue<number>;
  /** A vertical swipe has begun (dy > 0 is downward): should it move the sheet rather than scroll `scroller`? */
  shouldDrag: (dy: number, scroller: HTMLElement | null) => boolean;
  /** The finger has lifted after moving the sheet; velocity in px/s, positive downward. */
  onRelease: (velocity: number) => void;
};

// Native controls keep their own gestures: a select's picker, a text field's caret and selection.
const SKIP = "input, textarea, select, [contenteditable]";

/** The nearest ancestor of `target`, inside `root`, that scrolls vertically. */
function scrollerOf(target: Element | null, root: HTMLElement): HTMLElement | null {
  for (let el = target instanceof HTMLElement ? target : null; el && el !== root; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
}

/** After a drag, the lifted finger must not also press whatever it started on. */
function swallowNextClick() {
  const stop = (e: MouseEvent) => (e.stopPropagation(), e.preventDefault());
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 400);
}

/**
 * Touch dragging for a bottom sheet, from anywhere on it. The first move decides who owns the gesture: the sheet
 * (then the page never scrolls under the finger) or the browser (horizontal swipes, and scrolling content that can
 * scroll). Touch events, not pointer events, because only they can still stop a scroll once the finger is moving.
 */
export function useSheetDrag(el: HTMLElement | null, options: Options) {
  const opts = useRef(options);
  useLayoutEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    if (!el) return;
    // y0 and anchor: the sheet's offset and the finger's position when the sheet took the gesture.
    type Gesture = { x: number; y: number; y0: number; anchor: number; target: Element | null; mode: "sheet" | "native" | null; moved: number; samples: { t: number; y: number }[] };
    let g: Gesture | null = null;

    const release = () => {
      const s = g;
      g = null;
      if (s?.mode !== "sheet") return;
      // Velocity over the last 100ms; a finger that stopped before lifting has none.
      const now = performance.now();
      const recent = s.samples.filter((p) => now - p.t < 100);
      const a = recent[0];
      const b = recent[recent.length - 1];
      // A finger that barely moved (a tap that wobbled) is not a flick.
      const v = s.moved >= 10 && a && b && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
      if (s.moved > 8) swallowNextClick();
      opts.current.onRelease(v);
    };
    const start = (e: TouchEvent) => {
      if (g?.mode === "sheet") release();
      g = null;
      if (e.touches.length !== 1 || (e.target as Element | null)?.closest?.(SKIP)) return;
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, y0: 0, anchor: t.clientY, target: e.target as Element, mode: null, moved: 0, samples: [] };
    };
    const move = (e: TouchEvent) => {
      if (!g || g.mode === "native") return;
      if (e.touches.length !== 1) {
        if (g.mode === "sheet") release();
        g = null;
        return;
      }
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.mode) {
        if (!dx && !dy) return;
        // Decided on the first move, while the event can still be cancelled (once scrolling starts it can't).
        if (!e.cancelable || Math.abs(dx) > Math.abs(dy) || !opts.current.shouldDrag(dy, scrollerOf(g.target, el))) {
          g.mode = "native";
          return;
        }
        g.mode = "sheet";
        opts.current.y.stop();
        g.y0 = opts.current.y.get();
        // The browser holds back the first ~15px of a touch before it reports any move. Catching that up at once
        // would jump; instead the sheet starts from where the finger is now and moves with it from here.
        g.anchor = t.clientY;
      }
      e.preventDefault();
      const raw = g.y0 + t.clientY - g.anchor;
      // Past fully open it resists, so the top of the sheet is felt.
      opts.current.y.set(raw < 0 ? raw * 0.2 : raw);
      g.moved = Math.max(g.moved, Math.abs(dy));
      g.samples.push({ t: performance.now(), y: t.clientY });
      if (g.samples.length > 12) g.samples.shift();
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", release);
    el.addEventListener("touchcancel", release);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", release);
      el.removeEventListener("touchcancel", release);
    };
  }, [el]);
}
