"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FileBarChart,
  LineChart,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AccountingReportsPanel } from "@/components/accounting/accounting-reports-panel";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import {
  ExpenseDateRangePicker,
  formatExpenseDateFilterLabel,
  matchesExpenseDate,
  type ExpenseDateFilter,
} from "@/components/expenses/expense-date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { navDescriptionForPath } from "@/lib/nav-items";
import {
  applyBranchFilters,
  invoiceBranchId,
  resolveBranchScopeLabel,
  useBranchScope,
} from "@/lib/branch-scope";
import {
  buildIncomeExpenseTrend,
  categoryDisplayLabel,
  expensesByCategoryCashOut,
  filterExpensesByDate,
  filterInvoicesByDate,
  filterJobCardsByAdvanceDate,
  incomeSourceBreakdownFromReceipts,
  paymentMethodBreakdownForPeriod,
  pendingSalaryTotal,
  percentChange,
  previousExpenseDateFilter,
  recognizedInvoices,
  totalExpenseCashOutInPeriod,
  totalIncomeReceipts,
  totalPayables,
  totalReceivables,
} from "@/lib/accounting/dashboard-metrics";
import { invoicePaidTotal } from "@/lib/party/ledger-math";
import { buildRecentExpenseRows, type RecentExpenseRow } from "@/lib/accounting/recent-expenses";
import { useAuthStore } from "@/store/auth-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { revalidateRouteDomainData } from "@/lib/domain-route-revalidate";
import { useBranchStore } from "@/store/branch-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useCustomerStore } from "@/store/customer-store";
import { useExpenseStore } from "@/store/expense-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useMembershipStore } from "@/store/membership-store";
import { usePayrollStore } from "@/store/payroll-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { Expense, Invoice } from "@/types";
import type { LucideIcon } from "lucide-react";

const DEFAULT_DATE: ExpenseDateFilter = { kind: "preset", preset: "this_month" };
type RecentMembershipsPreset = "today" | "yesterday" | "this_week" | "this_month" | "all";

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

function expenseMethodLabel(m?: string | null): string {
  const method = (m ?? "").trim();
  if (!method) return "Unknown";
  if (method === "BANK_TRANSFER") return "Transfer";
  return method.charAt(0) + method.slice(1).toLowerCase();
}

