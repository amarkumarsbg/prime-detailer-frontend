"use client";

import { create } from "zustand";
import type { Customer } from "@/types";
import { apiGet, apiPost, apiPut, apiPatch, ApiError } from "@/lib/api-client";
import { normalizePhoneDigits } from "@/lib/phone";

export type NewCustomerInput = Omit<Customer, "id" | "createdAt"> & {
  referralCode: string;
};

export type CustomerImportPayloadItem = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
};

export type CustomerBulkImportResult = {
  created: Customer[];
  skipped: Array<{
    index: number;
    name: string;
    phone: string;
    reason: "DUPLICATE" | "INVALID" | "DUPLICATE_IN_BATCH";
    message: string;
  }>;
  createdCount: number;
  skippedCount: number;
};

interface CustomerStore {
  customers: Customer[];
  customersLoading: boolean;
  customersError: string | null;
  fetchCustomers: () => Promise<void>;
  /** Returns the created customer on success, or null if phone conflict / error. */
  addCustomer: (customer: NewCustomerInput) => Promise<Customer | null>;
  /** Bulk-create customers; merges created rows into the store. */
  importCustomers: (customers: CustomerImportPayloadItem[]) => Promise<CustomerBulkImportResult>;
  /** Returns false if updates.phone is already used by another customer. */
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<boolean>;
  findByPhone: (phone: string) => Customer | undefined;
  findByEmail: (email: string) => Customer | undefined;
  findByReferralCode: (code: string) => Customer | undefined;
  creditWallet: (customerId: string, amount: number, type?: "CREDIT" | "DEBIT", reason?: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  customersLoading: false,
  customersError: null,

  fetchCustomers: async () => {
    set({ customersLoading: true, customersError: null });
    try {
      const data = await apiGet<{ customers: Customer[] }>("/api/customers");
      set({ customers: data.customers, customersLoading: false });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load customers";
      set({ customersError: message, customersLoading: false });
    }
  },

  addCustomer: async (customer) => {
    try {
      const data = await apiPost<{ customer: Customer }>("/api/customers", {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        referralCode: customer.referralCode,
        referredBy: customer.referredBy,
        totalVisits: customer.totalVisits,
        rewardPoints: customer.rewardPoints,
        walletBalance: customer.walletBalance,
        lastVisitDate: customer.lastVisitDate,
        isInactive: customer.isInactive,
        emailVerified: customer.emailVerified,
      });
      set((state) => ({ customers: [data.customer, ...state.customers] }));
      return data.customer;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return null;
      throw e;
    }
  },

  importCustomers: async (customers) => {
    const data = await apiPost<CustomerBulkImportResult>("/api/customers/bulk", {
      customers,
    });
    if (data.created.length > 0) {
      set((state) => ({ customers: [...data.created, ...state.customers] }));
    }
    return data;
  },

  updateCustomer: async (id, updates) => {
    try {
      const data = await apiPut<{ customer: Customer }>(`/api/customers/${id}`, {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.referralCode !== undefined && { referralCode: updates.referralCode }),
        ...(updates.referredBy !== undefined && { referredBy: updates.referredBy }),
        ...(updates.totalVisits !== undefined && { totalVisits: updates.totalVisits }),
        ...(updates.rewardPoints !== undefined && { rewardPoints: updates.rewardPoints }),
        ...(updates.walletBalance !== undefined && { walletBalance: updates.walletBalance }),
        ...(updates.lastVisitDate !== undefined && { lastVisitDate: updates.lastVisitDate }),
        ...(updates.isInactive !== undefined && { isInactive: updates.isInactive }),
        ...(updates.emailVerified !== undefined && { emailVerified: updates.emailVerified }),
      });
      set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? data.customer : c)),
      }));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return false;
      throw e;
    }
  },

  findByPhone: (phone) => {
    const cleaned = normalizePhoneDigits(phone);
    if (cleaned.length !== 10) return undefined;
    return get().customers.find((c) => normalizePhoneDigits(c.phone) === cleaned);
  },

  findByEmail: (email) => {
    const norm = email.trim().toLowerCase();
    if (!norm) return undefined;
    return get().customers.find((c) => c.email?.trim().toLowerCase() === norm);
  },

  findByReferralCode: (code) => {
    const upper = code.trim().toUpperCase();
    return get().customers.find((c) => c.referralCode.toUpperCase() === upper);
  },

  creditWallet: async (customerId, amount, type = "CREDIT", reason = "Manual Adjustment") => {
    const data = await apiPatch<{ customer: Customer }>(
      `/api/customers/${customerId}/wallet`,
      { amount, type, reason }
    );
    set((state) => ({
      customers: state.customers.map((c) => (c.id === customerId ? data.customer : c)),
    }));
  },
}));
