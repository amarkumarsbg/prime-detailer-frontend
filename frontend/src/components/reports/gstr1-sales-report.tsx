"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GSTR1_DUMMY_INVOICE_ROWS, type Gstr1InvoiceDummyRow } from "@/lib/reports/gstr1-dummy-data";
import { formatInrFull } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FileJson,
  Mail,
  Printer,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-gstr1-favourite";

function fmtInvoiceDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Gstr1SalesReport() {
  const rows = useMemo(() => GSTR1_DUMMY_INVOICE_ROWS, []);
  const [favourite, setFavourite] = useState(false);
  const [dateRange, setDateRange] = useState("last30");
  const [viewMode, setViewMode] = useState("invoice");

  useEffect(() => {
    try {
      queueMicrotask(() => setFavourite(localStorage.getItem(FAV_KEY) === "1"));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavourite = () => {
    const next = !favourite;
    setFavourite(next);
    try {
      localStorage.setItem(FAV_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    downloadBlob(blob, `gstr1-sales-${new Date().toISOString().slice(0, 10)}.json`);
    toast.message("Download started");
  };

  const exportCsv = () => {
    const header = [
      "GSTIN",
      "Customer Name",
      "State Code",
      "State Name",
      "Invoice Number",
      "Invoice Date",
      "Invoice Value",
      "Tax %",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.gstin,
        `"${r.customerName.replace(/"/g, '""')}"`,
        r.stateCode,
        `"${r.stateName}"`,
        r.invoiceNumber,
        r.invoiceDate,
        r.invoiceValue,
        r.taxPercent,
        r.taxableValue,
        r.cgst,
        r.sgst,
        r.igst,
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `gstr1-sales-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.message("Download started");
  };

  const exportPdfHint = () => {
    toast.message("Print PDF", { description: "Use your browser print dialog to save as PDF." });
    window.print();
  };

  const emailReport = (kind: "json" | "excel") => {
    toast.message(kind === "json" ? "Email JSON" : "Email Excel", {
      description: "The report will be sent to your configured email address.",
    });
  };

  const tableSection = (data: Gstr1InvoiceDummyRow[], emptyHint?: string) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <th className="w-10 border-r border-border px-2 py-2" aria-hidden />
            <th className="border-r border-border px-3 py-2 font-semibold text-foreground">GSTIN</th>
            <th className="border-r border-border px-3 py-2 font-semibold text-foreground">
              Customer Name
            </th>
            <th
              className="border-r border-border px-0 py-0 text-center font-semibold text-foreground"
              colSpan={2}
            >
              <div className="border-b border-border px-2 py-1.5">Place of Supply</div>
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-border px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  State Code
                </div>
                <div className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  State Name
                </div>
              </div>
            </th>
            <th
              className="border-r border-border px-0 py-0 text-center font-semibold text-foreground"
              colSpan={3}
            >
              <div className="border-b border-border px-2 py-1.5">Invoice Details</div>
              <div className="grid grid-cols-3 gap-0">
                <div className="border-r border-border px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  Invoice Number
                </div>
                <div className="border-r border-border px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  Invoice Date
                </div>
                <div className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  Invoice Value
                </div>
              </div>
            </th>
            <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
              Total Tax (%)
            </th>
            <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
              Taxable Value
            </th>
            <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
              CGST
            </th>
            <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
              SGST
            </th>
            <th className="px-3 py-2 text-right font-semibold text-foreground">IGST</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                {emptyHint ?? "No records."}
              </td>
            </tr>
          ) : (
            data.map((r) => (
                <tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
                  <td className="border-r border-border px-2 py-2" />
                  <td className="border-r border-border px-3 py-2 font-mono text-xs">{r.gstin}</td>
                  <td className="border-r border-border px-3 py-2">{r.customerName}</td>
                  <td className="border-r border-border px-3 py-2 text-center tabular-nums">
                    {r.stateCode}
                  </td>
                  <td className="border-r border-border px-3 py-2">{r.stateName}</td>
                  <td className="border-r border-border px-3 py-2 font-mono text-xs">
                    {r.invoiceNumber}
                  </td>
                  <td className="border-r border-border whitespace-nowrap px-3 py-2">
                    {fmtInvoiceDate(r.invoiceDate)}
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    {formatInrFull(r.invoiceValue)}
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    {r.taxPercent}%
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    {formatInrFull(r.taxableValue)}
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    {formatInrFull(r.cgst)}
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    {formatInrFull(r.sgst)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInrFull(r.igst)}</td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              GSTR-1 (Sales)
            </h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-300/80 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
              onClick={toggleFavourite}
            >
              <Star
                className={`h-4 w-4 ${favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
              />
              Favourite
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-9 w-[160px] border-sky-200/80 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30">
              <CalendarDays className="mr-2 h-4 w-4 opacity-70" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7">Last 7 Days</SelectItem>
              <SelectItem value="last30">Last 30 Days</SelectItem>
              <SelectItem value="fq">This Quarter</SelectItem>
              <SelectItem value="fy">This Financial Year</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-sky-200/80 bg-background"
              >
                <FileJson className="h-4 w-4" />
                Download JSON
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={exportJson}>Download JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>Download Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdfHint}>Download PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-sky-200/80 bg-background"
              >
                <Mail className="h-4 w-4" />
                Email Excel
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => emailReport("json")}>Email JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => emailReport("excel")}>Email Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-sky-200/80"
            onClick={exportPdfHint}
          >
            <Printer className="h-4 w-4" />
            Print Pdf
          </Button>

          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="h-9 w-[140px] border-sky-200/80 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">Invoice View</SelectItem>
              <SelectItem value="hsn">HSN View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="sales"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Sales
          </TabsTrigger>
          <TabsTrigger
            value="salesReturn"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Sales Return/ Credit Note
          </TabsTrigger>
          <TabsTrigger
            value="purchaseReturn"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Purchase Return/ Debit Note
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 space-y-3">
          {viewMode === "invoice" ? (
            tableSection(rows)
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Switch to Invoice View to see the GSTR-1 table for this period.
            </p>
          )}
        </TabsContent>

        <TabsContent value="salesReturn" className="mt-4">
          {tableSection(
            [],
            "No sales return or credit note rows for this period."
          )}
        </TabsContent>

        <TabsContent value="purchaseReturn" className="mt-4">
          {tableSection(
            [],
            "No purchase return or debit note rows for this period."
          )}
        </TabsContent>
      </Tabs>

      <div className="rounded-md border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100 print:text-xs">
        Invoices <strong>pushed to IRN</strong> will be autopopulated on govt GST portal. However,
        the tax payer should still verify all the data in this report at the time of filing to avoid
        any errors.
      </div>
    </div>
  );
}
