"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryStore } from "@/store/inventory-store";
import { formatCurrency } from "@/lib/utils";
import { catalogForCounterSale } from "@/lib/counter-sale";
import {
  getSelectableUnits,
  getUnitPrice,
  partMatchesInventorySearch,
} from "@/lib/inventory/multi-unit";
import type { QuotationPartLine } from "@/types";

export function quotationPartLineTotal(line: Pick<QuotationPartLine, "quantity" | "unitPrice">): number {
  return Math.round(line.quantity * line.unitPrice * 100) / 100;
}

export function quotationPartsSubtotal(lines: QuotationPartLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
}

export function QuotationCounterSalePartsPicker({
  lines,
  onLinesChange,
  title = "Counter Sale",
}: {
  lines: QuotationPartLine[];
  onLinesChange: (lines: QuotationPartLine[]) => void;
  title?: string;
}) {
  const parts = useInventoryStore((s) => s.parts);
  const [partSearch, setPartSearch] = useState("");
  const [catalogueUnits, setCatalogueUnits] = useState<Record<string, string>>({});

  const eligibleParts = useMemo(
    () => catalogForCounterSale(parts).filter((p) => partMatchesInventorySearch(p, partSearch)),
    [parts, partSearch]
  );

  const addPart = (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    const unit = catalogueUnits[partId] ?? getSelectableUnits(part)[0] ?? part.primaryUnit;
    const unitPrice = getUnitPrice(part, unit);
    const existing = lines.find((line) => line.partId === partId && line.unit === unit);
    if (existing) {
      onLinesChange(
        lines.map((line) =>
          line.partId === partId && line.unit === unit
            ? {
                ...line,
                quantity: line.quantity + 1,
                lineTotal: quotationPartLineTotal({ quantity: line.quantity + 1, unitPrice: line.unitPrice }),
              }
            : line
        )
      );
      return;
    }
    onLinesChange([
      ...lines,
      {
        partId: part.id,
        name: part.name,
        sku: part.sku,
        quantity: 1,
        unit,
        unitPrice,
        lineTotal: unitPrice,
      },
    ]);
  };

  const updateQuantity = (index: number, nextQty: number) => {
    const qty = Math.max(1, nextQty);
    onLinesChange(
      lines.map((line, i) =>
        i === index
          ? {
              ...line,
              quantity: qty,
              lineTotal: quotationPartLineTotal({ quantity: qty, unitPrice: line.unitPrice }),
            }
          : line
      )
    );
  };

  const removeLine = (index: number) => {
    onLinesChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/10">
      <div className="space-y-1">
        <Label className="text-sm font-semibold">{title}</Label>
        <p className="text-xs text-muted-foreground">
          Optional. Add Direct Sale parts to include in this estimate.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Parts catalogue</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search parts by name or SKU..."
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
          />
        </div>
        <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y">
          {eligibleParts.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No Counter Sale parts. Enable Direct Sale on a catalog item.
            </p>
          ) : (
            eligibleParts.map((part) => {
              const units = getSelectableUnits(part);
              const selectedUnit = catalogueUnits[part.id] ?? units[0] ?? part.primaryUnit;
              const price = getUnitPrice(part, selectedUnit);
              return (
                <div key={part.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{part.name}</p>
                    <p className="text-xs text-muted-foreground">{part.sku}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(price)}</span>
                    {units.length > 1 && (
                      <Select
                        value={selectedUnit}
                        onValueChange={(unit) =>
                          setCatalogueUnits((prev) => ({ ...prev, [part.id]: unit }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[88px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => addPart(part.id)}>
                      Add
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {lines.length > 0 && (
        <div className="space-y-2">
          <Label>Selected parts</Label>
          <ul className="rounded-lg border border-border divide-y">
            {lines.map((line, index) => (
              <li key={`${line.partId}-${line.unit}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.sku} · {line.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(index, line.quantity - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(index, line.quantity + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 w-20 text-right">
                  {formatCurrency(line.lineTotal)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => removeLine(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
