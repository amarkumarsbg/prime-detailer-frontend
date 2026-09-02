import { describe, expect, it } from "vitest";
import {
  canEditJobCardPricing,
  jobCardIsEditable,
  jobCardPartsEditable,
  jobCardPricingEditable,
  jobCardUpdateAllowed,
} from "@/lib/job-card-edit-policy";
import {
  evaluateJobCardPricingWrite,
  jobCardHasPricingDelta,
} from "@/lib/job-card-pricing-rbac";
import { quotationIsEditable, quotationUpdateAllowed } from "@/lib/quotation-edit-policy";
import { userHasPermission } from "@/lib/rbac";
import type { JobCard, Quotation, User } from "@/types";

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

describe("JOB_CARD_PRICING permission", () => {
  const staff: User = {
    id: "u1",
    email: "a@b.c",
    name: "A",
    phone: "",
    role: "MECHANIC",
    branchId: "b1",
    isActive: true,
    permissions: ["JOB_CARDS"],
  };

  const priced: User = {
    ...staff,
    permissions: ["JOB_CARDS", "JOB_CARD_PRICING"],
  };

  const admin: User = {
    ...staff,
    role: "SUPER_ADMIN",
    permissions: [],
  };

  it("userHasPermission: SUPER_ADMIN bypass; staff needs key", () => {
    expect(userHasPermission(admin, "JOB_CARD_PRICING")).toBe(true);
    expect(userHasPermission(staff, "JOB_CARD_PRICING")).toBe(false);
    expect(userHasPermission(priced, "JOB_CARD_PRICING")).toBe(true);
  });

  it("canEditJobCardPricing requires permission and status/invoice lock", () => {
    expect(canEditJobCardPricing(staff, { status: "AWAITING_SERVICE" }, false)).toBe(false);
    expect(canEditJobCardPricing(priced, { status: "AWAITING_SERVICE" }, false)).toBe(true);
    expect(
      canEditJobCardPricing(
        { ...staff, permissions: ["JOB_CARD_PRICING_EDIT"] },
        { status: "AWAITING_SERVICE" },
        false
      )
    ).toBe(true);
    expect(canEditJobCardPricing(priced, { status: "DELIVERED" }, false)).toBe(false);
    expect(canEditJobCardPricing(priced, { status: "AWAITING_SERVICE" }, true)).toBe(false);
    expect(canEditJobCardPricing(admin, { status: "AWAITING_SERVICE" }, false)).toBe(true);
  });

  it("does not treat estimatedAmount as a pricing delta", () => {
    const prev = {
      status: "AWAITING_SERVICE",
      services: [
        {
          id: "s1",
          jobCardId: "j1",
          serviceCatalogId: "c1",
          name: "Wash",
          price: 500,
          isCompleted: false,
          priceSource: "CATALOG" as const,
        },
      ],
      estimatedAmount: 500,
    } as JobCard;
    const next = { ...prev, estimatedAmount: 9999 };
    expect(jobCardHasPricingDelta(prev, next)).toBe(false);
  });

  it("detects custom price change and evaluates permission", () => {
    const prev = {
      status: "AWAITING_SERVICE",
      services: [
        {
          id: "s1",
          jobCardId: "j1",
          serviceCatalogId: "c1",
          name: "Wash",
          price: 500,
          isCompleted: false,
          priceSource: "CATALOG" as const,
        },
      ],
    } as JobCard;
    const next = {
      ...prev,
      services: [
        {
          ...prev.services[0]!,
          price: 700,
          isCustomPrice: true,
          priceSource: "CUSTOM" as const,
        },
      ],
    };
    expect(jobCardHasPricingDelta(prev, next)).toBe(true);
    const denied = evaluateJobCardPricingWrite({
      hasPricingPermission: false,
      prev,
      next,
      hasInvoice: false,
    });
    expect(denied.ok).toBe(false);
    const allowed = evaluateJobCardPricingWrite({
      hasPricingPermission: true,
      prev,
      next,
      hasInvoice: false,
    });
    expect(allowed.ok).toBe(true);
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
