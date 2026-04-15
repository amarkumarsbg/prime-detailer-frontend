import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getBranches, postBranch, putBranch } from "../controllers/branch-api.controller.js";

export const branchApiRouter = Router();

branchApiRouter.use(requireAuth);

branchApiRouter.get("/", getBranches);
branchApiRouter.post("/", postBranch);
branchApiRouter.put("/:id", putBranch);
