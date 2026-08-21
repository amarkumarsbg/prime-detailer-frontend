/** Staff HR profile fields on User (not a separate Employee entity). */

export type StaffHrFields = {
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
  /** Employment start — must stay independent of birthday/anniversary. */
  joiningDate?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  notes?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

/**
 * Normalize optional HR strings for API payloads.
 * Does not copy joiningDate into anniversary (or vice versa).
 */
export function normalizeStaffHrFields(input: StaffHrFields): StaffHrFields {
  return {
    employeeCode: trimOrNull(input.employeeCode),
    designation: trimOrNull(input.designation),
    department: trimOrNull(input.department),
    joiningDate: trimOrNull(input.joiningDate),
    birthday: trimOrNull(input.birthday),
    anniversary: trimOrNull(input.anniversary),
    notes: trimOrNull(input.notes),
  };
}
