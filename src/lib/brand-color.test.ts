import { describe, expect, it } from "vitest";
import {
  contrastForeground,
  DEFAULT_BRAND_PRIMARY,
  isValidHex,
  matchingBrandPresetId,
  normalizeHex,
  resolveBrandCssVars,
} from "./brand-color";

describe("brand-color", () => {
  it("normalizes #RGB and #RRGGBB", () => {
    expect(normalizeHex("#0a9")).toBe("#00AA99");
    expect(normalizeHex("#059669")).toBe("#059669");
    expect(normalizeHex("  #3b82f6 ")).toBe("#3B82F6");
  });

  it("rejects invalid hex", () => {
    expect(isValidHex("059669")).toBe(false);
    expect(isValidHex("#GG0000")).toBe(false);
    expect(isValidHex("#12")).toBe(false);
    expect(normalizeHex("")).toBeNull();
  });

  it("picks readable foreground", () => {
    expect(contrastForeground("#000000")).toBe("#FFFFFF");
    expect(contrastForeground("#FFFFFF")).toBe("#0F172A");
    expect(contrastForeground("#059669")).toBe("#FFFFFF");
    expect(contrastForeground("#FDE68A")).toBe("#0F172A");
  });

  it("resolves CSS var bundle with default fallback", () => {
    const v = resolveBrandCssVars("not-a-color");
    expect(v.primary).toBe(DEFAULT_BRAND_PRIMARY);
    expect(v.ring).toBe(DEFAULT_BRAND_PRIMARY);
  });

  it("matches presets", () => {
    expect(matchingBrandPresetId("#059669")).toBe("green");
    expect(matchingBrandPresetId("#112233")).toBeNull();
  });
});
