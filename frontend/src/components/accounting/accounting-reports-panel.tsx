"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  FileDown,
  FileSpreadsheet,
  FileText,
  Landmark,
  Percent,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import {
  categoryDisplayLabel,
  expensesByCategory,
  recognizedInvoices,
  totalExpenseAmount,
} from "@/lib/accounting/dashboard-metrics";
import type { Expense, Invoice } from "@/types";
import type { LucideIcon } from "lucide-react";

type ReportView = "pl" | "cash" | "tax";

type AccountingReportsPanelProps = {
  invoices: Invoice[];
  expenses: Expense[];
  /** Period income from actual receipts (payments + advances + memberships). */
  periodIncome: number;
  cashInflow: number;
  cashOutflow: number;
  openingCashBalance: number;
};

export function AccountingReportsPanel({
  invoices,
  expenses,
  periodIncome,
  cashInflow,
  cashOutflow,
  openingCashBalance,
}: AccountingReportsPanelProps) {
  const [view, setView] = useState<ReportView>("pl");

  const expenseTotal = useMemo(() => totalExpenseAmount(expenses), [expenses]);
  const netProfit = Math.round((periodIncome - expenseTotal) * 100) / 100;
  const margin = periodIncome > 0 ? (netProfit / periodIncome) * 100 : 0;
  const byCategory = useMemo(() => expensesByCategory(expenses), [expenses]);
  const recognized = useMemo(() => recognizedInvoices(invoices), [invoices]);

  const tax = useMemo(() => {
    const nonDraft = recognized;
    const totalSales = nonDraft.reduce((s, i) => s + i.subtotal, 0);
    const taxCollected = nonDraft.reduce((s, i) => s + i.taxAmount, 0);
    const purchasesBase = expenseTotal;
    const inputTaxEst = Math.round(purchasesBase * 0.18 * 100) / 100;
    const netPayable = Math.max(0, Math.round((taxCollected - inputTaxEst) * 100) / 100);
    return { totalSales, taxCollected, inputTaxEst, netPayable, purchasesBase };
  }, [recognized, expenseTotal]);

  const netOperating = Math.round((cashInflow - cashOutflow) * 100) / 100;
  const closingCash = Math.round((openingCashBalance + netOperating) * 100) / 100;

  const exportStub = (kind: "pdf" | "excel") => {
    toast.success(kind === "pdf" ? "Export PDF queued." : "Export Excel queued.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <ReportViewBtn
            active={view === "pl"}
            icon={Activity}
            label="Profit & Loss"
            onClick={() => setView("pl")}
          />
          <ReportViewBtn
            active={view === "cash"}
            icon={TrendingUp}
            label="Cash Flow"
            onClick={() => setView("cash")}
          />
          <ReportViewBtn
            active={view === "tax"}
            icon={FileText}
            label="Tax Summary"
            onClick={() => setView("tax")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportStub("pdf")}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportStub("excel")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {view === "pl" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric
              title="Total Revenue"
              value={periodIncome}
              valueClass="text-emerald-600"
              icon={TrendingUp}
              iconClass="bg-emerald-100 text-emerald-700"
            />
            <MiniMetric
              title="Total Expenses"
              value={expenseTotal}
              valueClass="text-rose-600"
              icon={TrendingDown}
              iconClass="bg-rose-100 text-rose-700"
            />
            <MiniMetric
              title="Net Profit"
              value={netProfit}
              valueClass="text-blue-600"
              icon={Landmark}
              iconClass="bg-blue-100 text-blue-700"
            />
            <MiniMetric
              title="Profit Margin"
              valueLabel={`${margin.toFixed(1)}%`}
              valueClass="text-violet-600"
              icon={Percent}
              iconClass="bg-violet-100 text-violet-700"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {recognized.length === 0 && periodIncome <= 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No revenue data
                  </p>
                ) : (
                  <ul className="max-h-[220px] space-y-2 overflow-y-auto text-sm">
                    {recognized.slice(0, 12).map((inv) => (
                      <li
                        key={inv.id}
                        className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                      >
                        <span className="truncate text-muted-foreground">
                          {inv.invoiceNumber}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatCurrency(inv.grandTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No expense data
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {byCategory.map((row) => (
                      <li
                        key={row.category}
                        className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                      >
                        <span>{categoryDisplayLabel(row.category)}</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profit &amp; Loss Statement</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <StatementRow
                    label="REVENUE"
                    amount={periodIncome}
                    tone="emerald"
                    bold
                  />
                  <StatementRow
                    label="COST OF GOODS SOLD"
                    amount={0}
                    paren
                    tone="rose"
                  />
                  <StatementRow
                    label="GROSS PROFIT"
                    amount={periodIncome}
                    tone="blue"
                    bold
                  />
                  <StatementRow
                    label="OPERATING EXPENSES"
                    amount={expenseTotal}
                    paren
                    tone="rose"
                  />
                  <StatementRow
                    label="NET PROFIT"
                    amount={netProfit}
                    tone="blue"
                    bold
                    emphasize
                  />
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "cash" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric
              title="Opening Balance"
              value={openingCashBalance}
              valueClass="text-foreground"
              icon={Landmark}
              iconClass="bg-slate-100 text-slate-700"
            />
            <MiniMetric
              title="Net Operating Cash"
              value={netOperating}
              valueClass="text-emerald-600"
              icon={Activity}
              iconClass="bg-emerald-100 text-emerald-700"
            />
            <MiniMetric
              title="Net Cash Change"
              value={netOperating}
              valueClass="text-emerald-600"
              icon={TrendingUp}
              iconClass="bg-emerald-100 text-emerald-700"
            />
            <MiniMetric
              title="Closing Balance"
              value={closingCash}
              valueClass="text-blue-600"
              icon={Landmark}
              iconClass="bg-blue-100 text-blue-700"
            />
          </div>

          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Flow Statement</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Activity</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <StatementRow
                    label="OPENING CASH BALANCE"
                    amount={openingCashBalance}
                    tone="blue"
                    bold
                  />
                  <tr>
                    <td className="px-4 py-2 font-semibold" colSpan={2}>
                      OPERATING ACTIVITIES
                    </td>
                  </tr>
                  <StatementRow
                    label="Cash Inflow from Operations"
                    amount={cashInflow}
                    tone="emerald"
                    indent
                  />
                  <StatementRow
                    label="Cash Outflow from Operations"
                    amount={cashOutflow}
                    paren
                    tone="rose"
                    indent
                  />
                  <StatementRow
                    label="Net Operating Cash Flow"
                    amount={netOperating}
                    tone="emerald"
                    bold
                  />
                  <tr className="bg-violet-50/80 dark:bg-violet-950/20">
                    <td className="px-4 py-2 font-semibold" colSpan={2}>
                      INVESTING ACTIVITIES
                    </td>
                  </tr>
                  <StatementRow
                    label="Capital Expenditure"
                    amount={0}
                    paren
                    tone="rose"
                    indent
                  />
                  <StatementRow
                    label="Net Investing Cash Flow"
                    amount={0}
                    tone="violet"
                    bold
                  />
                  <tr>
                    <td className="px-4 py-2 font-semibold" colSpan={2}>
                      FINANCING ACTIVITIES
                    </td>
                  </tr>
                  <StatementRow
                    label="Loans/Capital Received"
                    amount={0}
                    tone="emerald"
                    indent
                  />
                  <StatementRow
                    label="Loan Repayments"
                    amount={0}
                    paren
                    tone="rose"
                    indent
                  />
                  <StatementRow
                    label="Net Financing Cash Flow"
                    amount={0}
                    tone="amber"
                    bold
                  />
                  <StatementRow
                    label="NET CHANGE IN CASH"
                    amount={netOperating}
                    tone="blue"
                    bold
                  />
                  <StatementRow
                    label="CLOSING CASH BALANCE"
                    amount={closingCash}
                    tone="blue"
                    bold
                    emphasize
                  />
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "tax" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric
              title="Total Sales"
              value={tax.totalSales}
              valueClass="text-emerald-600"
              icon={TrendingUp}
              iconClass="bg-emerald-100 text-emerald-700"
            />
            <MiniMetric
              title="Tax Collected"
              value={tax.taxCollected}
              valueClass="text-blue-600"
              icon={FileText}
              iconClass="bg-blue-100 text-blue-700"
            />
            <MiniMetric
              title="Input Tax (Est.)"
              value={tax.inputTaxEst}
              valueClass="text-orange-600"
              icon={FileText}
              iconClass="bg-orange-100 text-orange-700"
            />
            <MiniMetric
              title="Net Tax Payable"
              value={tax.netPayable}
              valueClass="text-rose-600"
              icon={Landmark}
              iconClass="bg-rose-100 text-rose-700"
            />
          </div>

          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">GST Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-50/80 dark:bg-emerald-950/20">
                    <td className="px-4 py-2 font-semibold text-emerald-800 dark:text-emerald-300">
                      OUTPUT TAX (Tax Collected)
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(tax.taxCollected)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-muted-foreground">
                      Total Sales (Taxable)
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(tax.totalSales)}
                    </td>
                  </tr>
                  <tr className="bg-orange-50/80 dark:bg-orange-950/20">
                    <td className="px-4 py-2 font-semibold text-orange-800 dark:text-orange-300">
                      INPUT TAX (Tax Paid)
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-orange-700">
                      ({formatCurrency(tax.inputTaxEst)})
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 pl-8 text-muted-foreground">Total Purchases</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(tax.purchasesBase)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/80 dark:bg-blue-950/20">
                    <td className="px-4 py-2 font-semibold text-blue-800 dark:text-blue-300">
                      NET TAX PAYABLE
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-600">
                      {formatCurrency(tax.netPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="m-4 rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                Note: Input tax is estimated. Please verify with actual GST invoices.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function ReportViewBtn({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-400"
          : "border-border text-muted-foreground hover:bg-muted/50"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function MiniMetric({
  title,
  value,
  valueLabel,
  valueClass,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value?: number;
  valueLabel?: string;
  valueClass: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn("mt-1 text-xl font-bold tabular-nums", valueClass)}>
            {valueLabel ?? formatCurrency(value ?? 0)}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatementRow({
  label,
  amount,
  paren,
  tone,
  bold,
  indent,
  emphasize,
}: {
  label: string;
  amount: number;
  paren?: boolean;
  tone?: "emerald" | "rose" | "blue" | "violet" | "amber";
  bold?: boolean;
  indent?: boolean;
  emphasize?: boolean;
}) {
  const bg =
    tone === "emerald"
      ? "bg-emerald-50/80 dark:bg-emerald-950/20"
      : tone === "blue"
        ? "bg-blue-50/80 dark:bg-blue-950/20"
        : tone === "violet"
          ? "bg-violet-50/80 dark:bg-violet-950/20"
          : tone === "amber"
            ? "bg-amber-50/80 dark:bg-amber-950/20"
            : tone === "rose" && bold
              ? "bg-rose-50/50 dark:bg-rose-950/10"
              : emphasize
                ? "bg-blue-50/80 dark:bg-blue-950/20"
                : "";

  const amountClass =
    paren || amount < 0
      ? "text-rose-600"
      : tone === "emerald"
        ? "text-emerald-700 dark:text-emerald-400"
        : tone === "blue"
          ? "text-blue-700 dark:text-blue-400"
          : "";

  const display =
    paren || amount < 0
      ? `(${formatCurrency(Math.abs(amount))})`
      : formatCurrency(amount);

  return (
    <tr className={cn(bg, bold && "font-semibold")}>
      <td className={cn("px-4 py-2.5", indent && "pl-8 text-muted-foreground")}>{label}</td>
      <td className={cn("px-4 py-2.5 text-right tabular-nums", amountClass)}>{display}</td>
    </tr>
  );
}
