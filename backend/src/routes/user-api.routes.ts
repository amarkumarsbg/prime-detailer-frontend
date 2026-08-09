import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { getUsers, postUser, putUser } from "../controllers/user-api.controller.js";

export const userApiRouter = Router();

userApiRouter.use(requireAuth);
userApiRouter.use(requirePermission("STAFF"));

userApiRouter.get("/", getUsers);
userApiRouter.post("/", postUser);
userApiRouter.put("/:id", putUser);
