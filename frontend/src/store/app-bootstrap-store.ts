"use client";

import { create } from "zustand";
import { bootstrapAppData } from "@/lib/bootstrap-app-data";

interface AppBootstrapState {
  ready: boolean;
  error: string | null;
  run: () => Promise<void>;
  reset: () => void;
}

const RETRIES = 4;
const DELAY_MS = 2500;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export const useAppBootstrapStore = create<AppBootstrapState>((set) => ({
  ready: false,
  error: null,
  reset: () => set({ ready: false, error: null }),
  run: async () => {
    set({ error: null });
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        await bootstrapAppData();
        set({ ready: true });
        return;
      } catch (e) {
        lastError = e;
        if (attempt < RETRIES - 1) await sleep(DELAY_MS * (attempt + 1));
      }
    }
    set({
      error: lastError instanceof Error ? lastError.message : "Could not load data from API",
      ready: false,
    });
  },
}));
