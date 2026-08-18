import { z } from "zod";

/**
 * Structural validators for high-risk AppJsonRow collections.
 * Use `.passthrough()` so legacy/optional fields are not rejected.
 */

const nonEmptyString = z.string().min(1);

export const invoicePayloadSchema = z
  .object({
    id: nonEmptyString,
    invoiceNumber: nonEmptyString,
    jobCardId: z.string().optional(),
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    status: z.string().min(1),
    subtotal: z.number(),
    taxRate: z.number(),
    taxAmount: z.number(),
    grandTotal: z.number(),
    lineItems: z.array(z.record(z.string(), z.unknown())),
    payments: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const jobCardPayloadSchema = z
  .object({
    id: nonEmptyString,
    jobNumber: nonEmptyString,
    branchId: nonEmptyString,
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    vehicleId: nonEmptyString,
    vehicleRegNumber: z.string(),
    vehicleMakeModel: z.string(),
    status: z.string().min(1),
    services: z.array(z.record(z.string(), z.unknown())),
    estimatedAmount: z.number(),
  })
  .passthrough();

export const quotationPayloadSchema = z
  .object({
    id: nonEmptyString,
    quotationNumber: nonEmptyString,
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    status: z.string().min(1),
    services: z.array(z.record(z.string(), z.unknown())),
    subtotal: z.number(),
    taxRate: z.number(),
    taxAmount: z.number(),
    grandTotal: z.number(),
  })
  .passthrough();

/** Singleton payroll document (`entityId = default`). */
export const payrollPayloadSchema = z
  .object({
    salaryStructures: z.array(z.unknown()).optional(),
    payrollRecords: z.array(z.unknown()).optional(),
    salaryAdvances: z.array(z.unknown()).optional(),
    salaryAdvanceRecoveries: z.array(z.unknown()).optional(),
  })
  .passthrough();

/** Singleton membership document (`entityId = default`). */
export const membershipPayloadSchema = z
  .object({
    packages: z.array(z.unknown()).optional(),
    subscriptions: z.array(z.unknown()).optional(),
  })
  .passthrough();

const COLLECTION_PAYLOAD_SCHEMAS: Record<string, z.ZodType<object>> = {
  invoices: invoicePayloadSchema,
  jobCards: jobCardPayloadSchema,
  quotations: quotationPayloadSchema,
  payroll: payrollPayloadSchema,
  membership: membershipPayloadSchema,
};

export function parseCollectionPayload(collection: string, payload: unknown): object {
  const schema = COLLECTION_PAYLOAD_SCHEMAS[collection];
  if (!schema) {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [],
          message: "Body must be a JSON object",
        },
      ]);
    }
    return payload as object;
  }
  return schema.parse(payload) as object;
}

/** For array snapshots: validate each item when a schema exists. */
export function parseCollectionSnapshotItems(
  collection: string,
  items: unknown[]
): { id: string }[] {
  const schema = COLLECTION_PAYLOAD_SCHEMAS[collection];
  const out: { id: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== "object" || Array.isArray(it)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [i],
          message: "Each item must be an object with string id",
        },
      ]);
    }
    const id = (it as { id?: unknown }).id;
    if (typeof id !== "string" || !id) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [i, "id"],
          message: "Each item must have string id",
        },
      ]);
    }
    if (schema) {
      out.push(schema.parse(it) as { id: string });
    } else {
      out.push(it as { id: string });
    }
  }
  return out;
}

export function assertPayloadEntityIdMatch(
  collection: string,
  entityId: string,
  payload: object
): void {
  if (collection === "payroll" || collection === "membership") return;
  if (!("id" in payload)) return;
  const id = (payload as { id?: unknown }).id;
  if (typeof id === "string" && id !== entityId) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["id"],
        message: `payload.id must match URL entityId (${entityId})`,
      },
    ]);
  }
}
