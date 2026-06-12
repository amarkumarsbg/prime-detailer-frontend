"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartyCustomDateRangePopover } from "@/components/parties/party-custom-date-range-popover";
import {
  REPORT_PERIOD_OPTIONS,
  buildCustomPeriod,
  formatPeriodLabel,
  parseCustomPeriod,
  reportSelectItemClass,
} from "@/lib/reports/report-period-presets";
import { cn } from "@/lib/utils";

type PartyPeriodSelectProps = {
  value: string;
  onChange: (period: string) => void;
  className?: string;
};

const CALENDAR_OPEN_DELAY_MS = 150;
const CUSTOM_RANGE_LABEL = "Custom Date Range";

/** Same shell as other party detail filters. */
export const partyFilterTriggerClass =
  "h-9 shrink-0 rounded-md border border-input bg-background shadow-sm text-sm";

export function PartyPeriodSelect({ value, onChange, className }: PartyPeriodSelectProps) {
  const parsed = parseCustomPeriod(value);
  const selectValue = parsed ? "custom" : value;
  const hasAppliedCustom = Boolean(parsed);

  const today = format(new Date(), "yyyy-MM-dd");

  const [customStart, setCustomStart] = useState(() => parsed?.start ?? today);
  const [customEnd, setCustomEnd] = useState(() => parsed?.end ?? today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const previousPeriod = useRef(value);
  const appliedRef = useRef(false);
  const suppressDismissRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = parseCustomPeriod(value);
    if (p) {
      setCustomStart(p.start);
      setCustomEnd(p.end);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const queueCalendarOpen = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    suppressDismissRef.current = true;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setCalendarOpen(true);
      setTimeout(() => {
        suppressDismissRef.current = false;
      }, 300);
    }, CALENDAR_OPEN_DELAY_MS);
  }, []);

  const openCalendar = useCallback(() => {
    previousPeriod.current = value;
    appliedRef.current = false;

    if (parsed) {
      setCustomStart(parsed.start);
      setCustomEnd(parsed.end);
    } else {
      setCustomStart("");
      setCustomEnd("");
    }

    queueCalendarOpen();
  }, [value, parsed, today, queueCalendarOpen]);

  const handleSelectChange = (next: string) => {
    if (next !== "custom") {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      setCalendarOpen(false);
      onChange(next);
      return;
    }
    openCalendar();
  };

  const handleApplyCustom = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    onChange(buildCustomPeriod(start, end));
    appliedRef.current = true;
    setCalendarOpen(false);
  };

  const handleCancelCustom = () => {
    if (appliedRef.current) return;
    const prev = previousPeriod.current;
    if (parseCustomPeriod(prev)) {
      const p = parseCustomPeriod(prev)!;
      setCustomStart(p.start);
      setCustomEnd(p.end);
      onChange(prev);
    } else if (prev && prev !== "custom") {
      onChange(prev);
    }
  };

  const handleCalendarOpenChange = (open: boolean) => {
    if (!open && suppressDismissRef.current) return;
    if (!open && !appliedRef.current) {
      handleCancelCustom();
    }
    if (!open) {
      appliedRef.current = false;
    }
    setCalendarOpen(open);
  };

  /** Preset: "Last 365 Days" | Picking: "Custom Date Range" | Applied: "1 Jun 2026 - 24 Jun 2026" */
  const triggerLabel = calendarOpen ? CUSTOM_RANGE_LABEL : formatPeriodLabel(value);

  const triggerWidth = calendarOpen
    ? "w-full min-w-0 max-w-full sm:w-[240px]"
    : hasAppliedCustom
      ? "w-full min-w-0 max-w-full sm:w-[280px]"
      : "w-full min-w-0 max-w-full sm:w-[220px]";

  return (
    <PartyCustomDateRangePopover
      open={calendarOpen}
      onOpenChange={handleCalendarOpenChange}
      start={customStart}
      end={customEnd}
      onApply={handleApplyCustom}
      onCancel={handleCancelCustom}
      className={className}
      anchor={
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger
            className={cn(
              partyFilterTriggerClass,
              "relative pl-9 pr-3",
              triggerWidth,
              className
            )}
          >
            <Calendar
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <SelectValue asChild>
              <span className="relative z-[1] block min-w-0 flex-1 truncate text-left text-foreground">
                {triggerLabel}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REPORT_PERIOD_OPTIONS.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className={reportSelectItemClass}
                onPointerUp={
                  o.value === "custom"
                    ? () => {
                        openCalendar();
                      }
                    : undefined
                }
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
