import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_TIER_MONTHS,
  computeMembershipEndDate,
  membershipTierDurationLabel,
} from "./membership-duration";
import type { MembershipTier } from "@/types";

describe("membership duration mapping", () => {
  it("maps each tier to the correct durationMonths", () => {
    expect(MEMBERSHIP_TIER_MONTHS.MONTHLY).toBe(1);
    expect(MEMBERSHIP_TIER_MONTHS.QUARTERLY).toBe(3);
    expect(MEMBERSHIP_TIER_MONTHS.HALF_YEARLY).toBe(6);
    expect(MEMBERSHIP_TIER_MONTHS.YEARLY).toBe(12);
  });

  it("formats duration labels from the shared months map", () => {
    expect(membershipTierDurationLabel("MONTHLY")).toBe("1 Month");
    expect(membershipTierDurationLabel("QUARTERLY")).toBe("3 Months");
    expect(membershipTierDurationLabel("HALF_YEARLY")).toBe("6 Months");
    expect(membershipTierDurationLabel("YEARLY")).toBe("12 Months");
  });

  it("computes expiry with calendar months (Quarterly from 10 Sep 2026 → 10 Dec 2026)", () => {
    const start = "2026-09-10T10:00:00.000Z";
    const end = new Date(computeMembershipEndDate(start, "QUARTERLY"));
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(11); // December
    expect(end.getDate()).toBe(10);
  });

  it.each([
    ["MONTHLY", 1],
    ["QUARTERLY", 3],
    ["HALF_YEARLY", 6],
    ["YEARLY", 12],
  ] as const)("%s adds %i calendar months", (tier: MembershipTier, months: number) => {
    const start = new Date(2026, 8, 10, 10, 0, 0); // 10 Sep 2026 local
    const end = new Date(computeMembershipEndDate(start.toISOString(), tier));
    const expected = new Date(start);
    expected.setMonth(expected.getMonth() + months);
    expect(end.getFullYear()).toBe(expected.getFullYear());
    expect(end.getMonth()).toBe(expected.getMonth());
    expect(end.getDate()).toBe(expected.getDate());
  });
});
