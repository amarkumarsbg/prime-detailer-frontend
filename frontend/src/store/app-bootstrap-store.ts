"use client";

import { create } from "zustand";
import { bootstrapAppData } from "@/lib/bootstrap-app-data";

interface AppBootstrapState {
  ready: boolean;
  error: string | null;
  /** True while a background refresh is running (does not block UI). */
  refreshing: boolean;
  run: () => Promise<void>;
  /** Single bootstrap fetch; keeps existing data if already ready and the request fails. */
  refresh: () => Promise<void>;
  reset: () => void;
}

const RETRIES = 4;
const DELAY_MS = 2500;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const useAppBootstrapStore = create<AppBootstrapState>((set, get) => ({
  ready: false,
  error: null,
  refreshing: false,
  reset: () => set({ ready: false, error: null, refreshing: false }),
  refresh: async () => {
    if (get().refreshing) return;
    set({ refreshing: true });
    try {
      await bootstrapAppData();
      set({ ready: true, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not refresh data from API";
      if (!get().ready) {
        set({ error: msg, ready: false });
      } else {
        console.warn("[bootstrap] Background refresh failed (keeping cached data):", msg);
      }
    } finally {
      set({ refreshing: false });
    }
  },
  run: async () => {
    set({ error: null, refreshing: false });
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        await bootstrapAppData();
        set({ ready: true, refreshing: false });
        return;
      } catch (e) {
        lastError = e;
        if (attempt < RETRIES - 1) await sleep(DELAY_MS * (attempt + 1));
      }
    }
    set({
      error: lastError instanceof Error ? lastError.message : "Could not load data from API",
      ready: false,
      refreshing: false,
    });
  },
}));
