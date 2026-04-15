"use client";

import { create } from "zustand";
import type { ServiceCatalogItem } from "@/types";
import { postCollectionSnapshot } from "@/lib/collection-sync";

interface ServiceCatalogState {
  catalog: ServiceCatalogItem[];
  setCatalog: (updater: (prev: ServiceCatalogItem[]) => ServiceCatalogItem[]) => Promise<void>;
}

export const useServiceCatalogStore = create<ServiceCatalogState>((set, get) => ({
  catalog: [],

  setCatalog: async (updater) => {
    const catalog = updater(get().catalog);
    await postCollectionSnapshot("serviceCatalog", catalog);
    set({ catalog });
  },
}));
