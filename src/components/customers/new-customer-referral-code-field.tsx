"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NewCustomerReferralCodeField({
  id = "new-customer-referral",
  value,
  onChange,
  disabled,
  compact,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <Label htmlFor={id} className={cn(compact && "text-xs")}>
        Referral code (optional)
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="e.g. REF-A001"
        disabled={disabled}
        className={cn("uppercase", compact && "h-9")}
        autoComplete="off"
      />
      <p className="text-xs text-muted-foreground">
        New customers only — existing customers cannot use a referral code.
      </p>
    </div>
  );
}
