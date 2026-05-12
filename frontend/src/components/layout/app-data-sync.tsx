"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";

/** How often to pull `/api/bootstrap` while the tab is visible (balances freshness vs load). */
const POLL_INTERVAL_MS = 45_000;
/** Debounce refresh after route changes within the dashboard shell. */
const ROUTE_DEBOUNCE_MS = 400;

/**
 * Keeps Zustand entity stores aligned with the API: visibility resume, periodic polling,
 * navigation between dashboard routes, and browser reconnect.
 */
export function AppDataSync() {
  const pathname = usePathname();
  const ready = useAppBootstrapStore((s) => s.ready);
  const refresh = useAppBootstrapStore((s) => s.refresh);
  const skipNextRouteRefresh = useRef(true);

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
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready, refresh]);

  useEffect(() => {
    if (!ready) return;
    if (skipNextRouteRefresh.current) {
      skipNextRouteRefresh.current = false;
      return;
    }
    const t = window.setTimeout(() => void refresh(), ROUTE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [pathname, ready, refresh]);

  return null;
}
