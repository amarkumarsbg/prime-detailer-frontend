import type {
  OrganizationSubscription,
  PlanCode,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import {
  PLAN_CATALOG,
  canCreateWithLimit,
  effectiveMaxBranches,
  parsePlanLimits,
  type PlanLimits,
} from "../../lib/plan-catalog.js";
import {
  addMonths,
  daysUntilExpiry,
  graceOrLockStatus,
  isExportLocked,
  normalizeTermMonths,
  termLabelFromMonths,
  type GraceOrLockStatus,
} from "../../lib/subscription-lock.js";

export const DEFAULT_ORG_ID = "org-default";

export type EntitlementPayload = {
  organization: { id: string; name: string; slug: string | null };
  subscription: {
    planCode: PlanCode;
    planName: string;
    status: SubscriptionStatus;
    limits: PlanLimits;
    maxBranchesOverride: number | null;
    effectiveMaxBranches: number | null;
    contactUsUrl: string | null;
    contactPhone: string | null;
    upgradeUrl: string | null;
    /** @deprecated Prefer expiresAt */
    currentPeriodEnd: string | null;
    termMonths: number;
    startsAt: string | null;
    expiresAt: string | null;
    paymentStatus: SubscriptionPaymentStatus;
    lastPaymentTxnId: string | null;
    daysRemaining: number | null;
    graceOrLock: GraceOrLockStatus;
    exportLocked: boolean;
  };
  usage: {
    branchesUsed: number;
    usersUsed: number;
  };
  canCreateBranch: boolean;
  canExportData: boolean;
};

export type SubscriptionPaymentRow = {
  id: string;
  amount: number | null;
  currency: string;
  status: SubscriptionPaymentStatus;
  txnReference: string | null;
  method: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type SubscriptionBillRow = {
  id: string;
  billNumber: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  periodStart: string;
  periodEnd: string;
  amount: number | null;
  currency: string;
  createdAt: string;
};

function asLimitsJson(limits: PlanLimits): Prisma.InputJsonValue {
  return limits as unknown as Prisma.InputJsonValue;
}

function resolveExpiresAt(sub: OrganizationSubscription): Date | null {
  return sub.expiresAt ?? sub.currentPeriodEnd ?? null;
}

export function toEntitlement(
  org: { id: string; name: string; slug: string | null },
  sub: OrganizationSubscription,
  branchesUsed: number,
  usersUsed: number,
  now: Date = new Date()
): EntitlementPayload {
  const limits = parsePlanLimits(sub.limits);
  const max = effectiveMaxBranches(limits, sub.maxBranchesOverride);
  const statusOk = sub.status === "ACTIVE" || sub.status === "PAST_DUE";
  const canCreate = statusOk && canCreateWithLimit(branchesUsed, max);
  const expiresAt = resolveExpiresAt(sub);
  const exportLocked = isExportLocked(expiresAt, now);
  const termMonths = normalizeTermMonths(sub.termMonths);
  return {
    organization: { id: org.id, name: org.name, slug: org.slug },
    subscription: {
      planCode: sub.planCode,
      planName: sub.planName,
      status: sub.status,
      limits,
      maxBranchesOverride: sub.maxBranchesOverride,
      effectiveMaxBranches: max,
      contactUsUrl: sub.contactUsUrl,
      contactPhone: sub.contactPhone,
      upgradeUrl: sub.upgradeUrl,
      currentPeriodEnd: expiresAt?.toISOString() ?? null,
      termMonths,
      startsAt: sub.startsAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      paymentStatus: sub.paymentStatus,
      lastPaymentTxnId: sub.lastPaymentTxnId,
      daysRemaining: daysUntilExpiry(expiresAt, now),
      graceOrLock: graceOrLockStatus(expiresAt, now),
      exportLocked,
    },
    usage: { branchesUsed, usersUsed },
    canCreateBranch: canCreate,
    canExportData: !exportLocked,
  };
}

export async function countBranchesForOrg(organizationId: string): Promise<number> {
  return prisma.branch.count({ where: { organizationId } });
}

export async function countActiveUsersForOrg(organizationId: string): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      isActive: true,
      role: { not: "PLATFORM_OWNER" },
    },
  });
}

