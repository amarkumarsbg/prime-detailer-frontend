import { describe, expect, it } from "vitest";
import {
  paymentMethodBreakdownForPeriod,
  recognizedExpenseAmount,
  sumPurchasePaymentsInPeriod,
  totalExpenseAmount,
  totalPayables,
} from "@/lib/accounting/dashboard-metrics";
import { expenseOutstanding, expensePaidAmount } from "@/lib/party/ledger-math";
import { purchaseDue } from "@/lib/inventory/purchase-math";
import type { Expense, ProductPurchase } from "@/types";

function purchaseExpense(amount: number, paid: number, purchaseId = "pur-1"): Expense {
  const paymentStatus = paid <= 0 ? "PENDING" : paid >= amount ? "PAID" : "PARTIAL";
  return {
    id: "exp-1",
    title: "Purchase PUR-1",
    category: "SUPPLIES",
    amount,
    amountPaid: paid > 0 && paid < amount ? paid : paid >= amount ? amount : undefined,
    date: "2026-08-01",
    vendorName: "Vendor A",
    paymentStatus,
    paymentMethod: "CASH",
    createdBy: "u1",
    createdByName: "Staff",
    branchId: "br-1",
    createdAt: "2026-08-01T10:00:00.000Z",
    purchaseId,
  };
}

function purchase(
  grandTotal: number,
  amountPaid: number,
  payments: ProductPurchase["payments"] = []
): ProductPurchase {
  return {
    id: "pur-1",
    partId: "part-1",
    vendorName: "Vendor A",
    quantityMl: 0,
    purchasedAt: "2026-08-01T10:00:00.000Z",
    recordedBy: "u1",
    purchaseNumber: "PUR-1",
    branchId: "br-1",
    grandTotal,
    amountPaid,
    paymentStatus: amountPaid >= grandTotal ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID",
    payments,
  };
}

describe("purchase-linked expense recognition (accrual)", () => {
  it("recognizes full bill on unpaid purchase", () => {
    const e = purchaseExpense(5900, 0);
    expect(recognizedExpenseAmount(e)).toBe(5900);
    expect(expensePaidAmount(e)).toBe(0);
    expect(expenseOutstanding(e)).toBe(5900);
  });

  it("keeps expense at full bill after partial payment", () => {
    const e = purchaseExpense(5900, 5400);
    expect(recognizedExpenseAmount(e)).toBe(5900);
    expect(expensePaidAmount(e)).toBe(5400);
    expect(expenseOutstanding(e)).toBe(500);
  });

  it("does not increase expense when second payment completes the bill", () => {
    const before = purchaseExpense(5900, 5400);
    const after = purchaseExpense(5900, 5900);
    expect(recognizedExpenseAmount(before)).toBe(5900);
    expect(recognizedExpenseAmount(after)).toBe(5900);
    expect(totalExpenseAmount([before])).toBe(5900);
    expect(totalExpenseAmount([after])).toBe(5900);
    expect(expenseOutstanding(after)).toBe(0);
  });

  it("matches vendor purchase outstanding math", () => {
    const p = purchase(5900, 5400);
    const e = purchaseExpense(5900, 5400);
    expect(purchaseDue(p)).toBe(500);
    expect(expenseOutstanding(e)).toBe(500);
  });
});

describe("paymentMethodBreakdownForPeriod", () => {
  const filter = { kind: "custom" as const, start: "2026-08-01", end: "2026-08-31" };

  it("uses purchase payment dates for cash out, not cumulative expense recognition", () => {
    const purchases = [
      purchase(5900, 5900, [
        {
          id: "pay-1",
          amount: 5400,
          method: "CASH",
          paidAt: "2026-08-10T10:00:00.000Z",
        },
        {
          id: "pay-2",
          amount: 500,
          method: "UPI",
          paidAt: "2026-08-15T10:00:00.000Z",
        },
      ]),
    ];
    const expenses = [purchaseExpense(5900, 5900)];

    const breakdown = paymentMethodBreakdownForPeriod([], expenses, filter, purchases);
    expect(sumPurchasePaymentsInPeriod(purchases, filter, "cash")).toBe(5400);
    expect(sumPurchasePaymentsInPeriod(purchases, filter, "online")).toBe(500);
    expect(breakdown.cashExpenses).toBe(5400);
    expect(breakdown.onlineExpenses).toBe(500);
  });
});

describe("totalPayables", () => {
  it("sums outstanding across purchase-linked and direct expenses", () => {
    const purchaseBill = purchaseExpense(5900, 5400);
    const direct: Expense = {
      ...purchaseBill,
      id: "exp-2",
      purchaseId: undefined,
      amount: 1000,
      amountPaid: undefined,
      paymentStatus: "PENDING",
    };
    expect(totalPayables([purchaseBill, direct])).toBe(1500);
  });
});
