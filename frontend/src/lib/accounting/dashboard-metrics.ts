import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { ExpenseDateFilter } from "@/components/expenses/expense-date-range-picker";
import { matchesExpenseDate } from "@/components/expenses/expense-date-range-picker";
import { expenseOutstanding, invoiceOutstanding } from "@/lib/party/ledger-math";
import type {
  CustomerMembership,
  Expense,
  ExpensePaymentMethod,
  Invoice,
  JobCard,
  MembershipPackage,
  PaymentMethod,
  PayrollRecord,
} from "@/types";

export function sumInvoicePayments(
  invoices: Invoice[],
  methods: PaymentMethod[] | "all"
): number {
  let s = 0;
  for (const inv of invoices) {
    for (const p of inv.payments) {
      if (methods === "all" || methods.includes(p.method)) s += p.amount;
    }
  }
  return Math.round(s * 100) / 100;
}

/** Payments whose paidAt falls in the date filter (actual cash receipts). */
export function sumInvoicePaymentsInPeriod(
  invoices: Invoice[],
  filter: ExpenseDateFilter,
  methods: PaymentMethod[] | "all" = "all"
): number {
  let s = 0;
  for (const inv of invoices) {
    if (inv.status === "DRAFT") continue;
    for (const p of inv.payments) {
      if (!matchesExpenseDate(p.paidAt, filter)) continue;
      if (methods === "all" || methods.includes(p.method)) s += p.amount;
    }
  }
  return Math.round(s * 100) / 100;
}

const ONLINE_INCOME: PaymentMethod[] = ["UPI", "CARD", "WALLET"];
const CASH_EXPENSE: ExpensePaymentMethod[] = ["CASH"];
const ONLINE_EXPENSE: ExpensePaymentMethod[] = ["CARD", "UPI", "BANK_TRANSFER", "OTHER"];

export function expenseAmountForMethod(e: Expense): number {
  if (e.paymentStatus === "PENDING" || e.paymentStatus === "OVERDUE") {
    return e.amount;
  }
  if (e.paymentStatus === "PARTIAL") {
    return e.amountPaid ?? 0;
  }
  return e.amount;
}

export function sumExpensesByMethods(
  expenses: Expense[],
  methods: ExpensePaymentMethod[]
): number {
  const set = new Set(methods);
  let s = 0;
  for (const e of expenses) {
    if (set.has(e.paymentMethod)) s += expenseAmountForMethod(e);
  }
  return Math.round(s * 100) / 100;
}

export function filterInvoicesByDate(invoices: Invoice[], filter: ExpenseDateFilter): Invoice[] {
  return invoices.filter((inv) => matchesExpenseDate(inv.createdAt, filter));
}

export function filterExpensesByDate(expenses: Expense[], filter: ExpenseDateFilter): Expense[] {
  return expenses.filter((e) => matchesExpenseDate(e.date, filter));
}

export function recognizedInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status !== "DRAFT");
}

export function totalInvoiceRevenue(invoices: Invoice[]): number {
  return (
    Math.round(recognizedInvoices(invoices).reduce((s, i) => s + i.grandTotal, 0) * 100) / 100
  );
}