async function usageForOrg(organizationId: string) {
  const [branchesUsed, usersUsed] = await Promise.all([
    countBranchesForOrg(organizationId),
    countActiveUsersForOrg(organizationId),
  ]);
  return { branchesUsed, usersUsed };
}

export async function getEntitlementForOrg(organizationId: string): Promise<EntitlementPayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscription: true },
  });
  if (!org?.subscription) return null;
  const usage = await usageForOrg(organizationId);
  return toEntitlement(org, org.subscription, usage.branchesUsed, usage.usersUsed);
}

export async function assertCanCreateBranch(organizationId: string): Promise<EntitlementPayload> {
  const entitlement = await getEntitlementForOrg(organizationId);
  if (!entitlement) {
    throw new AppHttpError(403, "Organization subscription not found.", "SUBSCRIPTION_MISSING");
  }
  if (!entitlement.canCreateBranch) {
    const max = entitlement.subscription.effectiveMaxBranches;
    const used = entitlement.usage.branchesUsed;
    const limitLabel = max === null ? "unlimited" : String(max);
    throw new AppHttpError(
      403,
      `Branch limit reached (${used}/${limitLabel}). Upgrade your plan or contact us to add another branch.`,
      "BRANCH_LIMIT_REACHED",
      {
        planName: entitlement.subscription.planName,
        maxBranches: max,
        currentBranches: used,
        upgradeUrl: entitlement.subscription.upgradeUrl,
        contactUsUrl: entitlement.subscription.contactUsUrl,
      }
    );
  }
  return entitlement;
}

export async function listOrganizationsForPlatform() {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: { subscription: true },
  });
  const results = [];
  for (const org of orgs) {
    if (!org.subscription) continue;
    const usage = await usageForOrg(org.id);
    results.push(toEntitlement(org, org.subscription, usage.branchesUsed, usage.usersUsed));
  }
  return results;
}

export async function getOrganizationForPlatform(orgId: string) {
  return getEntitlementForOrg(orgId);
}

export type PatchSubscriptionInput = {
  planCode?: PlanCode;
  planName?: string;
  status?: SubscriptionStatus;
  limits?: PlanLimits;
  maxBranchesOverride?: number | null;
  contactUsUrl?: string | null;
  contactPhone?: string | null;
  upgradeUrl?: string | null;
  termMonths?: number;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  paymentStatus?: SubscriptionPaymentStatus;
  lastPaymentTxnId?: string | null;
};

