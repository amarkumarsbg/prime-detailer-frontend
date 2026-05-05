"use client";

import { useEffect, useState } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type ExpenseDateFilter =
  | {
      kind: "preset";
      preset:
        | "today"
        | "yesterday"
        | "this_week"
        | "last_week"
        | "this_month"
        | "last_month"
        | "all";
    }
  | { kind: "custom"; start: string; end: string };

export function matchesExpenseDate(dateStr: string, f: ExpenseDateFilter): boolean {
  const d = parseISO(dateStr);
  const day = format(d, "yyyy-MM-dd");
  const now = new Date();

  if (f.kind === "custom") {
    return day >= f.start && day <= f.end;
  }

  switch (f.preset) {
    case "all":
      return true;
    case "today":
      return day === format(now, "yyyy-MM-dd");
    case "yesterday":
      return day === format(subDays(now, 1), "yyyy-MM-dd");
    case "this_week": {
      const a = startOfWeek(now, { weekStartsOn: 1 });
      const b = endOfWeek(now, { weekStartsOn: 1 });
      return d >= a && d <= b;
    }
    case "last_week": {
      const ref = subWeeks(now, 1);
      const a = startOfWeek(ref, { weekStartsOn: 1 });
      const b = endOfWeek(ref, { weekStartsOn: 1 });
      return d >= a && d <= b;
    }
    case "this_month":
      return d >= startOfMonth(now) && d <= endOfMonth(now);
    case "last_month": {
      const ref = subMonths(now, 1);
      return d >= startOfMonth(ref) && d <= endOfMonth(ref);
    }
    default:
      return true;
  }
}

export function formatExpenseDateFilterLabel(f: ExpenseDateFilter): string {
  const now = new Date();
  if (f.kind === "custom") {
    return `${format(parseISO(f.start), "d MMM yyyy")} – ${format(parseISO(f.end), "d MMM yyyy")}`;
  }
  switch (f.preset) {
    case "today":
      return `Today (${format(now, "d MMM yyyy")})`;
    case "yesterday":
      return `Yesterday (${format(subDays(now, 1), "d MMM yyyy")})`;
    case "this_week":
      return "This week";
    case "last_week":
      return "Last week";
    case "this_month":
      return `This month (${format(now, "MMM yyyy")})`;
    case "last_month":
      return `Last month (${format(subMonths(now, 1), "MMM yyyy")})`;
    case "all":
      return "All time";
    default:
      return "Date range";
  }
}

type PresetKey = Extract<ExpenseDateFilter, { kind: "preset" }>["preset"];

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "all", label: "All time" },
];

type ExpenseDateRangePickerProps = {
  value: ExpenseDateFilter;
  onChange: (next: ExpenseDateFilter) => void;
  className?: string;
};

export function ExpenseDateRangePicker({
  value,
  onChange,
  className,
}: ExpenseDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(
    () => value.kind === "custom" ? value.start : format(new Date(), "yyyy-MM-dd")
  );
  const [draftEnd, setDraftEnd] = useState(
    () => value.kind === "custom" ? value.end : format(new Date(), "yyyy-MM-dd")
  );

  useEffect(() => {
    if (!open) return;
    if (value.kind === "custom") {
      setDraftStart(value.start);
      setDraftEnd(value.end);
    } else {
      const t = format(new Date(), "yyyy-MM-dd");
      setDraftStart(t);
      setDraftEnd(t);
    }
  }, [open, value]);

  const applyPreset = (preset: PresetKey) => {
    onChange({ kind: "preset", preset });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draftStart || !draftEnd) return;
    if (draftStart > draftEnd) return;
    onChange({ kind: "custom", start: draftStart, end: draftEnd });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full sm:w-[min(100%,280px)] justify-start text-left font-normal",
            className
          )}
        >
          <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatExpenseDateFilterLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(calc(100vw-2rem),360px)] p-0" align="start">
        <div className="p-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Quick presets</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  variant={
                    value.kind === "preset" && value.preset === key ? "secondary" : "outline"
                  }
                  size="sm"
                  className="h-8 text-xs justify-center"
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Custom range</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exp-range-start" className="text-xs">
                  Start date
                </Label>
                <Input
                  id="exp-range-start"
                  type="date"
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-range-end" className="text-xs">
                  End date
                </Label>
                <Input
                  id="exp-range-end"
                  type="date"
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              size="sm"
              onClick={applyCustom}
              disabled={!draftStart || !draftEnd || draftStart > draftEnd}
            >
              Apply custom range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
