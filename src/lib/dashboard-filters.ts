import type { Customer, Invoice, JobCard, Part, ServiceReminder } from "@/types";
import { invoiceOutstanding } from "@/lib/party/ledger-math";

/** Job cards created on the current calendar day (local). */
export function isTodaysBookingsJob(jc: JobCard): boolean {
  const d = new Date(jc.createdAt);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function isReadyForDeliveryJob(jc: JobCard): boolean {
  return jc.status === "READY";
}

export function isOverdueJobCard(jc: JobCard): boolean {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const expected = new Date(jc.expectedDelivery);
  return expected < todayStart && !["DELIVERED", "CANCELLED"].includes(jc.status);
}

/** ISO timestamp for sorting the Delivery column (actual if delivered, else expected). */
export function jobCardDeliveryAt(jc: JobCard): string {
  if (jc.status === "DELIVERED") {
    return jc.actualDelivery ?? jc.updatedAt ?? jc.createdAt;
  }
  return jc.expectedDelivery ?? jc.createdAt;
}

/** Low stock: ml-tracked uses stock/reorder ml; else quantity vs reorder level. */
export function isLowStockPart(p: Part): boolean {
  if (p.stockQuantityMl != null && p.reorderLevelMl != null) {
    return p.stockQuantityMl <= p.reorderLevelMl;
  }
  return p.quantity <= p.reorderLevel;
}

export function isPendingPaymentInvoice(inv: Invoice): boolean {
  if (inv.status !== "ISSUED" && inv.status !== "PARTIALLY_PAID") return false;
  return invoiceOutstanding(inv) > 0.01;
}

export type PendingPaymentCustomer = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  outstanding: number;
  invoiceCount: number;
};

/** One row per customer who has at least one invoice with a balance due. */
export function groupPendingPaymentCustomers(invoices: Invoice[]): PendingPaymentCustomer[] {
  const map = new Map<string, PendingPaymentCustomer>();
  for (const inv of invoices.filter(isPendingPaymentInvoice)) {
    const due = invoiceOutstanding(inv);
    const existing = map.get(inv.customerId);
    if (!existing) {
      map.set(inv.customerId, {
        id: inv.customerId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        outstanding: due,
        invoiceCount: 1,
      });
    } else {
      existing.outstanding = Math.round((existing.outstanding + due) * 100) / 100;
      existing.invoiceCount += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
}

/** Due on or before end of today + 7 days; excludes completed/dismissed. */
export function isDueSoonReminder(r: ServiceReminder): boolean {
  if (r.status === "COMPLETED" || r.status === "DISMISSED") return false;
  const end = new Date();
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return new Date(r.dueDate).getTime() <= end.getTime();
}

export function isInactiveCustomer(c: Customer): boolean {
  if (!c.lastVisitDate) return true;
  const last = new Date(c.lastVisitDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  cutoff.setHours(0, 0, 0, 0);
  return last < cutoff;
}
