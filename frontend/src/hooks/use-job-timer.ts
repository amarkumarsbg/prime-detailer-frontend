"use client";

import { useEffect, useState } from "react";

function formatOverdueOrLong(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h >= 1) {
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

function formatMmSs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export interface UseJobTimerInput {
  serviceTimerStartedAt?: string;
  serviceAllocatedMinutes?: number;
  bufferTotalMinutes?: number;
  bufferRemainingMinutes?: number;
  timerIsPaused?: boolean;
  timerPausedAt?: string;
  totalPausedMs?: number;
}

export interface UseJobTimerResult {
  active: boolean;
  /** Active work elapsed (excludes all pause time) */
  activeElapsedMs: number;
  allocatedMs: number;
  isOverdue: boolean;
  overdueMs: number;
  overdueLabel: string;
  /** Current pause segment length (0 if not paused) */
  currentPauseMs: number;
  /** Completed pauses + current segment, for footer */
  totalPauseMsForDisplay: number;
  totalPauseMinutesRounded: number;
  bufferTotal: number;
  bufferRemaining: number;
  bufferUsedPercent: number;
  pausedManualLabel: string;
}

const TICK_MS = 1000;

export function useJobTimer(input: UseJobTimerInput): UseJobTimerResult {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!input.serviceTimerStartedAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [input.serviceTimerStartedAt]);

  if (!input.serviceTimerStartedAt) {
    return {
      active: false,
      activeElapsedMs: 0,
      allocatedMs: 0,
      isOverdue: false,
      overdueMs: 0,
      overdueLabel: "",
      currentPauseMs: 0,
      totalPauseMsForDisplay: 0,
      totalPauseMinutesRounded: 0,
      bufferTotal: input.bufferTotalMinutes ?? 0,
      bufferRemaining: input.bufferRemainingMinutes ?? 0,
      bufferUsedPercent: 0,
      pausedManualLabel: "0m 0s",
    };
  }

  const startMs = new Date(input.serviceTimerStartedAt).getTime();
  const now = Date.now();
  const totalPausedCompleted = input.totalPausedMs ?? 0;
  const paused = Boolean(input.timerIsPaused && input.timerPausedAt);
  const currentPauseMs = paused
    ? Math.max(0, now - new Date(input.timerPausedAt!).getTime())
    : 0;
  const totalPauseMsForDisplay = totalPausedCompleted + currentPauseMs;
  const activeElapsedMs = Math.max(
    0,
    now - startMs - totalPausedCompleted - currentPauseMs
  );

  const allocMin = input.serviceAllocatedMinutes ?? 0;
  const allocatedMs = Math.max(0, allocMin) * 60_000;
  const overdueMs =
    allocatedMs > 0 ? Math.max(0, activeElapsedMs - allocatedMs) : 0;
  const isOverdue = overdueMs > 0;

  const bufferTotal = Math.max(0, input.bufferTotalMinutes ?? 0);
  const bufferRem = Math.max(
    0,
    Math.min(bufferTotal, input.bufferRemainingMinutes ?? 0)
  );
  const bufferUsed = bufferTotal - bufferRem;
  const bufferUsedPercent =
    bufferTotal > 0 ? Math.round((bufferUsed / bufferTotal) * 100) : 0;

  return {
    active: true,
    activeElapsedMs,
    allocatedMs,
    isOverdue,
    overdueMs,
    overdueLabel: isOverdue ? formatOverdueOrLong(overdueMs) : "",
    currentPauseMs,
    totalPauseMsForDisplay,
    totalPauseMinutesRounded: Math.round(totalPauseMsForDisplay / 60_000),
    bufferTotal,
    bufferRemaining: bufferRem,
    bufferUsedPercent,
    pausedManualLabel: paused ? formatMmSs(currentPauseMs) : "0m 0s",
  };
}
