import type {
  StaffRewardLedgerEntry,
  StaffRewardMode,
  StaffRewardSettings,
  StaffRewardType,
} from "@/types";

/** Job fields needed to draft delivery reward ledger rows. */
export type JobRewardInput = {
  id: string;
  jobNumber: string;
  mechanicId?: string;
  mechanicName?: string;
  branchId: string;
  estimatedAmount: number;
  incentivePercent: number;
  incentiveAmount: number;
  actualDelivery?: string;
  /** Promised / expected delivery timestamp (ISO). */
  promisedDelivery?: string;
  /** When absent, supervisor share is skipped (full amount to applicator). */
  supervisorId?: string;
  supervisorName?: string;
};

/** Optional per-service override (subset of global settings). */
export type StaffRewardServiceOverride = {
  rewardMode?: StaffRewardMode;
  percent?: number;
  fixedAmount?: number;
  timeBonusEnabled?: boolean;
  timeBonusMinutesThreshold?: number;
  timeBonusPercent?: number;
  lateDeductionEnabled?: boolean;
  lateDeductionPercent?: number;
};

export type JobRewardDraft = Omit<StaffRewardLedgerEntry, "id">;

export function roundReward(n: number): number {
  return Math.round(n * 100) / 100;
}

export function rewardIdempotencyKey(
  jobId: string,
  staffId: string,
  rewardType: StaffRewardType
): string {
  return `${jobId}:${staffId}:${rewardType}`;
}

export function defaultStaffRewardSettings(
  now = new Date().toISOString()
): StaffRewardSettings {
  return {
    rewardMode: "PERCENT_OF_JOB",
    defaultPercent: 5,
    defaultFixedAmount: 0,
    tiersEnabled: false,
    tiers: [
      {
        id: "tier-bronze",
        name: "Bronze",
        tier: "BRONZE",
        monthlyJobThreshold: 10,
        percentBonus: 2,
      },
      {
        id: "tier-silver",
        name: "Silver",
        tier: "SILVER",
        monthlyJobThreshold: 20,
        percentBonus: 4,
      },
      {
        id: "tier-gold",
        name: "Gold",
        tier: "GOLD",
        monthlyJobThreshold: 35,
        percentBonus: 6,
      },
      {
        id: "tier-diamond",
        name: "Diamond",
        tier: "DIAMOND",
        monthlyJobThreshold: 50,
        percentBonus: 10,
      },
    ],
    timeBonusEnabled: false,
    timeBonusMinutesThreshold: 60,
    timeBonusPercent: 10,
    lateDeductionEnabled: false,
    lateDeductionPercent: 10,
    supervisorSharePercent: 30,
    applicatorSharePercent: 70,
    companyTargetEnabled: false,
    companyTargetRevenueType: "SERVICES",
    companyTargetPeriod: "MONTHLY",
    companyTargetTiers: [
      { targetAmount: 0, rewardPercent: 0 },
      { targetAmount: 0, rewardPercent: 0 },
      { targetAmount: 0, rewardPercent: 0 },
      { targetAmount: 0, rewardPercent: 0 },
    ],
    companyTargetFrequencyTiers: {
      MONTHLY: [
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
      ],
      QUARTERLY: [
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
      ],
      HALF_YEARLY: [
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
      ],
      YEARLY: [
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
        { targetAmount: 0, rewardPercent: 0 },
      ],
    },
    updatedAt: now,
  };
}

function periodFromIso(iso?: string): { periodMonth: number; periodYear: number } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return { periodMonth: now.getMonth() + 1, periodYear: now.getFullYear() };
  }
  return { periodMonth: d.getMonth() + 1, periodYear: d.getFullYear() };
}

