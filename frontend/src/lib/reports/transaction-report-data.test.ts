import { describe, expect, it } from "vitest";
import {
  buildExpenseCategoryRows,
  buildExpenseTransactionRows,
} from "@/lib/reports/transaction-report-data";
import type { Expense, ProductPurchase } from "@/types";

function expense(partial: Partial<Expense> & Pick<Expense, "id" | "amount" | "paymentStatus">): Expense {
  return {
    title: partial.title ?? "Expense",
    category: partial.category ?? "SUPPLIES",
    date: partial.date ?? "2026-08-18",
    paymentMethod: partial.paymentMethod ?? "CASH",
    createdBy: "u1",
    createdByName: "Staff",
    branchId: "br-1",
    createdAt: "2026-08-18T10:00:00.000Z",
    ...partial,
  };
}

function purchase(
  partial: Partial<ProductPurchase> & Pick<ProductPurchase, "id">
): ProductPurchase {
  return {
    partId: "part-1",
    vendorName: "Vendor",
    quantityMl: 0,
    purchasedAt: "2026-08-18T10:00:00.000Z",
    recordedBy: "u1",
    ...partial,
  };
}

describe("buildExpenseTransactionRows", () => {
  const period = "custom:2026-08-01:2026-08-31";

  it("uses cash paid, not full unpaid bill", () => {
    const rows = buildExpenseTransactionRows(
      [
        expense({
          id: "e1",
          title: "Purchase PUR-2026-0001",
          amount: 5900,
          amountPaid: 10,
          paymentStatus: "PARTIAL",
        }),
        expense({
          id: "e2",
          title: "Rent",
          amount: 1000,
          paymentStatus: "PENDING",
          category: "RENT",
        }),
      ],
      period,
      "All Expense Categories"
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.expenseNumber).toBe("Purchase PUR-2026-0001");
    expect(rows[0]?.totalAmount).toBe(10);
  });

  it("includes fully paid purchase-linked expenses", () => {
    const rows = buildExpenseTransactionRows(
      [
        expense({
          id: "e1",
          title: "Purchase PUR-2026-0001",
          amount: 5900,
          paymentStatus: "PAID",
          purchaseId: "pur-1",
        }),
      ],
      period,
      "All Expense Categories"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalAmount).toBe(5900);
  });

  it("splits purchase vendor payments by method (cash + UPI)", () => {
    const rows = buildExpenseTransactionRows(
      [
        expense({
          id: "e1",
          title: "Purchase PUR-2026-0001",
          amount: 100,
          amountPaid: 100,
          paymentStatus: "PAID",
          paymentMethod: "UPI",
          purchaseId: "pur-1",
        }),
      ],
      period,
      "All Expense Categories",
      [
        purchase({
          id: "pur-1",
          purchaseNumber: "PUR-2026-0001",
          amountPaid: 100,
          payments: [
            {
              id: "pay-cash",
              amount: 10,
              method: "CASH",
              paidAt: "2026-08-18T11:00:00.000Z",
            },
            {
              id: "pay-upi",
              amount: 90,
              method: "UPI",
              paidAt: "2026-08-18T11:05:00.000Z",
            },
          ],
        }),
      ]
    );

    expect(rows).toHaveLength(2);
    // Newest payment first (UPI at 11:05 before cash at 11:00)
    expect(rows.map((r) => ({ mode: r.paymentMode, amount: r.totalAmount }))).toEqual([
      { mode: "UPI", amount: 90 },
      { mode: "CASH", amount: 10 },
    ]);
  });

  it("orders same-day payments by time so the latest amount is first", () => {
    const rows = buildExpenseTransactionRows(
      [
        expense({
          id: "e1",
          title: "Purchase PUR-2026-0002",
          amount: 708,
          amountPaid: 108,
          paymentStatus: "PARTIAL",
          purchaseId: "pur-2",
        }),
      ],
      period,
      "All Expense Categories",
      [
        purchase({
          id: "pur-2",
          purchaseNumber: "PUR-2026-0002",
          amountPaid: 108,
          payments: [
            {
              id: "pay-old",
              amount: 8,
              method: "CASH",
              paidAt: "2026-08-21T08:00:00.000Z",
            },
            {
              id: "pay-latest",
              amount: 100,
              method: "CASH",
              paidAt: "2026-08-21T18:30:00.000Z",
            },
          ],
        }),
      ]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.totalAmount).toBe(100);
    expect(rows[0]?.id).toBe("pay-latest");
    expect(rows[1]?.totalAmount).toBe(8);
  });
});

describe("buildExpenseCategoryRows", () => {
  it("aggregates cash paid by category", () => {
    const rows = buildExpenseCategoryRows(
      [
        expense({
          id: "e1",
          amount: 5900,
          paymentStatus: "PAID",
          category: "SUPPLIES",
        }),
        expense({
          id: "e2",
          amount: 1000,
          amountPaid: 400,
          paymentStatus: "PARTIAL",
          category: "RENT",
        }),
      ],
      "custom:2026-08-01:2026-08-31"
    );
    expect(rows).toEqual([
      { category: "Consumables", totalAmount: 5900 },
      { category: "Rent", totalAmount: 400 },
    ]);
  });
});
