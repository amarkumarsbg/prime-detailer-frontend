import { describe, expect, it } from "vitest";
import {
  calculateJobReward,
  defaultStaffRewardSettings,
  resolveJobIncentiveAmount,
  rewardIdempotencyKey,
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
