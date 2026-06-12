"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInventoryStore } from "@/store/inventory-store";
import { Info, Search } from "lucide-react";

const VENDOR_HELP =
  "Suppliers from stock purchases. Costs use unit price × quantity (litres) where recorded.";

type SortKey = "spend" | "name" | "recent";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "By spend" },
  { value: "recent", label: "Recent" },
  { value: "name", label: "A–Z" },
];

export default function VendorsPage() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");

  const rows = useMemo(() => {
    const byVendor = new Map<
      string,
      { count: number; totalCost: number; lastAt: string }
    >();
    for (const p of purchases) {
      const name = p.vendorName.trim() || "Unknown";
      const lineCost = (p.unitCost ?? 0) * (p.quantityMl / 1000);
      const prev = byVendor.get(name) ?? { count: 0, totalCost: 0, lastAt: p.purchasedAt };
      const totalCost = prev.totalCost + lineCost;
      const lastAt =
        new Date(p.purchasedAt) > new Date(prev.lastAt) ? p.purchasedAt : prev.lastAt;
      byVendor.set(name, {
        count: prev.count + 1,
        totalCost,
        lastAt,
      });
    }
    return [...byVendor.entries()]
      .map(([vendorName, agg]) => ({ vendorName, ...agg }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [purchases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? rows.filter((r) => r.vendorName.toLowerCase().includes(q))
      : rows;

    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.vendorName.localeCompare(b.vendorName);
      if (sortKey === "recent") {
        return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
      }
      return b.totalCost - a.totalCost;
    });

    return list;
  }, [rows, query, sortKey]);

  const partsNote = parts.length
    ? `${parts.length} parts in catalog`
    : "Load inventory for more context.";

  const emptyMessage =
    rows.length === 0
      ? "No purchase records yet."
      : "No vendors match your search.";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Vendors"
        description={VENDOR_HELP}
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 md:hidden"
                  aria-label="About vendors"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-[260px] text-xs leading-relaxed"
              >
                {VENDOR_HELP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={sortKey === opt.value ? "default" : "outline"}
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => setSortKey(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <>
          <MobileCardList className="space-y-2">
            {filtered.map((r) => (
              <MobileRowCard key={r.vendorName} className="p-3 shadow-none">
                <p className="text-base font-semibold leading-tight text-foreground">
                  {r.vendorName}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  <span>
                    Purchases:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {r.count}
                    </span>
                  </span>
                  <span className="mx-2 text-border">·</span>
                  <span>
                    Spend:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(r.totalCost)}
                    </span>
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last purchase:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(r.lastAt)}
                  </span>
                </p>
              </MobileRowCard>
            ))}
          </MobileCardList>

          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <DesktopTableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Purchases</th>
                    <th className="px-4 py-3 text-right font-medium">Est. spend</th>
                    <th className="px-4 py-3 text-right font-medium">Last purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.vendorName}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{r.vendorName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(r.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatDate(r.lastAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DesktopTableWrap>
            <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
              Part labels: {partsNote}
            </p>
          </div>
        </>
      )}

      {filtered.length > 0 ? (
        <p className="px-1 text-xs text-muted-foreground md:hidden">
          Part labels: {partsNote}
        </p>
      ) : null}
    </div>
  );
}
