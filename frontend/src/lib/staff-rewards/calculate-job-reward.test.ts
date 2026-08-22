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
    companyTargetRevenueType: "SERVICES" as const,
    companyTargetFrequencyTiers: {
      MONTHLY: [{ targetAmount: 5000, rewardPercent: 10 }],
      QUARTERLY: [{ targetAmount: 15000, rewardPercent: 10 }],
      HALF_YEARLY: [{ targetAmount: 25000, rewardPercent: 10 }],
      YEARLY: [{ targetAmount: 35000, rewardPercent: 10 }],
    },
  };

  const jobCards = [
    { status: "DELIVERED", estimatedAmount: 10000, actualDelivery: "2026-02-15T12:00:00.000Z" }, // Q1
    { status: "DELIVERED", estimatedAmount: 20000, actualDelivery: "2026-05-15T12:00:00.000Z" }, // Q2
    { status: "DELIVERED", estimatedAmount: 30000, actualDelivery: "2026-08-15T12:00:00.000Z" }, // Q3
    { status: "DELIVERED", estimatedAmount: 40000, actualDelivery: "2026-11-15T12:00:00.000Z" }, // Q4
  ];

  it("handles missing joiningDate (default behavior)", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
    });

    expect(results).toHaveLength(4);
    expect(results[0].periodLabel).toBe("Monthly (Jan-Mar)");
    expect(results[0].revenue).toBe(10000);
    expect(results[0].rewardPercent).toBe(10);
    expect(results[0].totalReward).toBe(1000);
    expect(results[0].sharePerStaff).toBe(500);
    expect(results[0].notEligible).toBeUndefined();

    expect(results[1].revenue).toBe(20000);
    expect(results[1].rewardPercent).toBe(10);
    expect(results[1].totalReward).toBe(2000);

    expect(results[2].revenue).toBe(30000);
    expect(results[2].rewardPercent).toBe(10);

    expect(results[3].revenue).toBe(40000);
    expect(results[3].rewardPercent).toBe(10);
  });

  it("handles joining before the year", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2025-12-31",
    });

    expect(results[0].notEligible).toBeUndefined();
    expect(results[0].revenue).toBe(10000);
    expect(results[1].notEligible).toBeUndefined();
    expect(results[1].revenue).toBe(20000);
  });

  it("handles joining in Q1", () => {
    // Joins on Feb 20, Job 1 (Feb 15) is excluded.
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-02-20",
    });

    expect(results[0].notEligible).toBeUndefined();
    expect(results[0].revenue).toBe(0);
    expect(results[0].rewardPercent).toBe(0);
    expect(results[0].sharePerStaff).toBe(0);

    // Q2 should be normal
    expect(results[1].notEligible).toBeUndefined();
    expect(results[1].revenue).toBe(20000);
  });

  it("handles joining in Q2", () => {
    // Joins on May 10, Q1 is not eligible. Job 2 (May 15) is included in Q2.
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-05-10",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBeUndefined();
    expect(results[1].revenue).toBe(20000);
    expect(results[1].sharePerStaff).toBe(1000);
  });

  it("handles joining in Q3", () => {
    // Joins on Aug 20, Q1 and Q2 not eligible. Job 3 (Aug 15) is excluded.
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-20",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBe(true);
    expect(results[2].notEligible).toBeUndefined();
    expect(results[2].revenue).toBe(0);
  });

  it("handles joining in Q4", () => {
    // Joins on Nov 20, Q1, Q2, Q3 not eligible. Job 4 (Nov 15) is excluded.
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-11-20",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBe(true);
    expect(results[2].notEligible).toBe(true);
    expect(results[3].notEligible).toBeUndefined();
    expect(results[3].revenue).toBe(0);
  });

  it("handles joining exactly on period start", () => {
    // Joins on April 1 (start of Q2)
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-04-01",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBeUndefined();
    expect(results[1].revenue).toBe(20000);
  });

  it("handles joining exactly on period end", () => {
    // Joins on June 30 (end of Q2)
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-06-30",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBeUndefined();
    expect(results[1].revenue).toBe(0);
  });

  it("handles joining after period end", () => {
    // Joins on July 1 (after Q2 end)
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-07-01",
    });

    expect(results[0].notEligible).toBe(true);
    expect(results[1].notEligible).toBe(true);
    expect(results[2].notEligible).toBeUndefined();
    expect(results[2].revenue).toBe(30000);
  });
});
