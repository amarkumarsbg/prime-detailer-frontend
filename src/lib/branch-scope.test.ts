/**
 * Tests for computeBranchScopedDashboardStats — specifically Fix 4:
 * totalExpensesToday must use CASH basis (expensePaidAmount), not accrual.
 */
import { describe, expect, it } from "vitest";
import { computeBranchScopedDashboardStats } from "./branch-scope";
import type { DashboardStats, Expense, Invoice } from "@/types";

const EMPTY_STATS: DashboardStats = {
  averageRating: 0,
  carsReceivedToday: 0,
  carsDeliveredToday: 0,
  inProgressServices: 0,
  dailyRevenue: 0,
  totalExpensesToday: 0,
  netProfitToday: 0,
  newCustomersToday: 0,
  inactiveCustomers: 0,
  activeJobCards: 0,
  pendingPayments: 0,
  monthlyRevenue: [],
  serviceBreakdown: [],
  todaysBookings: [],
  readyForDelivery: [],
};

const TODAY = new Date().toISOString().slice(0, 10);

function paidExpenseToday(amount: number): Expense {
  return {
    id: "exp-paid",
    title: "Paid expense",
    category: "SUPPLIES",
    amount,
    amountPaid: amount,
    date: TODAY,
    vendorName: "V",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    createdBy: "u1",
    createdByName: "Staff",
    branchId: "br-main",
    createdAt: `${TODAY}T09:00:00.000Z`,
  };
}

function pendingExpenseToday(amount: number): Expense {
  return {
    id: "exp-pending",
    title: "Pending expense",
    category: "SUPPLIES",
    amount,
    amountPaid: undefined,
    date: TODAY,
    vendorName: "V",
    paymentStatus: "PENDING",
    paymentMethod: "CASH",
    createdBy: "u1",
    createdByName: "Staff",
    branchId: "br-main",
    createdAt: `${TODAY}T09:00:00.000Z`,
  };
}

function paidExpenseYesterday(amount: number): Expense {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yDate = yesterday.toISOString().slice(0, 10);
  return {
    id: "exp-yesterday",
    title: "Yesterday expense",
    category: "SUPPLIES",
    amount,
    amountPaid: amount,
    date: yDate,
    vendorName: "V",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    createdBy: "u1",
    createdByName: "Staff",
    branchId: "br-main",
    createdAt: `${yDate}T09:00:00.000Z`,
  };
}

function invoiceWithTodayPayment(amount: number): Invoice {
  return {
    id: "inv-today",
    invoiceNumber: "INV-001",
    jobCardId: "jc-1",
    jobNumber: "JC-001",
    customerId: "c-1",
    customerName: "Customer",
    customerPhone: "9000000000",
    vehicleRegNumber: "DL01",
    lineItems: [],
    subtotal: amount,
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal: amount,
    status: "PAID",
    payments: [
      {
        id: "pay-1",
        invoiceId: "inv-today",
        amount,
        method: "CASH",
        paidAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    branchId: "br-main",
  } as Invoice;
}

describe("computeBranchScopedDashboardStats — cash-basis expenses (Fix 4)", () => {
  it("Scenario 1: paid expense reduces net profit", () => {
    const invoices = [invoiceWithTodayPayment(10000)];
    const expenses = [paidExpenseToday(3000)];
    const stats = computeBranchScopedDashboardStats([], invoices, expenses, [], null, EMPTY_STATS);
    expect(stats.dailyRevenue).toBe(10000);
    expect(stats.totalExpensesToday).toBe(3000);
    expect(stats.netProfitToday).toBe(7000);
  });

  it("Scenario 2: PENDING expense does NOT reduce cash profit", () => {
    const invoices = [invoiceWithTodayPayment(10000)];
    const expenses = [pendingExpenseToday(3000)];
    const stats = computeBranchScopedDashboardStats([], invoices, expenses, [], null, EMPTY_STATS);
    expect(stats.dailyRevenue).toBe(10000);
    // Unpaid expense must NOT appear in today's cash expenses
    expect(stats.totalExpensesToday).toBe(0);
    expect(stats.netProfitToday).toBe(10000);
  });

  it("Scenario 3: yesterday's paid expense does NOT reduce today's profit", () => {
    const invoices = [invoiceWithTodayPayment(10000)];
    const expenses = [paidExpenseYesterday(3000)];
    const stats = computeBranchScopedDashboardStats([], invoices, expenses, [], null, EMPTY_STATS);
    expect(stats.dailyRevenue).toBe(10000);
    expect(stats.totalExpensesToday).toBe(0);
    expect(stats.netProfitToday).toBe(10000);
  });
});
