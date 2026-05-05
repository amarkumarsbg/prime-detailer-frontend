"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";

export type CashBankAccountType = "cash" | "unlinked" | "bank";

export interface CashBankBankMeta {
  accountNumber: string;
  holderName: string;
  ifsc: string;
  bankName: string;
  branchName: string;
  upiId?: string;
}

export interface CashBankAccount {
  id: string;
  type: CashBankAccountType;
  displayName: string;
  balance: number;
  openingBalanceDate?: string;
  accountNumberDisplay?: string;
  bankMeta?: CashBankBankMeta;
}

export type CashBankTxnRowType =
  | "OPENING"
  | "ADJUST_ADD"
  | "ADJUST_REDUCE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export interface CashBankTransaction {
  id: string;
  accountId: string;
  date: string;
  rowType: CashBankTxnRowType;
  txnNo?: string;
  party?: string;
  mode?: string;
  paid?: number;
  received?: number;
  balanceAfter: number;
  notes?: string;
}

function persist(accounts: CashBankAccount[], transactions: CashBankTransaction[]) {
  void putSingletonDocument("cashBank", { accounts, transactions }).catch((err) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
  });
}

export interface CashBankStore {
  accounts: CashBankAccount[];
  transactions: CashBankTransaction[];
  setAccounts: (v: CashBankAccount[] | ((prev: CashBankAccount[]) => CashBankAccount[])) => void;
  setTransactions: (
    v: CashBankTransaction[] | ((prev: CashBankTransaction[]) => CashBankTransaction[])
  ) => void;
  addBankAccount: (account: Omit<CashBankAccount, "id">) => void;
  updateBankAccount: (id: string, patch: Partial<CashBankAccount>) => void;
  removeBankAccount: (id: string) => void;
  adjustBalance: (input: {
    accountId: string;
    amount: number;
    add: boolean;
    dateIso: string;
    remarks?: string;
  }) => void;
  transfer: (input: {
    fromId: string;
    toId: string;
    amount: number;
    dateIso: string;
    remarks?: string;
  }) => boolean;
}

export const useCashBankStore = create<CashBankStore>((set, get) => ({
  accounts: [],
  transactions: [],

  setAccounts: (value) => {
    set((s) => ({
      accounts: typeof value === "function" ? value(s.accounts) : value,
    }));
    const { accounts, transactions } = get();
    persist(accounts, transactions);
  },

  setTransactions: (value) => {
    set((s) => ({
      transactions: typeof value === "function" ? value(s.transactions) : value,
    }));
    const { accounts, transactions } = get();
    persist(accounts, transactions);
  },

  addBankAccount: (account) => {
    const id = `acc-bank-${Date.now()}`;
    const row: CashBankAccount = { ...account, id, type: "bank" };
    set((s) => {
      const accounts = [row, ...s.accounts];
      persist(accounts, s.transactions);
      return { accounts };
    });
  },

  updateBankAccount: (id, patch) => {
    set((s) => {
      const accounts = s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
      persist(accounts, s.transactions);
      return { accounts };
    });
  },

  removeBankAccount: (id) => {
    set((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      persist(accounts, s.transactions);
      return { accounts };
    });
  },

  adjustBalance: ({ accountId, amount, add, dateIso, remarks }) => {
    if (amount <= 0) return;
    const state = get();
    const acc = state.accounts.find((a) => a.id === accountId);
    if (!acc) return;
    const delta = add ? amount : -amount;
    const newBal = Math.round((acc.balance + delta) * 100) / 100;
    const id = `txn-${Date.now()}`;
    const rowType: CashBankTxnRowType = add ? "ADJUST_ADD" : "ADJUST_REDUCE";
    const t: CashBankTransaction = {
      id,
      accountId,
      date: dateIso,
      rowType,
      party: "Balance adjustment",
      mode: "Manual",
      paid: add ? undefined : amount,
      received: add ? amount : undefined,
      balanceAfter: newBal,
      notes: remarks,
    };
    set((s) => {
      const accounts = s.accounts.map((a) => (a.id === accountId ? { ...a, balance: newBal } : a));
      const transactions = [t, ...s.transactions];
      persist(accounts, transactions);
      return { accounts, transactions };
    });
  },

  transfer: ({ fromId, toId, amount, dateIso, remarks }) => {
    if (amount <= 0 || fromId === toId) return false;
    const state = get();
    const from = state.accounts.find((a) => a.id === fromId);
    const to = state.accounts.find((a) => a.id === toId);
    if (!from || !to) return false;
    if (from.balance < amount) return false;
    const idBase = Date.now();
    const newFrom = Math.round((from.balance - amount) * 100) / 100;
    const newTo = Math.round((to.balance + amount) * 100) / 100;
    const tOut: CashBankTransaction = {
      id: `txn-${idBase}-out`,
      accountId: fromId,
      date: dateIso,
      rowType: "TRANSFER_OUT",
      party: `To ${to.displayName}`,
      mode: "Transfer",
      paid: amount,
      balanceAfter: newFrom,
      notes: remarks,
    };
    const tIn: CashBankTransaction = {
      id: `txn-${idBase}-in`,
      accountId: toId,
      date: dateIso,
      rowType: "TRANSFER_IN",
      party: `From ${from.displayName}`,
      mode: "Transfer",
      received: amount,
      balanceAfter: newTo,
      notes: remarks,
    };
    set((s) => {
      const accounts = s.accounts.map((a) => {
        if (a.id === fromId) return { ...a, balance: newFrom };
        if (a.id === toId) return { ...a, balance: newTo };
        return a;
      });
      const transactions = [tOut, tIn, ...s.transactions];
      persist(accounts, transactions);
      return { accounts, transactions };
    });
    return true;
  },
}));

export function totalCashBankBalance(accounts: CashBankAccount[]): number {
  return Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100;
}
