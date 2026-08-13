import { describe, expect, it } from "vitest";
import { normalizePhoneDigits } from "@/lib/phone";

describe("normalizePhoneDigits", () => {
  it("keeps last 10 digits", () => {
    expect(normalizePhoneDigits("+91-98765-43210")).toBe("9876543210");
    expect(normalizePhoneDigits("09876543210")).toBe("9876543210");
    expect(normalizePhoneDigits("abc")).toBe("");
  });
});
