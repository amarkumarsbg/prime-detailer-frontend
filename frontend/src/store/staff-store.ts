"use client";

import { create } from "zustand";
import type { User, UserRole } from "@/types";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api-client";
import { normalizeStaffHrFields } from "@/lib/staff-hr-fields";

function normalizePin(pin: string): string {
  return pin.trim().replace(/\D/g, "");
}

function isValidPinDigits(digits: string): boolean {
  return digits.length >= 4 && digits.length <= 8;
}

export type UpdatePinResult =
  | { ok: true }
  | { ok: false; error: "DUPLICATE" | "INVALID" };

interface AddStaffInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  isActive?: boolean;
  employeeCode?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
  birthday?: string;
  anniversary?: string;
  notes?: string;
  isAttendanceTracked?: boolean;
  /** Omit for server-generated temporary password (recommended). */
  password?: string;
}

export type UpdateStaffResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "DUPLICATE_EMAIL" };

interface StaffStoreState {
  staff: User[];
  addStaff: (input: AddStaffInput) => Promise<{
    temporaryPassword?: string;
    credentialsEmailSent?: boolean;
  }>;
  updateStaff: (
    id: string,
    updates: Partial<
      Pick<User, "name" | "email" | "phone" | "role" | "branchId" | "isActive" | "permissions" | "avatar" | "isAttendanceTracked">
    > &
      Partial<{
        employeeCode: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: string | null;
        birthday: string | null;
        anniversary: string | null;
        notes: string | null;
      }>
  ) => Promise<UpdateStaffResult>;
  updateAttendancePin: (staffId: string, pin: string) => Promise<UpdatePinResult>;
  findByAttendancePin: (pin: string) => User | undefined;
  resetToSeed: () => Promise<void>;
}

function generateRandomAttendancePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function nextStaffId(existing: User[]): string {
  const nums = existing
    .map((s) => {
      const m = /^usr-(\d+)$/.exec(s.id);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return `usr-${String(max + 1).padStart(3, "0")}`;
}

function allocateAttendancePin(getStaff: () => User[]): string {
  for (let i = 0; i < 80; i++) {
    const p = generateRandomAttendancePin();
    if (!getStaff().some((s) => s.attendancePin === p)) return p;
  }
  return String(1000 + getStaff().length);
}

export const useStaffStore = create<StaffStoreState>((set, get) => ({
  staff: [],

  resetToSeed: async () => {
    const { users } = await apiGet<{ users: User[] }>("/api/users");
    set({ staff: users });
  },

  addStaff: async (input) => {
    const list = get().staff;
    const hr = normalizeStaffHrFields({
      employeeCode: input.employeeCode,
      designation: input.designation,
      department: input.department,
      joiningDate: input.joiningDate,
      birthday: input.birthday,
      anniversary: input.anniversary,
      notes: input.notes,
    });
    const id = nextStaffId(list);
    const pwd = input.password?.trim();
    const { user, temporaryPassword, credentialsEmailSent } = await apiPost<{
      user: User;
      temporaryPassword?: string;
      credentialsEmailSent?: boolean;
    }>("/api/users", {
      id,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      role: input.role,
      branchId: input.branchId,
      isActive: input.isActive ?? true,
      isAttendanceTracked: input.isAttendanceTracked ?? true,
      attendancePin: allocateAttendancePin(() => get().staff),
      employeeCode: hr.employeeCode ?? null,
      designation: hr.designation ?? null,
      department: hr.department ?? null,
      joiningDate: hr.joiningDate ?? null,
      birthday: hr.birthday ?? null,
      anniversary: hr.anniversary ?? null,
      notes: hr.notes ?? null,
      ...(pwd ? { password: pwd } : {}),
    });
    set({ staff: [user, ...list] });
    return { temporaryPassword, credentialsEmailSent };
  },

  updateStaff: async (id, updates) => {
    const list = get().staff;
    const current = list.find((s) => s.id === id);
    if (!current) return { ok: false, error: "NOT_FOUND" };

    const next: User = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      email: updates.email !== undefined ? updates.email.trim() : current.email,
      phone: updates.phone !== undefined ? updates.phone.trim() : current.phone,
      role: updates.role ?? current.role,
      branchId: updates.branchId ?? current.branchId,
      isActive: updates.isActive ?? current.isActive,
      employeeCode:
        updates.employeeCode !== undefined
          ? updates.employeeCode?.trim() || undefined
          : current.employeeCode,
      designation:
        updates.designation !== undefined
          ? updates.designation?.trim() || undefined
          : current.designation,
      department:
        updates.department !== undefined
          ? updates.department?.trim() || undefined
          : current.department,
      joiningDate:
        updates.joiningDate !== undefined
          ? updates.joiningDate?.trim() || undefined
          : current.joiningDate,
      birthday:
        updates.birthday !== undefined
          ? updates.birthday?.trim() || undefined
          : current.birthday,
      anniversary:
        updates.anniversary !== undefined
          ? updates.anniversary?.trim() || undefined
          : current.anniversary,
      notes:
        updates.notes !== undefined ? updates.notes?.trim() || undefined : current.notes,
      isAttendanceTracked:
        updates.isAttendanceTracked !== undefined ? updates.isAttendanceTracked : current.isAttendanceTracked,
    };

    if (
      list.some(
        (s) => s.id !== id && s.email.toLowerCase() === next.email.toLowerCase()
      )
    ) {
      return { ok: false, error: "DUPLICATE_EMAIL" };
    }

    try {
      const hr = normalizeStaffHrFields({
        employeeCode: next.employeeCode,
        designation: next.designation,
        department: next.department,
        joiningDate: next.joiningDate,
        birthday: next.birthday,
        anniversary: next.anniversary,
        notes: next.notes,
      });
      const { user } = await apiPut<{ user: User }>(`/api/users/${id}`, {
        name: next.name,
        email: next.email,
        phone: next.phone,
        role: next.role,
        branchId: next.branchId,
        isActive: next.isActive,
        permissions: next.permissions,
        avatar: next.avatar ?? null,
        employeeCode: hr.employeeCode ?? null,
        designation: hr.designation ?? null,
        department: hr.department ?? null,
        joiningDate: hr.joiningDate ?? null,
        birthday: hr.birthday ?? null,
        anniversary: hr.anniversary ?? null,
        notes: hr.notes ?? null,
      });
      set({
        staff: list.map((s) => (s.id === id ? user : s)),
      });
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return { ok: false, error: "NOT_FOUND" };
      }
      throw e;
    }
  },

  updateAttendancePin: async (staffId, pin) => {
    const digits = normalizePin(pin);
    if (!isValidPinDigits(digits)) {
      return { ok: false, error: "INVALID" };
    }
    const list = get().staff;
    if (list.some((s) => s.id !== staffId && s.attendancePin === digits)) {
      return { ok: false, error: "DUPLICATE" };
    }
    try {
      const { user } = await apiPut<{ user: User }>(`/api/users/${staffId}`, {
        attendancePin: digits,
      });
      set({
        staff: list.map((s) => (s.id === staffId ? user : s)),
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "INVALID" };
    }
  },

  findByAttendancePin: (pin) => {
    const digits = normalizePin(pin);
    if (!digits) return undefined;
    return get().staff.find((s) => s.attendancePin === digits && s.isActive);
  },
}));

export { generateRandomAttendancePin };
