"use client";

import { create } from "zustand";
import type { User, UserRole } from "@/types";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api-client";

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
  birthday?: string;
  anniversary?: string;
}

export type UpdateStaffResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "DUPLICATE_EMAIL" };

interface StaffStoreState {
  staff: User[];
  addStaff: (input: AddStaffInput) => Promise<void>;
  updateStaff: (
    id: string,
    updates: Partial<
      Pick<User, "name" | "email" | "phone" | "role" | "branchId" | "isActive">
    >
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
    const birthday = input.birthday?.trim();
    const anniversary = input.anniversary?.trim();
    const id = nextStaffId(list);
    const { user } = await apiPost<{ user: User }>("/api/users", {
      id,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      role: input.role,
      branchId: input.branchId,
      isActive: input.isActive ?? true,
      attendancePin: allocateAttendancePin(() => get().staff),
      birthday: birthday || null,
      anniversary: anniversary || null,
    });
    set({ staff: [user, ...list] });
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
    };

    if (
      list.some(
        (s) => s.id !== id && s.email.toLowerCase() === next.email.toLowerCase()
      )
    ) {
      return { ok: false, error: "DUPLICATE_EMAIL" };
    }

    try {
      const { user } = await apiPut<{ user: User }>(`/api/users/${id}`, {
        name: next.name,
        email: next.email,
        phone: next.phone,
        role: next.role,
        branchId: next.branchId,
        isActive: next.isActive,
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
