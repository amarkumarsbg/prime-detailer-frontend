"use client";

import { create } from "zustand";
import type { FollowUp } from "@/types";
import { deleteCollectionDocument, putCollectionDocument, postCollectionSnapshot } from "@/lib/collection-sync";

interface FollowUpStore {
  followUps: FollowUp[];
  setFollowUps: (items: FollowUp[]) => void;
  addFollowUp: (fu: FollowUp) => Promise<void>;
  updateFollowUp: (id: string, patch: Partial<FollowUp>) => Promise<void>;
  removeFollowUp: (id: string) => Promise<void>;
}

export const useFollowUpStore = create<FollowUpStore>((set, get) => ({
  followUps: [],

  setFollowUps: (items) => set({ followUps: items }),

  addFollowUp: async (fu) => {
    await putCollectionDocument("followUps", fu.id, fu);
    set((s) => ({ followUps: [fu, ...s.followUps.filter((x) => x.id !== fu.id)] }));
  },

  updateFollowUp: async (id, patch) => {
    const prev = get().followUps.find((f) => f.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch };
    await putCollectionDocument("followUps", id, next);
    set((s) => ({ followUps: s.followUps.map((f) => (f.id === id ? next : f)) }));
  },

  removeFollowUp: async (id) => {
    await deleteCollectionDocument("followUps", id);
    set((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) }));
  },
}));

export async function syncFollowUpsSnapshot(followUps: FollowUp[]): Promise<void> {
  await postCollectionSnapshot("followUps", followUps);
}
