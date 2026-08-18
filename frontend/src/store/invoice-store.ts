"use client";

import { create } from "zustand";
import type { Invoice, InvoiceStatus, Payment } from "@/types";
import { deleteCollectionDocument, putCollectionDocument } from "@/lib/collection-sync";

interface InvoiceStore {
  invoices: Invoice[];
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

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],

  addInvoice: async (invoice) => {
    await putCollectionDocument("invoices", invoice.id, invoice);
    set((state) => ({ invoices: [invoice, ...state.invoices] }));
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
    return { ok: true };
  },
}));
