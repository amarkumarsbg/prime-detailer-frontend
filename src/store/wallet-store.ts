"use client";

import { create } from "zustand";
import type { WalletTransaction } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";
import { apiGet } from "@/lib/api-client";

interface WalletStore {
  transactions: WalletTransaction[];
  addTransaction: (tx: WalletTransaction) => Promise<void>;
  getByCustomer: (customerId: string) => WalletTransaction[];
  fetchTransactions: () => Promise<void>;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  transactions: [],

  addTransaction: async (tx) => {
    await putCollectionDocument("walletTransactions", tx.id, tx);
    set((state) => ({ transactions: [tx, ...state.transactions] }));
  },

  getByCustomer: (customerId) =>
    get()
      .transactions.filter((t) => t.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  fetchTransactions: async () => {
    try {
      const data = await apiGet<{ items: WalletTransaction[] }>("/api/collections/walletTransactions");
      set({ transactions: data.items || [] });
    } catch (e) {
      console.error("Failed to fetch wallet transactions:", e);
    }
  },
}));
