"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportSelectItemClass } from "@/lib/reports/report-period-presets";

export const HR_MONTH_OPTIONS = [
  { v: 1, label: "January" },
  { v: 2, label: "February" },
  { v: 3, label: "March" },
  { v: 4, label: "April" },
  { v: 5, label: "May" },
  { v: 6, label: "June" },
  { v: 7, label: "July" },
  { v: 8, label: "August" },
  { v: 9, label: "September" },
  { v: 10, label: "October" },
  { v: 11, label: "November" },
  { v: 12, label: "December" },
] as const;

export function hrYearOptions(centerYear: number): number[] {
  return [centerYear - 2, centerYear - 1, centerYear, centerYear + 1];
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type BranchOption = { id: string; name: string };

type HrMonthYearBranchFiltersProps = {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  showBranchPicker: boolean;
  pageBranchFilter: string;
  onBranchFilterChange: (v: string) => void;
  branches: BranchOption[];
  extra?: ReactNode;
};

export function HrMonthYearBranchFilters({
  month,
  year,
  onMonthChange,
  onYearChange,
  showBranchPicker,
  pageBranchFilter,
  onBranchFilterChange,
  branches,
  extra,
}: HrMonthYearBranchFiltersProps) {
  const years = hrYearOptions(new Date().getFullYear());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="h-9 w-[140px] border-border" aria-label="Month">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {HR_MONTH_OPTIONS.map((m) => (
            <SelectItem key={m.v} value={String(m.v)} className={reportSelectItemClass}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="h-9 w-[100px] border-border" aria-label="Year">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)} className={reportSelectItemClass}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showBranchPicker ? (
        <Select value={pageBranchFilter} onValueChange={onBranchFilterChange}>
          <SelectTrigger className="h-9 w-[180px] border-border" aria-label="Branch">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className={reportSelectItemClass}>
              All branches
            </SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id} className={reportSelectItemClass}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {extra}
    </div>
  );
}
