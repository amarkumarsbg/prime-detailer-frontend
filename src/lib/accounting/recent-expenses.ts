import { expenseOutstanding, expensePaidAmount } from "@/lib/party/ledger-math";
import type { Expense, ProductPurchase } from "@/types";

export type RecentExpenseRow = {
  expense: Expense;
  displayDate: string;
  displayAmount: number;
  dueAmount: number;
  displayPaymentStatus: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE";
  displayPaymentMethod: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildRecentExpenseRows(
  expenses: Expense[],
  purchases: ProductPurchase[],
  limit = 6
): RecentExpenseRow[] {
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));

  const rows: RecentExpenseRow[] = expenses.map((expense) => {
    const purchase = expense.purchaseId ? purchaseById.get(expense.purchaseId) : undefined;
    const payments = purchase?.payments ?? [];

    if (payments.length > 0) {
      const latest = [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
      const paidTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));
      const billTotal = round2(purchase?.grandTotal ?? expense.amount);
      const dueAmount = Math.max(0, round2(billTotal - paidTotal));
      const displayPaymentStatus =
        dueAmount <= 0.01 ? "PAID" : paidTotal > 0.01 ? "PARTIAL" : "PENDING";

      return {
        expense,
        displayDate: latest?.paidAt ?? expense.date,
        displayAmount: round2(latest?.amount ?? 0),
        dueAmount,
        displayPaymentStatus,
        displayPaymentMethod: latest?.method ?? expense.paymentMethod,
      };
    }

    const paidAmount = purchase ? round2(purchase.amountPaid ?? 0) : round2(expensePaidAmount(expense));
    const dueAmount = purchase
      ? Math.max(0, round2((purchase.grandTotal ?? expense.amount) - paidAmount))
      : round2(expenseOutstanding(expense));

    return {
      expense,
      displayDate: expense.date,
      displayAmount: paidAmount,
      dueAmount,
      displayPaymentStatus: expense.paymentStatus,
      displayPaymentMethod: expense.paymentMethod,
    };
  });

  return rows
    .sort(
      (a, b) =>
        b.displayDate.localeCompare(a.displayDate) ||
        b.expense.createdAt.localeCompare(a.expense.createdAt)
    )
    .slice(0, limit);
}
