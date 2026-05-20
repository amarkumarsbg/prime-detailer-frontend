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
import { useScopedExpenses, useScopedInvoices } from "@/hooks/use-scoped-data";
import { useSettingsStore } from "@/store/settings-store";
import { formatInrFull } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Mail,
  Printer,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-pl-favourite";

/** Demo stock figures when inventory is not modeled in P&amp;L yet. */
const DUMMY_STOCK = 190050.64;

type PlRow = {
  label: string;
  /** null → show "-" like the reference UI */
  amount: number | null;
};

function fmtCell(amount: number | null): string {
  if (amount == null) return "-";
  return formatInrFull(amount);
}

export function ProfitLossReport() {
  const businessName = useSettingsStore((s) => s.businessName);
  const invoices = useScopedInvoices();
  const expenses = useScopedExpenses();

  const [favourite, setFavourite] = useState(false);
  const [period, setPeriod] = useState("week");

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

  const { saleTotal, expenseTotal, netSimplified } = useMemo(() => {
    const sale = invoices.reduce((s, i) => s + (i.grandTotal ?? 0), 0);
    const exp = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
    return {
      saleTotal: Math.round(sale * 100) / 100,
      expenseTotal: Math.round(exp * 100) / 100,
      netSimplified: Math.round((sale - exp) * 100) / 100,
    };
  }, [invoices, expenses]);

  const rows: PlRow[] = useMemo(
    () => [
      { label: "Sale(+)", amount: saleTotal > 0 ? saleTotal : null },
      { label: "Cr. Note/Sale Return(-)", amount: null },
      { label: "Purchase(-)", amount: null },
      { label: "Dr. Note/Purchase Return(+)", amount: null },
      { label: "Tax Payable(-)", amount: null },
      { label: "Tax Receivable(+)", amount: null },
      { label: "Opening Stock(-)", amount: DUMMY_STOCK },
      { label: "Closing Stock(+)", amount: DUMMY_STOCK },
      { label: "Gross Profit", amount: null },
      { label: "Other Income(+)", amount: null },
      { label: "Indirect Expenses(-)", amount: expenseTotal > 0 ? expenseTotal : null },
      {
        label: "Net Profit",
        amount: saleTotal > 0 || expenseTotal > 0 ? netSimplified : null,
      },
    ],
    [saleTotal, expenseTotal, netSimplified]
  );

  const downloadCsv = () => {
    const lines = [
      ["Particulars", "Amount"].join(","),
      ...rows.map((r) => [`"${r.label.replace(/"/g, '""')}"`, r.amount ?? ""].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started", { description: "Excel-compatible CSV." });
  };

  const printPdf = () => {
    toast.message("Print PDF", { description: "Use your browser print dialog to save as PDF." });
    window.print();
  };

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <div className="max-w-[min(100%,28rem)] rounded-lg bg-[#0b1426] px-3 py-2 text-center text-xs font-semibold uppercase leading-snug tracking-wide text-white shadow-sm">
              {businessName || "Your business"}
            </div>
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

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-[150px] border-sky-200/80 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-sky-200/80"
              onClick={() =>
                toast.message("Email Excel", {
                  description: "Demo: connect mail to send this export.",
                })
              }
            >
              <Mail className="h-4 w-4" />
              Email Excel
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-sky-200/80 bg-background"
                >
                  Download Excel
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadCsv}>Download Excel (CSV)</DropdownMenuItem>
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
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card print:border-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground">
                Particulars
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/80 last:border-0">
                <td className="px-4 py-3 text-foreground">{r.label}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {fmtCell(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
