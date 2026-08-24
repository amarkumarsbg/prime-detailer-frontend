"use client";

import { create } from "zustand";
import type { Invoice, InvoiceStatus, Payment, PaginationParams } from "@/types";
import { deleteCollectionDocument, putCollectionDocument } from "@/lib/collection-sync";
import { apiGet, ApiError } from "@/lib/api-client";
import { useReminderStore } from "@/store/reminder-store";

interface InvoiceStore {
  invoices: Invoice[];
  invoicesLoading: boolean;
  invoicesError: string | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isInitialLoaded: boolean;

  fetchPaginatedInvoices: (params: PaginationParams, append?: boolean) => Promise<void>;
  addInvoice: (invoice: Invoice) => Promise<void>;
  getNextInvoiceNumber: () => string;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  recordPayment: (
    invoiceId: string,
    payment: Omit<Payment, "id"> & { id?: string; addExtraToWallet?: boolean; extraAmount?: number },
    options: { performedBy: string },
    walletAmountUsed?: number
  ) => Promise<{ ok: boolean; inventoryError?: string }>;
}

function computeInvoiceStatus(inv: Invoice, payments: Payment[]): InvoiceStatus {
  const paid = payments.reduce((s, p) => s + p.amount, 0) + (inv.walletAmountUsed || 0);
  if (paid >= inv.grandTotal - 0.01) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return inv.status;
}

/** Fire-and-forget payment reminder sync (Phase 3). Never throws into invoice flows. */
function queuePaymentReminderSync(invoice: Invoice) {
  void useReminderStore
    .getState()
    .syncPaymentReminderForInvoice(invoice)
    .catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error(err);
    });
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  invoicesLoading: false,
  invoicesError: null,
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  isInitialLoaded: false,

  fetchPaginatedInvoices: async (params, append = false) => {
    set({ invoicesLoading: true, invoicesError: null });
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
        items: Invoice[]; 
        metadata?: { total: number; page: number; pageSize: number; totalPages: number } 
      }>(`/api/collections/invoices?${query.toString()}`);
      
      const newItems = data.items;
      
      set((state) => ({ 
        invoices: append ? [...state.invoices, ...newItems] : newItems, 
        invoicesLoading: false,
        isInitialLoaded: true,
        total: data.metadata?.total ?? (append ? state.total + newItems.length : newItems.length),
        page: data.metadata?.page ?? params.page,
        pageSize: data.metadata?.pageSize ?? params.pageSize,
        totalPages: data.metadata?.totalPages ?? 1,
      }));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load invoices";
      set({ invoicesError: message, invoicesLoading: false });
    }
  },

  addInvoice: async (invoice) => {
    await putCollectionDocument("invoices", invoice.id, invoice);
    set((state) => ({ invoices: [invoice, ...state.invoices] }));
    queuePaymentReminderSync(invoice);
  },

  getNextInvoiceNumber: () => {
    const all = get().invoices;
    const maxNum = all.reduce((max, inv) => {
      const match = inv.invoiceNumber.match(/INV-\d{4}-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `INV-2026-${String(maxNum + 1).padStart(4, "0")}`;
  },

  updateInvoice: async (id, updates) => {
    const prev = get().invoices.find((i) => i.id === id);
    if (!prev) return;
    const next = { ...prev, ...updates };
    await putCollectionDocument("invoices", id, next);
    set((state) => ({
      invoices: state.invoices.map((inv) => (inv.id === id ? next : inv)),
    }));
    queuePaymentReminderSync(next);
  },

  deleteInvoice: async (id) => {
    await deleteCollectionDocument("invoices", id);
    set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) }));
  },

  recordPayment: async (invoiceId, payment, options, walletAmountUsed = 0) => {
    void options.performedBy;
    const inv = get().invoices.find((i) => i.id === invoiceId);
    if (!inv) return { ok: false, inventoryError: "Invoice not found" };

    const newPayment: Payment = {
      ...payment,
      id: payment.id ?? `pay-${Date.now()}`,
      invoiceId,
    } as any;
    const payments = [...inv.payments, newPayment];
    const updatedWalletAmount = Math.round(((inv.walletAmountUsed || 0) + walletAmountUsed) * 100) / 100;
    const next = {
      ...inv,
      payments,
      walletAmountUsed: updatedWalletAmount,
      storedPdf: undefined,
    };
    const status = computeInvoiceStatus(next, payments);
    next.status = status;

    await putCollectionDocument("invoices", invoiceId, next);
    set((state) => ({
      invoices: state.invoices.map((i) => (i.id === invoiceId ? next : i)),
    }));
    queuePaymentReminderSync(next);
    return { ok: true };
  },
}));
