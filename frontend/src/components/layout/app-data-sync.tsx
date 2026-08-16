"use client";

import { useEffect, useRef } from "react";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";

/** How often to pull thin `/api/bootstrap` while the tab is visible. */
const POLL_INTERVAL_MS = 45_000;

/**
 * Keeps shell stores (branches, branding, entitlement) fresh.
 * Domain collections are loaded by DomainDataSync per route.
 */
export function AppDataSync() {
  const ready = useAppBootstrapStore((s) => s.ready);
  const refresh = useAppBootstrapStore((s) => s.refresh);
  const started = useRef(false);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
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
    if (!started.current) {
      started.current = true;
    }
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready, refresh]);

  return null;
}
