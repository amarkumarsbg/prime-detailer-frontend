import type { AttendanceRecord, User, UserRole } from "@/types";

const LATE_CUTOFF = "09:30";
const HALF_DAY_MAX_MINUTES = 240;

function attendanceIdRank(id: string): number {
  const m = id.match(/(\d+)/g);
  if (!m?.length) return 0;
  return Math.max(...m.map((x) => parseInt(x, 10)));
}

function sortRecordsLatestFirst(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => attendanceIdRank(b.id) - attendanceIdRank(a.id));
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function statusForCheckIn(checkIn: string): "PRESENT" | "LATE" {
  return checkIn > LATE_CUTOFF ? "LATE" : "PRESENT";
}

function statusForCheckOut(
  checkIn: string,
  durationMinutes: number
): AttendanceRecord["status"] {
  if (durationMinutes < HALF_DAY_MAX_MINUTES) return "HALF_DAY";
  if (checkIn > LATE_CUTOFF) return "LATE";
  return "PRESENT";
}

function nextRecordId(existing: AttendanceRecord[]): string {
  const max = existing.reduce((m, r) => Math.max(m, attendanceIdRank(r.id)), 0);
  return `att-${String(max + 1).padStart(6, "0")}`;
}

export type PunchApplyResult =
  | {
      ok: true;
      kind: "checkIn";
      time: string;
      record: AttendanceRecord;
      nextRecords: AttendanceRecord[];
    }
  | {
      ok: true;
      kind: "checkOut";
      time: string;
      record: AttendanceRecord;
      nextRecords: AttendanceRecord[];
    }
  | { ok: false; error: "WRONG_BRANCH" | "INACTIVE" };

/** Clock for punch — use the client’s local calendar day/time (phone) so Vercel UTC doesn’t shift the date). */
export type PunchClock = { date: string; timeStr: string };

/** Immutable punch: returns updated records array (shared by API + tests). */
export function applyPunchToRecords(
  records: AttendanceRecord[],
  staff: User,
  branchId: string,
  clock: PunchClock
): PunchApplyResult {
  if (!staff.isActive) {
    return { ok: false, error: "INACTIVE" };
  }
  if (staff.branchId !== branchId) {
    return { ok: false, error: "WRONG_BRANCH" };
  }

  const today = clock.date;
  const timeStr = clock.timeStr;

  const forDay = records.filter(
    (r) => r.staffId === staff.id && r.branchId === branchId && r.date === today
  );
  const sorted = sortRecordsLatestFirst(forDay);

  const open = sorted.find((r) => r.checkIn != null && r.checkOut == null);

  if (open) {
    const durationMinutes = minutesBetween(open.checkIn!, timeStr);
    const status = statusForCheckOut(open.checkIn!, durationMinutes);
    const updated: AttendanceRecord = {
      ...open,
      checkOut: timeStr,
      durationMinutes,
      status,
      qrScanned: true,
    };
    const nextRecords = records.map((r) => (r.id === open.id ? updated : r));
    return {
      ok: true,
      kind: "checkOut",
      time: timeStr,
      record: updated,
      nextRecords,
    };
  }

  const absentOrEmpty = sorted.find(
    (r) => r.checkIn == null && r.checkOut == null
  );

  const checkInStatus = statusForCheckIn(timeStr);

  if (absentOrEmpty) {
    const updated: AttendanceRecord = {
      ...absentOrEmpty,
      checkIn: timeStr,
      checkOut: undefined,
      durationMinutes: undefined,
      status: checkInStatus,
      qrScanned: true,
    };
    const nextRecords = records.map((r) =>
      r.id === absentOrEmpty.id ? updated : r
    );
    return {
      ok: true,
      kind: "checkIn",
      time: timeStr,
      record: updated,
      nextRecords,
    };
  }

  const newRecord: AttendanceRecord = {
    id: nextRecordId(records),
    staffId: staff.id,
    staffName: staff.name,
    staffRole: staff.role as UserRole,
    branchId,
    date: today,
    checkIn: timeStr,
    checkOut: undefined,
    durationMinutes: undefined,
    status: checkInStatus,
    qrScanned: true,
  };
  return {
    ok: true,
    kind: "checkIn",
    time: timeStr,
    record: newRecord,
    nextRecords: [newRecord, ...records],
  };
}
