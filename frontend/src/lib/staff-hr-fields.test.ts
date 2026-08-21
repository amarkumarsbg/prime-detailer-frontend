import { describe, expect, it } from "vitest";
import { normalizeStaffHrFields } from "./staff-hr-fields";

describe("normalizeStaffHrFields", () => {
  it("keeps joiningDate separate from birthday and anniversary", () => {
    const out = normalizeStaffHrFields({
      joiningDate: "2024-01-15",
      birthday: "1990-06-01",
      anniversary: "2025-01-15",
      employeeCode: " EMP-001 ",
      designation: " Lead Detailer ",
      department: " Workshop ",
      notes: "  ",
    });
    expect(out.joiningDate).toBe("2024-01-15");
    expect(out.birthday).toBe("1990-06-01");
    expect(out.anniversary).toBe("2025-01-15");
    expect(out.joiningDate).not.toBe(out.anniversary);
    expect(out.joiningDate).not.toBe(out.birthday);
    expect(out.employeeCode).toBe("EMP-001");
    expect(out.designation).toBe("Lead Detailer");
    expect(out.department).toBe("Workshop");
    expect(out.notes).toBeNull();
  });

  it("does not invent anniversary from joiningDate", () => {
    const out = normalizeStaffHrFields({ joiningDate: "2023-03-01" });
    expect(out.joiningDate).toBe("2023-03-01");
    expect(out.anniversary).toBeUndefined();
    expect(out.birthday).toBeUndefined();
  });
});