export async function patchOrganizationSubscription(
  orgId: string,
  input: PatchSubscriptionInput,
  actorLabel: string
): Promise<EntitlementPayload> {
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { subscription: true },
  });
  if (!existing?.subscription) {
    throw new AppHttpError(404, "Organization not found", "ORG_NOT_FOUND");
  }

  const sub = existing.subscription;
  let nextPlanCode = input.planCode ?? sub.planCode;
  let nextPlanName = input.planName ?? sub.planName;
  let nextLimits = input.limits ? parsePlanLimits(input.limits) : parsePlanLimits(sub.limits);

  if (input.planCode && !input.limits) {
    const template = PLAN_CATALOG[input.planCode];
    nextLimits = { ...template.limits };
    if (!input.planName) nextPlanName = template.planName;
  }

  const nextOverride =
    input.maxBranchesOverride !== undefined ? input.maxBranchesOverride : sub.maxBranchesOverride;

  const oldMax = effectiveMaxBranches(parsePlanLimits(sub.limits), sub.maxBranchesOverride);
  const newMax = effectiveMaxBranches(nextLimits, nextOverride);

  const nextExpires =
    input.expiresAt !== undefined ? input.expiresAt : resolveExpiresAt(sub);
  const nextTerm =
    input.termMonths !== undefined ? normalizeTermMonths(input.termMonths) : normalizeTermMonths(sub.termMonths);

  const before = {
    planCode: sub.planCode,
    status: sub.status,
    expiresAt: resolveExpiresAt(sub)?.toISOString() ?? null,
    paymentStatus: sub.paymentStatus,
    termMonths: sub.termMonths,
  };

  const updated = await prisma.organizationSubscription.update({
    where: { organizationId: orgId },
    data: {
      planCode: nextPlanCode,
      planName: nextPlanName,
      status: input.status ?? sub.status,
      limits: asLimitsJson(nextLimits),
      maxBranchesOverride: nextOverride,
      contactUsUrl: input.contactUsUrl !== undefined ? input.contactUsUrl : sub.contactUsUrl,
      contactPhone: input.contactPhone !== undefined ? input.contactPhone : sub.contactPhone,
      upgradeUrl: input.upgradeUrl !== undefined ? input.upgradeUrl : sub.upgradeUrl,
      termMonths: nextTerm,
      startsAt: input.startsAt !== undefined ? input.startsAt : sub.startsAt,
      expiresAt: nextExpires,
      currentPeriodEnd: nextExpires,
      paymentStatus: input.paymentStatus ?? sub.paymentStatus,
      lastPaymentTxnId:
        input.lastPaymentTxnId !== undefined ? input.lastPaymentTxnId : sub.lastPaymentTxnId,
    },
  });

  await prisma.platformAuditLog.create({
    data: {
      organizationId: orgId,
      actor: actorLabel,
      action: "subscription.patch",
      before,
      after: {
        planCode: updated.planCode,
        status: updated.status,
        expiresAt: resolveExpiresAt(updated)?.toISOString() ?? null,
        paymentStatus: updated.paymentStatus,
        termMonths: updated.termMonths,
      },
    },
  });

  console.info("[platform] subscription updated", {
    orgId,
    actor: actorLabel,
    oldMaxBranches: oldMax,
    newMaxBranches: newMax,
    maxBranchesOverride: nextOverride,
    planCode: nextPlanCode,
    at: new Date().toISOString(),
  });

  const usage = await usageForOrg(orgId);
  return toEntitlement(existing, updated, usage.branchesUsed, usage.usersUsed);
}

function defaultPeriodDates(termMonths: number, now = new Date()) {
  const startsAt = now;
  const expiresAt = addMonths(now, termMonths);
  return { startsAt, expiresAt };
}

/** Ensure default org exists (idempotent helpers for seed / bootstrap). */
export async function ensureDefaultOrganization(opts?: {
  name?: string;
  maxBranches?: number;
}): Promise<string> {
  const name = opts?.name ?? "Prime Detailers";
  const branchCount = await prisma.branch.count();
  const maxBranches = opts?.maxBranches ?? Math.max(1, branchCount);
  const termMonths = 12;
  const { startsAt, expiresAt } = defaultPeriodDates(termMonths);

  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    create: {
      id: DEFAULT_ORG_ID,
      name,
      slug: "prime-detailers",
      subscription: {
        create: {
          id: "sub-default",
          planCode: "STARTER",
          planName: "Starter",
          status: "ACTIVE",
          limits: asLimitsJson({ maxBranches }),
          termMonths,
          startsAt,
          expiresAt,
          currentPeriodEnd: expiresAt,
          paymentStatus: "PAID",
        },
      },
    },
    update: { name },
  });

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId: DEFAULT_ORG_ID },
  });
  if (!sub) {
    await prisma.organizationSubscription.create({
      data: {
        id: "sub-default",
        organizationId: DEFAULT_ORG_ID,
        planCode: "STARTER",
        planName: "Starter",
        status: "ACTIVE",
        limits: asLimitsJson({ maxBranches }),
        termMonths,
        startsAt,
        expiresAt,
        currentPeriodEnd: expiresAt,
        paymentStatus: "PAID",
      },
    });
  } else if (!sub.expiresAt && !sub.currentPeriodEnd) {
    await prisma.organizationSubscription.update({
      where: { organizationId: DEFAULT_ORG_ID },
      data: {
        termMonths: normalizeTermMonths(sub.termMonths),
        startsAt: sub.startsAt ?? startsAt,
        expiresAt,
        currentPeriodEnd: expiresAt,
        paymentStatus: sub.paymentStatus ?? "PAID",
      },
    });
  }

  return DEFAULT_ORG_ID;
}

