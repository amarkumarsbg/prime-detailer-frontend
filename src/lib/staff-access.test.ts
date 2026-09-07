import { describe, expect, it } from "vitest";
import {
  deriveStaffAccessLevel,
  permissionsForStaffAccessLevel,
  userHasWithoutEditAccess,
} from "@/lib/staff-access";

describe("deriveStaffAccessLevel", () => {
  it("treats CREATE/VIEW-only granular perms as without edit", () => {
    expect(
      deriveStaffAccessLevel(["JOB_CARDS_CREATE", "JOB_CARDS_VIEW", "BILLING_CREATE", "BILLING_VIEW"])
    ).toBe("withoutEditAccess");
  });

  it("still detects without edit when a stray base key remains", () => {
    expect(
      deriveStaffAccessLevel(["JOB_CARDS_CREATE", "JOB_CARDS_VIEW", "DASHBOARD"])
    ).toBe("withoutEditAccess");
  });

  it("treats any *_EDIT as with edit", () => {
    expect(deriveStaffAccessLevel(["JOB_CARDS_CREATE", "JOB_CARDS_VIEW", "JOB_CARDS_EDIT"])).toBe(
      "withEditAccess"
    );
  });

  it("treats legacy base-only payloads as with edit", () => {
    expect(deriveStaffAccessLevel(["JOB_CARDS", "STAFF", "BILLING"])).toBe("withEditAccess");
  });
});

describe("userHasWithoutEditAccess", () => {
  it("is false for admins", () => {
    expect(
      userHasWithoutEditAccess({
        role: "ADMIN",
        permissions: ["JOB_CARDS_CREATE", "JOB_CARDS_VIEW"],
      })
    ).toBe(false);
  });

  it("is true for branch manager create/view only", () => {
    expect(
      userHasWithoutEditAccess({
        role: "BRANCH_MANAGER",
        permissions: ["JOB_CARDS_CREATE", "JOB_CARDS_VIEW", "STAFF_VIEW"],
      })
    ).toBe(true);
  });
});

describe("permissionsForStaffAccessLevel withoutEditAccess", () => {
  it("strips edit keys and HR module permissions", () => {
    const next = permissionsForStaffAccessLevel(
      [
        "JOB_CARDS_CREATE",
        "JOB_CARDS_VIEW",
        "JOB_CARDS_EDIT",
        "STAFF_CREATE",
        "STAFF_VIEW",
        "LEAVE_VIEW",
        "ATTENDANCE_CREATE",
      ],
      "withoutEditAccess"
    );
    expect(next.some((p) => p.endsWith("_EDIT"))).toBe(false);
    expect(next.some((p) => p.startsWith("STAFF"))).toBe(false);
    expect(next.some((p) => p.startsWith("LEAVE"))).toBe(false);
    expect(next.some((p) => p.startsWith("ATTENDANCE"))).toBe(false);
    expect(next).toContain("JOB_CARDS_CREATE");
    expect(next).toContain("JOB_CARDS_VIEW");
  });
});
