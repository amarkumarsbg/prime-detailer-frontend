"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAttendanceStore } from "@/store/attendance-store";
import { useAuthStore } from "@/store/auth-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";

const POLL_OK_MS = 2000;
const POLL_FAIL_MAX_MS = 30_000;

/**
 * Polls the attendance API so punches from phones show on the shop PC within ~2s.
 * Only runs on the dashboard Attendance screen (`/attendance`) so every other page
 * does not hammer `/api/attendance`.
 */
export function AttendanceRealtimeSync() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const bootstrapReady = useAppBootstrapStore((s) => s.ready);
  const [authReady, setAuthReady] = useState(false);

  const onAttendanceDashboard = pathname === "/attendance";

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthReady(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !bootstrapReady || !onAttendanceDashboard) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let failBackoffMs = POLL_OK_MS;

    const scheduleNext = (delayMs: number) => {
      timeoutId = setTimeout(() => void tick(), delayMs);
    };

    const tick = async () => {
      if (cancelled) return;
      const ok = await useAttendanceStore.getState().sync();
      if (cancelled) return;
      if (ok) {
        failBackoffMs = POLL_OK_MS;
        scheduleNext(POLL_OK_MS);
      } else {
        failBackoffMs = Math.min(failBackoffMs * 2, POLL_FAIL_MAX_MS);
        scheduleNext(failBackoffMs);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [authReady, isAuthenticated, bootstrapReady, onAttendanceDashboard]);

  return null;
}
