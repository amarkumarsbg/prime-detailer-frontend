import { getStaffJobStats } from "@/lib/staff-job-stats";
import type {
  AttendanceRecord,
  JobCard,
  StaffRewardLedgerEntry,
  StaffTarget,
  StaffTargetMetric,
} from "@/types";

export type StaffPerformanceInputStaff = {
  id: string;
  name: string;
  branchId: string;
  isActive?: boolean;
};

export type StaffPerformanceRow = {
  staffId: string;
  staffName: string;
  branchId: string;
  jobsCompleted: number;
  incentiveFromJobs: number;
  rewardsFromLedger: number;
  presentDays: number | null;
  targetMetric: StaffTargetMetric | null;
  targetValue: number | null;
  actualForTarget: number | null;
  targetAchievementPct: number | null;
};

function inRange(iso: string | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

function parseAttendanceDay(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!m) return null;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(day.getTime()) ? null : day;
}

function countPresentDays(
  records: AttendanceRecord[] | undefined,
  staffId: string,
  start: Date,
  end: Date
): number | null {
  if (!records) return null;
  const presentish = new Set(["PRESENT", "LATE", "HALF_DAY"]);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let count = 0;
  for (const r of records) {
    if (r.staffId !== staffId) continue;
    if (!presentish.has(r.status)) continue;
    const day = parseAttendanceDay(r.date);
    if (!day || day < startDay || day > endDay) continue;
    count += 1;
  }
  return count;
}

function actualForMetric(
  metric: StaffTargetMetric,
  jobsCompleted: number,
  jobRevenue: number,
  rewardsFromLedger: number
): number {
  switch (metric) {
    case "JOBS_COMPLETED":
      return jobsCompleted;
    case "REVENUE":
      return jobRevenue;
    case "INCENTIVE":
      return rewardsFromLedger;
    default:
      return 0;
  }
}

/**
 * Build per-staff performance rows for a period from jobs, reward ledger,
 * optional targets, and optional attendance.
 */
export function buildStaffPerformanceRows(opts: {
  staff: StaffPerformanceInputStaff[];
  jobCards: JobCard[];
  ledger: StaffRewardLedgerEntry[];
  targets: StaffTarget[];
  rangeStart: Date;
  rangeEnd: Date;
  periodMonth: number;
  periodYear: number;
  branchId?: string | null;
  attendanceRecords?: AttendanceRecord[];
}): StaffPerformanceRow[] {
  const branchId = opts.branchId ?? null;
  const staffList = opts.staff.filter((s) => !branchId || s.branchId === branchId);

  const jobsInPeriod = opts.jobCards.filter((jc) => {
    if (branchId && jc.branchId !== branchId) return false;
    const anchor = jc.actualDelivery ?? jc.updatedAt ?? jc.createdAt;
    return inRange(anchor, opts.rangeStart, opts.rangeEnd);
  });

  const ledgerInPeriod = opts.ledger.filter((e) => {
    if (e.status === "CANCELLED") return false;
    if (branchId && e.branchId !== branchId) return false;
    return e.periodMonth === opts.periodMonth && e.periodYear === opts.periodYear;
  });

  const targetsInPeriod = opts.targets.filter((t) => {
    if (branchId && t.branchId !== branchId) return false;
    return t.periodMonth === opts.periodMonth && t.periodYear === opts.periodYear;
  });

  const rows: StaffPerformanceRow[] = [];

  for (const member of staffList) {
    const stats = getStaffJobStats(jobsInPeriod, member.id);
    const jobRevenue = stats.completedJobs.reduce(
      (sum, jc) => sum + (jc.estimatedAmount ?? 0),
      0
    );
    const rewardsFromLedger = ledgerInPeriod
      .filter((e) => e.staffId === member.id)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    const target = targetsInPeriod.find((t) => t.staffId === member.id) ?? null;
    const actualForTarget = target
      ? actualForMetric(
          target.metric,
          stats.completed,
          jobRevenue,
          rewardsFromLedger
        )
      : null;
    const targetAchievementPct =
      target && target.targetValue > 0 && actualForTarget != null
        ? Math.round((actualForTarget / target.targetValue) * 1000) / 10
        : target && target.targetValue === 0
          ? 100
          : null;

    const hasActivity =
      stats.completed > 0 ||
      stats.totalIncentiveEarned > 0 ||
      rewardsFromLedger !== 0 ||
      target != null;

    if (member.isActive === false && !hasActivity) continue;

    rows.push({
      staffId: member.id,
      staffName: member.name,
      branchId: member.branchId,
      jobsCompleted: stats.completed,
      incentiveFromJobs: stats.totalIncentiveEarned,
      rewardsFromLedger,
      presentDays: countPresentDays(
        opts.attendanceRecords,
        member.id,
        opts.rangeStart,
        opts.rangeEnd
      ),
      targetMetric: target?.metric ?? null,
      targetValue: target?.targetValue ?? null,
      actualForTarget,
      targetAchievementPct,
    });
  }

  return rows.sort((a, b) => {
    if (b.jobsCompleted !== a.jobsCompleted) return b.jobsCompleted - a.jobsCompleted;
    return b.rewardsFromLedger - a.rewardsFromLedger;
  });
}
