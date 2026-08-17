import type { OrganizationSubscription, PlanCode, Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import {
  PLAN_CATALOG,
  canCreateWithLimit,
  effectiveMaxBranches,
  parsePlanLimits,
  type PlanLimits,
} from "../../lib/plan-catalog.js";

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
    currentPeriodEnd: string | null;
  };
  usage: {
    branchesUsed: number;
  };
  canCreateBranch: boolean;
};

function asLimitsJson(limits: PlanLimits): Prisma.InputJsonValue {
  return limits as unknown as Prisma.InputJsonValue;
}

export function toEntitlement(
  org: { id: string; name: string; slug: string | null },
  sub: OrganizationSubscription,
  branchesUsed: number
): EntitlementPayload {
  const limits = parsePlanLimits(sub.limits);
  const max = effectiveMaxBranches(limits, sub.maxBranchesOverride);
  const statusOk = sub.status === "ACTIVE" || sub.status === "PAST_DUE";
  const canCreate = statusOk && canCreateWithLimit(branchesUsed, max);
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
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    },
    usage: { branchesUsed },
    canCreateBranch: canCreate,
  };
}

export async function countBranchesForOrg(organizationId: string): Promise<number> {
  return prisma.branch.count({ where: { organizationId } });
}

export async function getEntitlementForOrg(organizationId: string): Promise<EntitlementPayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscription: true },
  });
  if (!org?.subscription) return null;
  const used = await countBranchesForOrg(organizationId);
  return toEntitlement(org, org.subscription, used);
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
    const used = await countBranchesForOrg(org.id);
    results.push(toEntitlement(org, org.subscription, used));
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

  const used = await countBranchesForOrg(orgId);
  return toEntitlement(existing, updated, used);
}

/** Ensure default org exists (idempotent helpers for seed / bootstrap). */
export async function ensureDefaultOrganization(opts?: {
  name?: string;
  maxBranches?: number;
}): Promise<string> {
  const name = opts?.name ?? "Prime Detailers";
  const branchCount = await prisma.branch.count();
  const maxBranches = opts?.maxBranches ?? Math.max(1, branchCount);

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
      },
    });
  }

  return DEFAULT_ORG_ID;
}
