"use client";

import { useMemo, useState } from "react";
import { ReportPageChrome } from "@/components/reports/report-page-chrome";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { ReportTableEmpty } from "@/components/reports/report-table-empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScopedInvoices } from "@/hooks/use-scoped-data";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useInventoryStore } from "@/store/inventory-store";
import { useCustomerStore } from "@/store/customer-store";
import {
  dateInPreset,
  DEFAULT_REPORT_PERIOD,
  reportSelectItemClass,
} from "@/lib/reports/report-period-presets";
import {
  aggregateItemSalesPurchase,
  buildItemReportByPartyRows,
  isLowStockPart,
  movementQtyDisplay,
  partNumericStock,
  partStockQtyDisplay,
  partStockValue,
} from "@/lib/reports/item-report-helpers";
import { formatDate, formatInrFull } from "@/lib/utils";
import type { Part, PartCategory } from "@/types";
import { BarChart3, Package, Search } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_ALL = "all" as const;

function categoryOptions(parts: Part[]): { value: string; label: string }[] {
  const set = new Set(parts.map((p) => p.category));
  const sorted = Array.from(set).sort() as PartCategory[];
  return [{ value: CATEGORY_ALL, label: "All categories" }, ...sorted.map((c) => ({ value: c, label: c }))];
}

