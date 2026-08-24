import { describe, expect, it } from "vitest";
import {
  appendExtraBrand,
  appendExtraModel,
  isBrandNameTaken,
} from "./vehicle-catalog-extras";

describe("vehicle-catalog-extras", () => {
  it("detects brand names case-insensitively", () => {
    expect(isBrandNameTaken(["Honda", "Toyota"], "honda")).toBe(true);
    expect(isBrandNameTaken(["Honda"], "Maruti")).toBe(false);
  });

  it("appends unique extra brands", () => {
    expect(appendExtraBrand(["Honda"], "Toyota")).toEqual(["Honda", "Toyota"]);
    expect(appendExtraBrand(["Honda"], "honda")).toEqual(["Honda"]);
  });

  it("appends unique extra models per brand", () => {
    const next = appendExtraModel({}, "Honda", "City");
    expect(next).toEqual({ Honda: ["City"] });
    expect(appendExtraModel(next, "Honda", "city")).toEqual({ Honda: ["City"] });
    expect(appendExtraModel(next, "Honda", "Amaze")).toEqual({ Honda: ["City", "Amaze"] });
  });
});
