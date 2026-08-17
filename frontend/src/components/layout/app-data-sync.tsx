"use client";

import { useEffect, useRef } from "react";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";

/** How often to pull thin `/api/bootstrap` while the tab is visible. */
const POLL_INTERVAL_MS = 45_000;

/**
 * Ignore visibility→visible refresh shortly after shell becomes ready so the
 * initial layout `run()` is not immediately duplicated by a first-paint visibility event.
 */
export const BOOTSTRAP_VISIBILITY_GRACE_MS = 5_000;

/**
 * Keeps shell stores (branches, branding, entitlement) fresh.
 * Domain collections are loaded by DomainDataSync per route.
 */
export function AppDataSync() {
  const ready = useAppBootstrapStore((s) => s.ready);
  const refresh = useAppBootstrapStore((s) => s.refresh);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const { readyAtMs, ready: isReady } = useAppBootstrapStore.getState();
      if (
        isReady &&
        readyAtMs > 0 &&
        Date.now() - readyAtMs < BOOTSTRAP_VISIBILITY_GRACE_MS
      ) {
        return;
      }
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready, refresh]);

  return null;
}
