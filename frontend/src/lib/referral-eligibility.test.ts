import { describe, expect, it } from "vitest";
import {
  canApplyReferralOnInvoice,
  invoiceCarriesReferral,
  isNewCustomerForReferral,
  referredByFromOptionalInput,
} from "./referral-eligibility";

describe("isNewCustomerForReferral", () => {
  const now = Date.parse("2026-08-18T12:00:00.000Z");

  it("allows a customer created in this visit window with no prior invoices", () => {
    expect(
      isNewCustomerForReferral({
        createdAt: "2026-08-18T11:00:00.000Z",
        totalVisits: 1,
        otherInvoiceCount: 0,
        nowMs: now,
      })
    ).toBe(true);
  });

  it("allows a referred customer on their first invoice even after the window", () => {
    expect(
      isNewCustomerForReferral({
        createdAt: "2026-07-01T00:00:00.000Z",
        totalVisits: 1,
        referredBy: "REF-AB12",
        otherInvoiceCount: 0,
        nowMs: now,
      })
    ).toBe(true);
  });

  it("blocks an existing directory customer with no referral and an old createdAt", () => {
    expect(
      isNewCustomerForReferral({
        createdAt: "2025-01-01T00:00:00.000Z",
        totalVisits: 0,
        otherInvoiceCount: 0,
        nowMs: now,
      })
    ).toBe(false);
  });

  it("blocks anyone who already has another invoice", () => {
    expect(
      isNewCustomerForReferral({
        createdAt: "2026-08-18T11:00:00.000Z",
        totalVisits: 1,
        referredBy: "REF-AB12",
        otherInvoiceCount: 1,
        nowMs: now,
      })
    ).toBe(false);
  });

  it("blocks repeat visitors", () => {
    expect(
      isNewCustomerForReferral({
        createdAt: "2026-08-18T11:00:00.000Z",
        totalVisits: 2,
        otherInvoiceCount: 0,
        nowMs: now,
      })
    ).toBe(false);
  });
});

describe("invoiceCarriesReferral", () => {
  it("detects discount or code used", () => {
    expect(invoiceCarriesReferral({ referralDiscount: 200 })).toBe(true);
    expect(invoiceCarriesReferral({ referralCodeUsed: "REF-1" })).toBe(true);
    expect(invoiceCarriesReferral({ referralDiscount: 0, referralCodeUsed: "" })).toBe(false);
  });
});

describe("canApplyReferralOnInvoice", () => {
  const now = Date.parse("2026-08-18T12:00:00.000Z");
  const newCustomer = {
    id: "cust-new",
    createdAt: "2026-08-18T11:00:00.000Z",
    totalVisits: 1,
  };

  it("allows the first invoice for a recently created customer", () => {
    expect(
      canApplyReferralOnInvoice({
        customer: newCustomer,
        invoices: [{ id: "inv-1", customerId: "cust-new" }],
        currentInvoiceId: "inv-1",
        nowMs: now,
      })
    ).toBe(true);
  });

  it("blocks a later invoice for the same customer", () => {
    expect(
      canApplyReferralOnInvoice({
        customer: newCustomer,
        invoices: [
          { id: "inv-1", customerId: "cust-new" },
          { id: "inv-2", customerId: "cust-new" },
        ],
        currentInvoiceId: "inv-2",
        nowMs: now,
      })
    ).toBe(false);
  });
});

describe("referredByFromOptionalInput", () => {
  it("accepts empty input", () => {
    expect(referredByFromOptionalInput("", () => ({ id: "x" }))).toEqual({});
  });

  it("rejects an unknown code", () => {
    expect(referredByFromOptionalInput("REF-NOPE", () => undefined)).toEqual({
      error: "Invalid referral code.",
    });
  });
});