export function totalExpenseAmount(expenses: Expense[]): number {
  return Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

export function totalReceivables(invoices: Invoice[]): number {
  return (
    Math.round(
      recognizedInvoices(invoices).reduce((s, i) => s + invoiceOutstanding(i), 0) * 100
    ) / 100
  );
}

export function totalPayables(expenses: Expense[]): number {
  return Math.round(expenses.reduce((s, e) => s + expenseOutstanding(e), 0) * 100) / 100;
}

/** Pending staff salary from payroll records not yet paid. */
export function pendingSalaryTotal(records: PayrollRecord[]): number {
  return (
    Math.round(
      records
        .filter((r) => r.status === "PENDING" || r.status === "PROCESSING")
        .reduce((s, r) => s + r.netSalary, 0) * 100
    ) / 100
  );
}

export function totalAdvanceReceipts(jobCards: JobCard[]): number {
  return (
    Math.round(jobCards.reduce((s, j) => s + (j.highEndAdvanceAmountInr ?? 0), 0) * 100) / 100
  );
}

export function filterJobCardsByAdvanceDate(
  jobCards: JobCard[],
  filter: ExpenseDateFilter
): JobCard[] {
  return jobCards.filter((j) => {
    const at = j.highEndAdvanceCollectedAt;
    if (!at || !(j.highEndAdvanceAmountInr && j.highEndAdvanceAmountInr > 0)) return false;
    return matchesExpenseDate(at, filter);
  });
}

export function membershipRevenueInPeriod(
  subscriptions: CustomerMembership[],
  packages: MembershipPackage[],
  filter: ExpenseDateFilter
): { amount: number; count: number } {
  const priceById = new Map(packages.map((p) => [p.id, p.price]));
  let amount = 0;
  let count = 0;
  for (const s of subscriptions) {
    if (s.status === "CANCELLED") continue;
    if (!matchesExpenseDate(s.startDate, filter)) continue;
    amount += priceById.get(s.packageId) ?? 0;
    count += 1;
  }
  return { amount: Math.round(amount * 100) / 100, count };
}

/**
 * Total Income from actual receipts in period:
 * invoice payments + advances + memberships. Wallet usage excluded.
 */
export function totalIncomeReceipts(args: {
  invoices: Invoice[];
  advances: JobCard[];
  memberships: CustomerMembership[];
  packages: MembershipPackage[];
  filter: ExpenseDateFilter;
}): {
  total: number;
  invoicePayments: number;
  invoicePaymentCount: number;
  advances: number;
  memberships: number;
  membershipCount: number;
} {
  const invoicePayments = sumInvoicePaymentsInPeriod(args.invoices, args.filter, "all");
  let invoicePaymentCount = 0;
  for (const inv of args.invoices) {
    if (inv.status === "DRAFT") continue;
    for (const p of inv.payments) {
      if (matchesExpenseDate(p.paidAt, args.filter)) invoicePaymentCount += 1;
    }
  }
  const advances = totalAdvanceReceipts(args.advances);
  const mem = membershipRevenueInPeriod(args.memberships, args.packages, args.filter);
  const total = Math.round((invoicePayments + advances + mem.amount) * 100) / 100;
  return {
    total,
    invoicePayments,
    invoicePaymentCount,
    advances,
    memberships: mem.amount,
    membershipCount: mem.count,
  };
}

export function expensesByCategory(expenses: Expense[]): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function categoryDisplayLabel(c: string): string {
  if (/^[A-Z_]+$/.test(c)) {
    return c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, " ");
  }
  return c;
}

export type IncomeExpenseTrendPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