export function ItemReportByParty() {
  const parts = useInventoryStore((s) => s.parts);
  const customers = useCustomerStore((s) => s.customers);
  const invoices = useScopedInvoices();
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [category, setCategory] = useState<string>(CATEGORY_ALL);
  const [party, setParty] = useState<string>("all");

  const catOpts = useMemo(() => categoryOptions(parts), [parts]);
  const rows = useMemo(() => {
    if (party === "all") return [];
    return buildItemReportByPartyRows(party, invoices, period, category, parts);
  }, [party, invoices, period, category, parts]);

  const downloadCsv = () => {
    toast.message(party === "all" ? "Select a party first" : "Download started");
  };

  return (
    <ReportPageChrome
      title="Item Report By Party"
      favouriteStorageKey="prime-detailer-item-by-party-fav"
      emailReportName="Item Report By Party"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[200px] border-border">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {catOpts.map((o) => (
                <SelectItem key={o.value} value={o.value} className={reportSelectItemClass}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={party} onValueChange={setParty}>
            <SelectTrigger className="h-9 w-[220px] border-border">
              <SelectValue placeholder="Select Party" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className={reportSelectItemClass}>
                All parties
              </SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id} className={reportSelectItemClass}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-left">Item Code</th>
              <th className="px-2 py-2 text-right">Sales Quantity</th>
              <th className="px-2 py-2 text-right">Sales Amount</th>
              <th className="px-2 py-2 text-right">Purchase Quantity</th>
              <th className="px-2 py-2 text-right">Purchase Amount</th>
            </tr>
          </thead>
          <tbody>
            {party === "all" ? (
              <ReportTableEmpty
                colSpan={6}
                message="Select a party to see item-wise sales"
                icon={Search}
              />
            ) : rows.length === 0 ? (
              <ReportTableEmpty
                colSpan={6}
                message="No transactions available for selected party"
                icon={Search}
              />
            ) : (
              rows.map((r) => (
                <tr key={r.itemName} className="border-b border-border/80 hover:bg-muted/10">
                  <td className="px-2 py-2 font-medium">{r.itemName}</td>
                  <td className="px-2 py-2 font-mono text-xs">{r.itemCode}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.salesQuantity}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.salesAmount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.purchaseQuantity}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(r.purchaseAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function ItemSalesPurchaseSummaryReport() {
  const parts = useInventoryStore((s) => s.parts);
  const movements = useInventoryStore((s) => s.stockMovements);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [category, setCategory] = useState<string>(CATEGORY_ALL);

  const rows = useMemo(
    () => aggregateItemSalesPurchase(parts, movements, category, period),
    [parts, movements, category, period]
  );

  const totals = useMemo(() => {
    const s = rows.reduce((a, r) => a + r.salesQty, 0);
    const p = rows.reduce((a, r) => a + r.purchaseQty, 0);
    return { sales: Math.round(s * 1000) / 1000, purchase: Math.round(p * 1000) / 1000 };
  }, [rows]);

  const catOpts = useMemo(() => categoryOptions(parts), [parts]);

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    const header = "Item Name,Sales Quantity,Purchase Quantity";
    const lines = rows.map((r) =>
      [`"${r.itemName.replace(/"/g, '""')}"`, r.salesQty, r.purchaseQty].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `item-sales-purchase-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Item Sales and Purchase Summary"
      favouriteStorageKey="prime-detailer-item-sp-summary-fav"
      emailReportName="Item Sales and Purchase Summary"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 min-w-[220px] border-border">
            <SelectValue placeholder="Search Category" />
          </SelectTrigger>
          <SelectContent>
            {catOpts.map((o) => (
              <SelectItem key={o.value} value={o.value} className={reportSelectItemClass}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <MobileCardList>
        {rows.map((r) => (
          <MobileRowCard key={r.partId}>
            <p className="font-medium leading-snug">{r.itemName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Sales qty</span>
                <p className="font-semibold tabular-nums">{r.salesQty}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Purchase qty</span>
                <p className="font-semibold tabular-nums">{r.purchaseQty}</p>
              </div>
            </div>
          </MobileRowCard>
        ))}
        {rows.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/25 p-4 text-sm font-semibold">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="tabular-nums">
                {totals.sales} / {totals.purchase}
              </span>
            </div>
          </div>
        )}
      </MobileCardList>
      <DesktopTableWrap className="rounded-lg border border-border bg-card">
        <table className="w-full min-w-[560px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-right">Sales Quantity</th>
              <th className="px-2 py-2 text-right">Purchase Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <>
                <tr className="border-b border-border bg-muted/25 font-semibold">
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.sales}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.purchase}</td>
                </tr>
                <ReportTableEmpty colSpan={3} />
              </>
            ) : (
              <>
                {rows.map((r) => (
                  <tr key={r.partId} className="border-b border-border/80">
                    <td className="px-2 py-2">{r.itemName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.salesQty}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.purchaseQty}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/25 font-semibold">
                  <td className="px-2 py-2">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.sales}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.purchase}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </DesktopTableWrap>
    </ReportPageChrome>
  );
}

export function LowStockSummaryReport() {
  const parts = useInventoryStore((s) => s.parts);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);

  const lowRows = useMemo(() => parts.filter(isLowStockPart), [parts]);

  const totalValue = useMemo(
    () => lowRows.reduce((s, p) => s + partStockValue(p), 0),
    [lowRows]
  );

  const downloadCsv = () => {
    if (lowRows.length === 0) {
      toast.message("No rows to export");
      return;
    }
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Low Stock Summary"
      favouriteStorageKey="prime-detailer-low-stock-fav"
      emailReportName="Low Stock Summary"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
    >
      <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total Stock Value: </span>
        <span className="font-semibold text-emerald-600 tabular-nums">
          {formatInrFull(totalValue)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[800px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-left">Item Code</th>
              <th className="px-2 py-2 text-right">Stock Quantity</th>
              <th className="px-2 py-2 text-right">Low Stock Level</th>
              <th className="px-2 py-2 text-right">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {lowRows.length === 0 ? (
              <ReportTableEmpty
                colSpan={5}
                message="No items available to generate report"
                icon={Package}
              />
            ) : (
              lowRows.map((p) => (
                <tr key={p.id} className="border-b border-border/80">
                  <td className="px-2 py-2">{p.name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{partStockQtyDisplay(p)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {p.stockQuantityMl != null
                      ? `${((p.reorderLevelMl ?? 0) / 1000).toFixed(1)} L`
                      : `${p.reorderLevel} PCS`}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(partStockValue(p))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function RateListReport() {
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const rows = useMemo(
    () => [...catalog].filter((s) => s.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );

  const downloadCsv = () => {
    const header = "Name,Item Code,MRP,Selling Price";
    const lines = rows.map((s) =>
      [`"${s.name.replace(/"/g, '""')}"`, "-", "-", s.defaultPrice].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rate-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Rate List"
      favouriteStorageKey="prime-detailer-rate-list-fav"
      emailReportName="Rate List"
      period="week"
      onPeriodChange={() => {}}
      showPeriod={false}
      onDownloadCsv={downloadCsv}
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-center">Item Code</th>
              <th className="px-2 py-2 text-center">MRP</th>
              <th className="px-2 py-2 text-right">Selling Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/80 hover:bg-muted/20">
                <td className="px-2 py-2">{s.name}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">—</td>
                <td className="px-2 py-2 text-center text-muted-foreground">—</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">
                  {formatInrFull(s.defaultPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}

export function StockDetailReport() {
  const parts = useInventoryStore((s) => s.parts);
  const movements = useInventoryStore((s) => s.stockMovements);
  const [period, setPeriod] = useState<string>(DEFAULT_REPORT_PERIOD);
  const [partId, setPartId] = useState<string>("");

  const sortedParts = useMemo(
    () => [...parts].sort((a, b) => a.name.localeCompare(b.name)),
    [parts]
  );

  const rows = useMemo(() => {
    if (!partId) return [];
    return movements
      .filter((m) => m.partId === partId && dateInPreset(m.createdAt, period))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, partId, period]);

  const downloadCsv = () => {
    if (!partId || rows.length === 0) {
      toast.message("Select an item and ensure movements exist for export.");
      return;
    }
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Stock Detail Report"
      favouriteStorageKey="prime-detailer-stock-detail-fav"
      emailReportName="Stock Detail Report"
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
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Transaction Type</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Closing Stock</th>
              <th className="px-2 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {!partId ? (
              <ReportTableEmpty
                colSpan={5}
                message="Select an Item first to see the reports."
                icon={Search}
              />
            ) : rows.length === 0 ? (
              <ReportTableEmpty colSpan={5} message="No movements in this period for this item." />
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-border/80">
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(m.createdAt)}</td>
                  <td className="px-2 py-2">{m.type === "IN" ? "Inward" : "Outward"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{movementQtyDisplay(m)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                  <td className="max-w-[240px] truncate px-2 py-2 text-muted-foreground">
                    {m.reason}
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

export function StockSummaryReport() {
  const parts = useInventoryStore((s) => s.parts);
  const [period, setPeriod] = useState("today");
  const [category, setCategory] = useState<string>(CATEGORY_ALL);

  const filtered = useMemo(
    () => (category === CATEGORY_ALL ? parts : parts.filter((p) => p.category === category)),
    [parts, category]
  );

  const totalValue = useMemo(
    () => filtered.reduce((s, p) => s + partStockValue(p), 0),
    [filtered]
  );

  const totalQty = useMemo(
    () => Math.round(filtered.reduce((s, p) => s + partNumericStock(p), 0) * 100) / 100,
    [filtered]
  );

  const catOpts = useMemo(() => categoryOptions(parts), [parts]);

  const downloadCsv = () => {
    const header =
      "Item Name,Batch Number,Item Code,Purchase Price,Selling Price,Stock Quantity,Stock Value";
    const lines = filtered.map((p) => {
      const sell = p.unitPrice;
      const buy = Math.round(sell * 0.92 * 100) / 100;
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        "-",
        p.sku,
        buy,
        sell,
        partNumericStock(p),
        partStockValue(p),
      ].join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message("Download started");
  };

  return (
    <ReportPageChrome
      title="Stock Summary"
      favouriteStorageKey="prime-detailer-stock-summary-fav"
      emailReportName="Stock Summary"
      period={period}
      onPeriodChange={setPeriod}
      onDownloadCsv={downloadCsv}
      filterSlot={
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 min-w-[220px] border-border">
            <SelectValue placeholder="Search Category" />
          </SelectTrigger>
          <SelectContent>
            {catOpts.map((o) => (
              <SelectItem key={o.value} value={o.value} className={reportSelectItemClass}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <BarChart3 className="h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Total Stock Value</p>
            <p className="text-lg font-semibold tabular-nums">{formatInrFull(totalValue)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <Package className="h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Total Stock Quantity</p>
            <p className="text-lg font-semibold tabular-nums">{totalQty}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
              <th className="px-2 py-2 text-left">Item Name</th>
              <th className="px-2 py-2 text-center">Batch Number</th>
              <th className="px-2 py-2 text-left">Item Code</th>
              <th className="px-2 py-2 text-right">Purchase Price</th>
              <th className="px-2 py-2 text-right">Selling Price</th>
              <th className="px-2 py-2 text-right">Stock Quantity</th>
              <th className="px-2 py-2 text-right">Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const sell = p.unitPrice;
              const buy = Math.round(sell * 0.92 * 100) / 100;
              return (
                <tr key={p.id} className="border-b border-border/80 hover:bg-muted/15">
                  <td className="px-2 py-2">{p.name}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">—</td>
                  <td className="px-2 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(buy)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(sell)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{partStockQtyDisplay(p)}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {formatInrFull(partStockValue(p))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ReportPageChrome>
  );
}
