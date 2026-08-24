"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, cn } from "@/lib/utils";

type ServiceCustomPriceControlProps = {
  catalogPrice: number;
  customPrice: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  className?: string;
  /** Compact layout for dense cards / checklists */
  dense?: boolean;
};

export function ServiceCustomPriceControl({
  catalogPrice,
  customPrice,
  onChange,
  disabled = false,
  className,
  dense = false,
}: ServiceCustomPriceControlProps) {
  const isCustom = customPrice != null && Number.isFinite(customPrice);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!editing) return;
    setDraft(isCustom ? String(customPrice) : String(catalogPrice));
  }, [editing, isCustom, customPrice, catalogPrice]);

  const commit = () => {
    const n = Number.parseFloat(draft.replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    if (Math.abs(rounded - catalogPrice) < 0.005) {
      onChange(null);
    } else {
      onChange(rounded);
    }
    setEditing(false);
  };

  if (disabled && !isCustom) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Default: {formatCurrency(catalogPrice)}
      </p>
    );
  }

  if (editing && !disabled) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-[11px] text-muted-foreground">Custom price (₹)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            className={cn("h-8 w-28 tabular-nums", dense && "h-7 text-xs")}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
          />
          <Button type="button" size="sm" className="h-8" onClick={commit}>
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (isCustom) {
    return (
      <div className={cn("space-y-0.5", className)}>
        <p className={cn("text-xs text-muted-foreground", dense && "text-[11px]")}>
          Default: {formatCurrency(catalogPrice)}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-semibold text-primary tabular-nums", dense && "text-xs")}>
            Custom Price: {formatCurrency(customPrice!)}
          </p>
          {!disabled && (
            <span className="inline-flex items-center gap-1 text-xs">
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                className="font-medium text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                onClick={() => onChange(null)}
              >
                Reset
              </button>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className={cn("text-xs text-muted-foreground", dense && "text-[11px]")}>
        Default Price: {formatCurrency(catalogPrice)}
      </p>
      {!disabled && (
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline",
            dense && "text-[11px]"
          )}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" />
          Set Custom Price
        </button>
      )}
    </div>
  );
}
