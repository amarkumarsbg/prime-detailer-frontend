"use client";

import { useEffect, useState } from "react";
import { Car, Check, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SegmentPricing, ServiceCatalogItem } from "@/types";
import { toast } from "sonner";

const SEGMENT_LABELS: Record<keyof SegmentPricing, string> = {
  HATCHBACK: "Hatchback",
  SEDAN: "Sedan",
  SUV: "SUV",
  LUXURY: "Luxury",
  MUV: "MUV",
  COMPACT_SUV: "Compact SUV",
  BIKE: "Bike",
};

const SEGMENT_KEYS = Object.keys(SEGMENT_LABELS) as (keyof SegmentPricing)[];

const QUICK_SEGMENTS: {
  key: "BIKE" | "HATCHBACK" | "SEDAN" | "SUV";
  label: string;
  icon: string;
}[] = [
  { key: "BIKE", label: "Bike", icon: "🏍️" },
  { key: "HATCHBACK", label: "Hatchback", icon: "🚗" },
  { key: "SEDAN", label: "Sedan", icon: "🚙" },
  { key: "SUV", label: "SUV", icon: "🚐" },
];

type EditFormState = {
  name: string;
  description: string;
  category: string;
  /** Which of the four primary segments are offered for this package */
  compatible: Record<"BIKE" | "HATCHBACK" | "SEDAN" | "SUV", boolean>;
  segmentPricing: Record<keyof SegmentPricing, string>;
  gstApplicable: boolean;
  gstPercent: string;
  durationMin: string;
  maxDuration: string;
  scopeGlobal: boolean;
  isHighEnd: boolean;
  isActive: boolean;
  incentivePercent: string;
};

function serviceToForm(s: ServiceCatalogItem): EditFormState {
  const segmentPricing = SEGMENT_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: String(s.segmentPricing[k]) }),
    {} as Record<keyof SegmentPricing, string>
  );
  const gstPct = s.gstPercent ?? 18;
  const q = (key: "BIKE" | "HATCHBACK" | "SEDAN" | "SUV") =>
    Number.parseFloat(segmentPricing[key]) > 0;
  const anyQuick = q("BIKE") || q("HATCHBACK") || q("SEDAN") || q("SUV");
  return {
    name: s.name,
    description: s.description,
    category: s.category,
    compatible: anyQuick
      ? { BIKE: q("BIKE"), HATCHBACK: q("HATCHBACK"), SEDAN: q("SEDAN"), SUV: q("SUV") }
      : { BIKE: true, HATCHBACK: true, SEDAN: true, SUV: true },
    segmentPricing,
    gstApplicable: s.gstApplicable !== false,
    gstPercent: String(gstPct),
    durationMin: s.durationMinutes != null ? String(s.durationMinutes) : "",
    maxDuration: s.maxDurationMinutes != null ? String(s.maxDurationMinutes) : "",
    scopeGlobal: (s.scope ?? "GLOBAL") === "GLOBAL",
    isHighEnd: s.isHighEnd,
    isActive: s.isActive,
    incentivePercent: String(s.incentivePercent),
  };
}

function formToService(base: ServiceCatalogItem, form: EditFormState): ServiceCatalogItem {
  const segmentPricing = SEGMENT_KEYS.reduce(
    (acc, k) => ({
      ...acc,
      [k]: Math.max(0, parseFloat(form.segmentPricing[k]) || 0),
    }),
    {} as SegmentPricing
  );
  const four = ["HATCHBACK", "SEDAN", "SUV", "BIKE"] as const;
  const avg =
    four.reduce((a, k) => a + segmentPricing[k], 0) / 4;
  const gstPct = form.gstApplicable
    ? Math.min(100, Math.max(0, parseFloat(form.gstPercent) || 0))
    : undefined;
  const durationMinutes = form.durationMin.trim()
    ? Math.max(0, parseInt(form.durationMin, 10))
    : undefined;
  const maxDurationMinutes = form.maxDuration.trim()
    ? Math.max(0, parseInt(form.maxDuration, 10))
    : undefined;

  return {
    ...base,
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    defaultPrice: Math.max(0, Math.round(avg)),
    segmentPricing,
    isHighEnd: form.isHighEnd,
    isActive: form.isActive,
    incentivePercent: Math.min(100, Math.max(0, parseFloat(form.incentivePercent) || 0)),
    gstApplicable: form.gstApplicable,
    gstPercent: gstPct,
    durationMinutes,
    maxDurationMinutes,
    scope: form.scopeGlobal ? "GLOBAL" : "BRANCH",
  };
}

