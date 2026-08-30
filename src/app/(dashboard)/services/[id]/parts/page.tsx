"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { Part, ServiceConsumption, VehicleSegment } from "@/types";
import { ArrowLeft, Box, ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLitresFromMl, isMlTrackedPart } from "@/lib/inventory-units";
import { partUsedInServices } from "@/lib/inventory/part-used-in";
import { hasDualUnitPart, getSelectableUnits, formatAvailableStock } from "@/lib/inventory/multi-unit";

const VEHICLE_QTY_SEGMENTS: { value: VehicleSegment; label: string }[] = [
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "COMPACT_SUV", label: "Compact SUV" },
  { value: "MUV", label: "MUV" },
  { value: "LUXURY", label: "Luxury" },
  { value: "BIKE", label: "Bike" },
];

function stockLabel(p: Part): string {
  if (isMlTrackedPart(p)) {
    return `${formatLitresFromMl(p.stockQuantityMl ?? 0)} L`;
  }
  return `${p.quantity} ${p.primaryUnit}`;
}

function resolvePartUnit(part: Part): string {
  return isMlTrackedPart(part) ? "L" : part.primaryUnit;
}

/** All units that are valid for a consumption line on this part. */
function validUnitsForPart(part: Part): string[] {
  if (isMlTrackedPart(part)) return ["L", "ML"];
  return getSelectableUnits(part);
}

