"use client";

import { create } from "zustand";
import { postCollectionSnapshot } from "@/lib/collection-sync";
import type { ServiceCategoryRecord } from "@/types";

function persist(categories: ServiceCategoryRecord[]) {
  void postCollectionSnapshot("serviceCategories", categories).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
}

interface ServiceCategoryState {
  categories: ServiceCategoryRecord[];
  setCategories: (u: (prev: ServiceCategoryRecord[]) => ServiceCategoryRecord[]) => void;
  upsert: (row: ServiceCategoryRecord) => void;
  remove: (id: string) => void;
}

export const useServiceCategoryStore = create<ServiceCategoryState>((set) => ({
  categories: [],

  setCategories: (u) => {
    set((s) => {
      const categories = u(s.categories);
      persist(categories);
      return { categories };
    });
  },

  upsert: (row) => {
    set((s) => {
      const i = s.categories.findIndex((c) => c.id === row.id);
      const categories =
        i === -1
          ? [...s.categories, row].sort((a, b) => a.order - b.order)
          : (() => {
              const next = [...s.categories];
              next[i] = row;
              return next.sort((a, b) => a.order - b.order);
            })();
      persist(categories);
      return { categories };
    });
  },

  remove: (id) => {
    set((s) => {
      const categories = s.categories.filter((c) => c.id !== id);
      persist(categories);
      return { categories };
    });
  },
}));
