"use client";

import { create } from "zustand";
import type { JobCard } from "@/types";
import { deleteCollectionDocument, putCollectionDocument } from "@/lib/collection-sync";
import { syncPickupFromJobCard } from "@/lib/sync-pickup-from-job-card";

interface JobCardStore {
  jobCards: JobCard[];
  addJobCard: (jobCard: JobCard) => Promise<void>;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>;
  deleteJobCard: (id: string) => Promise<void>;
  getNextJobNumber: () => string;
}

export const useJobCardStore = create<JobCardStore>((set, get) => ({
  jobCards: [],

  addJobCard: async (jobCard) => {
    await putCollectionDocument("jobCards", jobCard.id, jobCard);
    set((state) => ({
      jobCards: [jobCard, ...state.jobCards.filter((jc) => jc.id !== jobCard.id)],
    }));
  },

  updateJobCard: async (id, updates) => {
    const prev = get().jobCards.find((jc) => jc.id === id);
    if (!prev) return;
    const next = { ...prev, ...updates };
    await putCollectionDocument("jobCards", id, next);
    set((state) => ({
      jobCards: state.jobCards.map((jc) => (jc.id === id ? next : jc)),
    }));
    if (updates.status) {
      syncPickupFromJobCard(id, next.status);
    }
  },

  deleteJobCard: async (id) => {
    await deleteCollectionDocument("jobCards", id);
    set((state) => ({
      jobCards: state.jobCards.filter((jc) => jc.id !== id),
    }));
  },

  getNextJobNumber: () => {
    const all = get().jobCards;
    const maxNum = all.reduce((max, jc) => {
      const match = jc.jobNumber.match(/JC-\d{4}-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `JC-2026-${String(maxNum + 1).padStart(4, "0")}`;
  },
}));
