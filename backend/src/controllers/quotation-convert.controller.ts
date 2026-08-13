import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { convertQuotationToJob } from "../services/quotation-convert.service.js";

const bodySchema = z.object({
  jobCard: z.record(z.string(), z.unknown()),
  quotation: z.record(z.string(), z.unknown()),
});

/**
 * Atomically persist a new job card and the converted quotation.
 */
export async function postConvertQuotationToJob(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bodySchema.parse(req.body);
    await convertQuotationToJob(body);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
