import { describe, expect, it } from "vitest";
import { jobNumberSortKey, sortJobCardsByNumberThenCreated } from "./sort-by-date";

describe("jobNumberSortKey", () => {
  it("ranks JC-2026-0110 above JC-2026-0109 and JC-2026-105", () => {
    expect(jobNumberSortKey("JC-2026-0110")).toBeGreaterThan(jobNumberSortKey("JC-2026-0109"));
    expect(jobNumberSortKey("JC-2026-0109")).toBeGreaterThan(jobNumberSortKey("JC-2026-0106"));
    expect(jobNumberSortKey("JC-2026-0106")).toBeGreaterThan(jobNumberSortKey("JC-2026-105"));
  });
});

describe("sortJobCardsByNumberThenCreated", () => {
  it("puts the highest job number first and uses createdAt as a tie-break", () => {
    const sorted = sortJobCardsByNumberThenCreated([
      { jobNumber: "JC-2026-0106", createdAt: "2026-08-16T18:00:00.000Z" },
      { jobNumber: "JC-2026-0110", createdAt: "2026-08-17T10:00:00.000Z" },
      { jobNumber: "JC-2026-0109", createdAt: "2026-08-17T09:00:00.000Z" },
      { jobNumber: "JC-2026-0108", createdAt: "2026-08-16T12:00:00.000Z" },
    ]);
    expect(sorted.map((j) => j.jobNumber)).toEqual([
      "JC-2026-0110",
      "JC-2026-0109",
      "JC-2026-0108",
      "JC-2026-0106",
    ]);
  });
});
