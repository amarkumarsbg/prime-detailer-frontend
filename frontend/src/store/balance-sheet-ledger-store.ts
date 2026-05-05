"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BalanceSheetManualCategory =
  | "capital"
  | "gstPayable"
  | "igstPayable"
  | "cgstPayable"
  | "sgstPayable"
  | "tcsPayableLiab"
  | "tdsPayableLiab"
  | "accountPayable"
  | "loansLiability"
  | "taxReceivable"
  | "tcsReceivable"
  | "tdsReceivable"
  | "inventory"
  | "fixedAssets"
  | "investments"
  | "loansAdvance";

export interface BalanceSheetLedgerEntry {
  id: string;
  category: BalanceSheetManualCategory;
  ledgerName: string;
  amount: number;
  date: string;
  createdAt: string;
}

export const BALANCE_SHEET_CATEGORY_LABEL: Record<BalanceSheetManualCategory, string> = {
  capital: "Capital",
  gstPayable: "GST Payable",
  igstPayable: "IGST Payable",
  cgstPayable: "CGST Payable",
  sgstPayable: "SGST Payable",
  tcsPayableLiab: "TCS Payable",
  tdsPayableLiab: "TDS Payable",
  accountPayable: "Account Payable",
  loansLiability: "Loans",
  taxReceivable: "Tax Receivable",
  tcsReceivable: "TCS Receivable",
  tdsReceivable: "TDS Receivable",
  inventory: "Inventory In Hand",
  fixedAssets: "Fixed Assets",
  investments: "Investments",
  loansAdvance: "Loans Advance",
};

interface BalanceSheetLedgerStore {
  entries: BalanceSheetLedgerEntry[];
  favourite: boolean;
  lastUpdatedAt: string | null;
  addEntry: (input: {
    category: BalanceSheetManualCategory;
    ledgerName: string;
    amount: number;
    date: string;
  }) => void;
  removeEntry: (id: string) => void;
  setFavourite: (value: boolean) => void;
  sumFor: (category: BalanceSheetManualCategory) => number;
}

function nowIso() {
  return new Date().toISOString();
}

export const useBalanceSheetLedgerStore = create<BalanceSheetLedgerStore>()(
  persist(
    (set, get) => ({
      entries: [],
      favourite: false,
      lastUpdatedAt: null,

      addEntry: ({ category, ledgerName, amount, date }) => {
        const id = `bs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const row: BalanceSheetLedgerEntry = {
          id,
          category,
          ledgerName: ledgerName.trim() || "Entry",
          amount: Math.round(amount * 100) / 100,
          date,
          createdAt: nowIso(),
        };
        set((s) => ({
          entries: [row, ...s.entries],
          lastUpdatedAt: nowIso(),
        }));
      },

      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
          lastUpdatedAt: nowIso(),
        })),

      setFavourite: (value) => set({ favourite: value }),

      sumFor: (category) => {
        return get().entries
          .filter((e) => e.category === category)
          .reduce((s, e) => s + e.amount, 0);
      },
    }),
    { name: "prime-detailer-balance-sheet-ledger" }
  )
);
