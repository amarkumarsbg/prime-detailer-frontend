import { addMonths } from "date-fns";
import type { MembershipTier } from "@/types";

/** Calendar months of coverage per membership tier — single source of truth. */
export const MEMBERSHIP_TIER_MONTHS: Record<MembershipTier, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

/** Approximate day lengths (legacy). Prefer MEMBERSHIP_TIER_MONTHS for duration/expiry. */
export const MEMBERSHIP_TIER_DAYS: Record<MembershipTier, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 180,
  YEARLY: 365,
};

export function membershipTierDurationLabel(tier: MembershipTier): string {
  const months = MEMBERSHIP_TIER_MONTHS[tier] ?? 1;
  return months === 1 ? "1 Month" : `${months} Months`;
}

/** Calendar-month end date for a membership start + tier (end of day). */
export function computeMembershipEndDate(isoStart: string, tier: MembershipTier): string {
  const months = MEMBERSHIP_TIER_MONTHS[tier] ?? 1;
  const d = addMonths(new Date(isoStart), months);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
