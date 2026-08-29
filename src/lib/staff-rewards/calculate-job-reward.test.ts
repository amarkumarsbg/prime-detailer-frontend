import { describe, expect, it } from "vitest";
import {
  calculateJobReward,
  defaultStaffRewardSettings,
  resolveJobIncentiveAmount,
  rewardIdempotencyKey,
  getCompanyTargetResults,
} from "./calculate-job-reward";
import type { JobRewardInput } from "./calculate-job-reward";

const baseJob = (over: Partial<JobRewardInput> = {}): JobRewardInput => ({
  id: "jc-1",
  jobNumber: "JC-001",
  mechanicId: "mech-1",
  mechanicName: "Alex",
  branchId: "br-1",
  estimatedAmount: 10_000,
  incentivePercent: 5,
  incentiveAmount: 0,
  ...over,
});

describe("resolveJobIncentiveAmount", () => {
  it("uses incentiveAmount when > 0", () => {
    const settings = defaultStaffRewardSettings();
    expect(
      resolveJobIncentiveAmount(
        baseJob({ incentiveAmount: 750, incentivePercent: 5 }),
        settings
      )
    ).toBe(750);
  });

  it("falls back to percent of estimatedAmount", () => {
    const settings = defaultStaffRewardSettings();
    expect(
      resolveJobIncentiveAmount(
        baseJob({ incentiveAmount: 0, incentivePercent: 5, estimatedAmount: 10_000 }),
        settings
      )
    ).toBe(500);
  });
});

describe("rewardIdempotencyKey", () => {
  it("formats as jobId:staffId:rewardType", () => {
    expect(rewardIdempotencyKey("jc-1", "mech-1", "JOB_INCENTIVE")).toBe(
      "jc-1:mech-1:JOB_INCENTIVE"
    );
  });
});

