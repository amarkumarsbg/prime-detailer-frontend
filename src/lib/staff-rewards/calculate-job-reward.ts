import type {
  CompanyTargetTierConfig,
  CompanyTargetDistributionMode,
  CompanyTargetRoleShareMap,
  StaffRewardLedgerEntry,
  StaffRewardMode,
  StaffRewardSettings,
  StaffRewardType,
  UserRole,
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
    defaultPercent: 0,
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
    companyTargetRevenueType: "INVOICES",
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
    companyTargetDistributionMode: "DISTRIBUTE_EQUALLY",
    companyTargetRoleShares: {
      ADMIN: 0,
      BRANCH_MANAGER: 15,
      MANAGER: 15,
      SUPERVISOR: 20,
      RECEPTIONIST: 10,
      MECHANIC: 40,
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
  periodType: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  periodMonth: number;
  periodYear: number;
  revenue: number;
  achievedTierIndex: number;
  targetAmount: number;
  rewardPercent: number;
  totalReward: number;
  sharePerStaff: number;
  shareForRole?: number;
  eligibleStaffCount: number;
  eligibleRoleCount?: number;
  notEligible?: boolean;
}

type CompanyTargetInvoice = {
  grandTotal?: number;
  createdAt?: string;
  status?: string;
};

type CompanyTargetStaffMember = {
  role?: string;
  joiningDate?: string;
};

const COMPANY_TARGET_REWARD_ROLES: Array<
  Exclude<UserRole, "CUSTOMER" | "SUPER_ADMIN" | "PLATFORM_OWNER">
> = [
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
];

function monthLabel(month: number): string {
  const monthsFull = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return monthsFull[Math.min(11, Math.max(0, month - 1))] ?? "";
}

function parsedTimeOrNull(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function isJoiningDayEligible(joiningDate?: string): boolean {
  if (!joiningDate) return false;
  const d = new Date(joiningDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDate() <= 5;
}

function isValidInvoiceForCompanyRevenue(inv: CompanyTargetInvoice): boolean {
  const status = String(inv.status ?? "").trim().toUpperCase();
  if (status === "DRAFT" || status === "CANCELLED" || status === "VOID" || status === "DELETED") {
    return false;
  }
  return Number.isFinite(inv.grandTotal ?? NaN);
}

function sumValidInvoiceRevenueInRange(
  invoices: CompanyTargetInvoice[],
  startTimeMs: number,
  endTimeMs: number
): number {
  let revenue = 0;
  for (const inv of invoices) {
    if (!isValidInvoiceForCompanyRevenue(inv)) continue;
    const createdAt = parsedTimeOrNull(inv.createdAt);
    if (createdAt == null) continue;
    if (createdAt < startTimeMs || createdAt > endTimeMs) continue;
    revenue += inv.grandTotal ?? 0;
  }
  return roundReward(revenue);
}

function eligibleStaffCountForPeriod(
  staffMembers: CompanyTargetStaffMember[] | undefined,
  periodEndTimeMs: number,
  fallbackCount: number
): number {
  if (!staffMembers || staffMembers.length === 0) {
    return Math.max(1, fallbackCount);
  }
  let count = 0;
  for (const s of staffMembers) {
    if (String(s.role ?? "").toUpperCase() === "SUPER_ADMIN") continue;
    if (!isJoiningDayEligible(s.joiningDate)) continue;
    const joinTime = parsedTimeOrNull(s.joiningDate);
    if (joinTime != null && joinTime > periodEndTimeMs) continue;
    count += 1;
  }
  return Math.max(1, count);
}

function normalizeDistributionMode(
  value: unknown
): CompanyTargetDistributionMode {
  return value === "DISTRIBUTE_ROLE_WISE"
    ? "DISTRIBUTE_ROLE_WISE"
    : "DISTRIBUTE_EQUALLY";
}

function normalizeRoleShares(
  raw: CompanyTargetRoleShareMap | undefined
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const role of COMPANY_TARGET_REWARD_ROLES) {
    const v = Number(raw?.[role] ?? 0);
    out[role] = Number.isFinite(v) && v > 0 ? v : 0;
  }
  return out;
}

function eligibleRoleCountsForPeriod(
  staffMembers: CompanyTargetStaffMember[] | undefined,
  periodEndTimeMs: number
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const role of COMPANY_TARGET_REWARD_ROLES) counts[role] = 0;
  if (!staffMembers) return counts;

  for (const s of staffMembers) {
    const role = String(s.role ?? "").toUpperCase();
    if (!COMPANY_TARGET_REWARD_ROLES.includes(role as any)) continue;
    if (!isJoiningDayEligible(s.joiningDate)) continue;
    const joinTime = parsedTimeOrNull(s.joiningDate);
    if (joinTime != null && joinTime > periodEndTimeMs) continue;
    counts[role] = (counts[role] ?? 0) + 1;
  }

  return counts;
}

function achievedTier(
  revenue: number,
  tiers: CompanyTargetTierConfig[]
): { index: number; targetAmount: number; rewardPercent: number } {
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
  if (achievedTierIndex === -1) {
    return { index: -1, targetAmount: 0, rewardPercent: 0 };
  }
  const winner = tiers[achievedTierIndex]!;
  return {
    index: achievedTierIndex,
    targetAmount: winner.targetAmount,
    rewardPercent: winner.rewardPercent,
  };
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
    grandTotal?: number;
    createdAt?: string;
    status?: string;
  }[];
  staffMembers?: CompanyTargetStaffMember[];
  activeStaffCount: number;
  settings: StaffRewardSettings;
  year: number;
  joiningDate?: string;
  staffRole?: string;
  evaluationDate?: Date;
}): CompanyTargetPeriodResult[] {
  if (!args.settings.companyTargetEnabled) {
    return [];
  }

  const freqTiersMap = (args.settings.companyTargetFrequencyTiers || {}) as Record<string, any>;
  void args.jobCards;

  const refDate = args.evaluationDate ?? new Date();
  const year = args.year;
  const month = refDate.getUTCMonth() + 1;

  const monthStart = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = Date.UTC(year, month, 0, 23, 59, 59, 999);

  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const quarterStart = Date.UTC(year, quarterStartMonth - 1, 1, 0, 0, 0, 0);
  const quarterEnd = Date.UTC(year, quarterStartMonth + 2, 0, 23, 59, 59, 999);

  const halfStartMonth = month <= 6 ? 1 : 7;
  const halfStart = Date.UTC(year, halfStartMonth - 1, 1, 0, 0, 0, 0);
  const halfEnd = Date.UTC(year, halfStartMonth + 5, 0, 23, 59, 59, 999);

  const yearStart = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = Date.UTC(year, 11, 31, 23, 59, 59, 999);

  const slots: Array<{
    label: string;
    configKey: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
    periodMonth: number;
    periodYear: number;
    startMs: number;
    endMs: number;
  }> = [
    {
      label: `Monthly (${monthLabel(month)})`,
      configKey: "MONTHLY",
      periodMonth: month,
      periodYear: year,
      startMs: monthStart,
      endMs: monthEnd,
    },
    {
      label: "Quarterly",
      configKey: "QUARTERLY",
      periodMonth: quarterStartMonth,
      periodYear: year,
      startMs: quarterStart,
      endMs: quarterEnd,
    },
    {
      label: "Half Yearly",
      configKey: "HALF_YEARLY",
      periodMonth: halfStartMonth,
      periodYear: year,
      startMs: halfStart,
      endMs: halfEnd,
    },
    {
      label: "Yearly",
      configKey: "YEARLY",
      periodMonth: 1,
      periodYear: year,
      startMs: yearStart,
      endMs: yearEnd,
    },
  ];

  const joiningTime = parsedTimeOrNull(args.joiningDate);
  const joiningDayEligible = isJoiningDayEligible(args.joiningDate);
  const distributionMode = normalizeDistributionMode(
    args.settings.companyTargetDistributionMode
  );
  const currentRole = String(args.staffRole ?? "").toUpperCase();

  return slots.map((slot) => {
    const revenue = sumValidInvoiceRevenueInRange(args.invoices, slot.startMs, slot.endMs);
    const configTiers = freqTiersMap[slot.configKey] || [];
    const tiers = (configTiers.length > 0 ? configTiers : (args.settings.companyTargetTiers || [])) as CompanyTargetTierConfig[];

    // Highest single achieved tier.
    const winner = achievedTier(revenue, tiers);
    const totalReward = roundReward(revenue * (winner.rewardPercent / 100));

    const eligibleStaffCount = eligibleStaffCountForPeriod(
      args.staffMembers,
      slot.endMs,
      args.activeStaffCount
    );
    const joinedByPeriodEnd = joiningTime != null && joiningTime <= slot.endMs;
    const notEligible = !(joiningDayEligible && joinedByPeriodEnd);

    let shareForRole: number;
    let eligibleRoleCount = 0;

    if (distributionMode === "DISTRIBUTE_ROLE_WISE") {
      const winnerTier = winner.index >= 0 ? (tiers[winner.index] as any) : null;
      const roleCounts = eligibleRoleCountsForPeriod(args.staffMembers, slot.endMs);
      eligibleRoleCount = roleCounts[currentRole] ?? 0;
      let shareForThisStaff: number = 0;

      if (winnerTier?.roleRewards && (winnerTier.roleRewards as any[]).length > 0) {
        // New: each role has its own independent reward % from the tier
        const roleEntry = (winnerTier.roleRewards as Array<{ role: string; rewardPercent: number }>).find(
          (r) => r.role && String(r.role).toUpperCase() === currentRole && r.rewardPercent > 0
        );
        if (roleEntry) {
          const rolePool = roundReward(revenue * (roleEntry.rewardPercent / 100));
          const roleCount = roleCounts[currentRole] ?? 0;
          shareForThisStaff = roleCount > 0 ? roundReward(rolePool / roleCount) : 0;
        }
      } else {
        // Legacy: single role on tier
        const tierRole = winnerTier ? String(winnerTier?.role ?? "").toUpperCase() : "";
        if (tierRole && currentRole === tierRole) {
          const roleCount = roleCounts[tierRole] ?? 0;
          shareForThisStaff = roleCount > 0 ? roundReward(totalReward / roleCount) : 0;
        }
        // No roleRewards and no role set — no reward for this staff member.
        // (companyTargetRoleShares fallback removed: it used a single shared pool
        // model inconsistent with the per-role independent pool model the backend uses.)
      }
      shareForRole = shareForThisStaff;
    } else {
      shareForRole = eligibleStaffCount > 0 ? roundReward(totalReward / eligibleStaffCount) : 0;
    }

    const sharePerStaff = notEligible ? 0 : shareForRole;

    return {
      periodLabel: slot.label,
      periodType: slot.configKey,
      periodMonth: slot.periodMonth,
      periodYear: slot.periodYear,
      revenue,
      achievedTierIndex: winner.index,
      targetAmount: winner.targetAmount,
      rewardPercent: winner.rewardPercent,
      totalReward,
      sharePerStaff,
      shareForRole,
      eligibleStaffCount,
      eligibleRoleCount: distributionMode === "DISTRIBUTE_ROLE_WISE" ? eligibleRoleCount : undefined,
      notEligible,
    };
  });
}
