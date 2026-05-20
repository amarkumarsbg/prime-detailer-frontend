import type { Branch, JobCard } from "@/types";

export type PerformancePeriod = "this_month" | "last_month" | "last_30d";

export function getPerformanceRange(
  period: PerformancePeriod,
  now = new Date()
): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "last_30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  last.setHours(23, 59, 59, 999);
  return { start, end: last };
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export interface BranchPerformanceMetrics {
  branchId: string;
  branchName: string;
  /** Truncated label for chart axes */
  chartLabel: string;
  jobCount: number;
  deliveredCount: number;
  totalJobValue: number;
  totalRewards: number;
  onTimeAmongDelivered: number;
  /** % of delivered jobs finished on or before expected delivery */
  onTimeRatePct: number;
  /** % of non-cancelled jobs in period that are delivered (throughput) */
  efficiencyPct: number;
}

export function shortBranchChartLabel(name: string, max = 15): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function emptyBranchPerformanceMetrics(
  branchId: string,
  branchName: string
): BranchPerformanceMetrics {
  return {
    branchId,
    branchName,
    chartLabel: shortBranchChartLabel(branchName),
    jobCount: 0,
    deliveredCount: 0,
    totalJobValue: 0,
    totalRewards: 0,
    onTimeAmongDelivered: 0,
    onTimeRatePct: 0,
    efficiencyPct: 0,
  };
}

function isOnTimeDelivery(jc: JobCard): boolean {
  const expected = new Date(jc.expectedDelivery).getTime();
  const actualRaw = jc.actualDelivery ?? jc.updatedAt;
  const actual = new Date(actualRaw).getTime();
  return actual <= expected;
}

/**
 * Jobs received in the period (by `createdAt`), excluding cancelled.
 * Value and rewards use `estimatedAmount` / `incentiveAmount` on those job cards.
 */
export function aggregateBranchPerformance(
  jobCards: JobCard[],
  branches: Branch[],
  rangeStart: Date,
  rangeEnd: Date
): BranchPerformanceMetrics[] {
  const nameById = new Map(branches.map((b) => [b.id, b.name]));

  const inPeriod = jobCards.filter(
    (jc) =>
      jc.status !== "CANCELLED" &&
      inRange(jc.createdAt, rangeStart, rangeEnd)
  );

  const byBranch = new Map<string, JobCard[]>();
  for (const jc of inPeriod) {
    const list = byBranch.get(jc.branchId) ?? [];
    list.push(jc);
    byBranch.set(jc.branchId, list);
  }

  const rows: BranchPerformanceMetrics[] = [];

  for (const [branchId, jobs] of byBranch) {
    const branchName = nameById.get(branchId) ?? branchId;
    let deliveredCount = 0;
    let onTimeAmongDelivered = 0;
    let totalJobValue = 0;
    let totalRewards = 0;

    for (const jc of jobs) {
      totalJobValue += jc.estimatedAmount ?? 0;
      totalRewards += jc.incentiveAmount ?? 0;
      if (jc.status === "DELIVERED") {
        deliveredCount += 1;
        if (isOnTimeDelivery(jc)) onTimeAmongDelivered += 1;
      }
    }

    const jobCount = jobs.length;
    const onTimeRatePct =
      deliveredCount > 0
        ? Math.round((onTimeAmongDelivered / deliveredCount) * 1000) / 10
        : 0;
    const efficiencyPct =
      jobCount > 0
        ? Math.round((deliveredCount / jobCount) * 1000) / 10
        : 0;

    rows.push({
      branchId,
      branchName,
      chartLabel: shortBranchChartLabel(branchName),
      jobCount,
      deliveredCount,
      totalJobValue,
      totalRewards,
      onTimeAmongDelivered,
      onTimeRatePct,
      efficiencyPct,
    });
  }

  return rows.sort((a, b) => b.totalJobValue - a.totalJobValue);
}

export function performancePeriodLabel(period: PerformancePeriod): string {
  switch (period) {
    case "this_month":
      return "This month";
    case "last_month":
      return "Last month";
    case "last_30d":
      return "Last 30 days";
    default:
      return period;
  }
}
