import { describe, expect, it } from "vitest";
import {
  jobDeclinesDropOff,
  jobHasDropIntent,
  nextPickupDropStatus,
} from "./pickup-drop-flow";
import type { JobCard } from "@/types";

describe("nextPickupDropStatus", () => {
  it("keeps pickup flow unchanged", () => {
    expect(nextPickupDropStatus("PICKUP", "PENDING")).toBe("DRIVER_ASSIGNED");
    expect(nextPickupDropStatus("PICKUP", "DRIVER_ASSIGNED")).toBe("PICKED_UP");
    expect(nextPickupDropStatus("PICKUP", "PICKED_UP")).toBe("IN_SERVICE");
  });

  it("uses dedicated drop flow without workshop action step", () => {
    expect(nextPickupDropStatus("DROP", "PENDING")).toBe("DRIVER_ASSIGNED");
    expect(nextPickupDropStatus("DROP", "DRIVER_ASSIGNED")).toBe("DELIVERED");
  });

  it("supports legacy drop rows that are already in service", () => {
    expect(nextPickupDropStatus("DROP", "IN_SERVICE")).toBe("DELIVERED");
  });
});

describe("booking drop intent helpers", () => {
  const baseJob = {
    notes: "",
    reportedIssues: "",
  } as JobCard;

  it("detects explicit drop-off decline from booking notes", () => {
    expect(jobDeclinesDropOff({ ...baseJob, notes: "Drop-off required: No" })).toBe(true);
    expect(jobDeclinesDropOff({ ...baseJob, notes: "Drop-off required: Yes" })).toBe(false);
  });

  it("detects drop-off intent from booking notes", () => {
    expect(jobHasDropIntent({ ...baseJob, notes: "Drop-off required: Yes" }, [])).toBe(true);
    expect(jobHasDropIntent({ ...baseJob, notes: "Drop-off required: No" }, [])).toBe(false);
  });
});
