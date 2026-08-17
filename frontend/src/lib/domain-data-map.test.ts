import { describe, expect, it } from "vitest";
import { resourcesForPath } from "@/lib/domain-data-map";

describe("resourcesForPath", () => {
  it("maps dashboard to core pack", () => {
    const r = resourcesForPath("/dashboard");
    expect(r).toContain("jobCards");
    expect(r).toContain("dashboardStats");
    expect(r).not.toContain("payroll");
  });

  it("maps payroll without cashBank", () => {
    const r = resourcesForPath("/payroll");
    expect(r).toContain("payroll");
    expect(r).toContain("staff");
    expect(r).not.toContain("cashBank");
  });

  it("prefers longest prefix", () => {
    const r = resourcesForPath("/job-cards/jc-001");
    expect(r).toContain("jobCards");
    expect(r).toContain("serviceCatalog");
  });

  it("loads appSettings for job-cards, booking, and payment pricing routes", () => {
    expect(resourcesForPath("/job-cards")).toContain("appSettings");
    expect(resourcesForPath("/job-cards/new")).toContain("appSettings");
    expect(resourcesForPath("/booking")).toContain("appSettings");
    expect(resourcesForPath("/bookings")).toContain("appSettings");
    expect(resourcesForPath("/billing")).toContain("appSettings");
    expect(resourcesForPath("/quotations")).toContain("appSettings");
    expect(resourcesForPath("/customers")).toContain("appSettings");
    expect(resourcesForPath("/parties")).toContain("appSettings");
  });
});
