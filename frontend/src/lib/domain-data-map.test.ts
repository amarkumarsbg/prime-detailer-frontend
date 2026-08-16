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
});
