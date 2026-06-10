"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GSTR2_DUMMY_PURCHASE_ROWS,
  type Gstr2PurchaseDummyRow,
} from "@/lib/reports/gstr2-purchase-dummy-data";
import { formatInrFull } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Mail,
  Printer,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const FAV_KEY = "prime-detailer-gstr2-favourite";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "last7", label: "Last 7 days" },
  { value: "month", label: "This Month" },
  { value: "prevMonth", label: "Previous Month" },
  { value: "last30", label: "Last 30 Days" },
  { value: "quarter", label: "This Quarter" },
  { value: "prevQuarter", label: "Previous Quarter" },
  { value: "fy", label: "Current Fiscal Year" },
  { value: "prevFy", label: "Previous Fiscal Year" },
  { value: "last365", label: "Last 365 Days" },
] as const;

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
  if (preset === "lastWeek") {
    const wd = today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(thisMon.getDate() - (wd === 0 ? 6 : wd - 1));
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastSun.getDate() + 6);
    return t >= startOfDay(lastMon).getTime() && t <= endOfDay(lastSun).getTime();
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
  if (preset === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), q * 3, 1);
    const last = new Date(now.getFullYear(), q * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevQuarter") {
    const q = Math.floor(now.getMonth() / 3) - 1;
    const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const qq = ((q % 4) + 4) % 4;
    const first = new Date(y, qq * 3, 1);
    const last = new Date(y, qq * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "fy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevFy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "last365") {
    const from = new Date(today);
    from.setDate(from.getDate() - 364);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  return true;
}

function fmtCell(iso: string) {
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

function totalTax(r: Gstr2PurchaseDummyRow) {
  return r.sgst + r.cgst + r.igst + r.cess;
}

const selectItemClass =
  "cursor-pointer focus:bg-muted/70 focus:text-foreground data-[highlighted]:bg-muted/70 data-[state=checked]:bg-transparent data-[state=checked]:font-medium";

export function Gstr2PurchaseReport() {
  const [favourite, setFavourite] = useState(false);
  const [period, setPeriod] = useState<string>("week");
  const [mainTab, setMainTab] = useState("purchase");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailYour, setEmailYour] = useState("agenciessamriddhi@gmail.com");
  const [emailCa, setEmailCa] = useState("nka.clients@gmail.com");

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

  const filteredPurchase = useMemo(() => {
    return GSTR2_DUMMY_PURCHASE_ROWS.filter((r) => inDatePreset(r.invoiceDate, period));
  }, [period]);

  const downloadCsv = () => {
    const rows = mainTab === "purchase" ? filteredPurchase : [];
    const header = [
      "GSTIN",
      "Vendor",
      "State Code",
      "State Name",
      "Invoice No",
      "Invoice Date",
      "Invoice Value",
      "Invoice Type",
      "Tax %",
      "Taxable",
      "SGST",
      "CGST",
      "IGST",
      "Cess",
      "Total Tax",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.gstin,
        `"${r.vendorName.replace(/"/g, '""')}"`,
        r.stateCode,
        r.stateName,
        r.invoiceNo,
        r.invoiceDate,
        r.invoiceValue,
        r.invoiceType,
        r.taxPercent,
        r.taxableValue,
        r.sgst,
        r.cgst,
        r.igst,
        r.cess,
        totalTax(r),
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gstr2-purchase-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  const printPdf = () => {
    toast.message("Print PDF", { description: "Use your browser print dialog to save as PDF." });
    window.print();
  };

  const sendEmail = () => {
    if (!emailYour.trim()) {
      toast.error("Enter your email.");
      return;
    }
    toast.success("Report queued", { description: `Sending to ${emailYour.trim()}` });
    setEmailOpen(false);
  };

  const tableBody = (rows: Gstr2PurchaseDummyRow[]) => {
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={15} className="px-4 py-20 text-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <FileSpreadsheet className="h-14 w-14 opacity-20" aria-hidden />
              <p className="text-sm">No transactions available to generate report</p>
            </div>
          </td>
        </tr>
      );
    }
    return (
      <>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-border/80 hover:bg-muted/20">
            <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.gstin}</td>
            <td className="max-w-[160px] truncate px-2 py-2">{r.vendorName}</td>
            <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums">{r.stateCode}</td>
            <td className="whitespace-nowrap px-2 py-2">{r.stateName}</td>
            <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.invoiceNo}</td>
            <td className="whitespace-nowrap px-2 py-2">{fmtCell(r.invoiceDate)}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {formatInrFull(r.invoiceValue)}
            </td>
            <td className="whitespace-nowrap px-2 py-2">{r.invoiceType}</td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{r.taxPercent}%</td>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {formatInrFull(r.taxableValue)}
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
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
              {formatInrFull(r.cess)}
            </td>
            <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">
              {formatInrFull(totalTax(r))}
            </td>
          </tr>
        ))}
      </>
    );
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
              GSTR-2 (Purchase)
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
              onClick={() => setEmailOpen(true)}
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

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[200px] border-violet-300/60 bg-background">
              <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-primary" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent position="popper" className="min-w-[var(--radix-select-trigger-width)]">
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className={selectItemClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 border-b border-border bg-transparent p-0 shadow-none">
          <TabsTrigger
            value="purchase"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm text-muted-foreground shadow-none ring-offset-0 focus-visible:ring-0 data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Purchase
          </TabsTrigger>
          <TabsTrigger
            value="return"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm text-muted-foreground shadow-none ring-offset-0 focus-visible:ring-0 data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Purchase Return
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchase" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[1400px] border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                  <th className="border-r border-border px-2 py-2" rowSpan={2}>
                    GSTIN
                  </th>
                  <th className="border-r border-border px-2 py-2" rowSpan={2}>
                    Customer Name
                  </th>
                  <th className="border-b border-border px-2 py-1.5 text-center" colSpan={2}>
                    Place of Supply
                  </th>
                  <th className="border-b border-border px-2 py-1.5 text-center" colSpan={4}>
                    Invoice Details
                  </th>
                  <th className="border-r border-border px-2 py-2" rowSpan={2}>
                    Total Tax %
                  </th>
                  <th className="border-r border-border px-2 py-2" rowSpan={2}>
                    Taxable Value
                  </th>
                  <th className="border-b border-border px-2 py-1.5 text-center" colSpan={5}>
                    Amount of Tax
                  </th>
                </tr>
                <tr className="border-b border-border bg-muted/50 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">
                  <th className="border-r border-border px-2 py-2">State Code</th>
                  <th className="border-r border-border px-2 py-2">State Name</th>
                  <th className="border-r border-border px-2 py-2">Invoice No / Original No</th>
                  <th className="border-r border-border px-2 py-2">Invoice Date</th>
                  <th className="border-r border-border px-2 py-2">Invoice Value</th>
                  <th className="border-r border-border px-2 py-2">Invoice Type</th>
                  <th className="border-r border-border px-2 py-2">SGST</th>
                  <th className="border-r border-border px-2 py-2">CGST</th>
                  <th className="border-r border-border px-2 py-2">IGST</th>
                  <th className="border-r border-border px-2 py-2">Cess</th>
                  <th className="px-2 py-2">Total Tax</th>
                </tr>
              </thead>
              <tbody className="text-foreground">{tableBody(filteredPurchase)}</tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="return" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="px-4 py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-12 w-12 opacity-20" aria-hidden />
                      <p className="text-sm">No purchase return transactions in this period.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Excel Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We will send you the GSTR-2 (Purchase) report to the email below
          </p>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="gstr2-email-you">
                Your Email ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gstr2-email-you"
                type="email"
                value={emailYour}
                onChange={(e) => setEmailYour(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstr2-email-ca">CA Email ID (Optional)</Label>
              <Input
                id="gstr2-email-ca"
                type="email"
                value={emailCa}
                onChange={(e) => setEmailCa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              onClick={sendEmail}
            >
              Send Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
