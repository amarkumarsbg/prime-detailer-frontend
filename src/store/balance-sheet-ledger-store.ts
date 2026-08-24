"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

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

export interface BalanceSheetManualPayload {
  entries: BalanceSheetLedgerEntry[];
  favourite: boolean;
  lastUpdatedAt: string | null;
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

function pushManualBalanceSheet(payload: BalanceSheetManualPayload): void {
  void putSingletonDocument("balanceSheetManual", payload).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

export function mergeBalanceSheetManualPayload(raw: unknown): Partial<BalanceSheetManualPayload> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const next: Partial<BalanceSheetManualPayload> = {};
  if (Array.isArray(o.entries)) next.entries = o.entries as BalanceSheetLedgerEntry[];
  if (typeof o.favourite === "boolean") next.favourite = o.favourite;
  if (o.lastUpdatedAt === null || typeof o.lastUpdatedAt === "string") {
    next.lastUpdatedAt = o.lastUpdatedAt as string | null;
  }
  return next;
}

interface BalanceSheetLedgerStore extends BalanceSheetManualPayload {
  addEntry: (input: {
    category: BalanceSheetManualCategory;
    ledgerName: string;
    amount: number;
    date: string;
  }) => void;
  removeEntry: (id: string) => void;
  setFavourite: (value: boolean) => void;
  sumFor: (category: BalanceSheetManualCategory) => number;
  hydrateFromBootstrap: (payload: Partial<BalanceSheetManualPayload>) => void;
}

function nowIso() {
  return new Date().toISOString();
}

export const useBalanceSheetLedgerStore = create<BalanceSheetLedgerStore>((set, get) => ({
  entries: [],
  favourite: false,
  lastUpdatedAt: null,

  hydrateFromBootstrap: (payload) =>
    set((state) => ({
      ...state,
      entries: Array.isArray(payload.entries) ? payload.entries : state.entries,
      favourite:
        typeof payload.favourite === "boolean" ? payload.favourite : state.favourite,
      lastUpdatedAt:
        payload.lastUpdatedAt !== undefined ? payload.lastUpdatedAt : state.lastUpdatedAt,
    })),

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
    pushManualBalanceSheet({
      entries: get().entries,
      favourite: get().favourite,
      lastUpdatedAt: get().lastUpdatedAt,
    });
  },

  removeEntry: (id) => {
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      lastUpdatedAt: nowIso(),
    }));
    pushManualBalanceSheet({
      entries: get().entries,
      favourite: get().favourite,
      lastUpdatedAt: get().lastUpdatedAt,
    });
  },

  setFavourite: (favourite) => {
    set({ favourite });
    pushManualBalanceSheet({
      entries: get().entries,
      favourite: get().favourite,
      lastUpdatedAt: get().lastUpdatedAt,
    });
    try {
      localStorage.setItem(
        "prime-detailer-balance-sheet-favourite",
        favourite ? "1" : "0"
      );
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("prime-report-favourite"));
    }
  },

  sumFor: (category) => {
    return get()
      .entries.filter((e) => e.category === category)
      .reduce((s, e) => s + e.amount, 0);
  },
}));
