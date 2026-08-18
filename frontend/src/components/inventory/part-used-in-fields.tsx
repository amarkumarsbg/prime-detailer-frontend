"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  PART_USED_IN_OPTIONS,
  togglePartUsedIn,
  type PartUsedIn,
} from "@/lib/inventory/part-used-in";

export function PartUsedInFields({
  value,
  onChange,
}: {
  value: PartUsedIn[];
  onChange: (next: PartUsedIn[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Parts used in</Label>
      <div className="flex flex-wrap gap-4">
        {PART_USED_IN_OPTIONS.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={checked}
                onCheckedChange={() => onChange(togglePartUsedIn(value, opt.id))}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Services uses the part on job cards. Direct Sale makes it available on Counter Sale.
      </p>
    </div>
  );
}
