"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  Percent,
  Search,
  Share2,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type FilterId = "party" | "category" | "payment" | "item" | "invoice" | "summary" | null;

type ReportDef = {
  label: string;
  href: string;
  /** Used when a filter pill is active */
  filters?: FilterId[];
};

type SectionDef = {
  id: string;
  title: string;
  icon: typeof Sparkles;
  collapseAt?: number;
  items: ReportDef[];
};

const FILTER_PILLS: { id: FilterId; label: string }[] = [
  { id: "party", label: "Party" },
  { id: "category", label: "Category" },
  { id: "payment", label: "Payment Collection" },
  { id: "item", label: "Item" },
  { id: "invoice", label: "Invoice Details" },
  { id: "summary", label: "Summary" },
];

const SECTIONS: SectionDef[] = [
  {
    id: "favourite",
    title: "Favourite",
    icon: Sparkles,
    items: [
      { label: "Balance Sheet", href: "/reports/finance/balance-sheet", filters: ["summary"] },
      { label: "GSTR-1 (Sales)", href: "/reports/gst/gstr-1-sales", filters: ["invoice", "summary"] },
      {
        label: "Profit And Loss Report",
        href: "/reports/finance/profit-loss",
        filters: ["summary", "category"],
      },
      {
        label: "Sales Summary - Staff wise",
        href: "/reports/sales-summary-staff",
        filters: ["summary", "party", "invoice"],
      },
      { label: "Analytics dashboard", href: "/reports/analytics", filters: ["summary"] },
    ],
  },
  {
    id: "gst",
    title: "GST",
    icon: Percent,
    collapseAt: 4,
    items: [
      { label: "GSTR-2 (Purchase)", href: "/reports/gst/gstr-2-purchase", filters: ["invoice"] },
      { label: "GSTR-3b", href: "/reports/gst/gstr-3b", filters: ["invoice", "summary"] },
      {
        label: "GST Purchase (With HSN)",
        href: "/reports/gst/gst-purchase-hsn",
        filters: ["invoice", "item"],
      },
      {
        label: "GST Sales (With HSN)",
        href: "/reports/gst/gst-sales-hsn",
        filters: ["invoice", "item"],
      },
      {
        label: "HSN Wise Sales Summary",
        href: "/reports/gst/hsn-wise-sales-summary",
        filters: ["item", "summary", "invoice"],
      },
      { label: "TDS Payable", href: "/reports/gst/tds-payable", filters: ["payment"] },
      { label: "TDS Receivable", href: "/reports/gst/tds-receivable", filters: ["payment"] },
      { label: "TCS Payable", href: "/reports/gst/tcs-payable", filters: ["payment"] },
      { label: "TCS Receivable", href: "/reports/gst/tcs-receivable", filters: ["payment"] },
    ],
  },
  {
    id: "transaction",
    title: "Transaction",
    icon: FileText,
    collapseAt: 4,
    items: [
      { label: "Audit Trail", href: "/activity", filters: ["summary"] },
      { label: "Bill Wise Profit", href: "/reports/transaction/bill-wise-profit", filters: ["invoice"] },
      {
        label: "Cash and Bank Report (All Payments)",
        href: "/reports/transaction/cash-bank",
        filters: ["payment"],
      },
      { label: "Daybook", href: "/reports/transaction/daybook", filters: ["summary"] },
      {
        label: "Expense Category Report",
        href: "/reports/transaction/expense-category",
        filters: ["category"],
      },
      {
        label: "Expense Transaction Report",
        href: "/reports/transaction/expense-transaction",
        filters: ["category", "payment"],
      },
      { label: "Purchase Summary", href: "/reports/transaction/purchase-summary", filters: ["summary"] },
    ],
  },
  {
    id: "item",
    title: "Item",
    icon: Package,
    collapseAt: 4,
    items: [
      { label: "Item Report By Party", href: "/reports/item/by-party", filters: ["party", "item"] },
      {
        label: "Item Sales and Purchase Summary",
        href: "/reports/item/sales-purchase-summary",
        filters: ["item", "summary"],
      },
      { label: "Low Stock Summary", href: "/reports/item/low-stock-summary", filters: ["item"] },
      { label: "Rate List", href: "/reports/item/rate-list", filters: ["item"] },
      { label: "Stock Detail Report", href: "/reports/item/stock-detail", filters: ["item"] },
      { label: "Stock Summary", href: "/reports/item/stock-summary", filters: ["item", "summary"] },
    ],
  },
  {
    id: "party",
    title: "Party",
    icon: Users,
    collapseAt: 4,
    items: [
      {
        label: "Receivable Ageing Report",
        href: "/reports/party/receivable-ageing",
        filters: ["party", "payment"],
      },
      { label: "Party Report By Item", href: "/reports/party/by-item", filters: ["party", "item"] },
      {
        label: "Party Statement (Ledger)",
        href: "/reports/party/ledger",
        filters: ["party", "summary"],
      },
      {
        label: "Party Wise Outstanding",
        href: "/reports/party/party-wise-outstanding",
        filters: ["party", "payment"],
      },
      {
        label: "Sales Summary - Category Wise",
        href: "/reports/party/sales-summary-category",
        filters: ["party", "category", "summary"],
      },
      {
        label: "Sales Summary - Staff wise",
        href: "/reports/sales-summary-staff",
        filters: ["party", "summary", "invoice"],
      },
    ],
  },
];

