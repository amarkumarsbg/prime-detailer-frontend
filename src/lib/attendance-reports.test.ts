import { describe, expect, it } from "vitest";
import {
  attendanceSummaryToCsv,
  buildStaffAttendanceSummary,
  eachDateInRange,
  isDateOnApprovedLeave,
  monthDateRange,
} from "./attendance-reports";
import type { AttendanceRecord, LeaveRequest } from "@/types";

const staff = [
  { id: "usr-1", name: "Alex", branchId: "br-1", isActive: true },
  { id: "usr-2", name: "Blake", branchId: "br-1", isActive: true },
  { id: "usr-3", name: "Chris", branchId: "br-2", isActive: true },
  { id: "usr-4", name: "Dana", branchId: "br-1", isActive: false },
];

const leave = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: "lr-1",
  staffId: "usr-1",
  staffName: "Alex",
  leaveTypeId: "lt-1",
  leaveTypeName: "Casual",
  branchId: "br-1",
  fromDate: "2026-08-11",
  toDate: "2026-08-12",
  days: 2,
  reason: "Personal",
  status: "APPROVED",
  appliedAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

const attendance = (over: Partial<AttendanceRecord>): AttendanceRecord => ({
  id: "att-1",
  staffId: "usr-1",
  staffName: "Alex",
  staffRole: "MECHANIC",
  branchId: "br-1",
  date: "2026-08-10",
  status: "PRESENT",
  qrScanned: true,
  durationMinutes: 480,
  checkIn: "09:00",
  checkOut: "17:00",
  ...over,
});

describe("monthDateRange / eachDateInRange", () => {
  it("returns inclusive month bounds", () => {
    expect(monthDateRange(2026, 8)).toEqual({
      fromDate: "2026-08-01",
      toDate: "2026-08-31",
    });
    expect(monthDateRange(2024, 2)).toEqual({
      fromDate: "2024-02-01",
      toDate: "2024-02-29",
    });
  });

  it("lists each date inclusively", () => {
    expect(eachDateInRange("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });
});

describe("isDateOnApprovedLeave", () => {
  it("matches approved leave only", () => {
    const requests = [
      leave({}),
      leave({
        id: "lr-2",
        staffId: "usr-2",
        fromDate: "2026-08-11",
        toDate: "2026-08-11",
        days: 1,
        status: "PENDING",
      }),
    ];
    expect(isDateOnApprovedLeave("2026-08-11", requests, "usr-1")).toBe(true);
    expect(isDateOnApprovedLeave("2026-08-13", requests, "usr-1")).toBe(false);
    expect(isDateOnApprovedLeave("2026-08-11", requests, "usr-2")).toBe(false);
  });
});

describe("buildStaffAttendanceSummary", () => {
  it("prefers present attendance over approved leave overlay", () => {
    const rows = buildStaffAttendanceSummary({
      attendance: [
        attendance({
          id: "a1",
          date: "2026-08-11",
          status: "PRESENT",
          durationMinutes: 480,
        }),
        attendance({
          id: "a2",
          date: "2026-08-10",
          status: "LATE",
          durationMinutes: 420,
        }),
      ],
      staff,
      approvedLeave: [leave({ fromDate: "2026-08-11", toDate: "2026-08-12", days: 2 })],
      fromDate: "2026-08-10",
      toDate: "2026-08-12",
      branchId: "br-1",
    });

    const alex = rows.find((r) => r.staffId === "usr-1");
    expect(alex).toMatchObject({
      presentDays: 1,
      lateDays: 1,
      leaveDays: 1, // Aug 12 leave; Aug 11 present wins
      absentDays: 0,
      halfDays: 0,
    });
    expect(alex?.totalMinutes).toBe(900);
    expect(alex?.avgHours).toBe(7.5);

    const blake = rows.find((r) => r.staffId === "usr-2");
    expect(blake).toMatchObject({
      presentDays: 0,
      leaveDays: 0,
      absentDays: 3,
    });

    expect(rows.some((r) => r.staffId === "usr-3")).toBe(false);
    expect(rows.some((r) => r.staffId === "usr-4")).toBe(false);
  });

  it("counts leave when no present/late/half-day punch", () => {
    const rows = buildStaffAttendanceSummary({
      attendance: [],
      staff: [staff[0]!],
      approvedLeave: [leave({ fromDate: "2026-08-11", toDate: "2026-08-11", days: 1 })],
      fromDate: "2026-08-11",
      toDate: "2026-08-11",
    });
    expect(rows[0]).toMatchObject({
      leaveDays: 1,
      absentDays: 0,
      presentDays: 0,
    });
  });
});

describe("attendanceSummaryToCsv", () => {
  it("includes expected header columns", () => {
    const csv = attendanceSummaryToCsv([
      {
        staffId: "usr-1",
        staffName: "Alex",
        branchId: "br-1",
        presentDays: 1,
        lateDays: 0,
        halfDays: 0,
        leaveDays: 1,
        absentDays: 0,
        totalMinutes: 480,
        avgHours: 8,
      },
    ]);
    const header = csv.split("\n")[0];
    expect(header).toBe(
      "Staff ID,Staff Name,Branch ID,Present Days,Late Days,Half Days,Leave Days,Absent Days,Total Minutes,Avg Hours"
    );
    expect(csv).toContain("usr-1,Alex,br-1,1,0,0,1,0,480,8");
  });
});
