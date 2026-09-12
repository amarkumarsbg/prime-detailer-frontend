import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_REWARD_CONFIG,
  canRedeemRewardPoints,
  loyaltyPointsEarned,
  maxRedeemablePoints,
  rewardDiscountFromPoints,
  rewardRedemptionHelpText,
  validateRewardPointsRedemption,
} from "./customer-reward-config";

const config = DEFAULT_CUSTOMER_REWARD_CONFIG;

describe("customer reward redemption & earn", () => {
  it("values 1 point at ₹0.25", () => {
    expect(rewardDiscountFromPoints(1, config)).toBe(0.25);
    expect(rewardDiscountFromPoints(200, config)).toBe(50);
    expect(rewardDiscountFromPoints(4, config)).toBe(1);
  });

  it("blocks redemption when available points are below minRedeem (102 < 200)", () => {
    expect(canRedeemRewardPoints(102, config)).toBe(false);
    expect(
      validateRewardPointsRedemption({
        points: 102,
        availablePoints: 102,
        config,
        subtotalInr: 5200,
      })
    ).toMatch(/Minimum 200 points required/);
  });

  it("allows 200 points → ₹50 discount", () => {
    expect(canRedeemRewardPoints(200, config)).toBe(true);
    expect(rewardDiscountFromPoints(200, config)).toBe(50);
    expect(
      validateRewardPointsRedemption({
        points: 200,
        availablePoints: 200,
        config,
        subtotalInr: 5200,
      })
    ).toBeNull();
  });

  it("earns 52 points for ₹5,200 at 1 point per ₹100", () => {
    expect(loyaltyPointsEarned(5200, config)).toBe(52);
    expect(loyaltyPointsEarned(5200, { ...config, pointsPer100: 1 })).toBe(52);
  });

  it("respects configured maximum redemption limit", () => {
    const withCap = { ...config, maxRedeem: 250 };
    expect(maxRedeemablePoints(500, withCap, 10_000)).toBe(250);
    expect(
      validateRewardPointsRedemption({
        points: 300,
        availablePoints: 500,
        config: withCap,
        subtotalInr: 10_000,
      })
    ).toMatch(/Maximum reward points redemption limit is 250/);
  });

  it("caps redeemable points by available balance when no maxRedeem", () => {
    expect(maxRedeemablePoints(180, config, 10_000)).toBe(180);
    expect(rewardRedemptionHelpText(config, 102, 102)).toContain("Minimum 200");
    expect(rewardRedemptionHelpText(config, 250, 250)).toContain("₹0.25");
  });
});
