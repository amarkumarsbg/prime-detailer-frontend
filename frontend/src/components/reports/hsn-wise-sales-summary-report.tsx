"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import { buildHsnWiseSalesSummaryRows } from "@/lib/reports/hsn-wise-summary-from-invoices";
import { formatInrFull } from "@/lib/utils";
import { useScopedInvoices } from "@/hooks/use-scoped-data";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-hsn-wise-sales-favourite";

export function HsnWiseSalesSummaryReport() {
  const [period, setPeriod] = useState("week");
  const invoices = useScopedInvoices();

  const rows = useMemo(
    () => buildHsnWiseSalesSummaryRows(invoices, period),
    [invoices, period]
  );

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header =
      "HSN,Item Name,Total Quantity,Total Value,Taxable Value,IGST,CGST,SGST,Cess,Total Tax Amount";
    const lines = rows.map((r) =>
      [
        r.hsn,
        `"${r.itemName.replace(/"/g, '""')}"`,
        r.totalQty,
        r.totalValue,
        r.taxableValue,
        r.igst,
        r.cgst,
        r.sgst,
        r.cess,
        r.totalTaxAmount,
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hsn-wise-sales-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="HSN Wise Sales Summary"
      favouriteStorageKey={FAV_KEY}
      emailReportName="HSN Wise Sales Summary"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1000px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">HSN</th>
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-right">Total Quantity</th>
              <th className="px-2 py-2 text-right">Total Value</th>
              <th className="px-2 py-2 text-right">Taxable Value</th>
              <th className="px-2 py-2 text-right">IGST</th>
              <th className="px-2 py-2 text-right">CGST</th>
              <th className="px-2 py-2 text-right">SGST</th>
              <th className="px-2 py-2 text-right">Cess</th>
              <th className="px-2 py-2 text-right">Total Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={10} />
            ) : (
              rows.map((r) => (
                <tr key={r.hsn} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.hsn}</td>
                  <td className="max-w-[220px] truncate px-2 py-2">{r.itemName}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{r.totalQty}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.totalValue)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.taxableValue)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.igst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.cgst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.sgst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.cess)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">
                    {formatInrFull(r.totalTaxAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
