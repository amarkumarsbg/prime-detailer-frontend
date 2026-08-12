import { describe, expect, it } from "vitest";
import { pickupAdvanceActionLabel } from "./pickup-drop-actions";

describe("pickupAdvanceActionLabel", () => {
  it("keeps pickup workshop action intact", () => {
    expect(pickupAdvanceActionLabel("PICKUP", "IN_SERVICE")).toBe("At workshop");
  });

  it("uses drop-off complete action for drop delivery transition", () => {
    expect(pickupAdvanceActionLabel("DROP", "DELIVERED")).toBe("Drop-off complete");
  });

  it("never maps drop to At workshop label", () => {
    expect(pickupAdvanceActionLabel("DROP", "IN_SERVICE")).toBe("Drop-off complete");
  });
});
