import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { postConvertQuotationToJob } from "../controllers/quotation-convert.controller.js";

export const quotationRouter = Router();

quotationRouter.use(requireAuth);
quotationRouter.post("/convert-to-job", postConvertQuotationToJob);
