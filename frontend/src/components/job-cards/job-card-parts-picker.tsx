"use client";

import { useMemo, useState } from "react";
import { Search, Package, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryStore } from "@/store/inventory-store";
import { formatCurrency, cn } from "@/lib/utils";
import { getStockStatus, stockStatusShortLabel } from "@/lib/inventory-units";
import {
  formatAvailableStock,
  formatDualUnitStock,
  formatDualUnitStockEquivalent,
  getSelectableUnits,
  getUnitPrice,
  hasDualUnitPart,
  partMatchesInventorySearch,
  validateStockConsumption,
} from "@/lib/inventory/multi-unit";
import type { Part, PartCategory, JobCardPartItem } from "@/types";

export type SelectedPartLine = {
  partId: string;
  quantity: number;
  unit: string;
};

export function selectedLinesFromJobParts(parts: JobCardPartItem[]): SelectedPartLine[] {
  return parts.map((p) => ({ partId: p.partId, quantity: p.quantity, unit: p.unit }));
}

export function buildJobCardPartItems(
  jobCardId: string,
  lines: SelectedPartLine[],
  inventoryParts: Part[]
): JobCardPartItem[] {
  const byId = new Map(inventoryParts.map((p) => [p.id, p]));
  return lines
    .map((line) => {
      const part = byId.get(line.partId);
      if (!part) return null;
      const unitPrice = getUnitPrice(part, line.unit);
      const lineTotal = Math.round(line.quantity * unitPrice * 100) / 100;
      return {
        id: `jp-${jobCardId}-${part.id}`,
        jobCardId,
        partId: part.id,
        name: part.name,
        sku: part.sku,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice,
        lineTotal,
      };
    })
    .filter((x): x is JobCardPartItem => x != null);
}

export function jobCardPartsSubtotal(parts: JobCardPartItem[]): number {
  return parts.reduce((sum, p) => sum + p.lineTotal, 0);
}

const PART_CATEGORIES: (PartCategory | "ALL")[] = [
  "ALL",
  "Engine",
  "Brakes",
  "Electrical",
  "Filters",
  "Suspension",
  "AC",
  "Body",
  "Lubricants",
  "Tires",
  "Detailing",
  "Other",
];

