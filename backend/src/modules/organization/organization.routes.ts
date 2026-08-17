import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getStudioSubscription } from "./organization.controller.js";

export const organizationRouter = Router();

organizationRouter.use(requireAuth);
organizationRouter.get("/subscription", getStudioSubscription);