function matchesSearch(label: string, q: string): boolean {
  if (!q.trim()) return true;
  return label.toLowerCase().includes(q.trim().toLowerCase());
}

function matchesFilter(
  item: ReportDef,
  activeFilter: FilterId,
  sectionId: string
): boolean {
  if (!activeFilter) return true;
  if (item.filters?.includes(activeFilter)) return true;
  if (activeFilter === "party" && sectionId === "party") return true;
  if (activeFilter === "item" && sectionId === "item") return true;
  if (activeFilter === "invoice" && sectionId === "gst") return true;
  if (activeFilter === "summary" && sectionId === "favourite") return true;
  return false;
}

export function ReportsHub() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleSections = useMemo(() => {
    return SECTIONS.map((sec) => {
      const items = sec.items.filter(
        (it) => matchesSearch(it.label, query) && matchesFilter(it, activeFilter, sec.id)
      );
      return { ...sec, items };
    }).filter((sec) => sec.items.length > 0);
  }, [query, activeFilter]);

  const toggleSection = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderSectionCard = (sec: SectionDef & { items: ReportDef[] }) => {
    const Icon = sec.icon;
    const cap = sec.collapseAt;
    const isCollapsible = cap != null && sec.items.length > cap;
    const open = expanded[sec.id] ?? false;
    const shown =
      !isCollapsible || open ? sec.items : sec.items.slice(0, cap);

    return (
      <div
        key={sec.id}
        className="flex min-h-[220px] flex-col border border-border bg-card"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="font-semibold text-foreground">{sec.title}</span>
        </div>
        <ul className="flex flex-1 flex-col gap-0 px-2 py-2">
          {shown.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-foreground/90 transition-colors hover:bg-muted"
              >
                <span className="leading-snug">{item.label}</span>
                {sec.id === "favourite" && (
                  <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                )}
              </Link>
            </li>
          ))}
        </ul>
        {isCollapsible && (
          <div className="mt-auto border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => toggleSection(sec.id)}
              className="flex w-full items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {open ? (
                <>
                  See less <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  See more <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col gap-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
        <Button
          type="button"
          className="shrink-0 bg-violet-600 hover:bg-violet-700"
          onClick={() => toast.message("CA Reports Sharing", { description: "Share GST report packs with your CA workspace." })}
        >
          <Share2 className="mr-2 h-4 w-4" />
          CA Reports Sharing
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Filter By</span>
        <div className="flex flex-wrap gap-2">
          {FILTER_PILLS.map((p) => (
            <button
              key={p.id ?? "all"}
              type="button"
              onClick={() => setActiveFilter((cur) => (cur === p.id ? null : p.id))}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                activeFilter === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports…"
          className="pl-9"
          aria-label="Find report"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {visibleSections
          .filter((s) => ["favourite", "gst", "transaction"].includes(s.id))
          .map(renderSectionCard)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleSections
          .filter((s) => ["item", "party"].includes(s.id))
          .map(renderSectionCard)}
      </div>

      {visibleSections.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No reports match your search or filter.
        </p>
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Find Report</span>
        <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">Ctrl</kbd>
        <span className="text-xs">+</span>
        <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">F</kbd>
      </div>
    </div>
  );
}
