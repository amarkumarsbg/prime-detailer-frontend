"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AGEING_DUMMY_ROWS,
  OUTSTANDING_DUMMY_ROWS,
  type AgeingBucketRow,
  type OutstandingPartyRow,
} from "@/lib/reports/party-outstanding-dummy";
import { reportSelectItemClass } from "@/lib/reports/report-period-presets";
import { useInventoryStore } from "@/store/inventory-store";
import { useCustomerStore } from "@/store/customer-store";
import { cn, formatInrFull } from "@/lib/utils";
import {
  AlertCircle,
  CircleDollarSign,
  Clock,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";

function DashOrMoney({
  v,
  className,
}: {
  v: number | null | undefined;
  className?: string;
}) {
  if (v == null || v === 0) {
    return (
      <td className={cn("border border-border px-2 py-1.5 text-center text-muted-foreground", className)}>
        —
      </td>
    );
  }
  return (
    <td
      className={cn(
        "border border-border px-2 py-1.5 text-right text-sm tabular-nums",
        className
      )}
    >
      {formatInrFull(v)}
    </td>
  );
}

export function AgeingReport() {
  const [period, setPeriod] = useState("today");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return AGEING_DUMMY_ROWS;
    return AGEING_DUMMY_ROWS.filter((r) => r.partyName.toLowerCase().includes(s));
  }, [q]);

  const footer = useMemo(() => {
    const z = (fn: (r: AgeingBucketRow) => number | null) =>
      rows.reduce((s, r) => s + (fn(r) ?? 0), 0);
    return {
      byTomorrow: z((r) => r.byTomorrow),
      upcoming: z((r) => r.upcoming),
      totalDue: z((r) => r.totalDue),
      d1to15: z((r) => r.d1to15),
      d16to30: z((r) => r.d16to30),
      d30plus: z((r) => r.d30plus),
      totalOverdue: z((r) => r.totalOverdue),
      totalAmount: z((r) => r.totalAmount),
    };
  }, [rows]);

  const downloadCsv = () => {
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Ageing Report"
      favouriteStorageKey="prime-detailer-ageing-fav"
      emailReportName="Ageing Report"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="mb-3 print:hidden">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by party name"
            className="pl-9"
            aria-label="Search by party name"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card print:text-xs">
        <table className="w-full min-w-[1100px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              <th
                className="border border-border bg-muted/50 px-2 py-2 text-left text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs"
                rowSpan={2}
              >
                Party Name
              </th>
              <th
                className="border border-border bg-[#fff9e6] px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-foreground sm:text-xs"
                colSpan={3}
              >
                Not yet due
              </th>
              <th
                className="border border-border bg-[#fdf2f2] px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-foreground sm:text-xs"
                colSpan={4}
              >
                Overdue
              </th>
              <th
                className="border border-border bg-muted/50 px-2 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs"
                rowSpan={2}
              >
                T. Amount
              </th>
            </tr>
            <tr>
              <th className="border border-border bg-[#fff9e6] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                By Tomorrow
              </th>
              <th className="border border-border bg-[#fff9e6] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                Upcoming
              </th>
              <th className="border border-border bg-[#fff9e6] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                T. Due
              </th>
              <th className="border border-border bg-[#fdf2f2] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                1-15 Days
              </th>
              <th className="border border-border bg-[#fdf2f2] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                16-30 Days
              </th>
              <th className="border border-border bg-[#fdf2f2] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                30+ Days
              </th>
              <th className="border border-border bg-[#fdf2f2] px-2 py-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                T. Overdue
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10">
                <td className="border border-border px-2 py-1.5">{r.partyName}</td>
                <DashOrMoney v={r.byTomorrow} />
                <DashOrMoney v={r.upcoming} />
                <DashOrMoney v={r.totalDue} />
                <DashOrMoney v={r.d1to15} />
                <DashOrMoney v={r.d16to30} />
                <DashOrMoney v={r.d30plus} />
                <DashOrMoney v={r.totalOverdue} className="font-medium text-red-600" />
                <td className="border border-border px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatInrFull(r.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td className="border border-border px-2 py-2">Total</td>
              <td className="border border-border px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatInrFull(footer.byTomorrow)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatInrFull(footer.upcoming)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatInrFull(footer.totalDue)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatInrFull(footer.d1to15)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatInrFull(footer.d16to30)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums">
                {formatInrFull(footer.d30plus)}
              </td>
              <td className="border border-border px-2 py-2 text-right font-medium tabular-nums text-red-600">
                {formatInrFull(footer.totalOverdue)}
              </td>
              <td className="border border-border px-2 py-2 text-right tabular-nums">
                {formatInrFull(footer.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function PartyReportByItem() {
  const parts = useInventoryStore((s) => s.parts);
  const [period, setPeriod] = useState("week");
  const [partId, setPartId] = useState<string>("");

  const sortedParts = useMemo(
    () => [...parts].sort((a, b) => a.name.localeCompare(b.name)),
    [parts]
  );

  const downloadCsv = () => {
    toast.message("Select an item first.");
  };

  return (
    <ReportPageChrome
      title="Party Report By Item"
      favouriteStorageKey="prime-detailer-party-by-item-fav"
      emailReportName="Party Report By Item"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <Select value={partId || "none"} onValueChange={(v) => setPartId(v === "none" ? "" : v)}>
          <SelectTrigger className="h-9 min-w-[240px] border-border">
            <SelectValue placeholder="Search Item" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className={reportSelectItemClass}>
              Search Item
            </SelectItem>
            {sortedParts.map((p) => (
              <SelectItem key={p.id} value={p.id} className={reportSelectItemClass}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Party Name</th>
              <th className="px-2 py-2 text-right">Sales Quantity</th>
              <th className="px-2 py-2 text-right">Sales Amount</th>
              <th className="px-2 py-2 text-right">Purchase Quantity</th>
              <th className="px-2 py-2 text-right">Purchase Amount</th>
            </tr>
          </thead>
          <tbody>
            {!partId ? (
              <ReportTableEmpty
                colSpan={5}
                message="Select an Item first to see the reports"
                icon={Search}
              />
            ) : (
              <ReportTableEmpty
                colSpan={5}
                message="No party movements for this item in the selected period."
                icon={Search}
              />
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function PartyLedgerStatementReport() {
  const customers = useCustomerStore((s) => s.customers);
  const [period, setPeriod] = useState("today");
  const [partyId, setPartyId] = useState<string>("");

  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  const downloadCsv = () => {
    if (!partyId) {
      toast.message("Select a party first.");
      return;
    }
    toast.message("Download started.");
  };

  return (
    <ReportPageChrome
      title="Party Statement (Ledger)"
      favouriteStorageKey="prime-detailer-party-ledger-fav"
      emailReportName="Party Statement (Ledger)"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <div className="relative min-w-[260px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={partyId || "none"} onValueChange={(v) => setPartyId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 border-border pl-9">
              <SelectValue placeholder="Select party by name ..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className={reportSelectItemClass}>
                Select party by name ...
              </SelectItem>
              {sorted.map((c) => (
                <SelectItem key={c.id} value={c.id} className={reportSelectItemClass}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <CircleDollarSign className="mt-0.5 h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Total Receivable Amount</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {partyId ? formatInrFull(125000) : "₹ —"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <AlertCircle className="mt-0.5 h-8 w-8 text-amber-500" aria-hidden />
          <div>
            <p className="text-xs font-medium text-amber-600">Overdue Amount</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {partyId ? formatInrFull(47400.6) : "₹ —"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <FileText className="mt-0.5 h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Total Sales Amount</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {partyId ? formatInrFull(248000) : "₹ —"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Clock className="mt-0.5 h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Total Received Amount</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {partyId ? formatInrFull(120599.4) : "₹ —"}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-[240px] overflow-x-auto rounded-lg border border-dashed border-border bg-muted/10">
        {!partyId ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Search className="h-14 w-14 opacity-25 text-sky-500/80" aria-hidden />
            <p className="text-sm">Select a Party first to see the reports</p>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No ledger entries for this party in the selected period.
          </p>
        )}
      </div>
    </ReportPageChrome>
  );
}

const CATEGORY_FILTER = [
  { value: "all", label: "All Categories" },
  { value: "b2b", label: "B2B" },
  { value: "retail", label: "Retail" },
] as const;

export function PartyWiseOutstandingReport() {
  const [period, setPeriod] = useState("today");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<"all" | "collect" | "pay">("all");

  const { toCollect, toPay, filteredRows } = useMemo(() => {
    const rows: OutstandingPartyRow[] = OUTSTANDING_DUMMY_ROWS;
    const collect = rows
      .filter((r) => r.closingBalance != null && r.closingBalance > 0)
      .reduce((s, r) => s + (r.closingBalance ?? 0), 0);
    const pay = rows
      .filter((r) => r.closingBalance != null && r.closingBalance < 0)
      .reduce((s, r) => s + Math.abs(r.closingBalance ?? 0), 0);

    let view = rows;
    if (tab === "collect") {
      view = rows.filter((r) => r.closingBalance != null && r.closingBalance > 0);
    } else if (tab === "pay") {
      view = rows.filter((r) => r.closingBalance != null && r.closingBalance < 0);
    }

    return { toCollect: collect, toPay: pay, filteredRows: view };
  }, [tab]);

  const downloadCsv = () => {
    toast.message("Download started.");
  };

  return (
    <ReportPageChrome
      title="Party Wise Outstanding"
      favouriteStorageKey="prime-detailer-party-outstanding-fav"
      emailReportName="Party Wise Outstanding"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[200px] border-border">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTER.map((c) => (
              <SelectItem key={c.value} value={c.value} className={reportSelectItemClass}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "all" | "collect" | "pay")}
          className="w-full"
        >
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="collect"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:text-emerald-700 data-[state=active]:shadow-none"
            >
              To Collect{" "}
              <span className="ml-2 font-semibold tabular-nums text-violet-700">
                {formatInrFull(toCollect)}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="pay"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:text-red-700 data-[state=active]:shadow-none"
            >
              To Pay{" "}
              <span className="ml-2 font-semibold tabular-nums">{formatInrFull(toPay)}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="shrink-0 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          GSTIN and Address can be viewed in excel report
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-left">Contact Number</th>
              <th className="px-2 py-2 text-right">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <ReportTableEmpty colSpan={4} />
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} className="border-b border-border/80 hover:bg-muted/15">
                  <td className="max-w-[280px] truncate px-2 py-2 font-medium">{r.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">
                    {r.contact ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {r.closingBalance != null ? formatInrFull(r.closingBalance) : "—"}
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

export function SalesSummaryCategoryWiseReport() {
  const [period, setPeriod] = useState("week");

  const downloadCsv = () => {
    toast.message("No rows to export");
  };

  return (
    <ReportPageChrome
      title="Sales Summary - Category Wise"
      favouriteStorageKey="prime-detailer-sales-cat-wise-fav"
      emailReportName="Sales Summary - Category Wise"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1000px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Invoice No</th>
              <th className="px-2 py-2 text-left">Party Sale</th>
              <th className="px-2 py-2 text-left">Created By</th>
              <th className="px-2 py-2 text-left">Due Date</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-right">Balance</th>
              <th className="px-2 py-2 text-left">Invoice Type</th>
              <th className="px-2 py-2 text-left">Invoice Status</th>
            </tr>
          </thead>
          <tbody>
            <ReportTableEmpty colSpan={9} />
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
