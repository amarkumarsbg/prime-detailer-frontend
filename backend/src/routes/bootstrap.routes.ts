import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getBootstrap } from "../controllers/bootstrap.controller.js";

export const bootstrapRouter = Router();

bootstrapRouter.get("/", requireAuth, getBootstrap);
