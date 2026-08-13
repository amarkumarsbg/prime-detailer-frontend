import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { jobCardPayloadSchema, quotationPayloadSchema } from "../validations/collection-payloads.js";

export type ConvertQuotationInput = {
  jobCard: Record<string, unknown>;
  quotation: Record<string, unknown>;
};

/**
 * Atomically persist a new job card and the converted quotation in AppJsonRow.
 */
export async function convertQuotationToJob(input: ConvertQuotationInput): Promise<void> {
  const jobCard = jobCardPayloadSchema.parse(input.jobCard) as Record<string, unknown>;
  const quotation = quotationPayloadSchema.parse(input.quotation) as Record<string, unknown>;

  const jobId = jobCard.id;
  const quotationId = quotation.id;
  const jobQuotationId = jobCard.quotationId;
  const convertedTo = quotation.convertedToJobCardId;
  const status = quotation.status;

  if (typeof jobId !== "string" || !jobId) {
    throw AppError.validation("jobCard.id must be a non-empty string");
  }
  if (typeof quotationId !== "string" || !quotationId) {
    throw AppError.validation("quotation.id must be a non-empty string");
  }
  if (jobQuotationId !== quotationId) {
    throw AppError.validation("jobCard.quotationId must equal quotation.id");
  }
  if (convertedTo !== jobId) {
    throw AppError.validation("quotation.convertedToJobCardId must match jobCard.id");
  }
  if (status !== "CONVERTED") {
    throw AppError.validation("quotation.status must be CONVERTED");
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
}
