import { describe, expect, it } from "vitest";
import {
  invoiceRevenueInPeriod,
  paymentMethodBreakdownForPeriod,
  recognizedExpenseAmount,
  sumPurchasePaymentsInPeriod,
  totalIncomeReceipts,
  totalAdvanceReceipts,
  totalExpenseAmount,
  totalExpenseCashOutInPeriod,
  filterJobCardsByAdvanceDate,
  totalPayables,
} from "@/lib/accounting/dashboard-metrics";
import { expenseOutstanding, expensePaidAmount } from "@/lib/party/ledger-math";
import { purchaseDue } from "@/lib/inventory/purchase-math";
import type { Expense, Invoice, JobCard, ProductPurchase } from "@/types";

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

function jobCardAdvance(
  id: string,
  status: JobCard["status"],
  amount: number,
  collectedAt = "2026-08-10T10:00:00.000Z"
): JobCard {
  return {
    id,
    jobNumber: `JC-${id}`,
    branchId: "br-1",
    customerId: "c-1",
    customerName: "Customer",
    customerPhone: "9000000000",
    vehicleId: "v-1",
    vehicleRegNumber: "DL01AA0001",
    vehicleMakeModel: "Car",
    vehicleSegment: "SEDAN",
    status,
    reportedIssues: "",
    expectedDelivery: "2026-08-10T18:00:00.000Z",
    services: [],
    estimatedAmount: 0,
    incentivePercent: 0,
    incentiveAmount: 0,
    highEndAdvanceAmountInr: amount,
    highEndAdvanceCollectedAt: collectedAt,
    createdBy: "u1",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: collectedAt,
  };
}

describe("totalExpenseCashOutInPeriod", () => {
  const filter = { kind: "custom" as const, start: "2026-08-01", end: "2026-08-31" };

  it("counts only the partial payment, not the full bill", () => {
    const purchases = [
      purchase(70, 10, [
        {
          id: "pay-1",
          amount: 10,
          method: "CASH",
          paidAt: "2026-08-10T10:00:00.000Z",
        },
      ]),
    ];
    const expenses = [purchaseExpense(70, 10)];
    expect(totalExpenseCashOutInPeriod(expenses, purchases, filter)).toBe(10);
    expect(totalExpenseAmount(expenses)).toBe(70);
  });

  it("counts legacy purchase amountPaid when payments[] is empty", () => {
    const purchases = [purchase(5900, 5900, [])];
    const expenses = [purchaseExpense(5900, 5900)];
    expect(totalExpenseCashOutInPeriod(expenses, purchases, filter)).toBe(5900);
  });

  it("falls back to linked expense when purchase is out of scope", () => {
    const expenses = [purchaseExpense(5900, 5900)];
    expect(totalExpenseCashOutInPeriod(expenses, [], filter)).toBe(5900);
  });

  it("does not double-count when purchase already has cash recorded", () => {
    const purchases = [purchase(5900, 5900, [])];
    const expenses = [purchaseExpense(5900, 5900)];
    expect(totalExpenseCashOutInPeriod(expenses, purchases, filter)).toBe(5900);
  });
});

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

describe("cancelled jobs in advance income", () => {
  const filter = { kind: "custom" as const, start: "2026-08-01", end: "2026-08-31" };

  it("excludes cancelled job advances from total receipts", () => {
    const rows = [
      jobCardAdvance("1", "RECEIVED", 1500),
      jobCardAdvance("2", "CANCELLED", 2500),
    ];

    expect(totalAdvanceReceipts(rows)).toBe(1500);
  });

  it("excludes cancelled jobs from date-filtered advance rows", () => {
    const rows = [
      jobCardAdvance("1", "READY", 1500),
      jobCardAdvance("2", "CANCELLED", 2500),
    ];

    expect(filterJobCardsByAdvanceDate(rows, filter).map((row) => row.id)).toEqual(["1"]);
  });
});

// ---------------------------------------------------------------------------
// Fix 2: otherIncome breakdown — Cash + Online + Other = Total Income
// ---------------------------------------------------------------------------

