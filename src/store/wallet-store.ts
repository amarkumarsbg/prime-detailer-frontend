"use client";

import { create } from "zustand";
import type { WalletTransaction } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";

interface WalletStore {
  transactions: WalletTransaction[];
  addTransaction: (tx: WalletTransaction) => Promise<void>;
  getByCustomer: (customerId: string) => WalletTransaction[];
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
}));
