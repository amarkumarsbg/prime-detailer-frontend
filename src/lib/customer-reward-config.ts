/** Org-level customer loyalty / rewards config (Settings → Rewards Points). */
export interface CustomerRewardConfig {
  /** Points earned per ₹100 of taxable spend. */
  pointsPer100: number;
  /** INR discount value of 1 point. */
  pointValue: number;
  referralBonus: number;
  /** Minimum points required before any redemption. */
  minRedeem: number;
  /** Optional hard cap on points redeemable per redemption. */
  maxRedeem?: number;
}

export const DEFAULT_CUSTOMER_REWARD_CONFIG: CustomerRewardConfig = {
  pointsPer100: 1,
  pointValue: 0.25,
  referralBonus: 100,
  minRedeem: 200,
};

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function normalizeCustomerRewardConfig(
  partial?: Partial<CustomerRewardConfig> | null
): CustomerRewardConfig {
  const pointsPer100 = toPositiveNumber(
    partial?.pointsPer100,
    DEFAULT_CUSTOMER_REWARD_CONFIG.pointsPer100
  );
  const pointValue = toPositiveNumber(
    partial?.pointValue,
    DEFAULT_CUSTOMER_REWARD_CONFIG.pointValue
  );
  const referralBonus = toPositiveNumber(
    partial?.referralBonus,
    DEFAULT_CUSTOMER_REWARD_CONFIG.referralBonus
  );
  const minRedeem = Math.max(
    0,
    Math.floor(toPositiveNumber(partial?.minRedeem, DEFAULT_CUSTOMER_REWARD_CONFIG.minRedeem))
  );
  const maxRaw = partial?.maxRedeem;
  const maxRedeem =
    maxRaw === undefined || maxRaw === null
      ? undefined
      : Math.max(0, Math.floor(toPositiveNumber(maxRaw, 0))) || undefined;

  return {
    pointsPer100: pointsPer100 > 0 ? pointsPer100 : DEFAULT_CUSTOMER_REWARD_CONFIG.pointsPer100,
    pointValue: pointValue > 0 ? pointValue : DEFAULT_CUSTOMER_REWARD_CONFIG.pointValue,
    referralBonus,
    minRedeem,
    ...(maxRedeem !== undefined ? { maxRedeem } : {}),
  };
}

/** INR discount for a points redemption (rounded to paise). */
export function rewardDiscountFromPoints(
  points: number,
  config: CustomerRewardConfig
): number {
  const pts = Math.max(0, Math.floor(points));
  if (pts <= 0 || config.pointValue <= 0) return 0;
  return Math.round(pts * config.pointValue * 100) / 100;
}

/**
 * Max points that may be redeemed now.
 * Respects available balance, optional config maxRedeem, and invoice subtotal coverage.
 */
export function maxRedeemablePoints(
  availablePoints: number,
  config: CustomerRewardConfig,
  subtotalInr?: number
): number {
  let max = Math.max(0, Math.floor(availablePoints));
  if (config.maxRedeem != null && config.maxRedeem > 0) {
    max = Math.min(max, config.maxRedeem);
  }
  if (subtotalInr != null && config.pointValue > 0) {
    max = Math.min(max, Math.floor(Math.max(0, subtotalInr) / config.pointValue));
  }
  return Math.max(0, max);
}

export function canRedeemRewardPoints(
  availablePoints: number,
  config: CustomerRewardConfig
): boolean {
  return availablePoints >= config.minRedeem;
}

/** Loyalty points earned on taxable subtotal after discounts (existing business rule). */
export function loyaltyPointsEarned(
  taxableSubtotal: number,
  config: CustomerRewardConfig
): number {
  const taxable = Math.max(0, taxableSubtotal);
  if (taxable <= 0 || config.pointsPer100 <= 0) return 0;
  return Math.floor((taxable / 100) * config.pointsPer100);
}

export function validateRewardPointsRedemption(input: {
  points: number;
  availablePoints: number;
  config: CustomerRewardConfig;
  subtotalInr?: number;
}): string | null {
  const { points, availablePoints, config, subtotalInr } = input;
  if (!Number.isFinite(points) || points <= 0) return null;

  if (availablePoints < config.minRedeem) {
    return `Minimum ${config.minRedeem} points required to redeem. Customer has ${availablePoints} points.`;
  }
  if (points < config.minRedeem) {
    return `Minimum ${config.minRedeem} points required to redeem.`;
  }
  const maxAllowed = maxRedeemablePoints(availablePoints, config, subtotalInr);
  if (points > availablePoints) {
    return `Insufficient points. Customer has ${availablePoints} points.`;
  }
  if (config.maxRedeem != null && config.maxRedeem > 0 && points > config.maxRedeem) {
    return `Maximum reward points redemption limit is ${config.maxRedeem} points.`;
  }
  if (points > maxAllowed) {
    return `Maximum ${maxAllowed} points can be redeemed on this invoice.`;
  }
  return null;
}

export function rewardRedemptionHelpText(
  config: CustomerRewardConfig,
  availablePoints: number,
  maxAllowed: number
): string {
  const valueLabel = `1 pt = ₹${config.pointValue.toFixed(2)} discount`;
  if (availablePoints < config.minRedeem) {
    return `Minimum ${config.minRedeem} points required to redeem (${valueLabel}).`;
  }
  if (config.maxRedeem != null && config.maxRedeem > 0) {
    return `Max ${maxAllowed} points redeemable (cap ${config.maxRedeem}; ${valueLabel}).`;
  }
  return `Max ${maxAllowed} points redeemable (${valueLabel}).`;
}

/**
 * Points to debit from the customer balance.
 * Prefers explicit `rewardPointsRedeemed`; falls back to legacy 1:1 `rewardDiscount`.
 */
export function pointsRedeemedFromInvoice(invoice: {
  rewardDiscount?: number;
  rewardPointsRedeemed?: number;
}): number {
  if (
    typeof invoice.rewardPointsRedeemed === "number" &&
    Number.isFinite(invoice.rewardPointsRedeemed) &&
    invoice.rewardPointsRedeemed > 0
  ) {
    return Math.floor(invoice.rewardPointsRedeemed);
  }
  return Math.max(0, Math.floor(invoice.rewardDiscount || 0));
}
