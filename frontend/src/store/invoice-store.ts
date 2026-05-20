"use client";

import { create } from "zustand";
import type { Invoice, InvoiceStatus, Payment } from "@/types";
import { putCollectionDocument } from "@/lib/collection-sync";

interface InvoiceStore {
  invoices: Invoice[];
  addInvoice: (invoice: Invoice) => Promise<void>;
  getNextInvoiceNumber: () => string;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  recordPayment: (
    invoiceId: string,
    payment: Omit<Payment, "id"> & { id?: string },
    options: { performedBy: string }
  ) => Promise<{ ok: boolean; inventoryError?: string }>;
}

function computeInvoiceStatus(inv: Invoice, payments: Payment[]): InvoiceStatus {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
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

  recordPayment: async (invoiceId, payment, options) => {
    void options.performedBy;
    const inv = get().invoices.find((i) => i.id === invoiceId);
    if (!inv) return { ok: false, inventoryError: "Invoice not found" };

    const newPayment: Payment = {
      ...payment,
      id: payment.id ?? `pay-${Date.now()}`,
      invoiceId,
    };
    const payments = [...inv.payments, newPayment];
    const status = computeInvoiceStatus(inv, payments);
    const next = { ...inv, payments, status, storedPdf: undefined };
    await putCollectionDocument("invoices", invoiceId, next);
    set((state) => ({
      invoices: state.invoices.map((i) => (i.id === invoiceId ? next : i)),
    }));
    return { ok: true };
  },
}));
