import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUsers, postUser, putUser } from "../controllers/user-api.controller.js";

export const userApiRouter = Router();

userApiRouter.use(requireAuth);

userApiRouter.get("/", getUsers);
userApiRouter.post("/", postUser);
userApiRouter.put("/:id", putUser);
