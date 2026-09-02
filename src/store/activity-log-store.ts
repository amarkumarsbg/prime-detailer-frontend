"use client";

import { create } from "zustand";
import type { ActivityLog } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";
import { apiGet } from "@/lib/api-client";

interface ActivityLogStore {
  logs: ActivityLog[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoadingMore: boolean;

  setInitialPage: (logs: ActivityLog[], page: number, pageSize: number, totalPages: number) => void;
  fetchNextPage: () => Promise<void>;
  addLog: (entry: ActivityLog) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogStore>((set, get) => ({
  logs: [],
  page: 1,
  pageSize: 15,
  hasMore: false,
  isLoadingMore: false,

  setInitialPage: (logs, page, pageSize, totalPages) => {
    set({ logs, page, pageSize, hasMore: page < totalPages, isLoadingMore: false });
  },

  fetchNextPage: async () => {
    const state = get();
    if (!state.hasMore || state.isLoadingMore) return;
    
    set({ isLoadingMore: true });
    try {
      const nextPage = state.page + 1;
      const data = await apiGet<{ items: ActivityLog[], page: number, totalPages: number }>(
        `/api/collections/activityLogs?page=${nextPage}&pageSize=${state.pageSize}`
      );
      
      const newLogs = Array.isArray(data.items) ? data.items : [];
      set((s) => ({
        logs: [...s.logs, ...newLogs],
        page: data.page || nextPage,
        hasMore: (data.page || nextPage) < (data.totalPages || 0),
      }));
    } catch (err) {
      console.warn("Failed to fetch next page of activity logs:", err);
    } finally {
      set({ isLoadingMore: false });
    }
  },

  addLog: async (entry) => {
    await putCollectionDocument("activityLogs", entry.id, entry);
    set((s) => ({
      logs: [entry, ...s.logs],
    }));
  },
}));