export function JobCardPartsPicker({
  selectedLines,
  onSelectedLinesChange,
  hideIntro = false,
  collapseSelected = false,
}: {
  selectedLines: SelectedPartLine[];
  onSelectedLinesChange: (lines: SelectedPartLine[]) => void;
  /** Hide title/help when the parent already shows step or dialog context. */
  hideIntro?: boolean;
  /** Collapse selected parts into an accordion to save vertical space in wizards. */
  collapseSelected?: boolean;
}) {
  const parts = useInventoryStore((s) => s.parts);
  const [partSearch, setPartSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedExpanded, setSelectedExpanded] = useState(!collapseSelected);
  /** Lets users clear/retype qty without snapping back to 1 mid-edit. */
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const partsById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      if (categoryFilter !== "ALL" && part.category !== categoryFilter) return false;
      return partMatchesInventorySearch(part, partSearch);
    });
  }, [parts, categoryFilter, partSearch]);

  const selectedPartRows = useMemo(
    () =>
      selectedLines
        .map((line) => {
          const part = partsById.get(line.partId);
          if (!part) return null;
          return { line, part };
        })
        .filter((row): row is { line: SelectedPartLine; part: Part } => row != null),
    [selectedLines, partsById]
  );

  const togglePart = (partId: string) => {
    const existing = selectedLines.find((l) => l.partId === partId);
    if (existing) {
      onSelectedLinesChange(selectedLines.filter((l) => l.partId !== partId));
      return;
    }
    const part = partsById.get(partId);
    const unit = part ? getSelectableUnits(part)[0] : "Piece";
    onSelectedLinesChange([...selectedLines, { partId, quantity: 1, unit }]);
  };

  const updateLine = (partId: string, patch: Partial<SelectedPartLine>) => {
    if (patch.unit != null) {
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[partId];
        return next;
      });
    }
    onSelectedLinesChange(
      selectedLines.map((l) => (l.partId === partId ? { ...l, ...patch } : l))
    );
  };

  const setQtyDraft = (partId: string, raw: string) => {
    setQtyDrafts((prev) => ({ ...prev, [partId]: raw }));
  };

  const commitQty = (partId: string, raw: string) => {
    const n = Number.parseFloat(raw.replace(/,/g, "").trim());
    const quantity = Number.isFinite(n) && n > 0 ? n : 1;
    updateLine(partId, { quantity });
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
  };

  const effectiveQuantity = (partId: string, committed: number): number => {
    const draft = qtyDrafts[partId];
    if (draft == null) return committed;
    const n = Number.parseFloat(draft.replace(/,/g, "").trim());
    return Number.isFinite(n) && n > 0 ? n : committed;
  };

  const removePart = (partId: string) => {
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    onSelectedLinesChange(selectedLines.filter((l) => l.partId !== partId));
  };

  const renderSelectedPartRow = ({
    part,
    line,
    qtyValue,
    lineTotal,
    units,
    equivalent,
    stock,
    stockCheck,
  }: {
    part: Part;
    line: SelectedPartLine;
    qtyValue: string;
    lineTotal: number;
    units: string[];
    equivalent: string | null;
    stock: ReturnType<typeof getStockStatus>;
    stockCheck: ReturnType<typeof validateStockConsumption>;
  }) => {
    const unitPrice = getUnitPrice(part, line.unit);
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium leading-snug break-words">{part.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              SKU {part.sku}
              {part.barcode ? ` · ${part.barcode}` : ""}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Available: {formatAvailableStock(part, line.unit)}
              {equivalent ? ` (= ${equivalent})` : ""}
            </p>
            {!stockCheck.ok && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{stockCheck.message}</span>
              </p>
            )}
            <Badge variant="outline" className={cn("mt-0.5 text-[10px]", stock.className)}>
              {stockStatusShortLabel(stock.label)}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removePart(part.id)}
            aria-label={`Remove ${part.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-3">
          {units.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">Unit</span>
              <Select value={line.unit} onValueChange={(unit) => updateLine(part.id, { unit })}>
                <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground shrink-0" htmlFor={`part-qty-${part.id}`}>
              Qty
            </label>
            <Input
              id={`part-qty-${part.id}`}
              type="text"
              inputMode="decimal"
              value={qtyValue}
              onChange={(e) => setQtyDraft(part.id, e.target.value)}
              onBlur={(e) => commitQty(part.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQty(part.id, (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-8 w-20 text-sm tabular-nums"
            />
            {units.length === 1 ? (
              <span className="text-xs text-muted-foreground">{line.unit}</span>
            ) : null}
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-semibold tabular-nums text-emerald-600">
              {formatCurrency(lineTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              @ {formatCurrency(unitPrice)}/{line.unit}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {!hideIntro && (
        <div>
          <p className="font-medium">Select Parts (Optional)</p>
          <p className="text-sm text-muted-foreground">
            Search by name, SKU, part number, or barcode. Choose unit and quantity — stock and price
            update automatically.
          </p>
        </div>
      )}

      {selectedPartRows.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          {collapseSelected ? (
            <>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-primary/10 transition-colors"
                onClick={() => setSelectedExpanded((v) => !v)}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected parts ({selectedPartRows.length})
                  </p>
                  {!selectedExpanded && selectedPartRows[0] && (
                    <p className="text-sm font-medium truncate mt-0.5">{selectedPartRows[0].part.name}</p>
                  )}
                </div>
                {selectedExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {selectedExpanded && (
                <div className="space-y-2 border-t border-primary/15 p-3 pt-2">
                  {selectedPartRows.map(({ line, part }) => {
                    const stock = getStockStatus(part);
                    const qtyValue = qtyDrafts[part.id] ?? String(line.quantity);
                    const qtyNumeric = effectiveQuantity(part.id, line.quantity);
                    const unitPrice = getUnitPrice(part, line.unit);
                    const lineTotal = Math.round(qtyNumeric * unitPrice * 100) / 100;
                    const stockCheck = validateStockConsumption(part, qtyNumeric, line.unit);
                    const units = getSelectableUnits(part);
                    const equivalent = formatDualUnitStockEquivalent(part);
                    return (
                      <div key={part.id}>
                        {renderSelectedPartRow({
                          part,
                          line,
                          qtyValue,
                          lineTotal,
                          units,
                          equivalent,
                          stock,
                          stockCheck,
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected parts ({selectedPartRows.length})
              </p>
              {selectedPartRows.map(({ line, part }) => {
                const stock = getStockStatus(part);
                const qtyValue = qtyDrafts[part.id] ?? String(line.quantity);
                const qtyNumeric = effectiveQuantity(part.id, line.quantity);
                const unitPrice = getUnitPrice(part, line.unit);
                const lineTotal = Math.round(qtyNumeric * unitPrice * 100) / 100;
                const stockCheck = validateStockConsumption(part, qtyNumeric, line.unit);
                const units = getSelectableUnits(part);
                const equivalent = formatDualUnitStockEquivalent(part);
                return (
                  <div key={part.id}>
                    {renderSelectedPartRow({
                      part,
                      line,
                      qtyValue,
                      lineTotal,
                      units,
                      equivalent,
                      stock,
                      stockCheck,
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-10"
            placeholder="Search name, SKU, part number, barcode..."
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:w-[200px] h-10">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {PART_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "ALL" ? "All Categories" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {parts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed">
          No parts in inventory yet. Add parts from Inventory first.
        </p>
      ) : filteredParts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No parts match your search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredParts.map((part) => {
            const on = selectedLines.some((l) => l.partId === part.id);
            const stock = getStockStatus(part);
            const equivalent = formatDualUnitStockEquivalent(part);
            return (
              <div
                key={part.id}
                role="button"
                tabIndex={0}
                onClick={() => togglePart(part.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePart(part.id);
                  }
                }}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all flex flex-col cursor-pointer min-h-0",
                  on
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/25"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                    {part.category}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", stock.className)}>
                    {stockStatusShortLabel(stock.label)}
                  </Badge>
                </div>
                <p className="font-semibold text-sm leading-tight mt-2">{part.name}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">SKU: {part.sku}</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-emerald-600 tabular-nums">
                      {formatCurrency(part.unitPrice)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">per {part.primaryUnit}</p>
                    {hasDualUnitPart(part) && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(getUnitPrice(part, part.secondaryUnit))}/{part.secondaryUnit}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="flex items-center justify-end gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {formatDualUnitStock(part)}
                    </div>
                    {equivalent && (
                      <p className="text-[10px] mt-0.5">({equivalent})</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
