import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { postWhatsApp } from "../controllers/messaging.controller.js";

export const messagingRouter = Router();

messagingRouter.use(requireAuth);

messagingRouter.post("/whatsapp", postWhatsApp);
