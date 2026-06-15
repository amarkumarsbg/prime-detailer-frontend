"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import { DEFAULT_REPORT_PERIOD, dateInPreset } from "@/lib/reports/report-period-presets";
import { useInventoryStore } from "@/store/inventory-store";
import { buildPurchaseSummaryRows } from "@/lib/reports/transaction-report-data";
import { formatInrFull } from "@/lib/utils";

type TaxReportVariant = "tds-payable" | "tds-receivable" | "tcs-payable" | "tcs-receivable";

const META: Record<
  TaxReportVariant,
  { title: string; baseLabel: string; taxLabel: string; hint: string }
> = {
  "tds-payable": {
    title: "TDS Payable",
    baseLabel: "Expense base (period)",
    taxLabel: "TDS payable",
    hint: "TDS is not captured on expenses yet. Base amount shows paid expenses in the selected period.",
  },
  "tds-receivable": {
    title: "TDS Receivable",
    baseLabel: "Receipts base (period)",
    taxLabel: "TDS receivable",
    hint: "Customer TDS deductions are not tracked on invoices yet.",
  },
  "tcs-payable": {
    title: "TCS Payable",
    baseLabel: "Purchase base (period)",
    taxLabel: "TCS payable",
    hint: "TCS on purchases is not modeled yet. Base shows inventory purchase value.",
  },
  "tcs-receivable": {
    title: "TCS Receivable",
    baseLabel: "Sales base (period)",
    taxLabel: "TCS receivable",
    hint: "TCS on sales is not modeled yet. Base shows invoice subtotals.",
  },
};

export function TaxWithholdingReport({ variant }: { variant: TaxReportVariant }) {
  const meta = META[variant];
  const expenses = useScopedExpenses();
  const invoices = useScopedInvoices();
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);

  const { baseAmount, taxAmount } = useMemo(() => {
    if (variant === "tds-payable") {
      const base = expenses
        .filter((e) => dateInPreset(e.date, period))
        .reduce((s, e) => s + e.amount, 0);
      return { baseAmount: base, taxAmount: 0 };
    }
    if (variant === "tds-receivable") {
      const base = invoices
        .filter((i) => i.status !== "DRAFT" && dateInPreset(i.createdAt, period))
        .reduce((s, i) => s + i.payments.reduce((p, pay) => p + pay.amount, 0), 0);
      return { baseAmount: base, taxAmount: 0 };
    }
    if (variant === "tcs-payable") {
      const rows = buildPurchaseSummaryRows(purchases, parts, period);
      const base = rows.reduce((s, r) => s + r.purchaseAmount, 0);
      return { baseAmount: base, taxAmount: 0 };
    }
    const base = invoices
      .filter((i) => i.status !== "DRAFT" && dateInPreset(i.createdAt, period))
      .reduce((s, i) => s + (i.subtotal ?? 0), 0);
    return { baseAmount: base, taxAmount: 0 };
  }, [variant, expenses, invoices, purchases, parts, period]);

  return (
    <ReportPageChrome
      title={meta.title}
      favouriteStorageKey={`prime-detailer-${variant}-fav`}
      emailReportName={meta.title}
      period={period}
      onPeriodChange={setPeriod}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{meta.hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{meta.baseLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInrFull(baseAmount)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{meta.taxLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInrFull(taxAmount)}</p>
          </div>
        </div>
      </div>
    </ReportPageChrome>
  );
}
