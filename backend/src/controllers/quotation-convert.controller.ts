import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const bodySchema = z.object({
  jobCard: z.record(z.string(), z.unknown()),
  quotation: z.record(z.string(), z.unknown()),
});

/**
 * Atomically persist a new job card and the converted quotation in AppJsonRow
 * (collection jobCards + collection quotations).
 */
export async function postConvertQuotationToJob(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bodySchema.parse(req.body);
    const jobCard = body.jobCard;
    const quotation = body.quotation;

    const jobId = jobCard.id;
    const quotationId = quotation.id;
    const jobQuotationId = jobCard.quotationId;
    const convertedTo = quotation.convertedToJobCardId;
    const status = quotation.status;

    if (typeof jobId !== "string" || !jobId) {
      res.status(400).json({ data: null, error: { message: "jobCard.id must be a non-empty string" } });
      return;
    }
    if (typeof quotationId !== "string" || !quotationId) {
      res.status(400).json({ data: null, error: { message: "quotation.id must be a non-empty string" } });
      return;
    }
    if (jobQuotationId !== quotationId) {
      res.status(400).json({
        data: null,
        error: { message: "jobCard.quotationId must equal quotation.id" },
      });
      return;
    }
    if (convertedTo !== jobId) {
      res.status(400).json({
        data: null,
        error: { message: "quotation.convertedToJobCardId must match jobCard.id" },
      });
      return;
    }
    if (status !== "CONVERTED") {
      res.status(400).json({
        data: null,
        error: { message: "quotation.status must be CONVERTED" },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.appJsonRow.upsert({
        where: { collection_entityId: { collection: "jobCards", entityId: jobId } },
        create: { collection: "jobCards", entityId: jobId, payload: jobCard as object },
        update: { payload: jobCard as object },
      });
      await tx.appJsonRow.upsert({
        where: { collection_entityId: { collection: "quotations", entityId: quotationId } },
        create: { collection: "quotations", entityId: quotationId, payload: quotation as object },
        update: { payload: quotation as object },
      });
    });

    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
