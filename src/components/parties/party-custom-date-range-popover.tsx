"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameDay,
  isSameMonth,
  parseISO,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PartyCustomDateRangePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Empty string = no date selected yet (fresh pick). */
  start: string;
  end: string;
  onApply: (start: string, end: string) => void;
  onCancel: () => void;
  anchor: React.ReactNode;
  className?: string;
};

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatPickerDate(d: Date): string {
  return format(d, "d MMM yyyy");
}

function parseDraftDate(iso: string): Date | null {
  if (!iso || iso.length < 10) return null;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function NavPill({
  label,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-1 rounded-md border border-input bg-background px-2 py-1.5">
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onPrev}
        aria-label={prevLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium text-foreground tabular-nums">{label}</span>
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onNext}
        aria-label={nextLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MonthCalendar({
  month,
  rangeStart,
  rangeEnd,
  awaitingEnd,
  onPick,
}: {
  month: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  awaitingEnd: boolean;
  onPick: (day: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="min-w-[280px]">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium tracking-wide text-muted-foreground mb-2">
        {weekDays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isStart = rangeStart !== null && isSameDay(day, rangeStart);
          const isEnd =
            rangeEnd !== null &&
            rangeStart !== null &&
            !awaitingEnd &&
            isSameDay(day, rangeEnd);
          const isEndpoint = isStart || isEnd;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center text-sm rounded-full transition-colors",
                !inMonth && "text-muted-foreground/45",
                inMonth && !isEndpoint && "text-foreground hover:bg-muted",
                isEndpoint &&
                  "bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PartyCustomDateRangePopover({
  open,
  onOpenChange,
  start,
  end,
  onApply,
  onCancel,
  anchor,
  className,
}: PartyCustomDateRangePopoverProps) {
  const [draftStart, setDraftStart] = useState<Date | null>(() => parseDraftDate(start));
  const [draftEnd, setDraftEnd] = useState<Date | null>(() => parseDraftDate(end));
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(parseDraftDate(start) ?? new Date())
  );

  useEffect(() => {
    if (!open) return;
    const s = parseDraftDate(start);
    const e = parseDraftDate(end);
    setDraftStart(s);
    setDraftEnd(e);
    setViewMonth(startOfMonth(s ?? new Date()));
  }, [open, start, end]);

  const hasStart = draftStart !== null;
  const awaitingEnd =
    hasStart && draftEnd !== null && isSameDay(draftStart, draftEnd);
  const rangeComplete =
    hasStart && draftEnd !== null && !isSameDay(draftStart, draftEnd);
  const canApply = rangeComplete;

  const pickDay = (day: Date) => {
    if (!isSameMonth(day, viewMonth)) {
      setViewMonth(startOfMonth(day));
    }
    if (!hasStart) {
      setDraftStart(day);
      setDraftEnd(day);
      return;
    }
    if (!awaitingEnd) {
      setDraftStart(day);
      setDraftEnd(day);
      return;
    }
    if (day < draftStart!) {
      setDraftEnd(draftStart);
      setDraftStart(day);
    } else {
      setDraftEnd(day);
    }
  };

  const handleOk = () => {
    if (!canApply || !draftStart || !draftEnd) return;
    const a = draftStart <= draftEnd ? draftStart : draftEnd;
    const b = draftStart <= draftEnd ? draftEnd : draftStart;
    onApply(toYmd(a), toYmd(b));
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className={cn("relative shrink-0 min-w-0", className)}>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        className="z-[200] w-auto max-w-[calc(100vw-1rem)] p-0 border border-input bg-popover shadow-lg rounded-lg"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-radix-select-content]")) {
            e.preventDefault();
          }
        }}
      >
        <div className="px-5 pt-5 pb-4">
          {!hasStart ? (
            <p className="text-center text-sm mb-4">
              <span className="font-semibold text-foreground">Select Start Date</span>
              <span className="text-muted-foreground mx-2">—</span>
              <span className="text-muted-foreground">End Date</span>
            </p>
          ) : awaitingEnd ? (
            <p className="flex items-center justify-center gap-2 text-sm mb-4 flex-wrap">
              <span className="font-medium text-blue-600 dark:text-blue-500">
                {formatPickerDate(draftStart)}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground">Select End Date</span>
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm mb-4 flex-wrap">
              <span className="font-medium text-blue-600 dark:text-blue-500">
                {formatPickerDate(draftStart!)}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className="font-medium text-blue-600 dark:text-blue-500">
                {formatPickerDate(draftEnd!)}
              </span>
            </p>
          )}

          <div className="flex gap-2 mb-4">
            <NavPill
              label={format(viewMonth, "MMMM")}
              onPrev={() => setViewMonth((m) => subMonths(m, 1))}
              onNext={() => setViewMonth((m) => addMonths(m, 1))}
              prevLabel="Previous month"
              nextLabel="Next month"
            />
            <NavPill
              label={String(getYear(viewMonth))}
              onPrev={() => setViewMonth((m) => setYear(m, getYear(m) - 1))}
              onNext={() => setViewMonth((m) => setYear(m, getYear(m) + 1))}
              prevLabel="Previous year"
              nextLabel="Next year"
            />
          </div>

          <MonthCalendar
            month={viewMonth}
            rangeStart={draftStart}
            rangeEnd={draftEnd}
            awaitingEnd={awaitingEnd}
            onPick={pickDay}
          />
        </div>

        <div className="flex justify-end gap-4 border-t border-input px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-sm font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={handleCancel}
          >
            CANCEL
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-auto px-0 text-sm font-semibold hover:bg-transparent",
              canApply
                ? "text-blue-600 hover:text-blue-700 dark:text-blue-500"
                : "text-blue-400 cursor-not-allowed"
            )}
            onClick={handleOk}
            disabled={!canApply}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