export async function requestSubscriptionRenewal(
  organizationId: string,
  actorLabel: string,
  opts?: { notes?: string; method?: string }
): Promise<{ entitlement: EntitlementPayload; payment: SubscriptionPaymentRow }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscription: true },
  });
  if (!org?.subscription) {
    throw new AppHttpError(404, "Subscription not found", "SUBSCRIPTION_MISSING");
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      organizationId,
      subscriptionId: org.subscription.id,
      status: "PENDING",
      method: opts?.method ?? "MANUAL",
      notes: opts?.notes ?? "Renewal requested from studio",
      recordedBy: actorLabel,
    },
  });

  const updated = await prisma.organizationSubscription.update({
    where: { organizationId },
    data: { paymentStatus: "PENDING" },
  });

  await prisma.platformAuditLog.create({
    data: {
      organizationId,
      actor: actorLabel,
      action: "subscription.renew_request",
      before: { paymentStatus: org.subscription.paymentStatus },
      after: { paymentStatus: "PENDING", paymentId: payment.id },
    },
  });

  const usage = await usageForOrg(organizationId);
  return {
    entitlement: toEntitlement(org, updated, usage.branchesUsed, usage.usersUsed),
    payment: mapPayment(payment),
  };
}

export async function listSubscriptionPayments(organizationId: string): Promise<SubscriptionPaymentRow[]> {
  const rows = await prisma.subscriptionPayment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(mapPayment);
}

export async function listSubscriptionBills(organizationId: string): Promise<SubscriptionBillRow[]> {
  const rows = await prisma.subscriptionBill.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(mapBill);
}

export async function getSubscriptionBill(
  organizationId: string,
  billId: string
): Promise<SubscriptionBillRow & { organizationName: string } | null> {
  const bill = await prisma.subscriptionBill.findFirst({
    where: { id: billId, organizationId },
    include: { organization: { select: { name: true } } },
  });
  if (!bill) return null;
  return { ...mapBill(bill), organizationName: bill.organization.name };
}

