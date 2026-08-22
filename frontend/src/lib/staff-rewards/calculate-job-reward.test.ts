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

  it("Joining 1 Aug 2026", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 7, 15)), // 15 Aug 2026
    });

    expect(results).toHaveLength(4);
    expect(results[0].periodLabel).toBe("Monthly (Aug)");
    expect(results[0].notEligible).toBeUndefined();
    expect(results[1].periodLabel).toBe("Quarterly (Aug-Oct)");
    expect(results[2].periodLabel).toBe("Half Yearly (Aug-Jan)");
    expect(results[3].periodLabel).toBe("Yearly (Aug-Jul)");
  });

  it("Joining 15 Aug 2026", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-15",
      evaluationDate: new Date(Date.UTC(2026, 7, 20)), // 20 Aug 2026
    });

    expect(results).toHaveLength(4);
    expect(results[0].periodLabel).toBe("Monthly (Aug-Sep)");
    expect(results[0].notEligible).toBe(true);
    expect(results[1].periodLabel).toBe("Quarterly (Aug-Nov)");
    expect(results[2].periodLabel).toBe("Half Yearly (Aug-Feb)");
    expect(results[3].periodLabel).toBe("Yearly (Aug-Aug)");
  });

  it("Joining 31 Aug 2026", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-31",
      evaluationDate: new Date(Date.UTC(2026, 8, 10)), // 10 Sep 2026
    });

    expect(results).toHaveLength(4);
    expect(results[0].periodLabel).toBe("Monthly (Aug-Sep)");
    expect(results[0].notEligible).toBe(true);
    expect(results[1].periodLabel).toBe("Quarterly (Aug-Nov)");
    expect(results[2].periodLabel).toBe("Half Yearly (Aug-Feb)");
    expect(results[3].periodLabel).toBe("Yearly (Aug-Aug)");
  });

  it("Quarterly rollover Aug-Oct -> Nov-Jan", () => {
    // Before rollover (Aug 15)
    const resultsBefore = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(resultsBefore[1].periodLabel).toBe("Quarterly (Aug-Oct)");

    // After rollover (Nov 15)
    const resultsAfter = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 10, 15)),
    });
    expect(resultsAfter[1].periodLabel).toBe("Quarterly (Nov-Jan)");
  });

  it("Half-yearly rollover Aug-Jan -> Feb-Jul", () => {
    // Before rollover (Aug 15)
    const resultsBefore = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(resultsBefore[2].periodLabel).toBe("Half Yearly (Aug-Jan)");

    // After rollover (Feb 15)
    const resultsAfter = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2027, 1, 15)),
    });
    expect(resultsAfter[2].periodLabel).toBe("Half Yearly (Feb-Jul)");
  });

  it("Yearly rollover Aug-Jul -> next Aug", () => {
    // Before rollover (Aug 15, 2026)
    const resultsBefore = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 7, 15)),
    });
    expect(resultsBefore[3].periodLabel).toBe("Yearly (Aug-Jul)");

    // After rollover (Aug 15, 2027)
    const resultsAfter = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2027,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2027, 7, 15)),
    });
    expect(resultsAfter[3].periodLabel).toBe("Yearly (Aug-Jul)");
  });

  it("Leap year/date boundaries", () => {
    const results = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2024,
      joiningDate: "2024-02-29", // Leap year
      evaluationDate: new Date(Date.UTC(2024, 1, 29)),
    });

    // 12 months after 29 Feb 2024 should be 28 Feb 2025 (non-leap year)
    expect(results[3].periodLabel).toBe("Yearly (Feb-Feb)");
  });

  it("Employee A and Employee B with different joining dates having different target periods", () => {
    const resultsA = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-08-01",
      evaluationDate: new Date(Date.UTC(2026, 7, 15)),
    });

    const resultsB = getCompanyTargetResults({
      jobCards,
      invoices: [],
      activeStaffCount: 2,
      settings,
      year: 2026,
      joiningDate: "2026-09-01",
      evaluationDate: new Date(Date.UTC(2026, 8, 15)),
    });

    expect(resultsA[0].periodLabel).toBe("Monthly (Aug)");
    expect(resultsB[0].periodLabel).toBe("Monthly (Sep)");

    expect(resultsA[1].periodLabel).toBe("Quarterly (Aug-Oct)");
    expect(resultsB[1].periodLabel).toBe("Quarterly (Sep-Nov)");
  });
});
