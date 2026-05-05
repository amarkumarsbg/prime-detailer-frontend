"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import {
  GST_PURCHASE_HSN_DUMMY,
  filterPurchaseHsnByPeriod,
} from "@/lib/reports/gst-purchase-hsn-dummy";
import { formatDate, formatInrFull } from "@/lib/utils";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-gst-purchase-hsn-favourite";

export function GstPurchaseHsnReport() {
  const [period, setPeriod] = useState("week");

  const rows = useMemo(
    () => filterPurchaseHsnByPeriod(GST_PURCHASE_HSN_DUMMY, period),
    [period]
  );

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header =
      "Date,Invoice No,Original Inv No,Party GSTIN,Party Name,Item,HSN,Qty,Price/Unit,SGST,CGST,IGST,Amount";
    const lines = rows.map((r) =>
      [
        r.date,
        r.invoiceNo,
        r.originalInvNo,
        r.partyGstin,
        `"${r.partyName.replace(/"/g, '""')}"`,
        `"${r.itemName.replace(/"/g, '""')}"`,
        r.hsn,
        r.qty,
        r.priceUnit,
        r.sgst,
        r.cgst,
        r.igst,
        r.amount,
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-purchase-hsn-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="GST Purchase (With HSN)"
      favouriteStorageKey={FAV_KEY}
      emailReportName="GST Purchase (With HSN)"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1200px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Invoice No</th>
              <th className="px-2 py-2 text-left">Original Inv No</th>
              <th className="px-2 py-2 text-left">Party GSTIN</th>
              <th className="px-2 py-2 text-left">Party Name</th>
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-left">HSN Code</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Price/Unit</th>
              <th className="px-2 py-2 text-right">SGST</th>
              <th className="px-2 py-2 text-right">CGST</th>
              <th className="px-2 py-2 text-right">IGST</th>
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <ReportTableEmpty colSpan={13} />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 hover:bg-muted/20">
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(r.date)}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.invoiceNo}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">
                    {r.originalInvNo}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.partyGstin}</td>
                  <td className="max-w-[140px] truncate px-2 py-2">{r.partyName}</td>
                  <td className="max-w-[160px] truncate px-2 py-2">{r.itemName}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.hsn}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.priceUnit)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.sgst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.cgst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatInrFull(r.igst)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">
                    {formatInrFull(r.amount)}
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
