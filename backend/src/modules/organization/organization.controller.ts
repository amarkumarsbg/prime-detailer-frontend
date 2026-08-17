import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getEntitlementForOrg,
  getOrganizationForPlatform,
  listOrganizationsForPlatform,
  patchOrganizationSubscription,
} from "./organization-subscription.service.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import { parsePlanLimits } from "../../lib/plan-catalog.js";
import { prisma } from "../../lib/prisma.js";

async function resolveOrgId(req: Request): Promise<string | undefined> {
  if (req.auth?.organizationId) return req.auth.organizationId;
  if (!req.auth?.id) return undefined;
  const row = await prisma.user.findUnique({
    where: { id: req.auth.id },
    select: { organizationId: true },
  });
  return row?.organizationId;
}

export async function getStudioSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) {
      res.status(403).json({
        data: null,
        error: { message: "Organization not found on user", code: "ORG_MISSING" },
      });
      return;
    }
    const entitlement = await getEntitlementForOrg(orgId);
    if (!entitlement) {
      res.status(404).json({
        data: null,
        error: { message: "Subscription not found", code: "SUBSCRIPTION_MISSING" },
      });
      return;
    }
    res.json({ data: entitlement, error: null });
  } catch (e) {
    next(e);
  }
}

export async function listPlatformOrganizations(_req: Request, res: Response, next: NextFunction) {
  try {
    const organizations = await listOrganizationsForPlatform();
    res.json({ data: { organizations }, error: null });
  } catch (e) {
    next(e);
  }
}

function paramOrgId(req: Request): string {
  const raw = req.params.orgId;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

export async function getPlatformOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = paramOrgId(req);
    const entitlement = await getOrganizationForPlatform(orgId);
    if (!entitlement) {
      res.status(404).json({ data: null, error: { message: "Organization not found" } });
      return;
    }
    res.json({ data: entitlement, error: null });
  } catch (e) {
    next(e);
  }
}

const patchSchema = z.object({
  planCode: z.enum(["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "CUSTOM"]).optional(),
  planName: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED"]).optional(),
  limits: z
    .object({
      maxBranches: z.number().int().nonnegative().nullable(),
      maxStaff: z.number().int().nonnegative().nullable().optional(),
      maxCustomers: z.number().int().nonnegative().nullable().optional(),
    })
    .optional(),
  maxBranchesOverride: z.number().int().nonnegative().nullable().optional(),
  contactUsUrl: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  upgradeUrl: z.string().nullable().optional(),
});

export async function patchPlatformOrganizationSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orgId = paramOrgId(req);
    const body = patchSchema.parse(req.body);
    const actor =
      (req as Request & { platformActor?: string }).platformActor ??
      (req.auth ? `user:${req.auth.id}` : "unknown");
    const entitlement = await patchOrganizationSubscription(
      orgId,
      {
        ...body,
        limits: body.limits ? parsePlanLimits(body.limits) : undefined,
      },
      actor
    );
    res.json({ data: entitlement, error: null });
  } catch (e) {
    if (e instanceof AppHttpError) {
      next(e);
      return;
    }
    next(e);
  }
}
