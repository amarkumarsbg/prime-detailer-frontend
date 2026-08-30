"use client";

import { create } from "zustand";
import type { Customer, PaginationParams } from "@/types";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, ApiError } from "@/lib/api-client";
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
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isInitialLoaded: boolean;

  fetchCustomers: () => Promise<void>;
  fetchPaginatedCustomers: (params: PaginationParams, append?: boolean) => Promise<void>;
  /** Returns the created customer on success, or null if phone conflict / error. */
  addCustomer: (customer: NewCustomerInput) => Promise<Customer | null>;
  /** Bulk-create customers; merges created rows into the store. */
  importCustomers: (customers: CustomerImportPayloadItem[]) => Promise<CustomerBulkImportResult>;
  /** Returns false if updates.phone is already used by another customer. */
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<void>;
  findByPhone: (phone: string) => Customer | undefined;
  findByEmail: (email: string) => Customer | undefined;
  findByReferralCode: (code: string) => Customer | undefined;
  creditWallet: (customerId: string, amount: number, type?: "CREDIT" | "DEBIT", reason?: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  customersLoading: false,
  customersError: null,
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  isInitialLoaded: false,

  fetchCustomers: async () => {
    return get().fetchPaginatedCustomers({ page: 1, pageSize: 50 });
  },

  fetchPaginatedCustomers: async (params, append = false) => {
    set({ customersLoading: true, customersError: null });
    try {
      const query = new URLSearchParams();
      query.append("page", params.page.toString());
      query.append("pageSize", params.pageSize.toString());
      if (params.search) query.append("search", params.search);
      if (params.sortBy) query.append("sortBy", params.sortBy);
      if (params.sortDir) query.append("sortDir", params.sortDir);
      if (params.filters) {
        Object.entries(params.filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            query.append(k, String(v));
          }
        });
      }

      const data = await apiGet<{ 
        customers: Customer[]; 
        metadata?: { total: number; page: number; pageSize: number; totalPages: number } 
      }>(`/api/customers?${query.toString()}`);
      
      const newItems = data.customers;
      
      set((state) => ({ 
        customers: append ? [...state.customers, ...newItems] : newItems, 
        customersLoading: false,
        isInitialLoaded: true,
        total: data.metadata?.total ?? (append ? state.total + newItems.length : newItems.length),
        page: data.metadata?.page ?? params.page,
        pageSize: data.metadata?.pageSize ?? params.pageSize,
        totalPages: data.metadata?.totalPages ?? 1,
      }));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load customers";
      set({ customersError: message, customersLoading: false });
    }
  },

  addCustomer: async (customer) => {
    try {
      const data = await apiPost<{
        customer: Customer;
        temporaryPassword?: string;
        credentialsSent?: boolean;
      }>("/api/customers", {
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

      // If credentials were not sent via WhatsApp (Twilio not configured),
      // attach the temporary password to the customer object so callers can
      // display it manually to staff.
      if (data.temporaryPassword && data.credentialsSent === false) {
        return { ...data.customer, _temporaryPassword: data.temporaryPassword } as Customer & { _temporaryPassword: string };
      }

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
        ...(updates.avatar !== undefined && { avatar: updates.avatar ?? null }),
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

  deleteCustomer: async (id) => {
    await apiDelete<{ ok: boolean }>(`/api/customers/${id}`);
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    }));
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
