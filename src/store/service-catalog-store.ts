"use client";

import { create } from "zustand";
import type { ServiceCatalogItem } from "@/types";
import { postCollectionSnapshot } from "@/lib/collection-sync";

interface ServiceCatalogState {
  catalog: ServiceCatalogItem[];
  setCatalog: (updater: (prev: ServiceCatalogItem[]) => ServiceCatalogItem[]) => Promise<void>;
  removeFromCatalog: (id: string) => Promise<void>;
}

export const useServiceCatalogStore = create<ServiceCatalogState>((set, get) => ({
  catalog: [],

  setCatalog: async (updater) => {
    const catalog = updater(get().catalog);
    await postCollectionSnapshot("serviceCatalog", catalog).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.warn("Failed to persist service catalog", err);
    });
    set({ catalog });
  },

  removeFromCatalog: async (id) => {
    const catalog = get().catalog.filter((s) => s.id !== id);
    await postCollectionSnapshot("serviceCatalog", catalog).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.warn("Failed to persist service catalog", err);
    });
    set({ catalog });
  },
}));
