import { describe, expect, it } from "vitest";
import {
  DEFAULT_GST_RATE,
  computeGstFromSubtotal,
  effectiveGstRate,
  isGstRegistered,
} from "@/lib/gst-tax";

describe("gst-tax", () => {
  it("treats only NOT_REGISTERED as GST off (missing/undefined ⇒ on)", () => {
    expect(isGstRegistered("REGISTERED")).toBe(true);
    expect(isGstRegistered(undefined)).toBe(true);
    expect(isGstRegistered(null)).toBe(true);
    expect(isGstRegistered("NOT_REGISTERED")).toBe(false);
  });

  it("uses 18% when registered and 0 when not", () => {
    expect(effectiveGstRate("REGISTERED")).toBe(DEFAULT_GST_RATE);
    expect(effectiveGstRate(undefined)).toBe(DEFAULT_GST_RATE);
    expect(effectiveGstRate("NOT_REGISTERED")).toBe(0);
  });

  it("GST ON: taxAmount and grandTotal include 18%", () => {
    const { taxRate, taxAmount, grandTotal } = computeGstFromSubtotal(1000, "REGISTERED");
    expect(taxRate).toBe(0.18);
    expect(taxAmount).toBe(180);
    expect(grandTotal).toBe(1180);
  });

  it("GST OFF: taxAmount = 0 and grandTotal = subtotal", () => {
    const { taxRate, taxAmount, grandTotal } = computeGstFromSubtotal(1000, "NOT_REGISTERED");
    expect(taxRate).toBe(0);
    expect(taxAmount).toBe(0);
    expect(grandTotal).toBe(1000);
  });

  it("rounds tax to 2 decimal places", () => {
    const { taxAmount, grandTotal } = computeGstFromSubtotal(99.99, "REGISTERED");
    expect(taxAmount).toBe(18);
    expect(grandTotal).toBe(117.99);
  });
});
