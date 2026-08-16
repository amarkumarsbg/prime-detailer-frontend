import { describe, expect, it } from "vitest";
import type { BootstrapPayload } from "@/lib/bootstrap-app-data";

const FORBIDDEN = [
  "customers",
  "vehicles",
  "users",
  "collections",
  "payroll",
  "cashBank",
] as const;

describe("thin BootstrapPayload contract", () => {
  it("only allows shell keys", () => {
    const sample: BootstrapPayload = {
      branches: [],
      branding: { businessName: "Studio", brandPrimary: "#000000" },
      entitlement: null,
    };
    for (const key of Object.keys(sample)) {
      expect(["branches", "branding", "entitlement"]).toContain(key);
    }
    for (const bad of FORBIDDEN) {
      expect(bad in sample).toBe(false);
    }
    expect("bankAccountNumber" in (sample.branding as object)).toBe(false);
  });
});
