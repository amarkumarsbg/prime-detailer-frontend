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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScopedInvoices } from "@/hooks/use-scoped-data";
import { DEFAULT_REPORT_PERIOD } from "@/lib/reports/report-period-presets";
import { ReportPeriodSelect } from "@/components/reports/report-period-select";
import type { Invoice, InvoiceStatus } from "@/types";
import { formatInrFull } from "@/lib/utils";
import { splitCgstSgst } from "@/lib/tax-invoice-format";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  Mail,
  Printer,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-sales-staff-favourite";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function inDatePreset(iso: string, preset: string): boolean {
  const t = new Date(iso).getTime();
  const now = new Date();
  const today = startOfDay(now);

  if (preset === "today") {
    return t >= today.getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return t >= startOfDay(y).getTime() && t <= endOfDay(y).getTime();
  }
  if (preset === "week") {
    const wd = today.getDay();
    const mon = new Date(today);
    mon.setDate(mon.getDate() - (wd === 0 ? 6 : wd - 1));
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return t >= startOfDay(mon).getTime() && t <= endOfDay(sun).getTime();
  }
  if (preset === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  return true;
}

function paidTotal(inv: Invoice): number {
  // Staff sales summary intentionally excludes wallet — do not use invoicePaidTotal.
  return (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
}

function balance(inv: Invoice): number {
  return Math.max(0, Math.round((inv.grandTotal - paidTotal(inv)) * 100) / 100);
}

function invoiceTypeLabel(inv: Invoice): "Cash" | "Credit" {
  const bal = balance(inv);
  if (bal > 0.01) return "Credit";
  const pays = inv.payments ?? [];
  if (pays.length === 0) return "Credit";
  const allCash = pays.every((p) => p.method === "CASH");
  return allCash ? "Cash" : "Credit";
}

function statusLabel(s: InvoiceStatus): "Paid" | "Unpaid" | "Cancelled" {
  if (s === "PAID") return "Paid";
  if (s === "DRAFT") return "Cancelled";
  return "Unpaid";
}

function matchesStatusFilter(row: "Paid" | "Unpaid" | "Cancelled", filter: string): boolean {
  if (filter === "all") return true;
  return row === filter;
}

function splitGst(inv: Invoice): { cgst: number; sgst: number; igst: number } {
  const tax = inv.taxAmount ?? 0;
  if (tax <= 0) return { cgst: 0, sgst: 0, igst: 0 };
  const { cgst, sgst } = splitCgstSgst(tax);
  return { cgst, sgst, igst: 0 };
}

export function SalesSummaryStaffReport() {
  const invoices = useScopedInvoices();

  const [favourite, setFavourite] = useState(false);
  const [partyQ, setPartyQ] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [invType, setInvType] = useState("all");
  const [invStatus, setInvStatus] = useState("all");

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

  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      const m = inv.mechanicName?.trim();
      set.add(m || "Unassigned");
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = partyQ.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (q && !inv.customerName.toLowerCase().includes(q)) return false;
      if (!inDatePreset(inv.createdAt, period)) return false;
      const mechanic = inv.mechanicName?.trim() || "Unassigned";
      if (staffFilter !== "all" && mechanic !== staffFilter) return false;
      const it = invoiceTypeLabel(inv);
      if (invType !== "all" && it.toLowerCase() !== invType) return false;
      const st = statusLabel(inv.status);
      if (!matchesStatusFilter(st, invStatus)) return false;
      return true;
    });
  }, [invoices, partyQ, period, staffFilter, invType, invStatus]);

  const totalSales = useMemo(
    () => filtered.reduce((s, i) => s + (i.grandTotal ?? 0), 0),
    [filtered]
  );

  const rows = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filtered]);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(iso)
    );

  const dueDate = (inv: Invoice) => {
    const created = new Date(inv.createdAt);
    const d = new Date(created);
    d.setDate(d.getDate() + 30);
    return fmtDate(d.toISOString());
  };

  const downloadCsv = () => {
    const header = [
      "Date",
      "Invoice No",
      "Party Name",
      "GSTIN",
      "Due Date",
      "Amount",
      "Balance",
      "Taxable",
      "CGST",
      "SGST",
      "IGST",
      "Invoice Type",
      "Invoice Status",
      "Created By",
    ].join(",");
    const lines = rows.map((inv) => {
      const g = splitGst(inv);
      const st = statusLabel(inv.status);
      return [
        inv.createdAt,
        inv.invoiceNumber,
        `"${inv.customerName.replace(/"/g, '""')}"`,
        "",
        dueDate(inv),
        inv.grandTotal,
        balance(inv),
        inv.subtotal ?? 0,
        g.cgst,
        g.sgst,
        g.igst,
        invoiceTypeLabel(inv),
        st,
        inv.mechanicName?.trim() || "Unassigned",
      ].join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-summary-staff-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  const printPdf = () => {
    toast.message("Print PDF", { description: "Use your browser print dialog to save as PDF." });
    window.print();
  };

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              Sales Summary - Staff wise
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

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-sky-200/80"
              onClick={() =>
                toast.message("Email Excel", { description: "The report will be sent to your configured email address." })
              }
            >
              <Mail className="h-4 w-4" />
              Email Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 border-sky-200/80 bg-background">
                  <Download className="h-4 w-4" />
                  Download Excel
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadCsv}>Download Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={printPdf}>Download Pdf</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-sky-200/80"
              onClick={printPdf}
            >
              <Printer className="h-4 w-4" />
              Print PDF
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>Total Sales</span>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatInrFull(totalSales)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={partyQ}
              onChange={(e) => setPartyQ(e.target.value)}
              placeholder="Search Party"
              className="pl-9"
              aria-label="Search party"
            />
          </div>

          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              {staffOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All Staff" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ReportPeriodSelect value={period} onChange={setPeriod} />

          <Select value={invType} onValueChange={setInvType}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Invoice Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>

          <Select value={invStatus} onValueChange={setInvStatus}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Invoice Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Unpaid">Unpaid</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card print:border-0">
        <table className="w-full min-w-[1200px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Date
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Invoice No
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Party Name
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                GSTIN
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Due Date
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                Balance Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                Taxable Value
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                CGST
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                SGST
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                IGST
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Invoice Type
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Invoice Status
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Created By
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="h-12 w-12 opacity-25" aria-hidden />
                    <p className="text-sm">No transactions available to generate report</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((inv) => {
                const g = splitGst(inv);
                const st = statusLabel(inv.status);
                return (
                  <tr key={inv.id} className="border-b border-border/80 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(inv.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5">{inv.customerName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      —
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{dueDate(inv)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(inv.grandTotal)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(balance(inv))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(inv.subtotal ?? 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(g.cgst)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(g.sgst)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatInrFull(g.igst)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{invoiceTypeLabel(inv)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{st}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {inv.mechanicName?.trim() || "Unassigned"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
