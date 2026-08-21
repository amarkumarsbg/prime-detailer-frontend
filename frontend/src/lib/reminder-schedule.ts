import type {
  ReminderFrequency,
  ReminderKind,
  ReminderStatus,
  ReminderType,
  ServiceReminder,
} from "@/types";

/**
 * Phase 0 product rules (locked):
 * - Service reminders anchor on job DELIVERED (Phase 2: category engine).
 * - Service recurrence: mark sent per period on WhatsApp send (Phase 4B auto + manual).
 * - Payment reminders start from invoice date/due; stop when outstanding is 0 (Phase 3);
 *   after WhatsApp send while still outstanding, advance to next period (Phase 4B).
 */

/** Cadence frequencies used by category + payment reminders (excludes CUSTOM). */
export type SchedulableReminderFrequency = Exclude<ReminderFrequency, "CUSTOM">;

export const SCHEDULABLE_REMINDER_FREQUENCIES: SchedulableReminderFrequency[] = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "YEARLY",
];

export const REMINDER_FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  BIANNUAL: "Half-Yearly",
  YEARLY: "Yearly",
  CUSTOM: "Custom",
};

/** Service categories driven by Settings frequencies (high-end uses CUSTOM month lists). */
export const CATEGORY_REMINDER_TYPES = [
  "GENERAL_SERVICE",
  "OIL_CHANGE",
  "BRAKE_INSPECTION",
  "TIRE_ROTATION",
  "AC_SERVICE",
  "BATTERY_CHECK",
  "INSURANCE",
  "PUC",
] as const satisfies readonly ReminderType[];

export type CategoryReminderType = (typeof CATEGORY_REMINDER_TYPES)[number];

export const CATEGORY_REMINDER_TYPE_LABELS: Record<CategoryReminderType, string> = {
  GENERAL_SERVICE: "General Service",
  OIL_CHANGE: "Oil Change",
  BRAKE_INSPECTION: "Brake Inspection",
  TIRE_ROTATION: "Tire Rotation",
  AC_SERVICE: "AC Service",
  BATTERY_CHECK: "Battery Check",
  INSURANCE: "Insurance",
  PUC: "PUC",
};

function parseLocalDay(isoOrDay: string | Date): Date {
  if (isoOrDay instanceof Date) {
    return new Date(isoOrDay.getFullYear(), isoOrDay.getMonth(), isoOrDay.getDate());
  }
  const day = isoOrDay.slice(0, 10);
  const [y, m, d] = day.split("-").map((x) => Number(x));
  if (!y || !m || !d) {
    const fallback = new Date(isoOrDay);
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }
  return new Date(y, m - 1, d);
}

function formatLocalDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add calendar months while clamping to the last valid day of the target month. */
function addCalendarMonths(d: Date, months: number): Date {
  const day = d.getDate();
  const result = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function isSchedulableReminderFrequency(
  value: string | undefined | null
): value is SchedulableReminderFrequency {
  return (
    value === "WEEKLY" ||
    value === "MONTHLY" ||
    value === "QUARTERLY" ||
    value === "BIANNUAL" ||
    value === "YEARLY"
  );
}

/** Normalize UI/legacy aliases to ReminderFrequency. */
export function parseReminderFrequency(
  value: string | undefined | null,
  fallback: SchedulableReminderFrequency = "MONTHLY"
): SchedulableReminderFrequency {
  if (!value) return fallback;
  const v = value.trim().toUpperCase().replace(/-/g, "_");
  if (v === "HALF_YEARLY" || v === "HALFYEARLY" || v === "6MONTHS" || v === "EVERY_6_MONTHS") {
    return "BIANNUAL";
  }
  if (v === "3MONTHS" || v === "EVERY_3_MONTHS") return "QUARTERLY";
  if (isSchedulableReminderFrequency(v)) return v;
  const lower = value.trim().toLowerCase();
  if (lower === "weekly") return "WEEKLY";
  if (lower === "monthly") return "MONTHLY";
  if (lower === "quarterly" || lower === "3months") return "QUARTERLY";
  if (lower === "biannual" || lower === "6months" || lower === "half-yearly") return "BIANNUAL";
  if (lower === "yearly") return "YEARLY";
  return fallback;
}

/**
 * Next due calendar date for a schedulable frequency.
 * CUSTOM is unsupported here — high-end uses month offsets instead.
 */
export function nextDueDate(
  from: Date | string,
  frequency: ReminderFrequency
): string {
  if (frequency === "CUSTOM") {
    throw new Error("nextDueDate does not support CUSTOM; use high-end month intervals");
  }
  const base = parseLocalDay(from);
  let next: Date;
  switch (frequency) {
    case "WEEKLY":
      next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
      break;
    case "MONTHLY":
      next = addCalendarMonths(base, 1);
      break;
    case "QUARTERLY":
      next = addCalendarMonths(base, 3);
      break;
    case "BIANNUAL":
      next = addCalendarMonths(base, 6);
      break;
    case "YEARLY":
      next = addCalendarMonths(base, 12);
      break;
    default:
      next = addCalendarMonths(base, 1);
  }
  return formatLocalDay(next);
}

/** Period bucket for dedupe (aligned with due date's calendar period). */
export function periodKey(from: Date | string, frequency: ReminderFrequency): string {
  if (frequency === "CUSTOM") {
    return `CUSTOM-${formatLocalDay(parseLocalDay(from))}`;
  }
  const d = parseLocalDay(from);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (frequency) {
    case "WEEKLY": {
      // ISO-ish week: Thursday-based year/week for stability near year boundaries
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }
    case "MONTHLY":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "QUARTERLY": {
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    case "BIANNUAL": {
      const h = m <= 6 ? 1 : 2;
      return `${y}-H${h}`;
    }
    case "YEARLY":
      return `${y}`;
    default:
      return `${y}-${String(m).padStart(2, "0")}`;
  }
}

/**
 * Status from due date + lead days.
 * - OVERDUE: more than leadDays past due
 * - DUE: on/before today, or within leadDays before due
 * - UPCOMING: more than leadDays before due
 */
export function computeReminderStatus(
  dueDate: string,
  leadDays: number,
  now: Date = new Date()
): Exclude<ReminderStatus, "COMPLETED" | "DISMISSED"> {
  const due = parseLocalDay(dueDate);
  const today = parseLocalDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  const lead = Math.max(0, Math.floor(leadDays));
  if (diffDays < -lead) return "OVERDUE";
  if (diffDays <= lead) return "DUE";
  return "UPCOMING";
}

/** Legacy rows without kind are SERVICE. */
export function normalizeReminderKind(kind: string | undefined | null): ReminderKind {
  return kind === "PAYMENT" ? "PAYMENT" : "SERVICE";
}

export function normalizeServiceReminder(raw: ServiceReminder): ServiceReminder {
  const kind = normalizeReminderKind(raw.kind);
  const frequency =
    raw.frequency === "CUSTOM"
      ? "CUSTOM"
      : parseReminderFrequency(raw.frequency, "MONTHLY");
  return {
    ...raw,
    kind,
    frequency: raw.frequency === "CUSTOM" ? "CUSTOM" : frequency,
    periodKey:
      raw.periodKey ??
      (raw.frequency === "CUSTOM"
        ? periodKey(raw.dueDate, "CUSTOM")
        : periodKey(raw.dueDate, frequency)),
  };
}

export function normalizeServiceReminders(list: ServiceReminder[]): ServiceReminder[] {
  return list.map(normalizeServiceReminder);
}