export function AccountingDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const productPurchases = useInventoryStore((s) => s.productPurchases);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const branches = useBranchStore((s) => s.branches);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const memberships = useMembershipStore((s) => s.subscriptions);
  const packages = useMembershipStore((s) => s.packages);
  const customers = useCustomerStore((s) => s.customers);
  const cashAccounts = useCashBankStore((s) => s.accounts);
  const bootstrapRefresh = useAppBootstrapStore((s) => s.refresh);
  const bootstrapRefreshing = useAppBootstrapStore((s) => s.refreshing);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const refreshing = bootstrapRefreshing || domainRefreshing;

  const { selectedBranchId, showBranchPicker, viewingLabel } = useBranchScope();
  const branchScoped = user?.role === "BRANCH_MANAGER";

  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilter>(DEFAULT_DATE);
  const [compare, setCompare] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [recentMembershipsFilter, setRecentMembershipsFilter] =
    useState<RecentMembershipsPreset>("all");

  const jobBranch = useMemo(
    () => new Map(jobCards.map((j) => [j.id, j.branchId])),
    [jobCards]
  );

  useEffect(() => {
    if (branchScoped && user?.branchId) {
      queueMicrotask(() => setBranchFilter(user.branchId));
    }
  }, [branchScoped, user?.branchId]);

  useEffect(() => {
    if (!showBranchPicker) {
      queueMicrotask(() => setBranchFilter("all"));
    }
  }, [showBranchPicker, selectedBranchId]);

  const branchInvoices = useMemo(() => {
    const withBranch = invoices.filter((inv) => !!invoiceBranchId(inv, jobBranch));
    return applyBranchFilters(
      withBranch,
      (inv) => invoiceBranchId(inv, jobBranch),
      selectedBranchId,
      showBranchPicker,
      branchFilter
    );
  }, [invoices, jobBranch, selectedBranchId, showBranchPicker, branchFilter]);

  const branchExpenses = useMemo(
    () =>
      applyBranchFilters(
        expenses,
        (e) => e.branchId,
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [expenses, selectedBranchId, showBranchPicker, branchFilter]
  );

  const branchPurchases = useMemo(
    () =>
      applyBranchFilters(
        productPurchases,
        (p) => p.branchId ?? "",
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [productPurchases, selectedBranchId, showBranchPicker, branchFilter]
  );

  const branchJobs = useMemo(
    () =>
      applyBranchFilters(
        jobCards,
        (j) => j.branchId,
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [jobCards, selectedBranchId, showBranchPicker, branchFilter]
  );

  const branchPayroll = useMemo(
    () =>
      applyBranchFilters(
        payrollRecords,
        (r) => r.branchId,
        selectedBranchId,
        showBranchPicker,
        branchFilter
      ),
    [payrollRecords, selectedBranchId, showBranchPicker, branchFilter]
  );

  const periodInvoices = useMemo(
    () => filterInvoicesByDate(branchInvoices, dateFilter),
    [branchInvoices, dateFilter]
  );
  const periodExpenses = useMemo(
    () => filterExpensesByDate(branchExpenses, dateFilter),
    [branchExpenses, dateFilter]
  );
  const periodAdvances = useMemo(
    () => filterJobCardsByAdvanceDate(branchJobs, dateFilter),
    [branchJobs, dateFilter]
  );

  const incomeReceipts = useMemo(
    () =>
      totalIncomeReceipts({
        invoices: branchInvoices,
        advances: periodAdvances,
        jobCards: branchJobs,
        memberships,
        packages,
        filter: dateFilter,
      }),
    [branchInvoices, periodAdvances, branchJobs, memberships, packages, dateFilter]
  );
  const companyRevenue = incomeReceipts.invoiceRevenue;
  const companyRevenueCount = incomeReceipts.invoiceCount;
  // Avoid double counting: membership-origin billing is represented under invoice revenue.
  const totalIncome =
    Math.round((incomeReceipts.invoiceRevenue + incomeReceipts.advances) * 100) / 100;
  const totalExpensesAmt = useMemo(
    () => totalExpenseCashOutInPeriod(branchExpenses, branchPurchases, dateFilter),
    [branchExpenses, branchPurchases, dateFilter]
  );
  const netProfit = Math.round((totalIncome - totalExpensesAmt) * 100) / 100;
  const receivables = useMemo(() => totalReceivables(branchInvoices), [branchInvoices]);
  const payables = useMemo(() => totalPayables(branchExpenses), [branchExpenses]);
  const pendingSalaries = useMemo(() => pendingSalaryTotal(branchPayroll), [branchPayroll]);
  const openingCashBalance = useMemo(
    () => Math.round(cashAccounts.reduce((s, a) => s + a.balance, 0) * 100) / 100,
    [cashAccounts]
  );

  const expenseCategoryRows = useMemo(
    () => expensesByCategoryCashOut(branchExpenses, branchPurchases, dateFilter),
    [branchExpenses, branchPurchases, dateFilter]
  );

  const compareFilter = useMemo(
    () => (compare ? previousExpenseDateFilter(dateFilter) : null),
    [compare, dateFilter]
  );

  const compareMetrics = useMemo(() => {
    if (!compareFilter) return null;
    const prevAdvances = filterJobCardsByAdvanceDate(branchJobs, compareFilter);
    const prevReceipts = totalIncomeReceipts({
      invoices: branchInvoices,
      advances: prevAdvances,
      jobCards: branchJobs,
      memberships,
      packages,
      filter: compareFilter,
    });
    const prevIncome =
      Math.round((prevReceipts.invoiceRevenue + prevReceipts.advances) * 100) / 100;
    return {
      companyRevenue: prevReceipts.invoiceRevenue,
      income: prevIncome,
      expenses: totalExpenseCashOutInPeriod(branchExpenses, branchPurchases, compareFilter),
    };
  }, [compareFilter, branchInvoices, branchJobs, branchExpenses, branchPurchases, memberships, packages]);

  const companyRevenueDelta = compareMetrics
    ? percentChange(companyRevenue, compareMetrics.companyRevenue)
    : null;
  const incomeDelta = compareMetrics
    ? percentChange(totalIncome, compareMetrics.income)
    : null;
  const expenseDelta = compareMetrics
    ? percentChange(totalExpensesAmt, compareMetrics.expenses)
    : null;

  const payments = useMemo(
    () => paymentMethodBreakdownForPeriod(
      branchInvoices,
      branchExpenses,
      dateFilter,
      branchPurchases,
      { advances: incomeReceipts.advances, memberships: 0 }
    ),
    [branchInvoices, branchExpenses, dateFilter, branchPurchases, incomeReceipts.advances]
  );

  const trend = useMemo(
    () => buildIncomeExpenseTrend(branchInvoices, branchExpenses, dateFilter, branchPurchases),
    [branchInvoices, branchExpenses, dateFilter, branchPurchases]
  );

  const categoryData = useMemo(() => {
    return expenseCategoryRows.map((r) => ({
      name: categoryDisplayLabel(r.category),
      value: r.amount,
    }));
  }, [expenseCategoryRows]);

  const incomeSources = useMemo(
    () =>
      incomeSourceBreakdownFromReceipts({
        invoiceRevenue: incomeReceipts.invoiceRevenue,
        advances: incomeReceipts.advances,
        memberships: 0,
      }),
    [incomeReceipts.invoiceRevenue, incomeReceipts.advances]
  );

  const recentInvoices = useMemo(() => {
    return [...branchInvoices]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [branchInvoices]);

  const recentExpenses = useMemo(() => {
    return buildRecentExpenseRows(branchExpenses, branchPurchases, 6);
  }, [branchExpenses, branchPurchases]);

  const recentMemberships = useMemo(() => {
    const pkgName = new Map(packages.map((p) => [p.id, p.name]));
    const custName = new Map(customers.map((c) => [c.id, c.name]));
    const pkgPrice = new Map(packages.map((p) => [p.id, p.price]));
    return [...memberships]
      .filter((m) =>
        matchesExpenseDate(m.startDate, { kind: "preset", preset: recentMembershipsFilter })
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 6)
      .map((m) => ({
        ...m,
        packageName: pkgName.get(m.packageId) ?? "Membership",
        customerName: custName.get(m.customerId) ?? "Customer",
        amount: pkgPrice.get(m.packageId) ?? 0,
      }));
  }, [memberships, packages, customers, recentMembershipsFilter]);

  const scopeLabel = useMemo(
    () => resolveBranchScopeLabel(showBranchPicker, viewingLabel, branchFilter, branches),
    [showBranchPicker, viewingLabel, branchFilter, branches]
  );

  const dateLabel = formatExpenseDateFilterLabel(dateFilter);
  const isAllTime = dateFilter.kind === "preset" && dateFilter.preset === "all";

  const resetFilters = () => {
    setDateFilter(DEFAULT_DATE);
    setCompare(false);
    if (!branchScoped) setBranchFilter("all");
  };

  const handleCompareToggle = () => {
    if (isAllTime) {
      setDateFilter(DEFAULT_DATE);
      setCompare(true);
      return;
    }
    setCompare((v) => !v);
  };

  const handleShowFull = () => {
    setDateFilter({ kind: "preset", preset: "all" });
    setCompare(false);
  };

  const handleRefresh = async () => {
    setDomainRefreshing(true);
    try {
      await Promise.all([
        bootstrapRefresh(),
        revalidateRouteDomainData("/accounting"),
      ]);
      toast.success("Accounting data refreshed");
    } catch {
      toast.error("Could not refresh data");
    } finally {
      setDomainRefreshing(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {navDescriptionForPath("/accounting")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 sm:h-9 sm:px-3 sm:text-sm"
            onClick={() => setAddExpenseOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            Add Expense
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters — full-width date/branch on mobile so labels stay readable */}
      <div className="rounded-lg border border-border/80 bg-card p-2 shadow-sm sm:rounded-xl sm:p-4">
        <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <ExpenseDateRangePicker
            value={dateFilter}
            onChange={setDateFilter}
            className="h-9 w-full min-w-0 justify-start px-2.5 text-left text-xs sm:h-10 sm:w-[min(100%,280px)] sm:px-3 sm:text-sm"
          />

          {showBranchPicker ? (
            <Select
              value={branchFilter}
              onValueChange={setBranchFilter}
              disabled={branchScoped}
            >
              <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-xs sm:h-10 sm:w-[200px] sm:px-3 sm:text-sm">
                <Building2 className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground sm:mr-2 sm:h-4 sm:w-4" />
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {!branchScoped && <SelectItem value="all">All Branches</SelectItem>}
                {branches
                  .filter((b) => b.isActive)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="inline-flex h-9 w-full min-w-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs sm:h-10 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
              <span className="truncate font-medium">{viewingLabel}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-end lg:ml-auto">
            <Button
              type="button"
              size="sm"
              variant={compare ? "secondary" : "outline"}
              className="h-9 shrink-0 gap-1 px-2.5 text-xs sm:h-10 sm:gap-1.5 sm:px-3 sm:text-sm"
              onClick={handleCompareToggle}
              title={isAllTime ? "Compare current month to last month" : "Compare to prior period"}
              aria-label={isAllTime ? "Compare current month to last month" : "Compare to prior period"}
            >
              <LineChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Compare
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isAllTime ? "secondary" : "outline"}
              className="h-9 shrink-0 gap-1 px-2.5 text-xs sm:h-10 sm:gap-1.5 sm:px-3 sm:text-sm"
              onClick={handleShowFull}
              title="Show all time"
              aria-label="Show all time"
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Full
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 shrink-0 gap-1 px-2.5 text-xs text-muted-foreground sm:h-10 sm:gap-1 sm:px-3 sm:text-sm"
              onClick={resetFilters}
              title="Reset filters"
              aria-label="Reset filters"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-1.5 hidden text-sm text-muted-foreground sm:mt-3 sm:block">
          Showing:{" "}
          <span className="font-medium text-foreground">
            {dateLabel} • {scopeLabel}
          </span>
          {compare && compareFilter ? (
            <span className="ml-1 text-xs">(vs prior period)</span>
          ) : null}
        </p>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
          Compare checks the current date range against the immediately previous period of the same length.
        </p>
        {compare && compareFilter ? (
          <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
            Comparing vs prior period
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
            Compare uses the previous equal-length period.
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-3 md:space-y-5">
        <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 flex-nowrap scrollbar-none">
          {(
            [
              ["overview", "Overview"],
              ["invoices", "Invoices"],
              ["reports", "Reports"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "shrink-0 rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium shadow-none sm:px-4 sm:py-2.5",
                "data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-700",
                "dark:data-[state=active]:text-blue-400"
              )}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-3 md:space-y-5">
          {/* KPI row */}
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Company Revenue"
              value={companyRevenue}
              valueClass="text-emerald-600 dark:text-emerald-400"
              subtitle="Total bill value (paid + unpaid)"
              icon={TrendingUp}
              iconWrap="bg-emerald-500 text-white"
              headerBg="bg-emerald-50/90 dark:bg-emerald-950/30"
              delta={companyRevenueDelta}
              breakdownTitle="Calculation Breakdown"
              breakdownNote="Company Revenue = Non-draft invoice totals created in the selected period, regardless of payment status (paid, partially paid, or unpaid)."
              breakdown={[
                {
                  label: `Invoice Revenue (${companyRevenueCount})`,
                  amount: companyRevenue,
                  dot: "bg-emerald-500",
                },
              ]}
            />
            <MetricCard
              title="Total Expenses"
              value={totalExpensesAmt}
              valueClass="text-rose-600 dark:text-rose-400"
              subtitle="Cash paid in period"
              icon={TrendingDown}
              iconWrap="bg-rose-500 text-white"
              headerBg="bg-rose-50/90 dark:bg-rose-950/30"
              delta={expenseDelta}
              deltaInvert
              breakdownTitle="Calculation Breakdown"
              breakdownNote="Total Expenses = vendor purchase payments + standalone expense amounts actually paid in this period (not the full unpaid bill). Outstanding bills stay under Payables."
              breakdown={
                expenseCategoryRows.length > 0
                  ? expenseCategoryRows.map((r) => ({
                      label: categoryDisplayLabel(r.category),
                      amount: r.amount,
                      dot: "bg-rose-500",
                    }))
                  : [{ label: "No expenses paid", amount: 0, dot: "bg-muted-foreground" }]
              }
            />
            <MetricCard
              title="Net Profit (Cash Basis)"
              value={netProfit}
              valueClass="text-blue-600 dark:text-blue-400"
              subtitle="Income and expenses counted when money is received / paid"
              icon={Activity}
              iconWrap="bg-blue-500 text-white"
              headerBg="bg-blue-50/90 dark:bg-blue-950/30"
              breakdownTitle="Calculation Breakdown"
              breakdown={[
                { label: "Total Income", amount: totalIncome, dot: "bg-emerald-500" },
                {
                  label: "Total Expenses",
                  amount: -totalExpensesAmt,
                  dot: "bg-rose-500",
                },
              ]}
            />
            <MetricCard
              title="Receivables"
              value={receivables}
              valueClass="text-orange-600 dark:text-orange-400"
              subtitle="Unpaid invoices"
              icon={CreditCard}
              iconWrap="bg-orange-500 text-white"
              headerBg="bg-orange-50/90 dark:bg-orange-950/30"
              onCardClick={() => setTab("invoices")}
              breakdownTitle="Calculation Breakdown"
              breakdown={[
                { label: "Unpaid Invoices", amount: receivables, dot: "bg-orange-500" },
                {
                  label: "Pending Stock Transfers (Out)",
                  amount: 0,
                  dot: "bg-muted-foreground",
                },
              ]}
            />
            <MetricCard
              title="Payables"
              value={Math.round((payables + pendingSalaries) * 100) / 100}
              valueClass="text-violet-600 dark:text-violet-400"
              subtitle="Pending payments"
              icon={Wallet}
              iconWrap="bg-violet-500 text-white"
              headerBg="bg-violet-50/90 dark:bg-violet-950/30"
              onCardClick={() => router.push("/expenses")}
              breakdownTitle="Calculation Breakdown"
              breakdown={[
                { label: "Pending Expenses", amount: payables, dot: "bg-violet-500" },
                { label: "Pending Salaries", amount: pendingSalaries, dot: "bg-pink-500" },
                {
                  label: "Pending Stock Transfers (In)",
                  amount: 0,
                  dot: "bg-muted-foreground",
                },
              ]}
            />
            <MetricCard
              title="Pending Salaries"
              value={pendingSalaries}
              valueClass="text-pink-600 dark:text-pink-400"
              subtitle="Staff payments due"
              icon={Users}
              iconWrap="bg-pink-500 text-white"
              headerBg="bg-pink-50/90 dark:bg-pink-950/30"
              onCardClick={() => router.push("/payroll")}
              breakdownTitle="Calculation Breakdown"
              breakdown={[
                {
                  label: "Payroll due (Pending / Processing)",
                  amount: pendingSalaries,
                  dot: "bg-pink-500",
                },
              ]}
            />
          </div>

          {/* Payment method breakdown */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Payment Method Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PastelStat
                label="Cash Income"
                value={payments.cashIncome}
                subtitle="Revenue in cash"
                icon={Wallet}
                tone="emerald"
              />
              <PastelStat
                label="Online Income"
                value={payments.onlineIncome}
                subtitle="UPI, Card, Wallet, etc."
                icon={CreditCard}
                tone="blue"
              />
              {payments.otherIncome > 0 && (
                <PastelStat
                  label="Other Income"
                  value={payments.otherIncome}
                  subtitle="Unbilled advances"
                  icon={Activity}
                  tone="amber"
                />
              )}
              <PastelStat
                label="Cash Expenses"
                value={payments.cashExpenses}
                subtitle="Paid in cash"
                icon={Wallet}
                tone="rose"
              />
              <PastelStat
                label="Online Expenses"
                value={payments.onlineExpenses}
                subtitle="UPI, Card, Transfer, etc."
                icon={CreditCard}
                tone="violet"
              />
              <PastelStat
                label="Net Cash Flow"
                value={payments.netCashFlow}
                subtitle={`In: ${formatCurrency(payments.cashIncome)} Out: ${formatCurrency(payments.cashExpenses)}`}
                icon={Wallet}
                tone="amber"
                className="sm:col-span-2"
              />
              <PastelStat
                label="Net Online Flow"
                value={payments.netOnlineFlow}
                subtitle={`In: ${formatCurrency(payments.onlineIncome)} Out: ${formatCurrency(payments.onlineExpenses)}`}
                icon={CreditCard}
                tone="sky"
                className="sm:col-span-2"
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Quick Actions</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAction
                icon={Plus}
                label="Add Expense"
                onClick={() => setAddExpenseOpen(true)}
              />
              <QuickAction
                icon={Users}
                label="Manage Salary"
                href="/payroll"
              />
              <QuickAction
                icon={ShoppingBag}
                label="Manage Vendors"
                href="/vendors"
              />
              <QuickAction
                icon={FileBarChart}
                label="View Reports"
                onClick={() => setTab("reports")}
              />
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="income-expense-trend" className="scroll-mt-24 border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Income vs Expense Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] pt-1">
                {trend.length === 0 ? (
                  <EmptyBlock label="No income or expense data for this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(typeof value === "number" ? value : Number(value) || 0)
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                      <Bar
                        dataKey="expense"
                        name="Expense"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card id="expense-category-chart" className="scroll-mt-24 border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Expense Breakdown by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] pt-1">
                {categoryData.length === 0 ? (
                  <EmptyBlock label="No expenses in this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="48%"
                        outerRadius={95}
                        label={false}
                      >
                        {categoryData.map((row, i) => (
                          <Cell
                            key={row.name}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(typeof value === "number" ? value : Number(value) || 0)
                        }
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-xs text-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent tables */}
          <div className="grid gap-4 xl:grid-cols-3">
            <RecentInvoicesTable
              rows={recentInvoices}
              onViewAll={() => router.push("/billing")}
            />
            <RecentExpensesTable
              rows={recentExpenses}
              onViewAll={() => router.push("/expenses")}
            />
            <RecentMembershipsTable
              rows={recentMemberships}
              filter={recentMembershipsFilter}
              onFilterChange={setRecentMembershipsFilter}
              onViewAll={() => router.push("/membership")}
            />
          </div>

          {/* Income source breakdown */}
          <Card
            id="income-source-breakdown"
            className="scroll-mt-24 border-border/70 shadow-sm"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Income Source Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {incomeSources.total <= 0 ? (
                <EmptyBlock label="No income sources for this period" />
              ) : (
                incomeSources.sources.map((s) => (
                  <div key={s.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(s.amount)}{" "}
                        <span className="text-foreground">({s.percent.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-[width]"
                        style={{ width: `${Math.min(100, Math.max(0, s.percent))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-0 space-y-3 md:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Invoice data from Billing — open any row for full detail.
            </p>
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/billing">Open Billing</Link>
            </Button>
          </div>
          <Card className="border-border/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recognizedInvoices(branchInvoices).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    [...recognizedInvoices(branchInvoices)]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 25)
                      .map((inv) => (
                        <InvoiceTableRow key={inv.id} inv={inv} />
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-0 space-y-3 md:space-y-4">
          <AccountingReportsPanel
            invoices={periodInvoices}
            expenses={periodExpenses}
            periodIncome={totalIncome}
            periodExpenseCashOut={totalExpensesAmt}
            expenseCategoryRows={expenseCategoryRows}
            cashInflow={payments.cashIncome + payments.onlineIncome}
            cashOutflow={totalExpensesAmt}
            openingCashBalance={openingCashBalance}
          />
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">Browse full Reports hub</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <AddExpenseDialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen} />
    </div>
  );
}

function MetricCard({
  title,
  value,
  valueClass,
  subtitle,
  icon: Icon,
  iconWrap,
  headerBg,
  delta,
  deltaInvert,
  breakdown,
  breakdownTitle = "Calculation Breakdown",
  breakdownNote,
  defaultOpen = false,
  onCardClick,
}: {
  title: string;
  value: number;
  valueClass: string;
  subtitle: string;
  icon: LucideIcon;
  iconWrap: string;
  headerBg: string;
  delta?: number | null;
  deltaInvert?: boolean;
  breakdown?: { label: string; amount: number; dot: string }[];
  breakdownTitle?: string;
  breakdownNote?: string;
  defaultOpen?: boolean;
  onCardClick?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border-border/70 bg-card p-0 shadow-sm gap-0">
      <div className={cn("p-4 sm:p-5", headerBg)}>
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className={cn("min-w-0 space-y-1 text-left", onCardClick && "cursor-pointer")}
            onClick={onCardClick}
          >
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight", valueClass)}>
              {formatCurrency(value)}
            </p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
            {delta != null ? (
              <p
                className={cn(
                  "text-[11px] font-medium",
                  (deltaInvert ? delta <= 0 : delta >= 0)
                    ? "text-emerald-600"
                    : "text-rose-600"
                )}
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs prior
              </p>
            ) : null}
          </button>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              iconWrap
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>

      {breakdown && breakdown.length > 0 ? (
        <div className="border-t border-border/60 bg-card px-4 py-3 sm:px-5">
          {open ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {breakdownTitle}
              </p>
              <ul className="space-y-1.5">
                {breakdown.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", row.dot)} />
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        row.amount < 0 && "text-rose-600"
                      )}
                    >
                      {row.amount < 0
                        ? `-${formatCurrency(Math.abs(row.amount))}`
                        : formatCurrency(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              {breakdownNote ? (
                <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {breakdownNote}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Hide Breakdown
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View Breakdown
            </button>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function PastelStat({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  tone: "emerald" | "blue" | "rose" | "violet" | "amber" | "sky";
  className?: string;
}) {
  const tones: Record<typeof tone, string> = {
    emerald:
      "border-emerald-200 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/30",
    blue: "border-blue-200 bg-blue-50/90 dark:border-blue-800 dark:bg-blue-950/30",
    rose: "border-rose-200 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/30",
    violet:
      "border-violet-200 bg-violet-50/90 dark:border-violet-800 dark:bg-violet-950/30",
    amber:
      "border-amber-200 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/30",
    sky: "border-sky-200 bg-sky-50/90 dark:border-sky-800 dark:bg-sky-950/30",
  };
  const iconTone: Record<typeof tone, string> = {
    emerald: "text-emerald-400/50 dark:text-emerald-500/40",
    blue: "text-blue-400/50 dark:text-blue-500/40",
    rose: "text-rose-400/50 dark:text-rose-500/40",
    violet: "text-violet-400/50 dark:text-violet-500/40",
    amber: "text-amber-500/45 dark:text-amber-500/40",
    sky: "text-sky-400/50 dark:text-sky-500/40",
  };
  const valueTone: Record<typeof tone, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    rose: "text-rose-600 dark:text-rose-400",
    violet: "text-violet-600 dark:text-violet-400",
    amber: value < 0 ? "text-amber-800 dark:text-amber-300" : "text-amber-700 dark:text-amber-300",
    sky: "text-sky-700 dark:text-sky-300",
  };

  const display =
    value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value);

  return (
    <div
      className={cn(
        "relative min-h-[7.25rem] overflow-hidden rounded-xl border p-4 shadow-sm",
        tones[tone],
        className
      )}
    >
      <Icon
        className={cn(
          "pointer-events-none absolute right-3 top-3 h-10 w-10",
          iconTone[tone]
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      <div className="relative z-[1] pr-10">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1.5 text-2xl font-bold tabular-nums tracking-tight", valueTone[tone])}>
          {display}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-card text-sm font-medium shadow-sm transition-colors hover:bg-muted/40 hover:border-border";

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      {label}
    </button>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function statusBadgeClass(status: Invoice["status"]): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "PARTIALLY_PAID":
      return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "ISSUED":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function InvoiceTableRow({ inv }: { inv: Invoice }) {
  const paid = invoicePaidTotal(inv);
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/billing/invoices/${encodeURIComponent(inv.id)}`}
          className="font-medium text-foreground hover:underline"
        >
          {inv.invoiceNumber}
        </Link>
      </td>
      <td className="px-4 py-3 uppercase text-muted-foreground">{inv.customerName}</td>
      <td className="px-4 py-3 text-right">
        <div className="font-semibold tabular-nums">{formatCurrency(inv.grandTotal)}</div>
        <div className="text-[11px] text-muted-foreground">
          Paid: {formatCurrency(paid)}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusBadgeClass(inv.status)
          )}
        >
          {inv.status.replace(/_/g, " ")}
        </span>
      </td>
    </tr>
  );
}

function RecentInvoicesTable({
  rows,
  onViewAll,
}: {
  rows: Invoice[];
  onViewAll: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View All
        </button>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  No invoices found
                </td>
              </tr>
            ) : (
              rows.map((inv) => {
                const paid = invoicePaidTotal(inv);
                return (
                  <tr key={inv.id} className="border-t border-border/50">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/billing/invoices/${encodeURIComponent(inv.id)}`}
                        className="block max-w-[7rem] truncate text-xs font-medium hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="max-w-[6rem] truncate px-3 py-2.5 text-xs uppercase text-muted-foreground">
                      {inv.customerName}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-xs font-semibold tabular-nums">
                        {formatCurrency(inv.grandTotal)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Paid: {formatCurrency(paid)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                          statusBadgeClass(inv.status)
                        )}
                      >
                        {inv.status === "PARTIALLY_PAID" ? "PARTIAL" : inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecentExpensesTable({
  rows,
  onViewAll,
}: {
  rows: RecentExpenseRow[];
  onViewAll: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Recent Expenses</CardTitle>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View All
        </button>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  No expenses found
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const e = row.expense;
                const due = row.dueAmount;
                return (
                  <tr key={e.id} className="border-t border-border/50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {formatDate(row.displayDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="max-w-[7rem] truncate text-xs font-medium">{e.title}</div>
                      <div className="text-[10px] font-medium uppercase text-orange-600 dark:text-orange-400">
                        {row.displayPaymentStatus} • {expenseMethodLabel(row.displayPaymentMethod)}
                      </div>
                    </td>
                    <td className="max-w-[5rem] truncate px-3 py-2.5 text-xs text-muted-foreground">
                      {categoryDisplayLabel(e.category)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        -{formatCurrency(row.displayAmount)}
                      </div>
                      {due > 0 ? (
                        <div className="text-[10px] text-rose-500">
                          Due: {formatCurrency(due)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecentMembershipsTable({
  rows,
  filter,
  onFilterChange,
  onViewAll,
}: {
  rows: {
    id: string;
    startDate: string;
    packageName: string;
    customerName: string;
    amount: number;
    status: string;
  }[];
  filter: RecentMembershipsPreset;
  onFilterChange: (next: RecentMembershipsPreset) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Recent Memberships</CardTitle>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View All
        </button>
      </CardHeader>
      <div className="border-b border-border/60 px-4 py-2.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Filter by date
          </p>
          <Select value={filter} onValueChange={(value) => onFilterChange(value as RecentMembershipsPreset)}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-[150px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Plan / Customer</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">
                  No recent memberships found
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-t border-border/50">
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(m.startDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="truncate text-xs font-medium">{m.packageName}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {m.customerName}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">
                    {m.amount > 0 ? formatCurrency(m.amount) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
