import { describe, expect, it } from "vitest";
import { buildStaffPerformanceRows } from "@/lib/performance-staff-metrics";
import type {
  AttendanceRecord,
  JobCard,
  StaffRewardLedgerEntry,
  StaffTarget,
} from "@/types";

function job(partial: Partial<JobCard> & Pick<JobCard, "id" | "mechanicId">): JobCard {
  return {
    jobNumber: partial.jobNumber ?? "JC-1",
    branchId: partial.branchId ?? "br-1",
    customerId: "c1",
    customerName: "Cust",
    customerPhone: "1",
    vehicleId: "v1",
    vehicleRegNumber: "KA01",
    vehicleMakeModel: "Car",
    vehicleSegment: "HATCHBACK",
    status: partial.status ?? "DELIVERED",
    reportedIssues: "",
    expectedDelivery: partial.expectedDelivery ?? "2026-08-15T12:00:00.000Z",
    actualDelivery: partial.actualDelivery ?? "2026-08-15T10:00:00.000Z",
    services: [],
    estimatedAmount: partial.estimatedAmount ?? 1000,
    incentivePercent: partial.incentivePercent ?? 5,
    incentiveAmount: partial.incentiveAmount ?? 50,
    createdBy: "u1",
    createdAt: partial.createdAt ?? "2026-08-10T10:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-15T10:00:00.000Z",
    ...partial,
  } as JobCard;
}

describe("buildStaffPerformanceRows", () => {
  const rangeStart = new Date("2026-08-01T00:00:00.000Z");
  const rangeEnd = new Date("2026-08-31T23:59:59.999Z");

  it("aggregates jobs, ledger, targets, and attendance", () => {
    const staff = [
      { id: "m1", name: "Mech One", branchId: "br-1", isActive: true },
      { id: "m2", name: "Mech Two", branchId: "br-1", isActive: true },
    ];
    const jobCards = [
      job({
        id: "j1",
        mechanicId: "m1",
        mechanicName: "Mech One",
        incentiveAmount: 80,
      }),
      job({
        id: "j2",
        mechanicId: "m1",
        mechanicName: "Mech One",
        incentiveAmount: 20,
      }),
    ];
    const ledger: StaffRewardLedgerEntry[] = [
      {
        id: "srl-1",
        staffId: "m1",
        staffName: "Mech One",
        branchId: "br-1",
        rewardType: "JOB_INCENTIVE",
        amount: 100,
        status: "APPROVED",
        periodMonth: 8,
        periodYear: 2026,
        createdAt: "2026-08-15T10:00:00.000Z",
        idempotencyKey: "j1:m1:JOB_INCENTIVE",
      },
      {
        id: "srl-2",
        staffId: "m1",
        staffName: "Mech One",
        branchId: "br-1",
        rewardType: "MANUAL_CREDIT",
        amount: 25,
        status: "CANCELLED",
        periodMonth: 8,
        periodYear: 2026,
        createdAt: "2026-08-16T10:00:00.000Z",
        idempotencyKey: "manual-1",
      },
    ];
    const targets: StaffTarget[] = [
      {
        id: "st-1",
        staffId: "m1",
        staffName: "Mech One",
        branchId: "br-1",
        periodMonth: 8,
        periodYear: 2026,
        metric: "JOBS_COMPLETED",
        targetValue: 4,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const attendanceRecords: AttendanceRecord[] = [
      {
        id: "a1",
        staffId: "m1",
        staffName: "Mech One",
        staffRole: "MECHANIC",
        branchId: "br-1",
        date: "2026-08-05",
        status: "PRESENT",
        qrScanned: true,
      },
      {
        id: "a2",
        staffId: "m1",
        staffName: "Mech One",
        staffRole: "MECHANIC",
        branchId: "br-1",
        date: "2026-08-06",
        status: "LATE",
        qrScanned: true,
      },
      {
        id: "a3",
        staffId: "m1",
        staffName: "Mech One",
        staffRole: "MECHANIC",
        branchId: "br-1",
        date: "2026-07-30",
        status: "PRESENT",
        qrScanned: true,
      },
    ];

    const rows = buildStaffPerformanceRows({
      staff,
      jobCards,
      ledger,
      targets,
      rangeStart,
      rangeEnd,
      periodMonth: 8,
      periodYear: 2026,
      attendanceRecords,
    });

    expect(rows).toHaveLength(2);
    const m1 = rows.find((r) => r.staffId === "m1");
    expect(m1).toMatchObject({
      jobsCompleted: 2,
      incentiveFromJobs: 100,
      rewardsFromLedger: 100,
      presentDays: 2,
      targetMetric: "JOBS_COMPLETED",
      targetValue: 4,
      actualForTarget: 2,
      targetAchievementPct: 50,
    });
    const m2 = rows.find((r) => r.staffId === "m2");
    expect(m2?.jobsCompleted).toBe(0);
    expect(m2?.presentDays).toBe(0);
  });

  it("filters by branch and skips cancelled-only inactive staff without activity", () => {
    const rows = buildStaffPerformanceRows({
      staff: [
        { id: "m1", name: "A", branchId: "br-1", isActive: true },
        { id: "m2", name: "B", branchId: "br-2", isActive: false },
      ],
      jobCards: [
        job({ id: "j1", mechanicId: "m1", branchId: "br-1" }),
      ],
      ledger: [],
      targets: [],
      rangeStart,
      rangeEnd,
      periodMonth: 8,
      periodYear: 2026,
      branchId: "br-1",
    });
    expect(rows.map((r) => r.staffId)).toEqual(["m1"]);
  });

  it("returns null presentDays when attendance is omitted", () => {
    const rows = buildStaffPerformanceRows({
      staff: [{ id: "m1", name: "A", branchId: "br-1", isActive: true }],
      jobCards: [],
      ledger: [],
      targets: [],
      rangeStart,
      rangeEnd,
      periodMonth: 8,
      periodYear: 2026,
    });
    expect(rows[0]?.presentDays).toBeNull();
  });
});
