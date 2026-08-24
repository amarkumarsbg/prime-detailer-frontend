/**
 * Build month offsets for high-end maintenance reminders from preset schedule + chosen first milestone.
 * If `firstMonths` matches a preset, behavior matches "all presets >= first".
 * If `firstMonths` is custom (not in preset), it is included first, then all preset milestones strictly after it.
 */
export function buildHighEndReminderMonthIntervals(
  presetMonths: number[],
  firstMonths: number
): number[] {
  const sorted = [...presetMonths]
    .filter((m) => Number.isFinite(m) && m > 0)
    .sort((a, b) => a - b);
  const cap = 120;
  const f = Math.min(cap, Math.max(1, Math.round(firstMonths)));
  if (sorted.length === 0) return [f];
  if (sorted.includes(f)) {
    return sorted.filter((m) => m >= f);
  }
  return [f, ...sorted.filter((m) => m > f)];
}

/** Suggested first value when switching from preset schedule to manual entry (not in `presetMonths`). */
export function defaultManualFirstFollowUpMonths(presetMonths: number[]): number {
  const sorted = [...presetMonths].filter((m) => Number.isFinite(m) && m > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 6;
  const g = sorted[0] - 1;
  return g >= 1 ? g : 3;
}

/** Preset planned completion times (minutes) for high-end programs on a job card. */
export const HIGH_END_COMPLETION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 240, label: "4 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 2880, label: "2 days" },
  { minutes: 4320, label: "3 days" },
];

const PRESET_MINUTE_SET = new Set(HIGH_END_COMPLETION_PRESETS.map((p) => p.minutes));

export function formatHighEndCompletionMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = m / 60;
    return Number.isInteger(h) ? `${h} hr` : `${Math.round(h * 10) / 10} hr`;
  }
  const d = Math.floor(m / 1440);
  const rem = m % 1440;
  if (rem === 0) return d === 1 ? "1 day" : `${d} days`;
  const h = Math.round(rem / 60);
  return `${d}d ${h}h`;
}

export function highEndCompletionSelectValue(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const rounded = Math.round(minutes);
  return PRESET_MINUTE_SET.has(rounded) ? String(rounded) : "__custom__";
}

/** Longest planned completion among selected high-end programs (0 when none set). */
export function maxHighEndCompletionMinutes(
  serviceIds: string[],
  minutesById: Record<string, number | undefined>
): number {
  let max = 0;
  for (const id of serviceIds) {
    const m = minutesById[id];
    if (m != null && Number.isFinite(m) && m > max) max = Math.round(m);
  }
  return max;
}

/** Expected delivery = base receive time + longest high-end planned completion. */
export function expectedDeliveryFromHighEndCompletion(
  baseDate: Date | string,
  serviceIds: string[],
  minutesById: Record<string, number | undefined>
): Date {
  const base = new Date(baseDate);
  const minutes = maxHighEndCompletionMinutes(serviceIds, minutesById);
  if (minutes <= 0) return base;
  return new Date(base.getTime() + minutes * 60_000);
}
