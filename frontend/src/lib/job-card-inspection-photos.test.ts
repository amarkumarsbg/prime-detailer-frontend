import { describe, expect, it } from "vitest";
import {
  hasBeforeInspectionPhoto,
  isBeforeInspectionPhoto,
  mergeInspectionPhotosById,
  normalizeInspectionPhotoKind,
  toPersistedInspectionPhotoType,
} from "@/lib/job-card-inspection-photos";
import type { InspectionPhoto } from "@/types";

describe("normalizeInspectionPhotoKind", () => {
  it("accepts legacy uppercase and new lowercase", () => {
    expect(normalizeInspectionPhotoKind("BEFORE")).toBe("before");
    expect(normalizeInspectionPhotoKind("before")).toBe("before");
    expect(normalizeInspectionPhotoKind("After")).toBe("after");
    expect(normalizeInspectionPhotoKind("AFTER")).toBe("after");
  });

  it("rejects unknown values", () => {
    expect(normalizeInspectionPhotoKind("")).toBeNull();
    expect(normalizeInspectionPhotoKind(undefined)).toBeNull();
    expect(normalizeInspectionPhotoKind("check-in")).toBeNull();
  });
});

describe("hasBeforeInspectionPhoto", () => {
  it("detects lowercase before with url", () => {
    expect(
      hasBeforeInspectionPhoto([
        { type: "before", url: "/uploads/job-cards/x/before/a.jpg" },
      ])
    ).toBe(true);
  });

  it("detects legacy BEFORE", () => {
    expect(
      hasBeforeInspectionPhoto([{ type: "BEFORE", url: "https://cdn.example/a.jpg" }])
    ).toBe(true);
  });

  it("ignores after and empty urls", () => {
    expect(hasBeforeInspectionPhoto([{ type: "after", url: "/x.jpg" }])).toBe(false);
    expect(hasBeforeInspectionPhoto([{ type: "before", url: "" }])).toBe(false);
    expect(hasBeforeInspectionPhoto([])).toBe(false);
    expect(hasBeforeInspectionPhoto(undefined)).toBe(false);
  });
});

describe("toPersistedInspectionPhotoType", () => {
  it("always persists lowercase", () => {
    expect(toPersistedInspectionPhotoType("before")).toBe("before");
    expect(toPersistedInspectionPhotoType("after")).toBe("after");
  });
});

describe("mergeInspectionPhotosById", () => {
  it("does not duplicate by id", () => {
    const a: InspectionPhoto = {
      id: "ph-1",
      type: "before",
      url: "/a.jpg",
      uploadedAt: "2026-08-01T00:00:00.000Z",
      uploadedBy: "u1",
    };
    const b: InspectionPhoto = {
      ...a,
      url: "/a-updated.jpg",
      caption: "Check-in",
    };
    const merged = mergeInspectionPhotosById([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.url).toBe("/a-updated.jpg");
  });
});

describe("isBeforeInspectionPhoto", () => {
  it("is case-insensitive for type", () => {
    expect(isBeforeInspectionPhoto({ type: "BeFoRe", url: "/x.jpg" })).toBe(true);
  });
});
