import { Router } from "express";
import { requirePlatformAuth } from "../middleware/platform-auth.js";
import {
  getPlatformOrganization,
  listPlatformOrganizations,
  patchPlatformOrganizationSubscription,
} from "../controllers/organization.controller.js";

export const platformRouter = Router();

platformRouter.use(requirePlatformAuth);
platformRouter.get("/organizations", listPlatformOrganizations);
platformRouter.get("/organizations/:orgId", getPlatformOrganization);
platformRouter.patch("/organizations/:orgId/subscription", patchPlatformOrganizationSubscription);
