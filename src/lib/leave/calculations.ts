import type { LeaveBalance, LeaveRequest, LeaveType } from "@/types";

/** Inclusive calendar days between yyyy-MM-dd dates (local). */
export function countLeaveDays(fromDate: string, toDate: string): number {
  const from = parseYmd(fromDate);
  const to = parseYmd(toDate);
  if (!from || !to || to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function availableLeaveDays(balance: LeaveBalance): number {
  return Math.max(0, balance.entitled - balance.used - balance.pending);
}

export function rangesOverlap(
  fromA: string,
  toA: string,
  fromB: string,
  toB: string
): boolean {
  return fromA <= toB && fromB <= toA;
}

const BLOCKING = new Set(["PENDING", "APPROVED"]);

export function hasOverlappingLeave(
  requests: LeaveRequest[],
  staffId: string,
  fromDate: string,
  toDate: string,
  excludeRequestId?: string
): boolean {
  return requests.some(
    (r) =>
      r.staffId === staffId &&
      r.id !== excludeRequestId &&
      BLOCKING.has(r.status) &&
      rangesOverlap(fromDate, toDate, r.fromDate, r.toDate)
  );
}

export function findBalance(
  balances: LeaveBalance[],
  staffId: string,
  leaveTypeId: string,
  year: number
): LeaveBalance | undefined {
  return balances.find(
    (b) => b.staffId === staffId && b.leaveTypeId === leaveTypeId && b.year === year
  );
}

export function ensureBalanceRow(opts: {
  balances: LeaveBalance[];
  staffId: string;
  leaveTypeId: string;
  branchId: string;
  year: number;
  entitled: number;
}): { balances: LeaveBalance[]; balance: LeaveBalance } {
  const existing = findBalance(
    opts.balances,
    opts.staffId,
    opts.leaveTypeId,
    opts.year
  );
  if (existing) return { balances: opts.balances, balance: existing };
  const balance: LeaveBalance = {
    id: `lb-${opts.staffId}-${opts.leaveTypeId}-${opts.year}`,
    staffId: opts.staffId,
    leaveTypeId: opts.leaveTypeId,
    branchId: opts.branchId,
    year: opts.year,
    entitled: opts.entitled,
    used: 0,
    pending: 0,
  };
  return { balances: [...opts.balances, balance], balance };
}

export function adjustBalance(
  balances: LeaveBalance[],
  balanceId: string,
  patch: Partial<Pick<LeaveBalance, "used" | "pending" | "entitled">>
): LeaveBalance[] {
  return balances.map((b) => {
    if (b.id !== balanceId) return b;
    return {
      ...b,
      entitled: Math.max(0, patch.entitled ?? b.entitled),
      used: Math.max(0, patch.used ?? b.used),
      pending: Math.max(0, patch.pending ?? b.pending),
    };
  });
}

export function yearFromDate(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export function defaultLeaveTypes(): LeaveType[] {
  return [
    {
      id: "lt-casual",
      name: "Casual Leave",
      paid: true,
      tracksBalance: true,
      defaultDaysPerYear: 12,
      isActive: true,
    },
    {
      id: "lt-sick",
      name: "Sick Leave",
      paid: true,
      tracksBalance: true,
      defaultDaysPerYear: 6,
      isActive: true,
    },
    {
      id: "lt-unpaid",
      name: "Unpaid Leave",
      paid: false,
      tracksBalance: false,
      defaultDaysPerYear: 0,
      isActive: true,
    },
  ];
}

/**
 * Approved leave intersecting [fromDate, toDate].
 * For Attendance/Payroll later — does not change punch behavior.
 */
export function getApprovedLeaveInRange(
  requests: LeaveRequest[],
  opts: { staffId?: string; branchId?: string; fromDate: string; toDate: string }
): LeaveRequest[] {
  return requests.filter((r) => {
    if (r.status !== "APPROVED") return false;
    if (opts.staffId && r.staffId !== opts.staffId) return false;
    if (opts.branchId && r.branchId !== opts.branchId) return false;
    return rangesOverlap(opts.fromDate, opts.toDate, r.fromDate, r.toDate);
  });
}
