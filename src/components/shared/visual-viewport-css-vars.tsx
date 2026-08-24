"use client";

import { useEffect } from "react";

const MOBILE_MQ = "(max-width: 639px)";

/**
 * Syncs Visual Viewport metrics to CSS vars so fixed bottom sheets can sit
 * above the on-screen keyboard (especially iOS / overlay keyboards).
 *
 * --vv-height: visible viewport height
 * --vv-keyboard-inset: space covered below the visual viewport
 */
export function VisualViewportCssVars() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;

    const reset = () => {
      root.style.setProperty("--vv-height", "100dvh");
      root.style.setProperty("--vv-keyboard-inset", "0px");
      root.style.setProperty("--vv-offset-top", "0px");
    };

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!window.matchMedia(MOBILE_MQ).matches) {
          reset();
          return;
        }
        const height = Math.round(vv.height);
        const offsetTop = Math.max(0, Math.round(vv.offsetTop));
        const inset = Math.max(
          0,
          Math.round(window.innerHeight - vv.height - vv.offsetTop)
        );
        root.style.setProperty("--vv-height", `${height}px`);
        root.style.setProperty("--vv-keyboard-inset", `${inset}px`);
        root.style.setProperty("--vv-offset-top", `${offsetTop}px`);
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const mq = window.matchMedia(MOBILE_MQ);
    mq.addEventListener("change", update);

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      mq.removeEventListener("change", update);
      reset();
    };
  }, []);

  return null;
}
