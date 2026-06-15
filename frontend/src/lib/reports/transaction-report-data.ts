import type { Invoice, Expense, ProductPurchase, Part } from "@/types";
import type { CashBankAccount, CashBankTransaction } from "@/store/cash-bank-store";
import { dateInPreset } from "@/lib/reports/report-period-presets";
import { invoicePaidTotal } from "@/lib/party/ledger-math";

export type BillWiseProfitRow = {
  date: string;
  invoiceNumber: string;
  partyName: string;
  invoiceAmount: number;
  salesAmount: number;
  purchaseAmount: number;
  profit: number;
};

export function buildBillWiseProfitRows(
  invoices: Invoice[],
  period: string,
  partyCustomerId: string
): BillWiseProfitRow[] {
  return invoices
    .filter(
      (inv) =>
        inv.status !== "DRAFT" &&
        dateInPreset(inv.createdAt, period) &&
        (partyCustomerId === "all" || inv.customerId === partyCustomerId)
    )
    .map((inv) => {
      const purchaseAmount = inv.lineItems
        .filter((li) => li.type === "PARTS")
        .reduce((s, li) => s + (li.total ?? 0), 0);
      const salesAmount = inv.subtotal ?? 0;
      const profit = Math.round((salesAmount - purchaseAmount) * 100) / 100;
      return {
        date: inv.createdAt,
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.customerName,
        invoiceAmount: inv.grandTotal,
        salesAmount,
        purchaseAmount,
        profit,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export type DaybookRow = {
  date: string;
  partyName: string;
  txnType: string;
  txnNo: string;
  totalAmount: number;
  moneyIn: number;
  moneyOut: number;
  balanceAmount: number;
};

type DaybookEntry = {
  at: string;
  partyName: string;
  txnType: string;
  txnNo: string;
  moneyIn: number;
  moneyOut: number;
};

function cashBankTxnType(row: CashBankTransaction): string {
  if (row.rowType === "TRANSFER_IN" || row.rowType === "TRANSFER_OUT") return "Contra";
  if (row.rowType === "OPENING" || row.rowType === "ADJUST_ADD" || row.rowType === "ADJUST_REDUCE") {
    return "Journal";
  }
  if ((row.received ?? 0) > 0) return "Receipt";
  if ((row.paid ?? 0) > 0) return "Payment";
  return "Journal";
}

export function buildDaybookRows(
  invoices: Invoice[],
  expenses: Expense[],
  cashTxns: CashBankTransaction[],
  period: string,
  txnTypeFilter: string
): { rows: DaybookRow[]; netAmount: number } {
  const entries: DaybookEntry[] = [];

  for (const inv of invoices) {
    if (inv.status === "DRAFT") continue;
    for (const p of inv.payments) {
      if (!dateInPreset(p.paidAt, period)) continue;
      entries.push({
        at: p.paidAt,
        partyName: inv.customerName,
        txnType: "Receipt",
        txnNo: p.referenceNumber ?? p.id,
        moneyIn: p.amount,
        moneyOut: 0,
      });
    }
  }

  for (const e of expenses) {
    if (!dateInPreset(e.date, period)) continue;
    const paid =
      e.paymentStatus === "PAID" ? e.amount : e.paymentStatus === "PARTIAL" ? (e.amountPaid ?? 0) : 0;
    if (paid > 0) {
      entries.push({
        at: `${e.date}T12:00:00.000Z`,
        partyName: e.vendorName ?? e.title,
        txnType: "Payment",
        txnNo: e.id,
        moneyIn: 0,
        moneyOut: paid,
      });
    }
  }

  for (const t of cashTxns) {
    const at = `${t.date}T12:00:00.000Z`;
    if (!dateInPreset(at, period)) continue;
    const type = cashBankTxnType(t);
    entries.push({
      at,
      partyName: t.party ?? "—",
      txnType: type,
      txnNo: t.txnNo ?? t.id,
      moneyIn: t.received ?? 0,
      moneyOut: t.paid ?? 0,
    });
  }

  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  let balance = 0;
  let netIn = 0;
  let netOut = 0;
  const rows: DaybookRow[] = [];

  for (const e of entries) {
    if (txnTypeFilter !== "All Transactions" && e.txnType !== txnTypeFilter) continue;
    balance += e.moneyIn - e.moneyOut;
    netIn += e.moneyIn;
    netOut += e.moneyOut;
    rows.push({
      date: e.at,
      partyName: e.partyName,
      txnType: e.txnType,
      txnNo: e.txnNo,
      totalAmount: Math.round((e.moneyIn + e.moneyOut) * 100) / 100,
      moneyIn: e.moneyIn,
      moneyOut: e.moneyOut,
      balanceAmount: Math.round(balance * 100) / 100,
    });
  }

  return { rows, netAmount: Math.round((netIn - netOut) * 100) / 100 };
}

export type PurchaseSummaryRow = {
  purchaseNo: string;
  originalInvoiceNo: string;
  purchaseDate: string;
  partyName: string;
  purchaseAmount: number;
  notes: string;
};

export function buildPurchaseSummaryRows(
  purchases: ProductPurchase[],
  parts: Part[],
  period: string
): PurchaseSummaryRow[] {
  return purchases
    .filter((p) => dateInPreset(p.purchasedAt, period))
    .map((p) => {
      const part = parts.find((x) => x.id === p.partId);
      const litres = p.quantityMl / 1000;
      const unitCost = p.unitCost ?? part?.unitPrice ?? 0;
      const amount = Math.round(litres * unitCost * 100) / 100;
      return {
        purchaseNo: p.reference ?? p.id,
        originalInvoiceNo: "—",
        purchaseDate: p.purchasedAt,
        partyName: p.vendorName,
        purchaseAmount: amount,
        notes: part?.name ?? "",
      };
    })
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
}

export type CashBankReportRow = {
  date: string;
  voucherType: string;
  txnNo: string;
  party: string;
  paid: number;
  received: number;
  balance: number;
  notes: string;
};

export function buildCashBankReportRows(
  accounts: CashBankAccount[],
  transactions: CashBankTransaction[],
  period: string,
  accountFilter: string,
  txnTypeFilter: string
): { rows: CashBankReportRow[]; totalPaid: number; totalReceived: number; closingBalance: number } {
  const account =
    accountFilter === "all"
      ? null
      : accounts.find((a) => a.id === accountFilter || a.displayName === accountFilter);

  const filtered = transactions
    .filter((t) => {
      const at = `${t.date}T12:00:00.000Z`;
      if (!dateInPreset(at, period)) return false;
      if (account && t.accountId !== account.id) return false;
      if (txnTypeFilter !== "All Transactions") {
        const type = cashBankTxnType(t);
        if (type !== txnTypeFilter) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalPaid = 0;
  let totalReceived = 0;
  const rows: CashBankReportRow[] = filtered.map((t) => {
    const paid = t.paid ?? 0;
    const received = t.received ?? 0;
    totalPaid += paid;
    totalReceived += received;
    return {
      date: t.date,
      voucherType: cashBankTxnType(t),
      txnNo: t.txnNo ?? t.id,
      party: t.party ?? "—",
      paid,
      received,
      balance: t.balanceAfter,
      notes: t.notes ?? "",
    };
  });

  const closingBalance = rows.length > 0 ? rows[rows.length - 1]!.balance : account?.balance ?? 0;

  return {
    rows,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    closingBalance,
  };
}

export function accountFilterOptions(accounts: CashBankAccount[]): { value: string; label: string }[] {
  return [
    { value: "all", label: "All bank accounts" },
    ...accounts.map((a) => ({
      value: a.id,
      label:
        a.type === "cash"
          ? a.displayName
          : `${a.bankMeta?.bankName ?? "Bank"} ${a.accountNumberDisplay ?? a.bankMeta?.accountNumber?.slice(-4) ?? ""}`.trim(),
    })),
  ];
}

export type ExpenseCategoryRow = {
  category: string;
  totalAmount: number;
};

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SUPPLIES: "Consumables",
  MARKETING: "Marketing",
  MAINTENANCE: "Maintenance",
  STAFF: "Staff welfare",
};

export function expenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}

export function buildExpenseCategoryRows(expenses: Expense[], period: string): ExpenseCategoryRow[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (!dateInPreset(e.date, period)) continue;
    const key = expenseCategoryLabel(e.category);
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, totalAmount]) => ({
      category,
      totalAmount: Math.round(totalAmount * 100) / 100,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function expenseCategoryFilterOptions(expenses: Expense[]): string[] {
  const cats = new Set<string>(["All Expense Categories"]);
  for (const e of expenses) {
    cats.add(expenseCategoryLabel(e.category));
  }
  return [...cats];
}

export type ExpenseTransactionRow = {
  date: string;
  expenseNumber: string;
  category: string;
  paymentMode: string;
  totalAmount: number;
};

export function buildExpenseTransactionRows(
  expenses: Expense[],
  period: string,
  categoryFilter: string
): ExpenseTransactionRow[] {
  return expenses
    .filter((e) => {
      if (!dateInPreset(e.date, period)) return false;
      if (categoryFilter === "All Expense Categories") return true;
      return expenseCategoryLabel(e.category) === categoryFilter;
    })
    .map((e) => ({
      date: e.date,
      expenseNumber: e.id,
      category: expenseCategoryLabel(e.category),
      paymentMode: e.paymentMethod.replace(/_/g, " "),
      totalAmount: e.amount,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function uniqueInvoiceCustomers(invoices: Invoice[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const inv of invoices) {
    if (!map.has(inv.customerId)) map.set(inv.customerId, inv.customerName);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
