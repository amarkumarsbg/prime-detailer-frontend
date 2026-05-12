import type { JobCard, ServiceItem, ServiceTimerDeliverySnapshot } from "@/types";

/** Sum of per-line catalog durations (no fallback). */
export function sumCatalogServiceMinutes(services: ServiceItem[]): number {
  return services.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
}

/** Sum of planned minutes for selected high-end programs (from job card). */
export function sumHighEndProgramAllocatedMinutes(
  highEndServiceIds: string[] | undefined,
  highEndCompletionMinutesByServiceId: Record<string, number> | undefined
): number {
  let sum = 0;
  for (const id of highEndServiceIds ?? []) {
    const m = highEndCompletionMinutesByServiceId?.[id];
    if (m != null && Number.isFinite(m) && m > 0) sum += m;
  }
  return sum;
}

/** Catalog + high-end planned minutes; falls back to 30 when nothing is defined. */
export function totalAllocatedMinutesForJob(
  services: ServiceItem[],
  highEndServiceIds?: string[],
  highEndCompletionMinutesByServiceId?: Record<string, number>
): number {
  const catalog = sumCatalogServiceMinutes(services);
  const he = sumHighEndProgramAllocatedMinutes(highEndServiceIds, highEndCompletionMinutesByServiceId);
  const total = catalog + he;
  return total > 0 ? total : 30;
}

/** Catalog line durations only; same 30-minute fallback as {@link totalAllocatedMinutesForJob} with no high-end rows. */
export function sumServiceAllocatedMinutes(services: ServiceItem[]): number {
  return totalAllocatedMinutesForJob(services);
}

/** Initial buffer pool: proportional with sensible clamp */
export function seedBufferMinutes(allocatedMinutes: number): number {
  const base = allocatedMinutes > 0 ? Math.round(allocatedMinutes * 0.15) : 10;
  return Math.max(5, Math.min(30, base > 0 ? base : 10));
}

/** Fields to persist when the service timer starts (In Service + mechanic). */
export function initialServiceTimerPatch(
  services: ServiceItem[],
  nowIso: string,
  opts?: {
    highEndServiceIds?: string[];
    highEndCompletionMinutesByServiceId?: Record<string, number>;
  }
): Pick<
  JobCard,
  | "serviceTimerStartedAt"
  | "serviceAllocatedMinutes"
  | "bufferTotalMinutes"
  | "bufferRemainingMinutes"
  | "timerIsPaused"
  | "timerPausedAt"
  | "totalPausedMs"
> {
  const allocated = totalAllocatedMinutesForJob(
    services,
    opts?.highEndServiceIds,
    opts?.highEndCompletionMinutesByServiceId
  );
  const buf = seedBufferMinutes(allocated);
  return {
    serviceTimerStartedAt: nowIso,
    serviceAllocatedMinutes: allocated,
    bufferTotalMinutes: buf,
    bufferRemainingMinutes: buf,
    timerIsPaused: false,
    timerPausedAt: undefined,
    totalPausedMs: 0,
  };
}

/**
 * Service timer metrics at a wall-clock instant (e.g. delivery).
 * Includes any in-progress pause segment ending at `closeIso`.
 */
export function computeServiceTimerSnapshot(
  jc: Pick<
    JobCard,
    | "serviceTimerStartedAt"
    | "serviceAllocatedMinutes"
    | "totalPausedMs"
    | "timerIsPaused"
    | "timerPausedAt"
    | "bufferTotalMinutes"
    | "bufferRemainingMinutes"
  >,
  closeIso: string
): ServiceTimerDeliverySnapshot | null {
  if (!jc.serviceTimerStartedAt) return null;
  const startMs = new Date(jc.serviceTimerStartedAt).getTime();
  const closeMs = new Date(closeIso).getTime();
  const completedPause = jc.totalPausedMs ?? 0;
  let pauseThroughClose = completedPause;
  if (jc.timerIsPaused && jc.timerPausedAt) {
    const pauseStart = new Date(jc.timerPausedAt).getTime();
    pauseThroughClose += Math.max(0, closeMs - pauseStart);
  }
  const activeElapsedMs = Math.max(0, closeMs - startMs - pauseThroughClose);
  const allocMin = jc.serviceAllocatedMinutes ?? 0;
  const allocatedMs = Math.max(0, allocMin) * 60_000;
  const overdueMs =
    allocatedMs > 0 ? Math.max(0, activeElapsedMs - allocatedMs) : 0;
  const bt = Math.max(0, jc.bufferTotalMinutes ?? 0);
  const br = Math.max(0, Math.min(bt, jc.bufferRemainingMinutes ?? 0));
  return {
    closedAt: closeIso,
    allocatedMinutes: allocMin,
    activeElapsedMs,
    overdueMs,
    totalPauseMs: pauseThroughClose,
    bufferTotalMinutes: bt,
    bufferRemainingMinutes: br,
  };
}

/** Prefer persisted snapshot; else recompute for delivered jobs with timer + actualDelivery. */
export function getServiceTimerSummaryForJob(
  jc: JobCard
): ServiceTimerDeliverySnapshot | null {
  if (jc.serviceTimerDeliverySnapshot) {
    return jc.serviceTimerDeliverySnapshot;
  }
  if (normalizeStatus(jc.status) !== "DELIVERED") return null;
  if (!jc.serviceTimerStartedAt || !jc.actualDelivery) return null;
  return computeServiceTimerSnapshot(jc, jc.actualDelivery);
}

function normalizeStatus(s: string): string {
  return String(s).toUpperCase();
}
