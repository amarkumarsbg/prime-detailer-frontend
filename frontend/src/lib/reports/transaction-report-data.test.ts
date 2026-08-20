import { describe, expect, it } from "vitest";
import {
  buildExpenseCategoryRows,
  buildExpenseTransactionRows,
} from "@/lib/reports/transaction-report-data";
import type { Expense } from "@/types";

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
