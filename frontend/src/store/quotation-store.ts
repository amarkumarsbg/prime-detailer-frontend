"use client";

import { create } from "zustand";
import type { Quotation } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";

interface QuotationStore {
  quotations: Quotation[];
  addQuotation: (q: Quotation) => Promise<void>;
  updateQuotation: (id: string, patch: Partial<Quotation>) => Promise<void>;
  getNextQuotationNumber: () => string;
}

export const useQuotationStore = create<QuotationStore>((set, get) => ({
  quotations: [],

  addQuotation: async (q) => {
    await putCollectionDocument("quotations", q.id, q);
    set((s) => ({ quotations: [q, ...s.quotations] }));
  },

  updateQuotation: async (id, patch) => {
    const prev = get().quotations.find((x) => x.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    await putCollectionDocument("quotations", id, next);
    set((s) => ({
      quotations: s.quotations.map((x) => (x.id === id ? next : x)),
    }));
  },

  getNextQuotationNumber: () => {
    const all = get().quotations;
    const max = all.reduce((m, q) => {
      const match = q.quotationNumber.match(/QUO-\d{4}-(\d+)/);
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    return `QUO-2026-${String(max + 1).padStart(4, "0")}`;
  },
}));
