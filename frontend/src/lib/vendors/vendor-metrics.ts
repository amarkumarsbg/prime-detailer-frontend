import { purchaseAmountPaid, purchaseDue, purchaseGrandTotal } from "@/lib/inventory/purchase-math";
import type { Expense, ExpenseVendorProfile, ProductPurchase } from "@/types";

export function expensePaidAmount(e: Expense): number {
  if (e.paymentStatus === "PAID") return e.amount;
  if (e.paymentStatus === "PARTIAL") return e.amountPaid ?? 0;
  return 0;
}

export function expensePayableAmount(e: Expense): number {
  if (e.paymentStatus === "PAID") return 0;
  if (e.paymentStatus === "PARTIAL") return Math.max(0, e.amount - (e.amountPaid ?? 0));
  return e.amount;
}

export function isVendorActive(profile: ExpenseVendorProfile | null): boolean {
  if (!profile) return true;
  return profile.isActive !== false;
}

export function isPurchaseOverdue(p: ProductPurchase): boolean {
  if (purchaseDue(p) <= 0.01) return false;
  if (!p.dueDate) return false;
  const due = new Date(p.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

export type VendorSummary = {
  key: string;
  vendorName: string;
  profile: ExpenseVendorProfile | null;
  purchases: ProductPurchase[];
  expenses: Expense[];
  purchaseCount: number;
  expenseCount: number;
  orderCount: number;
  purchaseVolume: number;
  expenseVolume: number;
  volume: number;
  paid: number;
  outstanding: number;
  lastAt: string | null;
  overdue: boolean;
  isActive: boolean;
};

function namesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function buildVendorSummaries(
  directory: ExpenseVendorProfile[],
  purchases: ProductPurchase[],
  expenses: Expense[]
): VendorSummary[] {
  const byKey = new Map<string, VendorSummary>();

  const ensure = (name: string, profile: ExpenseVendorProfile | null, fallbackKey: string) => {
    const k = name.trim().toLowerCase();
    const existing = byKey.get(k);
    if (existing) {
      if (profile && !existing.profile) existing.profile = profile;
      return existing;
    }
    const row: VendorSummary = {
      key: profile?.id ?? fallbackKey,
      vendorName: name.trim(),
      profile,
      purchases: [],
      expenses: [],
      purchaseCount: 0,
      expenseCount: 0,
      orderCount: 0,
      purchaseVolume: 0,
      expenseVolume: 0,
      volume: 0,
      paid: 0,
      outstanding: 0,
      lastAt: null,
      overdue: false,
      isActive: isVendorActive(profile),
    };
    byKey.set(k, row);
    return row;
  };

  for (const profile of directory) {
    const name = profile.name.trim();
    if (!name) continue;
    ensure(name, profile, profile.id);
  }

  for (const p of purchases) {
    const name = p.vendorName.trim() || "Unknown";
    const row = ensure(name, null, `purchase:${name.toLowerCase()}`);
    row.purchases.push(p);
  }

  for (const e of expenses) {
    if (e.purchaseId) continue;
    const name = e.vendorName?.trim();
    if (!name) continue;
    const row = ensure(name, null, `expense:${name.toLowerCase()}`);
    row.expenses.push(e);
  }

  for (const row of byKey.values()) {
    row.purchaseCount = row.purchases.length;
    row.expenseCount = row.expenses.length;
    row.orderCount = row.purchaseCount + row.expenseCount;
    row.purchaseVolume = row.purchases.reduce((s, p) => s + purchaseGrandTotal(p), 0);
    row.expenseVolume = row.expenses.reduce((s, e) => s + e.amount, 0);
    row.volume = row.purchaseVolume + row.expenseVolume;
    row.paid =
      row.purchases.reduce((s, p) => s + purchaseAmountPaid(p), 0) +
      row.expenses.reduce((s, e) => s + expensePaidAmount(e), 0);
    row.outstanding =
      row.purchases.reduce((s, p) => s + purchaseDue(p), 0) +
      row.expenses.reduce((s, e) => s + expensePayableAmount(e), 0);
    row.overdue = row.purchases.some(isPurchaseOverdue);
    row.isActive = isVendorActive(row.profile);

    let last = 0;
    let lastIso: string | null = null;
    for (const p of row.purchases) {
      const t = new Date(p.purchasedAt).getTime();
      if (t > last) {
        last = t;
        lastIso = p.purchasedAt;
      }
    }
    for (const e of row.expenses) {
      const t = new Date(e.date).getTime();
      if (t > last) {
        last = t;
        lastIso = e.date;
      }
    }
    row.lastAt = lastIso;
  }

  return [...byKey.values()];
}

export function vendorMatchesName(vendorName: string, other?: string | null) {
  if (!other) return false;
  return namesMatch(vendorName, other);
}
