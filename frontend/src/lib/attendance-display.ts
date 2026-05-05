import type { AttendanceRecord } from "@/types";

/** UI label for punch-clock view: In = on shift, Out = checked out, Absent = no check-in. */
export function getShiftStatusDisplay(r: AttendanceRecord): {
  label: string;
  variant: "success" | "destructive" | "info" | "secondary";
} {
  if (r.checkIn && r.checkOut) {
    return { label: "Out", variant: "success" };
  }
  if (r.checkIn) {
    return { label: "In", variant: "info" };
  }
  if (r.status === "ABSENT") {
    return { label: "Absent", variant: "destructive" };
  }
  return { label: "—", variant: "secondary" };
}
