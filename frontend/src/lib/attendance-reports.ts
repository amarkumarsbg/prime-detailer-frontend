import type { AttendanceRecord, LeaveRequest } from "@/types";
import { rangesOverlap } from "@/lib/leave/calculations";

export type AttendanceSummaryStaff = {
  id: string;
  name: string;
  branchId: string;
  isActive: boolean;
};

export type StaffAttendanceSummaryRow = {
  staffId: string;
  staffName: string;
  branchId: string;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  totalMinutes: number;
  avgHours: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive month bounds as yyyy-MM-dd. `month` is 1–12. */
export function monthDateRange(
  year: number,
  month: number
): { fromDate: string; toDate: string } {
  const fromDate = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { fromDate, toDate };
}

/** Inclusive list of yyyy-MM-dd dates in [fromDate, toDate]. */
export function eachDateInRange(fromDate: string, toDate: string): string[] {
  const from = parseYmd(fromDate);
  const to = parseYmd(toDate);
  if (!from || !to || to < from) return [];
  const out: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (cur <= to) {
    out.push(formatYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** True when `date` falls on an APPROVED leave for `staffId`. */
export function isDateOnApprovedLeave(
  date: string,
  leaveRequests: LeaveRequest[],
  staffId: string
): boolean {
  return leaveRequests.some(
    (r) =>
      r.staffId === staffId &&
      r.status === "APPROVED" &&
      rangesOverlap(date, date, r.fromDate, r.toDate)
  );
}

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Per-staff day rollup for a date window.
 * Attendance PRESENT/LATE/HALF_DAY wins; otherwise approved leave; else absent.
 * Does not change punch behavior.
 */
export function buildStaffAttendanceSummary(opts: {
  attendance: AttendanceRecord[];
  staff: AttendanceSummaryStaff[];
  approvedLeave: LeaveRequest[];
  fromDate: string;
  toDate: string;
  branchId?: string | null;
}): StaffAttendanceSummaryRow[] {
  const { attendance, approvedLeave, fromDate, toDate } = opts;
  const branchId = opts.branchId ?? null;
  const dates = eachDateInRange(fromDate, toDate);

  const roster = opts.staff.filter((s) => {
    if (!s.isActive) return false;
    if (branchId && s.branchId !== branchId) return false;
    return true;
  });

  const byStaffDate = new Map<string, AttendanceRecord>();
  for (const r of attendance) {
    if (r.date < fromDate || r.date > toDate) continue;
    if (branchId && r.branchId !== branchId) continue;
    byStaffDate.set(`${r.staffId}|${r.date}`, r);
  }

  return roster.map((s) => {
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let totalMinutes = 0;
    let durationSamples = 0;

    for (const date of dates) {
      const record = byStaffDate.get(`${s.id}|${date}`);
      const status = record?.status;
      if (status === "PRESENT") {
        presentDays += 1;
      } else if (status === "LATE") {
        lateDays += 1;
      } else if (status === "HALF_DAY") {
        halfDays += 1;
      } else if (isDateOnApprovedLeave(date, approvedLeave, s.id)) {
        leaveDays += 1;
      } else {
        absentDays += 1;
      }

      const mins = record?.durationMinutes;
      if (mins != null && mins > 0) {
        totalMinutes += mins;
        durationSamples += 1;
      }
    }

    const avgHours =
      durationSamples > 0
        ? Math.round((totalMinutes / durationSamples / 60) * 10) / 10
        : 0;

    return {
      staffId: s.id,
      staffName: s.name,
      branchId: s.branchId,
      presentDays,
      lateDays,
      halfDays,
      leaveDays,
      absentDays,
      totalMinutes,
      avgHours,
    };
  });
}

const CSV_HEADERS = [
  "Staff ID",
  "Staff Name",
  "Branch ID",
  "Present Days",
  "Late Days",
  "Half Days",
  "Leave Days",
  "Absent Days",
  "Total Minutes",
  "Avg Hours",
] as const;

export function attendanceSummaryToCsv(rows: StaffAttendanceSummaryRow[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((r) =>
      [
        r.staffId,
        r.staffName,
        r.branchId,
        r.presentDays,
        r.lateDays,
        r.halfDays,
        r.leaveDays,
        r.absentDays,
        r.totalMinutes,
        r.avgHours,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}
