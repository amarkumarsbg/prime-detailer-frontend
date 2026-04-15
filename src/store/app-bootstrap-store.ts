"use client";

import { create } from "zustand";
import { bootstrapAppData } from "@/lib/bootstrap-app-data";

interface AppBootstrapState {
  ready: boolean;
  error: string | null;
  run: () => Promise<void>;
  reset: () => void;
}

export const useAppBootstrapStore = create<AppBootstrapState>((set) => ({
  ready: false,
  error: null,
  reset: () => set({ ready: false, error: null }),
  run: async () => {
    set({ error: null });
    try {
      await bootstrapAppData();
      set({ ready: true });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Could not load data from API",
        ready: false,
      });
    }
  },
}));
