import { Router } from "express";
import { requirePlatformAuth } from "../../middleware/platform-auth.js";
import {
  getPlatformOrganization,
  listPlatformOrganizations,
  patchPlatformOrganizationSubscription,
  postPlatformMarkPaid,
  postPlatformVerifyPayment,
} from "../organization/organization.controller.js";

export const platformRouter = Router();

platformRouter.use(requirePlatformAuth);
platformRouter.get("/organizations", listPlatformOrganizations);
platformRouter.get("/organizations/:orgId", getPlatformOrganization);
platformRouter.patch("/organizations/:orgId/subscription", patchPlatformOrganizationSubscription);
platformRouter.post("/organizations/:orgId/subscription/verify-payment", postPlatformVerifyPayment);
platformRouter.post("/organizations/:orgId/subscription/mark-paid", postPlatformMarkPaid);
