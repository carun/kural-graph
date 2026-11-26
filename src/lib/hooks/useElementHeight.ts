"use client";
import { useLayoutEffect, useState } from "react";

/**
 * An element's height in pixels, kept current as it resizes (0 until there is one). Takes the element itself, held
 * in state through a callback ref, so an element that mounts later is still measured.
 */
export function useElementHeight(el: HTMLElement | null): number {
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    setH(el.clientHeight);
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return h;
}
