import { describe, expect, it } from "vitest";
import {
  availableLeaveDays,
  countLeaveDays,
  getApprovedLeaveInRange,
  hasOverlappingLeave,
  rangesOverlap,
} from "./calculations";
import type { LeaveBalance, LeaveRequest } from "@/types";

const baseRequest = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: "lr-1",
  staffId: "usr-1",
  staffName: "Alex",
  leaveTypeId: "lt-1",
  leaveTypeName: "Casual",
  branchId: "br-1",
  fromDate: "2026-08-10",
  toDate: "2026-08-12",
  days: 3,
  reason: "Personal",
  status: "PENDING",
  appliedAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

describe("countLeaveDays", () => {
  it("counts inclusive calendar days", () => {
    expect(countLeaveDays("2026-08-01", "2026-08-01")).toBe(1);
    expect(countLeaveDays("2026-08-01", "2026-08-03")).toBe(3);
  });

  it("returns 0 for inverted ranges", () => {
    expect(countLeaveDays("2026-08-05", "2026-08-01")).toBe(0);
  });
});

describe("overlap + balance", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap("2026-08-01", "2026-08-05", "2026-08-05", "2026-08-07")).toBe(true);
    expect(rangesOverlap("2026-08-01", "2026-08-03", "2026-08-04", "2026-08-05")).toBe(false);
  });

  it("blocks overlapping pending/approved leave for same staff", () => {
    const requests = [baseRequest({})];
    expect(hasOverlappingLeave(requests, "usr-1", "2026-08-12", "2026-08-14")).toBe(true);
    expect(hasOverlappingLeave(requests, "usr-1", "2026-08-13", "2026-08-14")).toBe(false);
  });

  it("computes available days from entitled - used - pending", () => {
    const bal: LeaveBalance = {
      id: "lb-1",
      staffId: "usr-1",
      leaveTypeId: "lt-1",
      branchId: "br-1",
      year: 2026,
      entitled: 12,
      used: 3,
      pending: 2,
    };
    expect(availableLeaveDays(bal)).toBe(7);
  });
});

describe("getApprovedLeaveInRange", () => {
  it("returns only approved leave intersecting the window", () => {
    const requests = [
      baseRequest({ id: "lr-a", status: "APPROVED" }),
      baseRequest({
        id: "lr-b",
        fromDate: "2026-08-20",
        toDate: "2026-08-21",
        days: 2,
        status: "PENDING",
      }),
    ];
    const hit = getApprovedLeaveInRange(requests, {
      staffId: "usr-1",
      fromDate: "2026-08-11",
      toDate: "2026-08-11",
    });
    expect(hit.map((r) => r.id)).toEqual(["lr-a"]);
  });
});
