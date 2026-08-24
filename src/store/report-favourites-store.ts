"use client";

import { create } from "zustand";
import { apiGet, apiPut } from "@/lib/api-client";
import {
  collectLocalFavouriteHrefs,
  markLocalFavouritesMigrated,
  notifyReportFavouritesChanged,
  shouldMigrateLocalFavourites,
} from "@/lib/reports/report-favourites-keys";

interface ReportFavouritesState {
  userId: string | null;
  hrefs: string[];
  loaded: boolean;
  loading: boolean;
  hydrateForUser: (userId: string) => Promise<void>;
  clear: () => void;
  isFavourited: (href: string) => boolean;
  setFavourited: (href: string, value: boolean) => Promise<void>;
  replaceHrefs: (hrefs: string[]) => Promise<void>;
}

async function persistHrefs(hrefs: string[]): Promise<string[]> {
  const data = await apiPut<{ hrefs: string[] }>("/api/auth/me/report-favourites", {
    hrefs,
  });
  return Array.isArray(data.hrefs) ? data.hrefs : hrefs;
}

export const useReportFavouritesStore = create<ReportFavouritesState>((set, get) => ({
  userId: null,
  hrefs: [],
  loaded: false,
  loading: false,

  hydrateForUser: async (userId) => {
    if (!userId) {
      get().clear();
      return;
    }
    if (get().userId === userId && get().loaded) return;
    set({ loading: true, userId });
    try {
      const data = await apiGet<{ hrefs: string[] }>("/api/auth/me/report-favourites");
      let hrefs = Array.isArray(data.hrefs) ? data.hrefs : [];

      if (hrefs.length === 0 && shouldMigrateLocalFavourites(userId)) {
        const migrated = collectLocalFavouriteHrefs();
        if (migrated.length > 0) {
          hrefs = await persistHrefs(migrated);
        }
        markLocalFavouritesMigrated(userId);
      }

      set({ hrefs, loaded: true, loading: false, userId });
      notifyReportFavouritesChanged();
    } catch {
      set({ hrefs: [], loaded: true, loading: false, userId });
      notifyReportFavouritesChanged();
    }
  },

  clear: () => {
    set({ userId: null, hrefs: [], loaded: false, loading: false });
    notifyReportFavouritesChanged();
  },

  isFavourited: (href) => get().hrefs.includes(href),

  setFavourited: async (href, value) => {
    const current = get().hrefs;
    const next = value
      ? current.includes(href)
        ? current
        : [...current, href]
      : current.filter((h) => h !== href);
    if (next.length === current.length && value === get().isFavourited(href)) {
      return;
    }
    // Optimistic UI
    set({ hrefs: next });
    notifyReportFavouritesChanged(href, value);
    try {
      const saved = await persistHrefs(next);
      set({ hrefs: saved, loaded: true });
      notifyReportFavouritesChanged();
    } catch {
      set({ hrefs: current });
      notifyReportFavouritesChanged();
      throw new Error("Could not save favourite");
    }
  },

  replaceHrefs: async (hrefs) => {
    const saved = await persistHrefs(hrefs);
    set({ hrefs: saved, loaded: true });
    notifyReportFavouritesChanged();
  },
}));
