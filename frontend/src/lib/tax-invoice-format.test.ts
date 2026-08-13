import { describe, expect, it } from "vitest";
import {
  gstHalfPercentLabel,
  splitCgstSgst,
  taxRateAsFraction,
  taxRateAsPercentLabel,
} from "@/lib/tax-invoice-format";

describe("splitCgstSgst", () => {
  it("splits tax evenly", () => {
    expect(splitCgstSgst(180)).toEqual({ cgst: 90, sgst: 90 });
    expect(splitCgstSgst(0)).toEqual({ cgst: 0, sgst: 0 });
  });
});

describe("taxRateAsFraction / labels", () => {
  it("normalizes percent and fraction inputs", () => {
    expect(taxRateAsFraction(0.18)).toBe(0.18);
    expect(taxRateAsFraction(18)).toBe(0.18);
    expect(taxRateAsFraction(0)).toBe(0);
    expect(taxRateAsPercentLabel(0.18)).toBe("18%");
    expect(taxRateAsPercentLabel(18)).toBe("18%");
    expect(gstHalfPercentLabel(0.18)).toBe("9%");
  });
});
