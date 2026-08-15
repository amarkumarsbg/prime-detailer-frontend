export const REPORT_PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "last7", label: "Last 7 days" },
  { value: "month", label: "This Month" },
  { value: "prevMonth", label: "Previous Month" },
  { value: "last30", label: "Last 30 Days" },
  { value: "last90", label: "Last 90 Days" },
  { value: "quarter", label: "This Quarter" },
  { value: "prevQuarter", label: "Previous Quarter" },
  { value: "fy", label: "Current Fiscal Year" },
  { value: "prevFy", label: "Previous Fiscal Year" },
  { value: "last365", label: "Last 365 Days" },
  { value: "custom", label: "Custom date (from-to)" },
] as const;

export type ReportPeriodPreset = (typeof REPORT_PERIOD_OPTIONS)[number]["value"];

/** Default period for report screens — shows FY data including seeded demo invoices. */
export const DEFAULT_REPORT_PERIOD: ReportPeriodPreset = "fy";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseCustomPeriod(
  period: string
): { start: string; end: string } | null {
  if (!period.startsWith("custom:")) return null;
  const parts = period.split(":");
  if (parts.length !== 3) return null;
  const [, start, end] = parts;
  if (!start || !end || start > end) return null;
  return { start, end };
}

export function buildCustomPeriod(start: string, end: string): string {
  return `custom:${start}:${end}`;
}

export function formatPeriodLabel(period: string): string {
  const custom = parseCustomPeriod(period);
  if (custom) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(d + "T12:00:00"));
    return `${fmt(custom.start)} - ${fmt(custom.end)}`;
  }
  const opt =
    REPORT_PERIOD_OPTIONS.find((o) => o.value === period) ??
    (
      [
        { value: "this_month", label: "This month" },
        { value: "last_month", label: "Last month" },
        { value: "last_30d", label: "Last 30 days" },
        { value: "7d", label: "Last 7 Days" },
        { value: "30d", label: "Last 30 Days" },
        { value: "90d", label: "Last 90 Days" },
        { value: "all", label: "All time" },
      ] as const
    ).find((o) => o.value === period);
  return opt?.label ?? "Date range";
}

/** Whether an ISO date string falls in the given preset window (uses local calendar). */
export function dateInPreset(iso: string, preset: string): boolean {
  const custom = parseCustomPeriod(preset);
  if (custom) {
    const day = iso.slice(0, 10);
    return day >= custom.start && day <= custom.end;
  }

  if (preset === "custom") {
    return true;
  }

  const t = new Date(iso).getTime();
  const now = new Date();
  const today = startOfDay(now);

  if (preset === "today") {
    return t >= today.getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return t >= startOfDay(y).getTime() && t <= endOfDay(y).getTime();
  }
  if (preset === "week") {
    const wd = today.getDay();
    const mon = new Date(today);
    mon.setDate(mon.getDate() - (wd === 0 ? 6 : wd - 1));
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return t >= startOfDay(mon).getTime() && t <= endOfDay(sun).getTime();
  }
  if (preset === "lastWeek") {
    const wd = today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(thisMon.getDate() - (wd === 0 ? 6 : wd - 1));
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastSun.getDate() + 6);
    return t >= startOfDay(lastMon).getTime() && t <= endOfDay(lastSun).getTime();
  }
  if (preset === "last7" || preset === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "month" || preset === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevMonth" || preset === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "last30" || preset === "30d" || preset === "last_30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "last90" || preset === "90d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 89);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "quarter" || preset === "fq") {
    const q = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), q * 3, 1);
    const last = new Date(now.getFullYear(), q * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevQuarter") {
    const q = Math.floor(now.getMonth() / 3) - 1;
    const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const qq = ((q % 4) + 4) % 4;
    const first = new Date(y, qq * 3, 1);
    const last = new Date(y, qq * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "fy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevFy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "last365") {
    const from = new Date(today);
    from.setDate(from.getDate() - 364);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "all") {
    return true;
  }
  return true;
}

/** Resolve a report period preset (or `custom:YYYY-MM-DD:YYYY-MM-DD`) to inclusive local bounds. */
export function getPeriodBounds(
  period: string,
  now = new Date()
): { start: Date; end: Date } {
  const custom = parseCustomPeriod(period);
  if (custom) {
    return {
      start: startOfDay(new Date(custom.start + "T12:00:00")),
      end: endOfDay(new Date(custom.end + "T12:00:00")),
    };
  }

  const today = startOfDay(now);
  const endNow = endOfDay(now);

  switch (period) {
    case "today":
      return { start: today, end: endNow };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const wd = today.getDay();
      const mon = new Date(today);
      mon.setDate(mon.getDate() - (wd === 0 ? 6 : wd - 1));
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      return { start: startOfDay(mon), end: endOfDay(sun) };
    }
    case "lastWeek": {
      const wd = today.getDay();
      const thisMon = new Date(today);
      thisMon.setDate(thisMon.getDate() - (wd === 0 ? 6 : wd - 1));
      const lastMon = new Date(thisMon);
      lastMon.setDate(lastMon.getDate() - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      return { start: startOfDay(lastMon), end: endOfDay(lastSun) };
    }
    case "last7":
    case "7d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { start: startOfDay(from), end: endNow };
    }
    case "month":
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(first), end: endNow };
    }
    case "prevMonth":
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "last30":
    case "last_30d":
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { start: startOfDay(from), end: endNow };
    }
    case "90d":
    case "last90": {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      return { start: startOfDay(from), end: endNow };
    }
    case "quarter":
    case "fq": {
      const q = Math.floor(now.getMonth() / 3);
      const first = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "prevQuarter": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const qq = ((q % 4) + 4) % 4;
      const first = new Date(y, qq * 3, 1);
      const last = new Date(y, qq * 3 + 3, 0);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "fy": {
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const first = new Date(y, 3, 1);
      const last = new Date(y + 1, 2, 31);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "prevFy": {
      const y = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
      const first = new Date(y, 3, 1);
      const last = new Date(y + 1, 2, 31);
      return { start: startOfDay(first), end: endOfDay(last) };
    }
    case "last365": {
      const from = new Date(today);
      from.setDate(from.getDate() - 364);
      return { start: startOfDay(from), end: endNow };
    }
    default:
      return { start: today, end: endNow };
  }
}

export function isoInPeriodBounds(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export const reportSelectItemClass =
  "cursor-pointer focus:bg-muted/70 focus:text-foreground data-[highlighted]:bg-muted/70 data-[state=checked]:bg-transparent data-[state=checked]:font-medium";
