import { describe, expect, it } from "vitest";
import {
  jobCardIsEditable,
  jobCardPartsEditable,
  jobCardPricingEditable,
  jobCardUpdateAllowed,
} from "@/lib/job-card-edit-policy";
import { quotationIsEditable, quotationUpdateAllowed } from "@/lib/quotation-edit-policy";
import type { JobCard, Quotation } from "@/types";

describe("jobCard edit policy", () => {
  it("locks delivered and cancelled jobs", () => {
    expect(jobCardIsEditable({ status: "AWAITING_SERVICE" })).toBe(true);
    expect(jobCardIsEditable({ status: "DELIVERED" })).toBe(false);
    expect(jobCardIsEditable({ status: "CANCELLED" })).toBe(false);
  });

  it("blocks parts after inventory consume", () => {
    expect(jobCardPartsEditable({ status: "READY", inventoryConsumedAt: undefined })).toBe(true);
    expect(
      jobCardPartsEditable({ status: "READY", inventoryConsumedAt: "2026-01-01T00:00:00.000Z" })
    ).toBe(false);
  });

  it("blocks pricing once invoiced", () => {
    expect(jobCardPricingEditable({ status: "QUALITY_CHECK" }, false)).toBe(true);
    expect(jobCardPricingEditable({ status: "QUALITY_CHECK" }, true)).toBe(false);
  });

  it("allows only locked keys after delivery", () => {
    const prev = { status: "DELIVERED" } as JobCard;
    expect(jobCardUpdateAllowed(prev, { status: "DELIVERED", updatedAt: "x" })).toBe(true);
    expect(jobCardUpdateAllowed(prev, { notes: "nope" })).toBe(false);
  });
});

describe("quotation edit policy", () => {
  it("editable until converted/rejected", () => {
    expect(quotationIsEditable({ status: "DRAFT" })).toBe(true);
    expect(quotationIsEditable({ status: "APPROVED" })).toBe(true);
    expect(quotationIsEditable({ status: "CONVERTED" })).toBe(false);
    expect(quotationIsEditable({ status: "REJECTED" })).toBe(false);
  });

  it("allows convert patches when locked", () => {
    const prev = { status: "CONVERTED" } as Quotation;
    expect(
      quotationUpdateAllowed(prev, {
        status: "CONVERTED",
        convertedToJobCardId: "jc-1",
        updatedAt: "now",
      })
    ).toBe(true);
    expect(quotationUpdateAllowed(prev, { notes: "edit" })).toBe(false);
  });
});
