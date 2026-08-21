import { describe, expect, it } from "vitest";
import {
  averageServiceRewardPercent,
  clampIncentivePercent,
  normalizeRewardCategoryIncentivePercents,
  resolveServiceRewardPercent,
} from "@/lib/reward-category-rates";

describe("normalizeRewardCategoryIncentivePercents", () => {
  it("keeps finite percents and clamps 0–100", () => {
    expect(
      normalizeRewardCategoryIncentivePercents({
        a: 5,
        b: "12.5",
        c: 150,
        d: -3,
        e: "x",
        " ": 9,
      })
    ).toEqual({ a: 5, b: 12.5, c: 100, d: 0 });
  });
});

describe("resolveServiceRewardPercent", () => {
  const rates = { "cat-wash": 4, "cat-ppf": 12 };

  it("uses category rate when set", () => {
    expect(
      resolveServiceRewardPercent(
        { category: "cat-wash", incentivePercent: 9 },
        rates,
        { fallbackPercent: 5 }
      )
    ).toBe(4);
  });

  it("falls back to service incentivePercent", () => {
    expect(
      resolveServiceRewardPercent(
        { category: "cat-other", incentivePercent: 7 },
        rates,
        { fallbackPercent: 5 }
      )
    ).toBe(7);
  });

  it("falls back to default mechanic percent", () => {
    expect(
      resolveServiceRewardPercent({ category: "cat-other" }, rates, {
        fallbackPercent: 5,
      })
    ).toBe(5);
  });

  it("uses high-end percent for high-end services without category rate", () => {
    expect(
      resolveServiceRewardPercent(
        { category: "cat-x", isHighEnd: true, incentivePercent: 3 },
        rates,
        { fallbackPercent: 5, highEndPercent: 10 }
      )
    ).toBe(10);
  });

  it("prefers category rate even for high-end", () => {
    expect(
      resolveServiceRewardPercent(
        { category: "cat-ppf", isHighEnd: true },
        rates,
        { fallbackPercent: 5, highEndPercent: 10 }
      )
    ).toBe(12);
  });
});

describe("averageServiceRewardPercent", () => {
  it("averages resolved rates across services", () => {
    const avg = averageServiceRewardPercent(
      [
        { category: "cat-wash", incentivePercent: 9 },
        { category: "cat-other", incentivePercent: 8 },
      ],
      { "cat-wash": 4 },
      { fallbackPercent: 5 }
    );
    expect(avg).toBe(6); // (4 + 8) / 2
  });

  it("returns fallback for empty selection", () => {
    expect(averageServiceRewardPercent([], {}, { fallbackPercent: 5 })).toBe(5);
  });
});

describe("clampIncentivePercent", () => {
  it("clamps and rounds to 2 decimals", () => {
    expect(clampIncentivePercent(12.345)).toBe(12.35);
    expect(clampIncentivePercent(200)).toBe(100);
    expect(clampIncentivePercent(NaN, 3)).toBe(3);
  });
});