/** Isolated row so local input state doesn't re-render the whole page on each keystroke. */
function SelectedPartRow({
  line,
  part,
  onRemove,
  onUpdateQty,
  onUpdateSegmentQty,
  onUpdateRequired,
  onUpdateUnit,
}: {
  line: ServiceConsumption;
  part: Part | undefined;
  onRemove: () => void;
  onUpdateQty: (qty: number) => void;
  onUpdateSegmentQty: (seg: VehicleSegment, value: number | null) => void;
  onUpdateRequired: (required: boolean) => void;
  onUpdateUnit: (unit: string) => void;
}) {
  // line.unit is the authoritative selected unit stored in the consumption profile
  const units = part ? getSelectableUnits(part) : [line.unit];
  const isDualUnit = part ? hasDualUnitPart(part) : false;

  const [defaultQty, setDefaultQty] = useState(String(line.quantityPerCar));
  const [segQtys, setSegQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const seg of VEHICLE_QTY_SEGMENTS) {
      init[seg.value] = line.segmentQuantities?.[seg.value] != null
        ? String(line.segmentQuantities[seg.value])
        : "";
    }
    return init;
  });
  const [vehicleQtyOpen, setVehicleQtyOpen] = useState(false);

  return (
    <div className="relative space-y-2 rounded-lg border border-border bg-card p-3">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-9 w-9 text-destructive sm:h-8 sm:w-8"
        onClick={onRemove}
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <div className="pr-10">
        <p className="text-sm font-medium">{line.partName}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {part?.sku ?? line.partId}
        </p>
        {part && (
          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
            Stock: {isMlTrackedPart(part) ? stockLabel(part) : formatAvailableStock(part, line.unit)}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {isDualUnit && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Unit</Label>
            <Select value={line.unit} onValueChange={onUpdateUnit}>
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {part && (
              <p className="text-[11px] text-muted-foreground">
                1 {part.primaryUnit} = {part.conversionFactor} {part.secondaryUnit}
              </p>
            )}
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Default Quantity ({line.unit})</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            className="h-10 sm:h-9"
            value={defaultQty}
            onChange={(e) => setDefaultQty(e.target.value)}
            onBlur={() => {
              const n = parseFloat(defaultQty);
              onUpdateQty(Number.isNaN(n) ? 0 : n);
            }}
          />
        </div>

        <Collapsible open={vehicleQtyOpen} onOpenChange={setVehicleQtyOpen}>
          <CollapsibleTrigger className="flex min-h-10 w-full items-center gap-1.5 rounded-md px-1 py-2 text-left text-sm font-medium text-blue-600 outline-none hover:bg-muted/50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400 dark:hover:text-blue-300 sm:min-h-0">
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform duration-200", vehicleQtyOpen && "-rotate-180")}
              aria-hidden
            />
            Vehicle-specific quantities
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">
                Override default for a segment; leave blank to use default quantity.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {VEHICLE_QTY_SEGMENTS.map(({ value: seg, label }) => (
                  <div key={seg} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-10 sm:h-9"
                      placeholder="Use default"
                      value={segQtys[seg] ?? ""}
                      onChange={(e) => setSegQtys((prev) => ({ ...prev, [seg]: e.target.value }))}
                      onBlur={() => {
                        const raw = segQtys[seg]?.trim() ?? "";
                        if (raw === "") { onUpdateSegmentQty(seg, null); return; }
                        const n = parseFloat(raw);
                        onUpdateSegmentQty(seg, Number.isNaN(n) ? null : n);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-1 flex min-h-10 items-center gap-2 border-t border-border pt-3">
          <Checkbox
            id={`required-${line.partId}`}
            checked={line.requiredPart !== false}
            onCheckedChange={(v) => onUpdateRequired(v === true)}
          />
          <Label
            htmlFor={`required-${line.partId}`}
            className="cursor-pointer text-sm font-normal leading-none"
          >
            Required part
          </Label>
        </div>
      </div>
    </div>
  );
}

export default function ConfigureServicePartsPage() {
  const params = useParams();
  const id = params.id as string;
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const parts = useInventoryStore((s) => s.parts);

  const service = useMemo(() => catalog.find((c) => c.id === id), [catalog, id]);
  const [search, setSearch] = useState("");

  const selected = useMemo(() => service?.consumptionProfile ?? [], [service]);

  useEffect(() => {
    if (!service) return;
    const current = service.consumptionProfile ?? [];
    let hasChanges = false;
    const normalized = current.map((line) => {
      const part = parts.find((p) => p.id === line.partId);
      if (!part) return line;
      // Keep the unit if it is valid for this part (covers both primary and secondary units).
      // Only reset to the default when the stored unit is completely unrecognised.
      const valid = validUnitsForPart(part);
      if (valid.includes(line.unit)) return line;
      hasChanges = true;
      return { ...line, unit: resolvePartUnit(part) };
    });
    if (!hasChanges) return;
    setCatalog((prev) =>
      prev.map((s) =>
        s.id === service.id ? { ...s, consumptionProfile: normalized } : s
      )
    );
  }, [service, parts, setCatalog]);

  const available = useMemo(() => {
    const selectedIds = new Set(selected.map((s) => s.partId));
    const q = search.trim().toLowerCase();
    return parts.filter((p) => {
      if (!partUsedInServices(p)) return false;
      if (selectedIds.has(p.id)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [parts, search, selected]);

  const addPart = (p: Part) => {
    if (!service) return;
    if (!partUsedInServices(p)) {
      toast.error("This part is marked for Direct Sale only.");
      return;
    }
    const isFluid = isMlTrackedPart(p);
    const line: ServiceConsumption = {
      partId: p.id,
      partName: p.name,
      quantityPerCar: isFluid ? 0.05 : 1,
      unit: isFluid ? "L" : p.primaryUnit,
      requiredPart: true,
    };
    setCatalog((prev) =>
      prev.map((s) =>
        s.id === service.id
          ? { ...s, consumptionProfile: [...(s.consumptionProfile ?? []), line] }
          : s
      )
    );
    toast.success(`${p.name} added`);
  };

  const removeLine = useCallback((partId: string) => {
    setCatalog((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, consumptionProfile: (s.consumptionProfile ?? []).filter((l) => l.partId !== partId) }
          : s
      )
    );
  }, [id, setCatalog]);

  const updateQty = useCallback((partId: string, quantityPerCar: number) => {
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) =>
            l.partId === partId ? { ...l, quantityPerCar } : l
          ),
        };
      })
    );
  }, [id, setCatalog]);

  const updateSegmentQty = useCallback((partId: string, segment: VehicleSegment, value: number | null) => {
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) => {
            if (l.partId !== partId) return l;
            const next = { ...(l.segmentQuantities ?? {}) };
            if (value == null || Number.isNaN(value)) { delete next[segment]; }
            else { next[segment] = value; }
            return { ...l, segmentQuantities: Object.keys(next).length ? next : undefined };
          }),
        };
      })
    );
  }, [id, setCatalog]);

  const updateRequiredPart = useCallback((partId: string, required: boolean) => {
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) =>
            l.partId === partId ? { ...l, requiredPart: required } : l
          ),
        };
      })
    );
  }, [id, setCatalog]);

  const updateUnit = useCallback((partId: string, unit: string) => {
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) =>
            l.partId === partId ? { ...l, unit } : l
          ),
        };
      })
    );
  }, [id, setCatalog]);

  if (!service) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Service not found.</p>
        <Button variant="link" asChild><Link href="/services">Back to Services</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 h-9 gap-1.5" asChild>
          <Link href="/services">
            <ArrowLeft className="h-4 w-4" />
            <span className="sm:hidden">Services</span>
            <span className="hidden sm:inline">Back to Services</span>
          </Link>
        </Button>
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 sm:h-11 sm:w-11">
            <Box className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              <span className="text-muted-foreground font-semibold">Parts · </span>
              <span className="wrap-break-word">{service.name}</span>
            </h1>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
              Select which parts are required when performing this service.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Available Parts</CardTitle>
            <Badge variant="secondary">{available.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9 sm:h-9"
                placeholder="Search parts by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1 sm:max-h-[min(480px,60vh)]">
              {available.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {p.sku} ·{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">Stock: {stockLabel(p)}</span>
                    </p>
                  </div>
                  <Button size="sm" className="h-9 shrink-0 gap-1 sm:h-8" onClick={() => addPart(p)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              ))}
              {available.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No matching parts to add.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Selected Parts</CardTitle>
            <Badge variant="secondary">{selected.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="max-h-[min(520px,60vh)] space-y-3 overflow-y-auto pr-1 sm:max-h-[min(560px,65vh)]">
              {selected.map((line) => {
                const p = parts.find((x) => x.id === line.partId);
                return (
                  <SelectedPartRow
                    key={line.partId}
                    line={line}
                    part={p}
                    onRemove={() => removeLine(line.partId)}
                    onUpdateQty={(qty) => updateQty(line.partId, qty)}
                    onUpdateSegmentQty={(seg, val) => updateSegmentQty(line.partId, seg, val)}
                    onUpdateRequired={(req) => updateRequiredPart(line.partId, req)}
                    onUpdateUnit={(unit) => updateUnit(line.partId, unit)}
                  />
                );
              })}
              {selected.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No parts selected yet. Add from the available list.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