function invoiceWithPayment(
  id: string,
  grandTotal: number,
  paidAmount: number,
  method: "CASH" | "UPI" | "CARD" | "WALLET",
  paidAt = "2026-08-10T10:00:00.000Z"
): Invoice {
  const payments =
    paidAmount > 0
      ? [{ id: `pay-${id}`, invoiceId: id, amount: paidAmount, method, paidAt }]
      : [];
  return {
    id,
    invoiceNumber: `INV-${id}`,
    jobCardId: "",
    jobNumber: "Test",
    customerId: "c1",
    customerName: "Customer",
    customerPhone: "9000000000",
    vehicleRegNumber: "DL01",
    lineItems: [],
    subtotal: grandTotal,
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal,
    status: paidAmount >= grandTotal ? "PAID" : "ISSUED",
    payments,
    createdAt: paidAt,
  } as Invoice;
}

function membershipPackage() {
  return {
    id: "pkg-1",
    name: "Gold",
    price: 999,
    validityDays: 365,
    includedServiceIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function membershipSubscription(status: "ACTIVE" | "EXPIRED" | "CANCELLED" = "ACTIVE") {
  return {
    id: "sub-1",
    customerId: "c1",
    packageId: "pkg-1",
    status,
    startDate: "2026-08-12T10:00:00.000Z",
    endDate: "2027-08-12T10:00:00.000Z",
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-12T10:00:00.000Z",
  };
}

describe("paymentMethodBreakdownForPeriod — otherIncome", () => {
  const filter = { kind: "custom" as const, start: "2026-08-01", end: "2026-08-31" };

  it("otherIncome is 0 when advances and memberships are 0", () => {
    const invoices = [invoiceWithPayment("i1", 5000, 5000, "CASH")];
    const result = paymentMethodBreakdownForPeriod(invoices, [], filter);
    expect(result.otherIncome).toBe(0);
    expect(result.cashIncome + result.onlineIncome + result.otherIncome).toBe(result.cashIncome);
  });

  it("otherIncome contains advance amount passed from caller", () => {
    const invoices = [invoiceWithPayment("i1", 5000, 5000, "CASH")];
    const result = paymentMethodBreakdownForPeriod(invoices, [], filter, [], {
      advances: 1000,
      memberships: 500,
    });
    expect(result.otherIncome).toBe(1500);
    expect(result.cashIncome).toBe(5000);
    // Total Income = cashIncome + onlineIncome + otherIncome
    expect(result.cashIncome + result.onlineIncome + result.otherIncome).toBe(6500);
  });

  it("does not double-count: invoicePayments are NOT in otherIncome", () => {
    const invoices = [
      invoiceWithPayment("i1", 3000, 3000, "CASH"),
      invoiceWithPayment("i2", 2000, 2000, "UPI"),
    ];
    const result = paymentMethodBreakdownForPeriod(invoices, [], filter, [], {
      advances: 500,
      memberships: 0,
    });
    expect(result.cashIncome).toBe(3000);
    expect(result.onlineIncome).toBe(2000);
    expect(result.otherIncome).toBe(500);
    // No double-count: sum equals total
    expect(result.cashIncome + result.onlineIncome + result.otherIncome).toBe(5500);
  });

  it("wallet payments are Online Income, not Other", () => {
    const invoices = [invoiceWithPayment("i1", 1000, 1000, "WALLET")];
    const result = paymentMethodBreakdownForPeriod(invoices, [], filter);
    expect(result.onlineIncome).toBe(1000);
    expect(result.otherIncome).toBe(0);
  });
});

describe("invoice recognition in total income", () => {
  const filter = { kind: "custom" as const, start: "2026-08-01", end: "2026-08-31" };

  it("counts invoice totals even when bills are unpaid or partially paid", () => {
    const invoices = [
      invoiceWithPayment("i1", 5000, 0, "CASH"),
      { ...invoiceWithPayment("i2", 4000, 1000, "UPI"), status: "PARTIALLY_PAID" as const },
      invoiceWithPayment("i3", 3000, 3000, "CASH"),
    ];

    expect(invoiceRevenueInPeriod(invoices, filter)).toEqual({ amount: 12000, count: 3 });
  });

  it("counts billed invoices once and excludes the same job advance from income", () => {
    const packages = [membershipPackage()];
    const memberships = [membershipSubscription()];
    const advances = [jobCardAdvance("job-1", "READY", 2000)];
    const invoices = [
      {
        ...invoiceWithPayment("i1", 5000, 0, "CASH"),
        jobCardId: "job-1",
        status: "ISSUED" as const,
      },
    ];

    expect(
      totalIncomeReceipts({
        invoices,
        advances,
        memberships,
        packages,
        filter,
      })
    ).toMatchObject({
      total: 5999,
      invoiceRevenue: 5000,
      invoiceCount: 1,
      advances: 0,
      memberships: 999,
      membershipCount: 1,
    });
  });
});
