import { describe, expect, it } from "vitest";
import { buildAutoMapping, normalizeImportPhone, placeholderEmailForPhone } from "./normalize";
import { parseCsvText } from "./parse-tabular";
import { applyColumnMapping, validateImportRows } from "./validate-rows";

describe("normalizeImportPhone", () => {
  it("keeps last 10 digits", () => {
    expect(normalizeImportPhone("+91-98765-43210")).toBe("9876543210");
    expect(normalizeImportPhone("09876543210")).toBe("9876543210");
  });
});

describe("parseCsvText + validateImportRows", () => {
  it("parses CSV and marks duplicates / invalid / ready", () => {
    const csv = [
      "Customer Name,Mobile,Email",
      "Alice,9876543210,a@example.com",
      "Bob,9876543210,",
      "NoPhone,,x@y.com",
      "Carol,9123456780,",
    ].join("\n");

    const { headers, rows } = parseCsvText(csv);
    const mapping = buildAutoMapping(headers);
    expect(mapping.find((m) => m.mappedTo === "name")?.header).toBe("Customer Name");
    expect(mapping.find((m) => m.mappedTo === "phone")?.header).toBe("Mobile");

    const parsed = applyColumnMapping(headers, rows, mapping);
    const validated = validateImportRows(parsed, new Set(["9123456780"]));

    expect(validated[0]?.status).toBe("ready");
    expect(validated[1]?.status).toBe("duplicate_in_file");
    expect(validated[2]?.status).toBe("invalid");
    expect(validated[3]?.status).toBe("already_exists");
    expect(validated[0]?.email).toBe("a@example.com");
    expect(validated[1]?.email).toBe(placeholderEmailForPhone("9876543210"));
  });
});
