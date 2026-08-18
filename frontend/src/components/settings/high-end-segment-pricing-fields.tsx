"use client";

import { Car } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HIGH_END_PRICE_SEGMENTS } from "@/store/high-end-service-store";
import type { SegmentPricing } from "@/types";

export type HighEndPriceDraft = Pick<SegmentPricing, "HATCHBACK" | "SEDAN" | "SUV" | "BIKE">;

export const EMPTY_HIGH_END_PRICE_DRAFT: Record<keyof HighEndPriceDraft, string> = {
  HATCHBACK: "",
  SEDAN: "",
  SUV: "",
  BIKE: "",
};

export function HighEndSegmentPricingFields({
  values,
  onChange,
}: {
  values: Record<keyof HighEndPriceDraft, string>;
  onChange: (next: Record<keyof HighEndPriceDraft, string>) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-950/30">
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-sm font-medium text-foreground">Pricing by vehicle type</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Amounts are excl. GST. Used on bookings from the vehicle’s type.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HIGH_END_PRICE_SEGMENTS.map(({ key, label, hint, icon }) => (
          <div key={key} className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs font-normal">
              <span className="text-base leading-none" aria-hidden>
                {icon}
              </span>
              <span>
                <span className="text-foreground">{label}</span>
                <span className="ml-1 text-[10px] text-muted-foreground">{hint}</span>
              </span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                type="number"
                min={0}
                step={1}
                className="h-9 pl-7"
                placeholder="0"
                value={values[key]}
                onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
