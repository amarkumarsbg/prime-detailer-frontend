import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  postSmsTest,
  postTransactionalEmail,
  postWhatsApp,
  postWhatsAppTest,
} from "../controllers/messaging.controller.js";

export const messagingRouter = Router();

messagingRouter.use(requireAuth);

messagingRouter.post("/sms/test", postSmsTest);
messagingRouter.post("/whatsapp/test", postWhatsAppTest);
messagingRouter.post("/whatsapp", postWhatsApp);
messagingRouter.post("/email", postTransactionalEmail);
