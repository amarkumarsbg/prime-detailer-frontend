"use client";

import { Label } from "@/components/ui/label";
import type { StaffAccessLevel } from "@/lib/staff-access";
import { cn } from "@/lib/utils";

type StaffAccessSelectorProps = {
  value: StaffAccessLevel;
  onChange: (value: StaffAccessLevel) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
};

export function StaffAccessSelector({
  value,
  onChange,
  disabled = false,
  name = "staff-access",
  className,
}: StaffAccessSelectorProps) {
  const options: { value: StaffAccessLevel; title: string; description: string }[] = [
    {
      value: "withEditAccess",
      title: "With Edit Access",
      description: "Full normal access including edit.",
    },
    {
      value: "withoutEditAccess",
      title: "Without Edit Access",
      description: "Normal access, but no edit/delete.",
    },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Access</Label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex gap-3 rounded-lg border p-3 transition-colors",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              value === option.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/40"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
