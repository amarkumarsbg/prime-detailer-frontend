import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { postConvertQuotationToJob } from "../controllers/quotation-convert.controller.js";

export const quotationRouter = Router();

quotationRouter.use(requireAuth);
quotationRouter.use(requirePermission("QUOTATIONS"));
quotationRouter.post("/convert-to-job", postConvertQuotationToJob);
