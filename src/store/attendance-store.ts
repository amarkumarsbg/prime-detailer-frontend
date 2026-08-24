"use client";

import { create } from "zustand";
import { format } from "date-fns";
import type { AttendanceRecord, User } from "@/types";
import { apiGet, apiDelete } from "@/lib/api-client";

export type PunchResult =
  | { ok: true; kind: "checkIn"; time: string; record: AttendanceRecord }
  | { ok: true; kind: "checkOut"; time: string; record: AttendanceRecord }
  | {
      ok: false;
      error: "WRONG_BRANCH" | "INACTIVE" | "NETWORK" | "SERVER";
    };

interface AttendanceStoreState {
  records: AttendanceRecord[];
  /** @returns whether the server returned fresh records */
  sync: () => Promise<boolean>;
  punch: (args: { staff: User; branchId: string }) => Promise<PunchResult>;
  resetToSeed: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStoreState>((set) => ({
  records: [],

  sync: async () => {
    try {
      const data = await apiGet<{ records: AttendanceRecord[] }>("/api/attendance");
      set({ records: data.records });
      return true;
    } catch {
      return false;
    }
  },

  resetToSeed: async () => {
    try {
      const data = await apiDelete<{ ok: boolean; records: AttendanceRecord[] }>(
        "/api/attendance"
      );
      set({ records: data.records });
    } catch {
      /* no-op */
    }
  },

  punch: async ({ staff, branchId }) => {
    try {
      const now = new Date();
      const res = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: staff.id,
          branchId,
          staffName: staff.name,
          staffRole: staff.role,
          clientLocalDate: format(now, "yyyy-MM-dd"),
          clientLocalTime: format(now, "HH:mm"),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        kind?: "checkIn" | "checkOut";
        time?: string;
        record?: AttendanceRecord;
        records?: AttendanceRecord[];
      };
      if (!data.ok) {
        if (data.error === "WRONG_BRANCH" || data.error === "INACTIVE") {
          return { ok: false, error: data.error };
        }
        return { ok: false, error: "SERVER" };
      }
      if (data.records) {
        set({ records: data.records });
      }
      return {
        ok: true,
        kind: data.kind!,
        time: data.time!,
        record: data.record!,
      };
    } catch {
      return { ok: false, error: "NETWORK" };
    }
  },
}));
