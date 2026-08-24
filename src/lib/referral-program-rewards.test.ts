import { describe, expect, it } from "vitest";
import { resolveReferralProgramRewards, rewardAmountFromMode } from "./referral-program-rewards";

const baseProgram = {
  programEnabled: true,
  advocateRewardMode: "fixed_inr" as const,
  advocateAmount: "100",
  newCustomerRewardMode: "fixed_inr" as const,
  newCustomerAmount: "100",
  minJobAmountInr: "0",
};

describe("rewardAmountFromMode", () => {
  it("returns flat amount", () => {
    expect(rewardAmountFromMode("fixed_inr", "100", 5000)).toBe(100);
  });
  it("returns percent of job", () => {
    expect(rewardAmountFromMode("percent_job", "10", 2000)).toBe(200);
  });
});

describe("resolveReferralProgramRewards", () => {
  it("uses Referrals page flat amounts", () => {
    const r = resolveReferralProgramRewards({ program: baseProgram, jobSubtotalInr: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.buyerAmount).toBe(100);
      expect(r.advocateAmount).toBe(100);
    }
  });

  it("blocks when program paused", () => {
    const r = resolveReferralProgramRewards({
      program: { ...baseProgram, programEnabled: false },
      jobSubtotalInr: 5000,
    });
    expect(r.ok).toBe(false);
  });

  it("enforces minimum job total", () => {
    const r = resolveReferralProgramRewards({
      program: { ...baseProgram, minJobAmountInr: "3000" },
      jobSubtotalInr: 2500,
    });
    expect(r.ok).toBe(false);
  });

  it("supports percent of job", () => {
    const r = resolveReferralProgramRewards({
      program: {
        ...baseProgram,
        advocateRewardMode: "percent_job",
        advocateAmount: "5",
        newCustomerRewardMode: "percent_job",
        newCustomerAmount: "2",
      },
      jobSubtotalInr: 10000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.advocateAmount).toBe(500);
      expect(r.buyerAmount).toBe(200);
    }
  });
});