export function EditServiceCatalogDialog({
  open,
  onOpenChange,
  service,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  service: ServiceCatalogItem | null;
  categories: string[];
  onSave: (next: ServiceCatalogItem) => void;
}) {
  const [form, setForm] = useState<EditFormState | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (service && open) setForm(serviceToForm(service));
      if (!open) setForm(null);
    });
  }, [service, open]);

  const setCompatible = (key: keyof EditFormState["compatible"], on: boolean) => {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f.compatible, [key]: on };
      const priceKey = key as keyof SegmentPricing;
      const nextPricing = { ...f.segmentPricing };
      if (!on) nextPricing[priceKey] = "0";
      return { ...f, compatible: next, segmentPricing: nextPricing };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !form) return;
    if (!form.name.trim()) return;
    if (!form.description.trim()) return;
    if (!form.durationMin.trim()) return;
    const h = Math.max(0, parseFloat(form.segmentPricing.HATCHBACK) || 0);
    const sed = Math.max(0, parseFloat(form.segmentPricing.SEDAN) || 0);
    const u = Math.max(0, parseFloat(form.segmentPricing.SUV) || 0);
    const bike = Math.max(0, parseFloat(form.segmentPricing.BIKE) || 0);
    if (h === 0 && sed === 0 && u === 0 && bike === 0) {
      toast.error("Enter at least one vehicle price under compatibility.");
      return;
    }
    onSave(formToService(service, form));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle className="text-xl font-semibold">Edit Service Package</DialogTitle>
          <DialogDescription className="sr-only">
            Update service name, compatibility, GST-inclusive pricing, duration, and availability.
          </DialogDescription>
        </DialogHeader>

        {form && service && (
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
            {/* Basic information */}
            <div className="space-y-2">
              <Label htmlFor="esp-name">
                Service Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="esp-name"
                value={form.name}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esp-cat">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => (f ? { ...f, category: v } : f))}
              >
                <SelectTrigger id="esp-cat" className="h-10 w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="esp-desc">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="esp-desc"
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, description: e.target.value } : f))
                }
                required
                className="resize-y min-h-[100px]"
                placeholder="Describe what this package includes…"
              />
            </div>

            {/* Compatibility */}
            <div
              className={cn(
                "rounded-xl border-2 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/30"
              )}
            >
              <div className="flex items-start gap-2">
                <Car className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div>
                  <p className="font-medium text-foreground">Compatibility</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Select vehicle types this service applies to.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_SEGMENTS.map(({ key, label, icon }) => {
                  const on = form.compatible[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCompatible(key, !on)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-colors",
                        on
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden>
                        {icon}
                      </span>
                      <span className="text-xs font-medium">{label}</span>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing incl GST */}
            <div
              className={cn(
                "rounded-xl border-2 border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-950 dark:text-emerald-100">
                      Pricing (incl. GST)
                    </p>
                    <p className="text-xs text-emerald-900/85 dark:text-emerald-200/80 mt-1">
                      Enter the price the customer pays. GST will be extracted automatically for
                      accounting.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="shrink-0 bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  INR (₹)
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {QUICK_SEGMENTS.map(({ key, label, icon }) => {
                  const disabled = !form.compatible[key];
                  return (
                    <div key={key} className="space-y-1.5">
                      <Label
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide flex flex-col gap-0.5",
                          disabled && "opacity-50"
                        )}
                      >
                        <span className="text-lg leading-none" aria-hidden>
                          {icon}
                        </span>
                        <span>{label}</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          ₹
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          disabled={disabled}
                          className="pl-7 h-9"
                          value={form.segmentPricing[key]}
                          onChange={(e) =>
                            setForm((f) =>
                              f
                                ? {
                                    ...f,
                                    segmentPricing: {
                                      ...f.segmentPricing,
                                      [key]: e.target.value,
                                    },
                                  }
                                : f
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GST settings */}
            <div
              className={cn(
                "rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/25"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="esp-gst"
                    checked={form.gstApplicable}
                    onCheckedChange={(c) =>
                      setForm((f) => (f ? { ...f, gstApplicable: c === true } : f))
                    }
                  />
                  <Label htmlFor="esp-gst" className="text-sm font-medium cursor-pointer">
                    GST Applicable
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="esp-gst-rate"
                    className="text-sm text-muted-foreground whitespace-nowrap"
                  >
                    GST Rate
                  </Label>
                  <Input
                    id="esp-gst-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="h-9 w-24"
                    disabled={!form.gstApplicable}
                    value={form.gstPercent}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, gstPercent: e.target.value } : f))
                    }
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <p className="text-xs text-amber-900/90 dark:text-amber-100/85 mt-3 leading-relaxed">
                Prices entered above are <strong>GST-inclusive</strong>. GST (
                {form.gstApplicable ? `${parseFloat(form.gstPercent || "0").toFixed(2)}%` : "—"})
                will be automatically reverse-extracted for tax compliance. Customers pay the price
                you enter.
              </p>
            </div>

            {/* Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="esp-dur">
                  Duration (min) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="esp-dur"
                  type="number"
                  min={0}
                  placeholder="e.g. 40"
                  required
                  value={form.durationMin}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, durationMin: e.target.value } : f))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="esp-max-dur">Max Duration (min)</Label>
                <Input
                  id="esp-max-dur"
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={form.maxDuration}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, maxDuration: e.target.value } : f))
                  }
                />
                <p className="text-xs text-muted-foreground">For ranges (e.g. 40–50 min)</p>
              </div>
            </div>

            {/* Service status */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Service status</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="esp-global"
                    checked={form.scopeGlobal}
                    onCheckedChange={(c) =>
                      setForm((f) => (f ? { ...f, scopeGlobal: c === true } : f))
                    }
                  />
                  <Label htmlFor="esp-global" className="text-sm font-medium cursor-pointer">
                    Global service (available to all branches)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="esp-act"
                    checked={form.isActive}
                    onCheckedChange={(c) =>
                      setForm((f) => (f ? { ...f, isActive: c === true } : f))
                    }
                  />
                  <Label htmlFor="esp-act" className="text-sm font-medium cursor-pointer">
                    Active (available for booking)
                  </Label>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border/60">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esp-high"
                      checked={form.isHighEnd}
                      onCheckedChange={(c) =>
                        setForm((f) => (f ? { ...f, isHighEnd: c === true } : f))
                      }
                    />
                    <Label htmlFor="esp-high" className="text-sm cursor-pointer">
                      High-end service
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="esp-inc" className="text-sm text-muted-foreground whitespace-nowrap">
                      Incentive %
                    </Label>
                    <Input
                      id="esp-inc"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className="h-9 w-20"
                      value={form.incentivePercent}
                      onChange={(e) =>
                        setForm((f) => (f ? { ...f, incentivePercent: e.target.value } : f))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Update
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
