"use client";

import { create } from "zustand";
import type {
  Expense,
  ExpensePaymentMethod,
  ExpensePaymentStatus,
  ExpenseVendorProfile,
} from "@/types";
import { postCollectionSnapshot, putSingletonDocument } from "@/lib/collection-sync";

export type AddExpenseInput = {
  title: string;
  category: string;
  description?: string;
  amount: number;
  amountPaid?: number;
  date: string;
  vendorName?: string;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  receipt?: string;
  createdBy: string;
  createdByName: string;
  branchId: string;
};

export type AddVendorDirectoryInput = Omit<ExpenseVendorProfile, "id">;

interface ExpenseStore {
  expenses: Expense[];
  customCategories: string[];
  categoryDescriptions: Record<string, string>;
  vendorSuggestions: string[];
  vendorDirectory: ExpenseVendorProfile[];
  addExpense: (input: AddExpenseInput) => Promise<Expense>;
  removeExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<boolean>;
  addCustomCategory: (label: string, description?: string) => Promise<void>;
  addVendorSuggestion: (name: string) => Promise<void>;
  addVendorDirectoryEntry: (input: AddVendorDirectoryInput) => Promise<ExpenseVendorProfile | null>;
}

async function persistExpenseState(get: () => ExpenseStore): Promise<void> {
  const s = get();
  await Promise.all([
    postCollectionSnapshot("expenses", s.expenses),
    putSingletonDocument("expenseMeta", {
      customCategories: s.customCategories,
      categoryDescriptions: s.categoryDescriptions,
      vendorSuggestions: s.vendorSuggestions,
      vendorDirectory: s.vendorDirectory,
    }),
  ]);
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  customCategories: [],
  categoryDescriptions: {},
  vendorSuggestions: [],
  vendorDirectory: [],

  addCustomCategory: async (label, description) => {
    const t = label.trim();
    if (!t) return;
    set((s) => {
      const nextCat = s.customCategories.includes(t)
        ? s.customCategories
        : [...s.customCategories, t];
      const desc = description?.trim();
      const categoryDescriptions =
        desc && desc.length > 0 ? { ...s.categoryDescriptions, [t]: desc } : s.categoryDescriptions;
      return { customCategories: nextCat, categoryDescriptions };
    });
    await persistExpenseState(get);
  },

  addVendorSuggestion: async (name) => {
    const t = name.trim();
    if (!t) return;
    set((s) =>
      s.vendorSuggestions.includes(t)
        ? s
        : { vendorSuggestions: [...s.vendorSuggestions, t] }
    );
    await persistExpenseState(get);
  },

  addVendorDirectoryEntry: async (input) => {
    const name = input.name.trim();
    if (!name) return null;
    const id = `ven-${Date.now()}`;
    const entry: ExpenseVendorProfile = {
      id,
      name,
      contactPerson: input.contactPerson?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      paymentTerms: input.paymentTerms?.trim() || undefined,
      address: input.address?.trim() || undefined,
      gstNumber: input.gstNumber?.trim() || undefined,
      panNumber: input.panNumber?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    };
    set((s) => ({
      vendorDirectory: [...s.vendorDirectory, entry],
      vendorSuggestions: s.vendorSuggestions.includes(name)
        ? s.vendorSuggestions
        : [...s.vendorSuggestions, name],
    }));
    await persistExpenseState(get);
    return entry;
  },

  removeExpense: async (id) => {
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    }));
    await persistExpenseState(get);
  },

  updateExpense: async (id, updates) => {
    const exists = get().expenses.some((e) => e.id === id);
    if (!exists) return false;
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    await persistExpenseState(get);
    return true;
  },

  addExpense: async (input) => {
    const now = new Date().toISOString();
    const amountPaid =
      input.paymentStatus === "PARTIAL"
        ? Math.min(Math.max(0, input.amountPaid ?? 0), input.amount)
        : undefined;

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      title: input.title.trim(),
      category: input.category.trim(),
      description: input.description?.trim() || undefined,
      amount: input.amount,
      amountPaid,
      date: input.date,
      vendorName: input.vendorName?.trim() || undefined,
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
      receipt: input.receipt?.trim() || undefined,
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      branchId: input.branchId,
      createdAt: now,
    };
    set((state) => ({
      expenses: [expense, ...state.expenses],
    }));
    await persistExpenseState(get);
    return expense;
  },
}));