function minutesBetween(earlierIso: string, laterIso: string): number | null {
  const a = new Date(earlierIso).getTime();
  const b = new Date(laterIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 60_000;
}

/**
 * Resolve base job incentive: prefer job.incentiveAmount when > 0;
 * otherwise FIXED_PER_JOB amount or percent of estimatedAmount.
 */
export function resolveJobIncentiveAmount(
  job: JobRewardInput,
  settings: StaffRewardSettings,
  serviceOverride?: StaffRewardServiceOverride
): number {
  if (typeof job.incentiveAmount === "number" && job.incentiveAmount > 0) {
    return roundReward(job.incentiveAmount);
  }

  const mode = serviceOverride?.rewardMode ?? settings.rewardMode;
  if (mode === "FIXED_PER_JOB") {
    const fixed =
      typeof serviceOverride?.fixedAmount === "number"
        ? serviceOverride.fixedAmount
        : settings.defaultFixedAmount;
    return roundReward(Math.max(0, fixed));
  }

  const percent =
    typeof job.incentivePercent === "number" && job.incentivePercent > 0
      ? job.incentivePercent
      : typeof serviceOverride?.percent === "number"
        ? serviceOverride.percent
        : settings.defaultPercent;
  return roundReward(Math.max(0, (job.estimatedAmount * percent) / 100));
}

function draftRow(opts: {
  staffId: string;
  staffName: string;
  branchId: string;
  job: JobRewardInput;
  rewardType: StaffRewardType;
  amount: number;
  periodMonth: number;
  periodYear: number;
  createdAt: string;
  reason?: string;
}): JobRewardDraft {
  return {
    staffId: opts.staffId,
    staffName: opts.staffName,
    branchId: opts.branchId,
    jobCardId: opts.job.id,
    jobNumber: opts.job.jobNumber,
    rewardType: opts.rewardType,
    amount: roundReward(opts.amount),
    status: "PENDING",
    periodMonth: opts.periodMonth,
    periodYear: opts.periodYear,
    reason: opts.reason,
    createdAt: opts.createdAt,
    idempotencyKey: rewardIdempotencyKey(opts.job.id, opts.staffId, opts.rewardType),
  };
}

/**
 * Build ledger drafts for a delivered job. Does not touch storage or check
 * existing keys — callers filter by `idempotencyKey`.
 */
export function calculateJobReward(opts: {
  job: JobRewardInput;
  settings: StaffRewardSettings;
  serviceOverride?: StaffRewardServiceOverride;
  now?: string;
}): JobRewardDraft[] {
  const { job, settings, serviceOverride } = opts;
  const createdAt = opts.now ?? new Date().toISOString();
  const mechanicId = job.mechanicId?.trim();
  if (!mechanicId) return [];

  const mechanicName = job.mechanicName?.trim() || mechanicId;
  const base = resolveJobIncentiveAmount(job, settings, serviceOverride);
  if (base <= 0) return [];

  const { periodMonth, periodYear } = periodFromIso(job.actualDelivery ?? createdAt);
  const drafts: JobRewardDraft[] = [];

  const supervisorId = job.supervisorId?.trim();
  const hasSupervisor = Boolean(supervisorId);

  type Share = { staffId: string; staffName: string; share: number };
  const recipients: Share[] = [];

  if (hasSupervisor && supervisorId) {
    const supPct = Math.max(0, settings.supervisorSharePercent);
    const appPct = Math.max(0, settings.applicatorSharePercent);
    const totalPct = supPct + appPct;
    const supervisorShare = totalPct > 0 ? supPct / totalPct : 0;
    const applicatorShare = totalPct > 0 ? appPct / totalPct : 1;
    recipients.push({
      staffId: supervisorId,
      staffName: job.supervisorName?.trim() || supervisorId,
      share: supervisorShare,
    });
    recipients.push({
      staffId: mechanicId,
      staffName: mechanicName,
      share: applicatorShare,
    });
  } else {
    recipients.push({ staffId: mechanicId, staffName: mechanicName, share: 1 });
  }

  for (const r of recipients) {
    const amount = roundReward(base * r.share);
    if (amount === 0) continue;
    drafts.push(
      draftRow({
        staffId: r.staffId,
        staffName: r.staffName,
        branchId: job.branchId,
        job,
        rewardType: "JOB_INCENTIVE",
        amount,
        periodMonth,
        periodYear,
        createdAt,
      })
    );
  }

  const timeBonusEnabled =
    serviceOverride?.timeBonusEnabled ?? settings.timeBonusEnabled;
  const lateDeductionEnabled =
    serviceOverride?.lateDeductionEnabled ?? settings.lateDeductionEnabled;
  const timeThreshold =
    serviceOverride?.timeBonusMinutesThreshold ?? settings.timeBonusMinutesThreshold;
  const timeBonusPercent =
    serviceOverride?.timeBonusPercent ?? settings.timeBonusPercent;
  const lateDeductionPercent =
    serviceOverride?.lateDeductionPercent ?? settings.lateDeductionPercent;

  const actual = job.actualDelivery;
  const promised = job.promisedDelivery;

  if (actual && promised) {
    const earlyMinutes = minutesBetween(actual, promised);
    const lateMinutes = minutesBetween(promised, actual);

    if (
      timeBonusEnabled &&
      earlyMinutes != null &&
      earlyMinutes >= Math.max(0, timeThreshold) &&
      timeBonusPercent > 0
    ) {
      for (const r of recipients) {
        const incentive = drafts.find(
          (d) => d.staffId === r.staffId && d.rewardType === "JOB_INCENTIVE"
        );
        if (!incentive) continue;
        const bonus = roundReward((incentive.amount * timeBonusPercent) / 100);
        if (bonus <= 0) continue;
        drafts.push(
          draftRow({
            staffId: r.staffId,
            staffName: r.staffName,
            branchId: job.branchId,
            job,
            rewardType: "TIME_BONUS",
            amount: bonus,
            periodMonth,
            periodYear,
            createdAt,
            reason: `Delivered ${Math.round(earlyMinutes)} min early`,
          })
        );
      }
    }

    if (
      lateDeductionEnabled &&
      lateMinutes != null &&
      lateMinutes > 0 &&
      lateDeductionPercent > 0
    ) {
      for (const r of recipients) {
        const incentive = drafts.find(
          (d) => d.staffId === r.staffId && d.rewardType === "JOB_INCENTIVE"
        );
        if (!incentive) continue;
        const ded = roundReward((incentive.amount * lateDeductionPercent) / 100);
        if (ded <= 0) continue;
        drafts.push(
          draftRow({
            staffId: r.staffId,
            staffName: r.staffName,
            branchId: job.branchId,
            job,
            rewardType: "LATE_DEDUCTION",
            amount: -ded,
            periodMonth,
            periodYear,
            createdAt,
            reason: `Delivered ${Math.round(lateMinutes)} min late`,
          })
        );
      }
    }
  }

  return drafts;
}

export interface CompanyTargetPeriodResult {
  periodLabel: string;
  revenue: number;
  achievedTierIndex: number;
  targetAmount: number;
  rewardPercent: number;
  totalReward: number;
  sharePerStaff: number;
  notEligible?: boolean;
}

export function getCompanyTargetResults(args: {
  jobCards: {
    status: string;
    estimatedAmount?: number;
    actualDelivery?: string;
    updatedAt?: string;
    createdAt?: string;
  }[];
  invoices: {
    source?: string;
    grandTotal?: number;
    createdAt?: string;
    status?: string;
  }[];
  activeStaffCount: number;
  settings: StaffRewardSettings;
  year: number;
  joiningDate?: string;
}): CompanyTargetPeriodResult[] {
  if (!args.settings.companyTargetEnabled) {
    return [];
  }

  const revenueType = args.settings.companyTargetRevenueType || "SERVICES";
  const freqTiersMap = (args.settings.companyTargetFrequencyTiers || {}) as Record<string, any>;
  const staffCount = args.activeStaffCount > 0 ? args.activeStaffCount : 1;

  const getRevenueInTimeRange = (startTimeMs: number, endTimeMs: number) => {
    let jobRev = 0;
    if (revenueType === "SERVICES" || revenueType === "BOTH") {
      jobRev = args.jobCards
        .filter((jc) => {
          if (jc.status !== "DELIVERED") return false;
          const dateStr = jc.createdAt;
          if (!dateStr) return false;
          const time = Date.parse(dateStr);
          if (Number.isNaN(time)) return false;
          return time >= startTimeMs && time <= endTimeMs;
        })
        .reduce((sum, jc) => sum + (jc.estimatedAmount ?? 0), 0);
    }

    let invRev = 0;
    if (revenueType === "COUNTER_SALE" || revenueType === "BOTH") {
      invRev = args.invoices
        .filter((inv) => {
          if (inv.status === "CANCELLED") return false;
          if (inv.source !== "COUNTER_SALE") return false;
          const dateStr = inv.createdAt;
          if (!dateStr) return false;
          const time = Date.parse(dateStr);
          if (Number.isNaN(time)) return false;
          return time >= startTimeMs && time <= endTimeMs;
        })
        .reduce((sum, inv) => sum + (inv.grandTotal ?? 0), 0);
    }

    return jobRev + invRev;
  };

  const startYear = args.year;
  const QUARTERS = [
    {
      label: "Monthly (Jan-Mar)",
      start: new Date(Date.UTC(startYear, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(startYear, 2, 31, 23, 59, 59, 999)),
      configKey: "MONTHLY",
    },
    {
      label: "Quarterly (Apr-Jun)",
      start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(startYear, 5, 30, 23, 59, 59, 999)),
      configKey: "QUARTERLY",
    },
    {
      label: "Half Yearly (Jul-Sep)",
      start: new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(startYear, 8, 30, 23, 59, 59, 999)),
      configKey: "HALF_YEARLY",
    },
    {
      label: "Yearly (Oct-Dec)",
      start: new Date(Date.UTC(startYear, 9, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(startYear, 11, 31, 23, 59, 59, 999)),
      configKey: "YEARLY",
    },
  ];

  const joinTime = args.joiningDate ? Date.parse(args.joiningDate) : NaN;
  const hasJoin = !Number.isNaN(joinTime);

  const results: CompanyTargetPeriodResult[] = [];

  for (const q of QUARTERS) {
    const startMs = q.start.getTime();
    const endMs = q.end.getTime();

    if (hasJoin && joinTime > endMs) {
      results.push({
        periodLabel: q.label,
        revenue: 0,
        achievedTierIndex: -1,
        targetAmount: 0,
        rewardPercent: 0,
        totalReward: 0,
        sharePerStaff: 0,
        notEligible: true,
      });
      continue;
    }

    const effectiveStartMs = hasJoin && joinTime > startMs ? joinTime : startMs;
    const revenue = getRevenueInTimeRange(effectiveStartMs, endMs);

    const configTiers = freqTiersMap[q.configKey] || [];
    const tiers = configTiers.length > 0 ? configTiers : (args.settings.companyTargetTiers || []);

    let achievedTierIndex = -1;
    let maxAchievedTarget = -1;

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t && t.targetAmount > 0 && revenue >= t.targetAmount) {
        if (t.targetAmount > maxAchievedTarget) {
          maxAchievedTarget = t.targetAmount;
          achievedTierIndex = i;
        }
      }
    }

    const t = achievedTierIndex !== -1 ? tiers[achievedTierIndex] : null;
    const targetAmount = t ? t.targetAmount : 0;
    const rewardPercent = t ? t.rewardPercent : 0;
    const totalReward = roundReward(revenue * (rewardPercent / 100));
    const sharePerStaff = roundReward(totalReward / staffCount);

    results.push({
      periodLabel: q.label,
      revenue: roundReward(revenue),
      achievedTierIndex,
      targetAmount,
      rewardPercent,
      totalReward,
      sharePerStaff,
    });
  }

  return results;
}
