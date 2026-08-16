"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  reportHubFilterInnerClass,
  reportHubFilterScrollClass,
} from "@/lib/reports/report-mobile-ui";
import {
  isReportFavourited,
  REPORT_FAVOURITE_EVENT,
  seedDefaultReportFavourites,
  setReportFavourited,
} from "@/lib/reports/report-favourites";
import { useBalanceSheetLedgerStore } from "@/store/balance-sheet-ledger-store";
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

/** All catalogue reports (Favourite is built dynamically). */
const CATALOG_SECTIONS: SectionDef[] = [
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
      {
        label: "Bill Wise Profit",
        href: "/reports/transaction/bill-wise-profit",
        filters: ["invoice"],
      },
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
      {
        label: "Purchase Summary",
        href: "/reports/transaction/purchase-summary",
        filters: ["summary"],
      },
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

const ALL_REPORTS: ReportDef[] = (() => {
  const map = new Map<string, ReportDef>();
  for (const sec of CATALOG_SECTIONS) {
    for (const item of sec.items) {
      if (!map.has(item.href)) map.set(item.href, item);
    }
  }
  map.set("/reports/finance/balance-sheet", {
    label: "Balance Sheet",
    href: "/reports/finance/balance-sheet",
    filters: ["summary"],
  });
  map.set("/reports/gst/gstr-1-sales", {
    label: "GSTR-1 (Sales)",
    href: "/reports/gst/gstr-1-sales",
    filters: ["invoice", "summary"],
  });
  map.set("/reports/finance/profit-loss", {
    label: "Profit And Loss Report",
    href: "/reports/finance/profit-loss",
    filters: ["summary", "category"],
  });
  map.set("/reports/sales-summary-staff", {
    label: "Sales Summary - Staff wise",
    href: "/reports/sales-summary-staff",
    filters: ["summary", "party", "invoice"],
  });
  map.set("/reports/analytics", {
    label: "Analytics dashboard",
    href: "/reports/analytics",
    filters: ["summary"],
  });
  return [...map.values()];
})();

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
  const [favTick, setFavTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const balanceSheetFavourite = useBalanceSheetLedgerStore((s) => s.favourite);
  const setBalanceSheetFavourite = useBalanceSheetLedgerStore((s) => s.setFavourite);

  useEffect(() => {
    seedDefaultReportFavourites(setBalanceSheetFavourite);
  }, [setBalanceSheetFavourite]);

  useEffect(() => {
    const refresh = () => setFavTick((t) => t + 1);
    queueMicrotask(refresh);
    window.addEventListener(REPORT_FAVOURITE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(REPORT_FAVOURITE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

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

  const favouriteItems = useMemo(() => {
    void favTick;
    return ALL_REPORTS.filter((r) =>
      isReportFavourited(r.href, balanceSheetFavourite)
    ).filter(
      (it) => matchesSearch(it.label, query) && matchesFilter(it, activeFilter, "favourite")
    );
  }, [favTick, balanceSheetFavourite, query, activeFilter]);

  const visibleSections = useMemo(() => {
    const favouriteSection: SectionDef & { items: ReportDef[] } = {
      id: "favourite",
      title: "Favourite",
      icon: Sparkles,
      items: favouriteItems,
    };

    const rest = CATALOG_SECTIONS.map((sec) => {
      const items = sec.items.filter(
        (it) => matchesSearch(it.label, query) && matchesFilter(it, activeFilter, sec.id)
      );
      return { ...sec, items };
    }).filter((sec) => sec.items.length > 0);

    const sections: (SectionDef & { items: ReportDef[] })[] = [];
    if (favouriteItems.length > 0) {
      sections.push(favouriteSection);
    } else if (!query.trim() && !activeFilter) {
      sections.push({ ...favouriteSection, items: [] });
    }
    sections.push(...rest);
    return sections;
  }, [favouriteItems, query, activeFilter]);

  const toggleSection = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const unfavourite = useCallback(
    (href: string) => {
      setReportFavourited(href, false, {
        setBalanceSheetFavourite,
      });
      setFavTick((t) => t + 1);
      toast.message("Removed from favourites");
    },
    [setBalanceSheetFavourite]
  );

  const renderSectionCard = (sec: SectionDef & { items: ReportDef[] }) => {
    const Icon = sec.icon;
    const cap = sec.collapseAt;
    const isCollapsible = cap != null && sec.items.length > cap;
    const open = expanded[sec.id] ?? false;
    const shown = !isCollapsible || open ? sec.items : sec.items.slice(0, cap);

    return (
      <div
        key={sec.id}
        className="flex min-h-[220px] flex-col border border-border bg-card max-md:min-h-0 max-md:rounded-xl max-md:shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 max-md:px-3 max-md:py-2.5">
          <Icon className="h-5 w-5 text-muted-foreground max-md:h-4 max-md:w-4" aria-hidden />
          <span className="font-semibold text-foreground max-md:text-sm">{sec.title}</span>
        </div>
        <ul className="flex flex-1 flex-col gap-0 px-2 py-2 max-md:px-1.5">
          {sec.id === "favourite" && shown.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              No favourite reports. Star a report to add it here.
            </li>
          ) : (
            shown.map((item) => (
              <li key={item.href}>
                <div className="flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1 text-sm text-foreground/90 transition-colors hover:bg-muted max-md:px-2 max-md:py-2">
                  <Link
                    href={item.href}
                    className="min-w-0 flex-1 px-1 py-2 leading-snug max-md:text-[15px]"
                  >
                    {item.label}
                  </Link>
                  {sec.id === "favourite" ? (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      aria-label={`Remove ${item.label} from favourites`}
                      title="Remove from favourites"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        unfavourite(item.href);
                      }}
                    >
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        {isCollapsible && (
          <div className="mt-auto border-t border-border px-3 py-2 max-md:py-2.5">
            <button
              type="button"
              onClick={() => toggleSection(sec.id)}
              className="flex min-h-[44px] w-full items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
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
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col gap-6 pb-16 max-md:gap-4 max-md:pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between max-md:gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground max-md:text-xl">
          Reports
        </h1>
        <Button
          type="button"
          className="shrink-0 bg-violet-600 hover:bg-violet-700 max-md:w-full"
          onClick={() =>
            toast.message("CA Reports Sharing", {
              description: "Share GST report packs with your CA workspace.",
            })
          }
        >
          <Share2 className="mr-2 h-4 w-4" />
          CA Reports Sharing
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Filter By</span>
        <div className={reportHubFilterScrollClass}>
          <div className={reportHubFilterInnerClass}>
            {FILTER_PILLS.map((p) => (
              <button
                key={p.id ?? "all"}
                type="button"
                onClick={() => setActiveFilter((cur) => (cur === p.id ? null : p.id))}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors max-md:px-3 max-md:py-2 max-md:text-xs",
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
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports…"
          className="h-11 pl-9 max-md:h-10"
          aria-label="Find report"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 max-md:gap-3 max-md:grid-cols-1">
        {visibleSections
          .filter((s) => ["favourite", "gst", "transaction"].includes(s.id))
          .map(renderSectionCard)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 max-md:gap-3 max-md:grid-cols-1">
        {visibleSections
          .filter((s) => ["item", "party"].includes(s.id))
          .map(renderSectionCard)}
      </div>

      {visibleSections.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No reports match your search or filter.
        </p>
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 hidden items-center gap-2 text-sm text-muted-foreground md:flex">
        <span>Find Report</span>
        <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
          Ctrl
        </kbd>
        <span className="text-xs">+</span>
        <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
          F
        </kbd>
      </div>
    </div>
  );
}
