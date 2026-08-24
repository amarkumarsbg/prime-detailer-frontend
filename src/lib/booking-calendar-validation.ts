import { format } from "date-fns";

/** `min` value for `<input type="date">` — local calendar today (yyyy-MM-dd). */
export function localTodayDateInputMin(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * `min` for `<input type="datetime-local">` (minute resolution, local TZ).
 * Rounds up to the next full minute so "now" is always selectable.
 */
export function localDatetimeLocalInputMin(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  if (d.getTime() <= Date.now()) {
    d.setMinutes(d.getMinutes() + 1);
  }
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/**
 * `min` for `<input type="time">` when the selected date is today (HH:mm, local).
 */
export function localTimeInputMinNow(): string {
  return format(new Date(), "HH:mm");
}

function appointmentSlotTimeMs(dateStr: string, timeStr: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!dm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const day = Number(dm[3]);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!tm) return null;
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(mo) ||
    !Number.isFinite(day) ||
    !Number.isFinite(h) ||
    !Number.isFinite(mi)
  ) {
    return null;
  }
  return new Date(y, mo - 1, day, h, mi, 0, 0).getTime();
}

/**
 * True if appointment date+time is before "now" (local), with small slack for clock skew.
 */
export function isAppointmentSlotInPast(
  dateStr: string,
  timeStr: string,
  slackMs: number = 60_000
): boolean {
  const t = appointmentSlotTimeMs(dateStr, timeStr);
  if (t === null) return true;
  return t < Date.now() - slackMs;
}

/**
 * True if `datetime-local` value parses to a time strictly before now.
 */
export function isDatetimeLocalInPast(value: string, slackMs: number = 60_000): boolean {
  const v = value.trim();
  if (!v) return true;
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return true;
  return t < Date.now() - slackMs;
}