function mapPayment(p: {
  id: string;
  amount: number | null;
  currency: string;
  status: SubscriptionPaymentStatus;
  txnReference: string | null;
  method: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}): SubscriptionPaymentRow {
  return {
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    txnReference: p.txnReference,
    method: p.method,
    notes: p.notes,
    recordedBy: p.recordedBy,
    verifiedAt: p.verifiedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function mapBill(b: {
  id: string;
  billNumber: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number | null;
  currency: string;
  createdAt: Date;
}): SubscriptionBillRow {
  return {
    id: b.id,
    billNumber: b.billNumber,
    planName: b.planName,
    termMonths: b.termMonths,
    termLabel: b.termLabel,
    periodStart: b.periodStart.toISOString(),
    periodEnd: b.periodEnd.toISOString(),
    amount: b.amount,
    currency: b.currency,
    createdAt: b.createdAt.toISOString(),
  };
}

async function nextBillNumber(organizationId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `SUB-${year}-`;
  const count = await prisma.subscriptionBill.count({
    where: { organizationId, billNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export type VerifyPaymentInput = {
  paymentId: string;
  outcome: "PAID" | "FAILED";
  txnReference?: string | null;
  amount?: number | null;
  notes?: string | null;
};

/**
 * Admin verifies a renew payment: on PAID, extends expiresAt by termMonths and creates a bill.
 */
export async function verifySubscriptionPayment(
  orgId: string,
  input: VerifyPaymentInput,
  actorLabel: string
): Promise<EntitlementPayload> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { subscription: true },
  });
  if (!org?.subscription) {
    throw new AppHttpError(404, "Organization not found", "ORG_NOT_FOUND");
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: input.paymentId, organizationId: orgId },
  });
  if (!payment) {
    throw new AppHttpError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  }

  const sub = org.subscription;

  if (input.outcome === "FAILED") {
    await prisma.$transaction([
      prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          txnReference: input.txnReference ?? payment.txnReference,
          notes: input.notes ?? payment.notes,
          amount: input.amount ?? payment.amount,
          verifiedAt: new Date(),
          recordedBy: actorLabel,
        },
      }),
      prisma.organizationSubscription.update({
        where: { organizationId: orgId },
        data: { paymentStatus: "FAILED" },
      }),
      prisma.platformAuditLog.create({
        data: {
          organizationId: orgId,
          actor: actorLabel,
          action: "subscription.payment_failed",
          before: { paymentId: payment.id, status: payment.status },
          after: { status: "FAILED" },
        },
      }),
    ]);
    const usage = await usageForOrg(orgId);
    const updated = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { organizationId: orgId },
    });
    return toEntitlement(org, updated, usage.branchesUsed, usage.usersUsed);
  }

  const termMonths = normalizeTermMonths(sub.termMonths);
  const now = new Date();
  const currentEnd = resolveExpiresAt(sub);
  const periodStart = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const periodEnd = addMonths(periodStart, termMonths);
  const txnRef = input.txnReference?.trim() || payment.txnReference || `MANUAL-${Date.now()}`;
  const billNumber = await nextBillNumber(orgId);
  const termLabel = termLabelFromMonths(termMonths);

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        txnReference: txnRef,
        notes: input.notes ?? payment.notes,
        amount: input.amount ?? payment.amount,
        verifiedAt: now,
        recordedBy: actorLabel,
      },
    });

    await tx.organizationSubscription.update({
      where: { organizationId: orgId },
      data: {
        paymentStatus: "PAID",
        lastPaymentTxnId: txnRef,
        status: "ACTIVE",
        startsAt: sub.startsAt ?? periodStart,
        expiresAt: periodEnd,
        currentPeriodEnd: periodEnd,
        termMonths,
      },
    });

    await tx.subscriptionBill.create({
      data: {
        organizationId: orgId,
        subscriptionId: sub.id,
        paymentId: payment.id,
        billNumber,
        planName: sub.planName,
        termMonths,
        termLabel,
        periodStart,
        periodEnd,
        amount: input.amount ?? payment.amount,
        currency: payment.currency,
      },
    });

    await tx.platformAuditLog.create({
      data: {
        organizationId: orgId,
        actor: actorLabel,
        action: "subscription.payment_verified",
        before: {
          expiresAt: currentEnd?.toISOString() ?? null,
          paymentStatus: sub.paymentStatus,
        },
        after: {
          expiresAt: periodEnd.toISOString(),
          paymentStatus: "PAID",
          billNumber,
          txnReference: txnRef,
        },
      },
    });
  });

  const usage = await usageForOrg(orgId);
  const updated = await prisma.organizationSubscription.findUniqueOrThrow({
    where: { organizationId: orgId },
  });
  return toEntitlement(org, updated, usage.branchesUsed, usage.usersUsed);
}

/**
 * Admin shortcut: mark paid without an existing payment row (creates payment + bill + extend).
 */
export async function adminMarkSubscriptionPaid(
  orgId: string,
  actorLabel: string,
  opts?: {
    txnReference?: string | null;
    amount?: number | null;
    termMonths?: number;
    notes?: string | null;
  }
): Promise<EntitlementPayload> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { subscription: true },
  });
  if (!org?.subscription) {
    throw new AppHttpError(404, "Organization not found", "ORG_NOT_FOUND");
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      organizationId: orgId,
      subscriptionId: org.subscription.id,
      status: "PROCESSING",
      method: "ADMIN",
      notes: opts?.notes ?? "Marked paid by platform admin",
      amount: opts?.amount ?? null,
      recordedBy: actorLabel,
    },
  });

  if (opts?.termMonths) {
    await prisma.organizationSubscription.update({
      where: { organizationId: orgId },
      data: { termMonths: normalizeTermMonths(opts.termMonths) },
    });
  }

  return verifySubscriptionPayment(
    orgId,
    {
      paymentId: payment.id,
      outcome: "PAID",
      txnReference: opts?.txnReference,
      amount: opts?.amount,
      notes: opts?.notes,
    },
    actorLabel
  );
}
