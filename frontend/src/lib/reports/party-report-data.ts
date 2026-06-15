import type { Invoice } from "@/types";
import type { PartyWithBalance } from "@/types/party";
import { invoiceOutstanding, invoicePaidTotal } from "@/lib/party/ledger-math";
import { dateInPreset } from "@/lib/reports/report-period-presets";
import type {
  AgeingBucketRow,
  OutstandingPartyRow,
} from "@/lib/reports/party-outstanding-dummy";

export function buildReceivableAgeingRows(invoices: Invoice[]): AgeingBucketRow[] {
  const now = Date.now();
  const byCustomer = new Map<string, AgeingBucketRow>();

  for (const inv of invoices) {
    if (inv.status === "DRAFT" || inv.status === "PAID") continue;
    const out = invoiceOutstanding(inv);
    if (out < 0.01) continue;

    const days = Math.floor((now - new Date(inv.createdAt).getTime()) / 86_400_000);
    let row = byCustomer.get(inv.customerId);
    if (!row) {
      row = {
        id: inv.customerId,
        partyName: inv.customerName,
        byTomorrow: null,
        upcoming: null,
        totalDue: null,
        d1to15: null,
        d16to30: null,
        d30plus: null,
        totalOverdue: null,
        totalAmount: 0,
      };
      byCustomer.set(inv.customerId, row);
    }

    row.totalAmount = Math.round((row.totalAmount + out) * 100) / 100;

    if (days <= 0) {
      row.upcoming = Math.round(((row.upcoming ?? 0) + out) * 100) / 100;
      row.totalDue = Math.round(((row.totalDue ?? 0) + out) * 100) / 100;
    } else if (days <= 15) {
      row.d1to15 = Math.round(((row.d1to15 ?? 0) + out) * 100) / 100;
    } else if (days <= 30) {
      row.d16to30 = Math.round(((row.d16to30 ?? 0) + out) * 100) / 100;
    } else {
      row.d30plus = Math.round(((row.d30plus ?? 0) + out) * 100) / 100;
    }
  }

  for (const row of byCustomer.values()) {
    const overdue = (row.d1to15 ?? 0) + (row.d16to30 ?? 0) + (row.d30plus ?? 0);
    row.totalOverdue = overdue > 0 ? Math.round(overdue * 100) / 100 : null;
  }

  return [...byCustomer.values()]
    .filter((r) => r.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function buildOutstandingPartyRows(
  parties: PartyWithBalance[],
  categoryFilter: string
): OutstandingPartyRow[] {
  return parties
    .filter((p) => {
      if (categoryFilter === "all") return true;
      if (categoryFilter === "b2b") return Boolean(p.gstin?.trim());
      if (categoryFilter === "retail") return p.kind === "customer" && !p.gstin?.trim();
      return true;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? (p.kind === "customer" ? (p.gstin ? "B2B" : "Retail") : "Supplier"),
      contact: p.mobile ?? null,
      closingBalance:
        Math.abs(p.balance) < 0.01
          ? null
          : p.kind === "customer"
            ? Math.round(p.balance * 100) / 100
            : Math.round(-p.balance * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.closingBalance ?? 0) - Math.abs(a.closingBalance ?? 0));
}

export type SalesCategoryWiseRow = {
  date: string;
  invoiceNo: string;
  partySale: string;
  createdBy: string;
  dueDate: string;
  amount: number;
  balance: number;
  invoiceType: string;
  invoiceStatus: string;
};

export function buildSalesSummaryCategoryRows(
  invoices: Invoice[],
  period: string
): SalesCategoryWiseRow[] {
  return invoices
    .filter((inv) => inv.status !== "DRAFT" && dateInPreset(inv.createdAt, period))
    .map((inv) => {
      const types = [...new Set(inv.lineItems.map((li) => li.type))];
      const invoiceType =
        types.length === 1
          ? types[0] === "PARTS"
            ? "Parts"
            : types[0] === "SERVICE"
              ? "Service"
              : types[0]
          : "Mixed";
      const paid = invoicePaidTotal(inv);
      return {
        date: inv.createdAt,
        invoiceNo: inv.invoiceNumber,
        partySale: inv.customerName,
        createdBy: inv.mechanicName ?? "—",
        dueDate: "—",
        amount: inv.grandTotal,
        balance: Math.round((inv.grandTotal - paid) * 100) / 100,
        invoiceType,
        invoiceStatus: inv.status,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
