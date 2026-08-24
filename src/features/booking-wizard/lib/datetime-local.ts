export function datetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Split `YYYY-MM-DDTHH:mm` for narrow layouts (native datetime-local popover is often too wide on mobile). */
export function splitDatetimeLocal(value: string): { date: string; time: string } {
  const t = value.trim();
  if (!t) return { date: "", time: "12:00" };
  const [d, rest] = t.split("T");
  const timeSeg = rest?.slice(0, 5) ?? "12:00";
  return {
    date: d ?? "",
    time: /^\d{2}:\d{2}$/.test(timeSeg) ? timeSeg : "12:00",
  };
}

export function joinDatetimeLocal(date: string, time: string): string {
  const d = date.trim();
  if (!d) return "";
  const tm = time.trim() && /^\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : "12:00";
  return `${d}T${tm}`;
}

export function hasExpectedDeliveryDateSet(value: string): boolean {
  return Boolean(splitDatetimeLocal(value).date.trim());
}
