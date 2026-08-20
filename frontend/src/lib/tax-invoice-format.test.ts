import { describe, expect, it } from "vitest";
import {
  gstHalfPercentLabel,
  splitCgstSgst,
  taxRateAsFraction,
  taxRateAsPercentLabel,
} from "@/lib/tax-invoice-format";

describe("formatInvoiceVehicleDetailsLine", () => {
  it("joins variant, year, fuel, and color", async () => {
    const { formatInvoiceVehicleDetailsLine } = await import("@/lib/tax-invoice-format");
    expect(
      formatInvoiceVehicleDetailsLine({
        variant: "EX",
        year: 2026,
        fuelType: "DIESEL",
        color: "Blue",
      })
    ).toBe("EX · 2026 · Diesel · Blue");
  });

  it("skips empty and placeholder color", async () => {
    const { formatInvoiceVehicleDetailsLine } = await import("@/lib/tax-invoice-format");
    expect(
      formatInvoiceVehicleDetailsLine({
        year: 2024,
        fuelType: "CNG",
        color: "—",
      })
    ).toBe("2024 · CNG");
  });
});

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
