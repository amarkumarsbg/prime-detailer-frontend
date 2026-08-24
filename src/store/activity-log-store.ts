"use client";

import { create } from "zustand";
import type { ActivityLog } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";

interface ActivityLogStore {
  logs: ActivityLog[];
  addLog: (entry: ActivityLog) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogStore>((set) => ({
  logs: [],

  addLog: async (entry) => {
    await putCollectionDocument("activityLogs", entry.id, entry);
    set((s) => ({
      logs: [entry, ...s.logs],
    }));
  },
}));