describe("calculateJobReward", () => {
  it("creates JOB_INCENTIVE draft with percent amount and idempotency key", () => {
    const settings = defaultStaffRewardSettings();
    const drafts = calculateJobReward({
      job: baseJob({ incentiveAmount: 0, incentivePercent: 5 }),
      settings,
      now: "2026-08-21T12:00:00.000Z",
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rewardType).toBe("JOB_INCENTIVE");
    expect(drafts[0].amount).toBe(500);
    expect(drafts[0].staffId).toBe("mech-1");
    expect(drafts[0].idempotencyKey).toBe("jc-1:mech-1:JOB_INCENTIVE");
  });

  it("skips supervisor split when supervisorId is absent", () => {
    const settings = {
      ...defaultStaffRewardSettings(),
      supervisorSharePercent: 30,
      applicatorSharePercent: 70,
    };
    const drafts = calculateJobReward({
      job: baseJob({ incentiveAmount: 1000 }),
      settings,
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].amount).toBe(1000);
    expect(drafts[0].staffId).toBe("mech-1");
  });
});

describe("getCompanyTargetResults", () => {
  const settings = {
    ...defaultStaffRewardSettings(),
    companyTargetEnabled: true,
    companyTargetRevenueType: "INVOICES" as const,
    companyTargetFrequencyTiers: {
      MONTHLY: [
        { targetAmount: 50000, rewardPercent: 5 },
        { targetAmount: 90000, rewardPercent: 8 },
      ],
      QUARTERLY: [{ targetAmount: 150000, rewardPercent: 10 }],
      HALF_YEARLY: [{ targetAmount: 300000, rewardPercent: 12 }],
      YEARLY: [{ targetAmount: 600000, rewardPercent: 15 }],
    },
  };

  const invoices = [
    { grandTotal: 20000, createdAt: "2026-01-10T11:00:00.000Z", status: "PAID" },
    { grandTotal: 40000, createdAt: "2026-02-05T10:00:00.000Z", status: "PAID" },
    { grandTotal: 10000, createdAt: "2026-02-10T10:00:00.000Z", status: "PARTIAL" },
    { grandTotal: 5000, createdAt: "2026-02-11T10:00:00.000Z", status: "ISSUED" },
    { grandTotal: 30000, createdAt: "2026-03-02T10:00:00.000Z", status: "PAID" },
    { grandTotal: 90000, createdAt: "2026-02-12T10:00:00.000Z", status: "DRAFT" },
    { grandTotal: 90000, createdAt: "2026-02-13T10:00:00.000Z", status: "CANCELLED" },
    { grandTotal: 90000, createdAt: "2026-02-14T10:00:00.000Z", status: "VOID" },
    { grandTotal: 90000, createdAt: "not-a-date", status: "PAID" },
  ];

  it("uses invoice totals only and excludes draft/cancelled/void invoices", () => {
    const results = getCompanyTargetResults({
      jobCards: [],
      invoices,
      staffMembers: [
        { role: "MECHANIC", joiningDate: "2026-01-01" },
        { role: "SUPER_ADMIN", joiningDate: "2026-01-01" },
      ],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-02-01",
      evaluationDate: new Date(Date.UTC(2026, 1, 20)),
    });

    expect(results).toHaveLength(4);
    expect(results[0].periodLabel).toBe("Monthly (February)");
    expect(results[0].periodType).toBe("MONTHLY");
    expect(results[0].periodMonth).toBe(2);
    expect(results[0].periodYear).toBe(2026);
    expect(results[0].revenue).toBe(55000);
    expect(results[0].rewardPercent).toBe(5);
    expect(results[0].totalReward).toBe(2750);
    expect(results[0].eligibleStaffCount).toBe(1);
    expect(results[0].sharePerStaff).toBe(2750);
    expect(results[0].notEligible).toBe(false);
  });

  it("uses the highest achieved tier for the selected frequency", () => {
    const results = getCompanyTargetResults({
      jobCards: [],
      invoices: [
        { grandTotal: 50000, createdAt: "2026-02-01T00:00:00.000Z", status: "PAID" },
        { grandTotal: 40000, createdAt: "2026-02-15T00:00:00.000Z", status: "PARTIAL" },
      ],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-02-01",
      evaluationDate: new Date(Date.UTC(2026, 1, 20)),
    });

    expect(results[0].revenue).toBe(90000);
    expect(results[0].achievedTierIndex).toBe(1);
    expect(results[0].targetAmount).toBe(90000);
    expect(results[0].rewardPercent).toBe(8);
    expect(results[0].totalReward).toBe(7200);
    expect(results[0].sharePerStaff).toBe(3600);
  });

  it("computes eligible staff by period end and excludes super admin", () => {
    const results = getCompanyTargetResults({
      jobCards: [],
      invoices: [{ grandTotal: 90000, createdAt: "2026-02-15T00:00:00.000Z", status: "PAID" }],
      staffMembers: [
        { role: "MECHANIC", joiningDate: "2026-01-01" },
        { role: "MANAGER", joiningDate: "2026-02-28" },
        { role: "RECEPTIONIST", joiningDate: "2026-03-01" },
        { role: "SUPER_ADMIN", joiningDate: "2020-01-01" },
      ],
      activeStaffCount: 4,
      settings,
      year: 2026,
      joiningDate: "2026-02-01",
      evaluationDate: new Date(Date.UTC(2026, 1, 20)),
    });

    expect(results[0].eligibleStaffCount).toBe(1);
    expect(results[0].sharePerStaff).toBe(7200);
  });

  it("marks staff not eligible when joining day is after 5th", () => {
    const results = getCompanyTargetResults({
      jobCards: [],
      invoices: [{ grandTotal: 90000, createdAt: "2026-02-15T00:00:00.000Z", status: "PAID" }],
      activeStaffCount: 3,
      settings,
      year: 2026,
      joiningDate: "2026-02-27",
      evaluationDate: new Date(Date.UTC(2026, 1, 20)),
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[0].sharePerStaff).toBe(0);
  });

  it("marks staff as not eligible when joining date is after period end", () => {
    const results = getCompanyTargetResults({
      jobCards: [],
      invoices: [{ grandTotal: 90000, createdAt: "2026-02-15T00:00:00.000Z", status: "PAID" }],
      activeStaffCount: 3,
      settings,
      year: 2026,
      joiningDate: "2026-03-05",
      evaluationDate: new Date(Date.UTC(2026, 1, 20)),
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[0].sharePerStaff).toBe(0);
  });
});
