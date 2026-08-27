import { describe, expect, it } from "vitest";
import {
  deriveQuotationSource,
  quotationHasServices,
  quotationSourceLabel,
  quotationSourceOf,
} from "@/lib/quotation-source";

describe("quotation-source guards", () => {
  it("handles undefined services safely", () => {
    expect(deriveQuotationSource(undefined, [{ id: "p1" } as never])).toBe("COUNTER_SALE");
    expect(deriveQuotationSource(undefined, undefined)).toBe("SERVICE");
  });

  it("treats malformed quotations with missing services as parts-only when parts exist", () => {
    const malformed = {
      source: undefined,
      services: undefined,
      parts: [{ id: "p1" }],
    } as never;
    expect(quotationSourceOf(malformed)).toBe("COUNTER_SALE");
    expect(quotationSourceLabel(malformed)).toBe("Counter Sale");
  });

  it("quotationHasServices returns false for missing service arrays", () => {
    const malformed = { services: undefined } as never;
    expect(quotationHasServices(malformed)).toBe(false);
  });
});
