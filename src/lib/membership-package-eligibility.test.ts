import { describe, expect, it } from "vitest";
import type { MembershipPackage, VehicleSegment } from "@/types";
import {
  filterMembershipPackagesForVehicleSegment,
  membershipPackageMatchesVehicleSegment,
} from "./membership-package-eligibility";

function pkg(
  id: string,
  applicableVehicleSegments?: VehicleSegment[],
  isActive = true
): MembershipPackage {
  return {
    id,
    name: id,
    tier: "MONTHLY",
    price: 999,
    includedServiceIds: ["svc-1"],
    isActive,
    createdAt: "2026-01-01T00:00:00.000Z",
    applicableVehicleSegments,
  };
}

describe("membership package vehicle eligibility", () => {
  it("Hatchback vehicle shows Hatchback package", () => {
    const out = filterMembershipPackagesForVehicleSegment([pkg("h", ["HATCHBACK"])], "HATCHBACK");
    expect(out.map((p) => p.id)).toEqual(["h"]);
  });

  it("Hatchback vehicle hides Sedan-only package", () => {
    const out = filterMembershipPackagesForVehicleSegment([pkg("s", ["SEDAN"])], "HATCHBACK");
    expect(out).toHaveLength(0);
  });

  it("SUV vehicle shows SUV package", () => {
    const out = filterMembershipPackagesForVehicleSegment([pkg("suv", ["SUV"])], "SUV");
    expect(out.map((p) => p.id)).toEqual(["suv"]);
  });

  it("package with multiple categories matches both categories", () => {
    const p = pkg("mix", ["HATCHBACK", "SEDAN"]);
    expect(membershipPackageMatchesVehicleSegment(p, "HATCHBACK")).toBe(true);
    expect(membershipPackageMatchesVehicleSegment(p, "SEDAN")).toBe(true);
    expect(membershipPackageMatchesVehicleSegment(p, "SUV")).toBe(false);
  });

  it("package with no categories matches every vehicle", () => {
    const p = pkg("all");
    expect(membershipPackageMatchesVehicleSegment(p, "HATCHBACK")).toBe(true);
    expect(membershipPackageMatchesVehicleSegment(p, "SEDAN")).toBe(true);
    expect(membershipPackageMatchesVehicleSegment(p, "SUV")).toBe(true);
  });

  it("changing vehicle category updates filtered options", () => {
    const packages = [pkg("h", ["HATCHBACK"]), pkg("s", ["SUV"]), pkg("all")];
    const hatchback = filterMembershipPackagesForVehicleSegment(packages, "HATCHBACK").map((p) => p.id);
    const suv = filterMembershipPackagesForVehicleSegment(packages, "SUV").map((p) => p.id);
    expect(hatchback).toEqual(["h", "all"]);
    expect(suv).toEqual(["s", "all"]);
  });

  it("returns empty when no package matches selected vehicle category", () => {
    const out = filterMembershipPackagesForVehicleSegment(
      [pkg("sedan", ["SEDAN"]), pkg("lux", ["LUXURY"])],
      "BIKE"
    );
    expect(out).toHaveLength(0);
  });

  it("keeps existing eligibility layers intact when composed after active filtering", () => {
    const baseEligible = [
      pkg("active-h", ["HATCHBACK"], true),
      pkg("inactive-h", ["HATCHBACK"], false),
      pkg("active-s", ["SEDAN"], true),
    ].filter((p) => p.isActive);

    const finalEligible = filterMembershipPackagesForVehicleSegment(baseEligible, "HATCHBACK");
    expect(finalEligible.map((p) => p.id)).toEqual(["active-h"]);
  });
});
