"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { Part, ServiceConsumption, VehicleSegment } from "@/types";
import { ArrowLeft, Box, ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  if (p.stockQuantityMl != null) {
    const L = p.stockQuantityMl / 1000;
    return `${L.toFixed(0)} L`;
  }
  return `${p.quantity} ${p.primaryUnit}`;
}

export default function ConfigureServicePartsPage() {
  const params = useParams();
  const id = params.id as string;
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const parts = useInventoryStore((s) => s.parts);

  const service = useMemo(() => catalog.find((c) => c.id === id), [catalog, id]);
  const [search, setSearch] = useState("");
  const [vehicleQtyOpen, setVehicleQtyOpen] = useState<Record<string, boolean>>({});

  const selected = useMemo(() => service?.consumptionProfile ?? [], [service]);

  const available = useMemo(() => {
    const selectedIds = new Set(selected.map((s) => s.partId));
    const q = search.trim().toLowerCase();
    return parts.filter((p) => {
      if (selectedIds.has(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [parts, search, selected]);

  const addPart = (p: Part) => {
    if (!service) return;
    const line: ServiceConsumption = {
      partId: p.id,
      partName: p.name,
      quantityPerCar: p.stockQuantityMl != null ? 0.05 : 1,
      unit: p.stockQuantityMl != null ? "L" : p.primaryUnit,
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

  const removeLine = (partId: string) => {
    if (!service) return;
    setCatalog((prev) =>
      prev.map((s) =>
        s.id === service.id
          ? {
              ...s,
              consumptionProfile: (s.consumptionProfile ?? []).filter((l) => l.partId !== partId),
            }
          : s
      )
    );
  };

  const updateQty = (partId: string, quantityPerCar: number) => {
    if (!service) return;
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== service.id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) =>
            l.partId === partId ? { ...l, quantityPerCar } : l
          ),
        };
      })
    );
  };

  const updateSegmentQty = (partId: string, segment: VehicleSegment, value: number | null) => {
    if (!service) return;
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== service.id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) => {
            if (l.partId !== partId) return l;
            const next = { ...(l.segmentQuantities ?? {}) };
            if (value == null || Number.isNaN(value)) {
              delete next[segment];
            } else {
              next[segment] = value;
            }
            const segmentQuantities = Object.keys(next).length ? next : undefined;
            return { ...l, segmentQuantities };
          }),
        };
      })
    );
  };

  const updateRequiredPart = (partId: string, required: boolean) => {
    if (!service) return;
    setCatalog((prev) =>
      prev.map((s) => {
        if (s.id !== service.id) return s;
        return {
          ...s,
          consumptionProfile: (s.consumptionProfile ?? []).map((l) =>
            l.partId === partId ? { ...l, requiredPart: required } : l
          ),
        };
      })
    );
  };

  if (!service) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Service not found.</p>
        <Button variant="link" asChild>
          <Link href="/services">Back to Services</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-2" asChild>
          <Link href="/services">
            <ArrowLeft className="h-4 w-4" />
            Back to Services
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Configure Parts: {service.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select which parts are required when performing this service.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Available Parts</CardTitle>
            <Badge variant="secondary">{available.length} parts</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search parts by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[min(480px,60vh)] overflow-y-auto space-y-2 pr-1">
              {available.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 bg-card"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {p.sku} ·{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Stock: {stockLabel(p)}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => addPart(p)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              ))}
              {available.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No matching parts to add.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Selected Parts</CardTitle>
            <Badge variant="secondary">{selected.length} selected</Badge>
          </CardHeader>
          <CardContent>
            <div className="max-h-[min(560px,65vh)] overflow-y-auto space-y-3 pr-1">
              {selected.map((line) => {
                const p = parts.find((x) => x.id === line.partId);
                return (
                  <div
                    key={line.partId}
                    className="rounded-lg border border-border p-3 space-y-2 relative bg-card"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8 text-destructive"
                      onClick={() => removeLine(line.partId)}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="pr-10">
                      <p className="font-medium text-sm">{line.partName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p?.sku ?? line.partId}</p>
                      {p && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Stock: {stockLabel(p)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Default Quantity ({line.unit})</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.quantityPerCar}
                          onChange={(e) =>
                            updateQty(line.partId, parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      <Collapsible
                        open={Boolean(vehicleQtyOpen[line.partId])}
                        onOpenChange={(open) =>
                          setVehicleQtyOpen((prev) => ({ ...prev, [line.partId]: open }))
                        }
                      >
                        <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-1 py-2 text-left text-sm font-medium text-blue-600 outline-none hover:bg-muted/50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400 dark:hover:text-blue-300">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 transition-transform duration-200",
                              vehicleQtyOpen[line.partId] && "-rotate-180"
                            )}
                            aria-hidden
                          />
                          Vehicle-Specific Quantities
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                            <p className="text-[11px] text-muted-foreground">
                              Override default for a segment; leave blank to use default quantity.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {VEHICLE_QTY_SEGMENTS.map(({ value: seg, label }) => (
                                <div key={seg} className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">{label}</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="Use default"
                                    value={
                                      line.segmentQuantities?.[seg] != null
                                        ? line.segmentQuantities[seg]
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value.trim();
                                      if (raw === "") {
                                        updateSegmentQty(line.partId, seg, null);
                                        return;
                                      }
                                      const n = parseFloat(raw);
                                      updateSegmentQty(
                                        line.partId,
                                        seg,
                                        Number.isNaN(n) ? null : n
                                      );
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <div className="flex items-center gap-2 border-t border-border pt-3 mt-1">
                        <Checkbox
                          id={`required-${line.partId}`}
                          checked={line.requiredPart !== false}
                          onCheckedChange={(v) =>
                            updateRequiredPart(line.partId, v === true)
                          }
                        />
                        <Label
                          htmlFor={`required-${line.partId}`}
                          className="text-sm font-normal cursor-pointer leading-none"
                        >
                          Required part
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })}
              {selected.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No parts selected yet. Add from the list on the left.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
