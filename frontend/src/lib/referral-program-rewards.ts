import type { ReferralProgramSerializable, ReferralRewardMode } from "@/store/referral-settings-store";

function parseNonNeg(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Round to paise (2 decimal places). */
export function roundInr(n: number): number {
  return Math.round(n * 100) / 100;
}

export function rewardAmountFromMode(
  mode: ReferralRewardMode,
  amountStr: string,
  jobSubtotalInr: number
): number {
  const n = parseNonNeg(amountStr);
  if (n <= 0) return 0;
  if (mode === "percent_job") {
    const base = Math.max(0, jobSubtotalInr);
    return roundInr((base * n) / 100);
  }
  return roundInr(n);
}

export type ResolvedReferralRewards =
  | {
      ok: true;
      buyerAmount: number;
      advocateAmount: number;
      jobSubtotalInr: number;
    }
  | {
      ok: false;
      reason: string;
      buyerAmount: 0;
      advocateAmount: 0;
      jobSubtotalInr: number;
    };

/**
 * Resolve wallet credit amounts from Referrals page rules + qualifying job subtotal (ex-GST).
 */
export function resolveReferralProgramRewards(input: {
  program: Pick<
    ReferralProgramSerializable,
    | "programEnabled"
    | "advocateRewardMode"
    | "advocateAmount"
    | "newCustomerRewardMode"
    | "newCustomerAmount"
    | "minJobAmountInr"
  >;
  /** Invoice / job subtotal before tax (₹). */
  jobSubtotalInr: number;
}): ResolvedReferralRewards {
  const jobSubtotalInr = roundInr(Math.max(0, Number(input.jobSubtotalInr) || 0));
  const program = input.program;

  if (!program.programEnabled) {
    return {
      ok: false,
      reason: "Referral program is paused.",
      buyerAmount: 0,
      advocateAmount: 0,
      jobSubtotalInr,
    };
  }

  const minJob = parseNonNeg(program.minJobAmountInr);
  if (minJob > 0 && jobSubtotalInr + 0.001 < minJob) {
    return {
      ok: false,
      reason: `Job total must be at least ₹${minJob.toLocaleString("en-IN")} for referral rewards.`,
      buyerAmount: 0,
      advocateAmount: 0,
      jobSubtotalInr,
    };
  }

  const buyerAmount = rewardAmountFromMode(
    program.newCustomerRewardMode,
    program.newCustomerAmount,
    jobSubtotalInr
  );
  const advocateAmount = rewardAmountFromMode(
    program.advocateRewardMode,
    program.advocateAmount,
    jobSubtotalInr
  );

  if (buyerAmount <= 0 && advocateAmount <= 0) {
    return {
      ok: false,
      reason: "Referral reward amounts are zero. Update rules on the Referrals page.",
      buyerAmount: 0,
      advocateAmount: 0,
      jobSubtotalInr,
    };
  }

  return { ok: true, buyerAmount, advocateAmount, jobSubtotalInr };
}