function dateRangeBounds(filter: ExpenseDateFilter): { start: Date; end: Date } | null {
  const now = new Date();
  if (filter.kind === "custom") {
    return {
      start: parseISO(filter.start),
      end: parseISO(filter.end),
    };
  }
  switch (filter.preset) {
    case "today": {
      const d = startOfDayLocal(now);
      return { start: d, end: endOfDayLocal(now) };
    }
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDayLocal(y), end: endOfDayLocal(y) };
    }
    case "this_week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "last_week": {
      const ref = subWeeks(now, 1);
      return {
        start: startOfWeek(ref, { weekStartsOn: 1 }),
        end: endOfWeek(ref, { weekStartsOn: 1 }),
      };
    }
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const ref = subMonths(now, 1);
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    }
    case "all":
      return null;
    default:
      return null;
  }
}

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Previous period of equal length for Compare mode. */
export function previousExpenseDateFilter(filter: ExpenseDateFilter): ExpenseDateFilter | null {
  const bounds = dateRangeBounds(filter);
  if (!bounds) return null;
  const ms = bounds.end.getTime() - bounds.start.getTime();
  const prevEnd = new Date(bounds.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - ms);
  return {
    kind: "custom",
    start: format(prevStart, "yyyy-MM-dd"),
    end: format(prevEnd, "yyyy-MM-dd"),
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function buildIncomeExpenseTrend(
  invoices: Invoice[],
  expenses: Expense[],
  filter: ExpenseDateFilter
): IncomeExpenseTrendPoint[] {
  const recognized = recognizedInvoices(invoices);
  const bounds = dateRangeBounds(filter);

  let bucket: "day" | "week" | "month" = "day";
  if (!bounds) {
    bucket = "month";
  } else {
    const days = (bounds.end.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 90) bucket = "month";
    else if (days > 14) bucket = "week";
    else bucket = "day";
  }

  const map = new Map<string, { income: number; expense: number; sort: string }>();

  const keyFor = (iso: string): { key: string; sort: string } => {
    const d = parseISO(iso);
    if (bucket === "month") {
      return { key: format(d, "yyyy-MM"), sort: format(d, "yyyy-MM") };
    }
    if (bucket === "week") {
      const start = startOfWeek(d, { weekStartsOn: 1 });
      return { key: format(start, "yyyy-MM-dd"), sort: format(start, "yyyy-MM-dd") };
    }
    return { key: format(d, "yyyy-MM-dd"), sort: format(d, "yyyy-MM-dd") };
  };

  for (const inv of recognized) {
    const { key, sort } = keyFor(inv.createdAt);
    const prev = map.get(key) ?? { income: 0, expense: 0, sort };
    prev.income += inv.grandTotal;
    map.set(key, prev);
  }
  for (const e of expenses) {
    const { key, sort } = keyFor(e.date);
    const prev = map.get(key) ?? { income: 0, expense: 0, sort };
    prev.expense += e.amount;
    map.set(key, prev);
  }

  return [...map.entries()]
    .map(([key, v]) => {
      const sample =
        key.includes("-") && key.length === 7 ? parseISO(`${key}-01`) : parseISO(key);
      const label =
        bucket === "month"
          ? format(sample, "MMM yyyy")
          : bucket === "week"
            ? `Wk ${format(sample, "d MMM")}`
            : format(sample, "d MMM");
      return {
        key,
        label,
        income: Math.round(v.income * 100) / 100,
        expense: Math.round(v.expense * 100) / 100,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function paymentMethodBreakdown(invoices: Invoice[], expenses: Expense[]) {
  const cashIncome = sumInvoicePayments(invoices, ["CASH"]);
  const onlineIncome = sumInvoicePayments(invoices, ONLINE_INCOME);
  const cashExpenses = sumExpensesByMethods(expenses, CASH_EXPENSE);
  const onlineExpenses = sumExpensesByMethods(expenses, ONLINE_EXPENSE);
  return {
    cashIncome,
    onlineIncome,
    cashExpenses,
    onlineExpenses,
    netCashFlow: Math.round((cashIncome - cashExpenses) * 100) / 100,
    netOnlineFlow: Math.round((onlineIncome - onlineExpenses) * 100) / 100,
  };
}

/** Period-aware payment breakdown using payment paidAt for income. */
export function paymentMethodBreakdownForPeriod(
  invoices: Invoice[],
  expenses: Expense[],
  filter: ExpenseDateFilter
) {
  const cashIncome = sumInvoicePaymentsInPeriod(invoices, filter, ["CASH"]);
  const onlineIncome = sumInvoicePaymentsInPeriod(invoices, filter, ONLINE_INCOME);
  const cashExpenses = sumExpensesByMethods(expenses, CASH_EXPENSE);
  const onlineExpenses = sumExpensesByMethods(expenses, ONLINE_EXPENSE);
  return {
    cashIncome,
    onlineIncome,
    cashExpenses,
    onlineExpenses,
    netCashFlow: Math.round((cashIncome - cashExpenses) * 100) / 100,
    netOnlineFlow: Math.round((onlineIncome - onlineExpenses) * 100) / 100,
  };
}

export function incomeSourceBreakdown(invoiceRevenue: number, advanceReceipts: number) {
  const total = invoiceRevenue + advanceReceipts;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    sources: [
      {
        id: "invoice",
        label: "Invoice Revenue",
        amount: invoiceRevenue,
        percent: pct(invoiceRevenue),
      },
      {
        id: "advance",
        label: "Advance Receipts",
        amount: advanceReceipts,
        percent: pct(advanceReceipts),
      },
    ],
  };
}

export function incomeSourceBreakdownFromReceipts(parts: {
  invoicePayments: number;
  advances: number;
  memberships: number;
}) {
  const total = parts.invoicePayments + parts.advances + parts.memberships;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
  const sources = [
    {
      id: "invoice",
      label: "Invoice Revenue",
      amount: parts.invoicePayments,
      percent: pct(parts.invoicePayments),
    },
    {
      id: "advance",
      label: "Advance Receipts",
      amount: parts.advances,
      percent: pct(parts.advances),
    },
    {
      id: "membership",
      label: "Memberships",
      amount: parts.memberships,
      percent: pct(parts.memberships),
    },
  ];
  return { total, sources };
}
