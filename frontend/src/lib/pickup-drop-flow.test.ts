import { describe, expect, it } from "vitest";
import { nextPickupDropStatus } from "./pickup-drop-flow";

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
