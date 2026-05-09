"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoice-store";
import { useExpenseStore } from "@/store/expense-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import type { Invoice, PaymentMethod } from "@/types";
import {
  Building2,
  FileDown,
  FileSpreadsheet,
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  CreditCard,
  FileText,
  PieChart,
} from "lucide-react";

const GST_RATE_EST = 0.18;

function invoiceBranchId(invoice: Invoice, jobBranch: Map<string, string>): string | undefined {
  return jobBranch.get(invoice.jobCardId);
}

function sumPayments(
  invoices: Invoice[],
  methods: PaymentMethod[] | "all"
): number {
  let s = 0;
  for (const inv of invoices) {
    for (const p of inv.payments) {
      if (methods === "all" || methods.includes(p.method)) s += p.amount;
    }
  }
  return s;
}

export default function AccountingPage() {
  const user = useAuthStore((s) => s.user);
  const invoices = useInvoiceStore((s) => s.invoices);
  const expenses = useExpenseStore((s) => s.expenses);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const branches = useBranchStore((s) => s.branches);

  const jobBranch = useMemo(
    () => new Map(jobCards.map((j) => [j.id, j.branchId])),
    [jobCards]
  );

  const branchScoped = user?.role === "BRANCH_MANAGER";
  const [branchFilter, setBranchFilter] = useState<string>("all");

  useEffect(() => {
    if (branchScoped && user?.branchId) {
      queueMicrotask(() => setBranchFilter(user.branchId));
    }
  }, [branchScoped, user?.branchId]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const bid = invoiceBranchId(inv, jobBranch);
      if (!bid) return false;
      if (branchFilter === "all") return true;
      return bid === branchFilter;
    });
  }, [invoices, jobBranch, branchFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => branchFilter === "all" || e.branchId === branchFilter);
  }, [expenses, branchFilter]);

  const pl = useMemo(() => {
    const recognized = filteredInvoices.filter((i) => i.status !== "DRAFT");
    const totalRevenue = recognized.reduce((s, i) => s + i.grandTotal, 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const byCategory = filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {});

    return { totalRevenue, totalExpenses, netProfit, margin, recognized, byCategory };
  }, [filteredInvoices, filteredExpenses]);

  const cash = useMemo(() => {
    const nonDraft = filteredInvoices.filter((i) => i.status !== "DRAFT");
    const cashIn = sumPayments(nonDraft, ["CASH"]);
    const onlineIn = sumPayments(nonDraft, ["UPI", "CARD", "WALLET"]);
    const totalIn = cashIn + onlineIn;
    const operatingOut = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const netOperating = totalIn - operatingOut;
    const openingBalance = 42700;
    const netChange = netOperating;
    const closingBalance = openingBalance + netChange;
    return {
      openingBalance,
      cashIn,
      onlineIn,
      totalIn,
      operatingOut,
      netOperating,
      netChange,
      closingBalance,
    };
  }, [filteredInvoices, filteredExpenses]);

  const tax = useMemo(() => {
    const nonDraft = filteredInvoices.filter((i) => i.status !== "DRAFT");
    const totalSales = nonDraft.reduce((s, i) => s + i.subtotal, 0);
    const taxCollected = nonDraft.reduce((s, i) => s + i.taxAmount, 0);
    const purchasesBase = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const inputTaxEst = purchasesBase * GST_RATE_EST;
    const netPayable = Math.max(0, taxCollected - inputTaxEst);
    return { totalSales, taxCollected, inputTaxEst, netPayable };
  }, [filteredInvoices, filteredExpenses]);

  const scopeLabel =
    branchFilter === "all"
      ? "All branches"
      : branches.find((b) => b.id === branchFilter)?.name ?? branchFilter;

  const demoExport = (kind: "pdf" | "excel") => {
    toast.success(kind === "pdf" ? "Export PDF queued (demo)." : "Export Excel queued (demo).");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Comprehensive financial summaries — Profit & Loss, cash flow, and tax."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => demoExport("pdf")}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => demoExport("excel")}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button asChild size="sm">
              <Link href="/billing" className="inline-flex items-center">
                <Receipt className="w-4 h-4 mr-2" />
                Invoices
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="flex items-center gap-2 min-w-[200px]">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select
            value={branchFilter}
            onValueChange={setBranchFilter}
            disabled={branchScoped}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {!branchScoped && <SelectItem value="all">All branches</SelectItem>}
              {branches
                .filter((b) => b.isActive)
                .map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing: <span className="font-medium text-foreground">{scopeLabel}</span>
        </p>
      </div>

      <Tabs defaultValue="pl" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="cash">Cash Flow</TabsTrigger>
          <TabsTrigger value="tax">Tax Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="space-y-6 mt-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Total revenue"
              value={formatCurrency(pl.totalRevenue)}
              subtitle="Issued & paid invoices"
              icon={TrendingUp}
              tone="emerald"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Total expenses"
              value={formatCurrency(pl.totalExpenses)}
              subtitle="Operational costs"
              icon={TrendingDown}
              tone="rose"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Net profit"
              value={formatCurrency(pl.netProfit)}
              subtitle="Revenue − expenses"
              icon={Landmark}
              tone="blue"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Profit margin"
              value={`${pl.margin.toFixed(1)}%`}
              subtitle="On recognized revenue"
              icon={PieChart}
              tone="violet"
              footerNote={scopeLabel}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {pl.recognized.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No revenue data</p>
                ) : (
                  <ul className="text-sm space-y-2 max-h-[220px] overflow-y-auto">
                    {pl.recognized.slice(0, 12).map((inv) => (
                      <li
                        key={inv.id}
                        className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                      >
                        <span className="truncate text-muted-foreground">{inv.invoiceNumber}</span>
                        <span className="font-medium tabular-nums shrink-0">
                          {formatCurrency(inv.grandTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expense breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(pl.byCategory).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No expense data</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {Object.entries(pl.byCategory).map(([cat, amt]) => (
                      <li
                        key={cat}
                        className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                      >
                        <span className="capitalize">{cat.toLowerCase().replace(/_/g, " ")}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(amt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profit &amp; Loss statement</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-emerald-50/80 dark:bg-emerald-950/20">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Revenue
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Service &amp; parts (invoices)</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(pl.totalRevenue)}
                    </td>
                  </tr>
                  <tr className="bg-rose-50/80 dark:bg-rose-950/20">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Expenses
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Operating expenses</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-rose-600">
                      ({formatCurrency(pl.totalExpenses)})
                    </td>
                  </tr>
                  <tr className="bg-blue-50/80 dark:bg-blue-950/20 font-semibold">
                    <td className="px-3 py-2">Net profit</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(pl.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash" className="space-y-6 mt-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Opening balance"
              value={formatCurrency(cash.openingBalance)}
              subtitle="Demo opening cash"
              icon={Wallet}
              tone="amber"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Net operating cash"
              value={formatCurrency(cash.netOperating)}
              subtitle="Collections − expenses"
              icon={Landmark}
              tone="emerald"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Net cash change"
              value={formatCurrency(cash.netChange)}
              subtitle="This period (demo)"
              icon={TrendingUp}
              tone="blue"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Closing balance"
              value={formatCurrency(cash.closingBalance)}
              subtitle="Opening + change"
              icon={Wallet}
              tone="violet"
              footerNote={scopeLabel}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cash income</p>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(cash.cashIn)}</p>
                  <p className="text-xs text-muted-foreground">CASH payments</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Online income</p>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(cash.onlineIn)}</p>
                  <p className="text-xs text-muted-foreground">UPI, card, wallet</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash flow statement</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="bg-emerald-50/80 dark:bg-emerald-950/20">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Operating activities
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Cash inflow (collections)</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(cash.totalIn)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Cash outflow (expenses)</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                      ({formatCurrency(cash.operatingOut)})
                    </td>
                  </tr>
                  <tr className="bg-muted/50 font-medium">
                    <td className="px-3 py-2">Net operating cash flow</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(cash.netOperating)}
                    </td>
                  </tr>
                  <tr className="bg-violet-50/80 dark:bg-violet-950/20">
                    <td className="px-3 py-2 font-semibold text-muted-foreground" colSpan={2}>
                      Investing &amp; financing (demo — no entries)
                    </td>
                  </tr>
                  <tr className="bg-blue-50/80 dark:bg-blue-950/20 font-semibold">
                    <td className="px-3 py-2">Closing cash balance</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">
                      {formatCurrency(cash.closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-6 mt-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Taxable sales"
              value={formatCurrency(tax.totalSales)}
              subtitle="Invoice subtotals"
              icon={TrendingUp}
              tone="emerald"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Tax collected"
              value={formatCurrency(tax.taxCollected)}
              subtitle="Output GST (invoices)"
              icon={FileText}
              tone="blue"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Input tax (est.)"
              value={formatCurrency(tax.inputTaxEst)}
              subtitle={`~${Math.round(GST_RATE_EST * 100)}% of expenses`}
              icon={FileText}
              tone="amber"
              footerNote={scopeLabel}
            />
            <KPICard
              title="Net tax payable"
              value={formatCurrency(tax.netPayable)}
              subtitle="Output − input (est.)"
              icon={Landmark}
              tone="rose"
              footerNote={scopeLabel}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">GST summary</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-50/80 dark:bg-emerald-950/20">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Output tax
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">Total sales (taxable)</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(tax.totalSales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">GST on sales</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(tax.taxCollected)}
                    </td>
                  </tr>
                  <tr className="bg-orange-50/80 dark:bg-orange-950/20">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>
                      Input tax
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">Purchases (expense base)</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 pl-6 text-muted-foreground">Estimated GST credit</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatCurrency(tax.inputTaxEst)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/80 dark:bg-blue-950/20 font-semibold">
                    <td className="px-3 py-2">Net tax payable</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(tax.netPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-4 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2 border border-amber-200/60 dark:border-amber-900/50">
                Note: Input tax is estimated from expenses. Verify with actual GST invoices.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
