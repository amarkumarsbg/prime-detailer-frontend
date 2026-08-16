import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  permNote,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

const collectionParam = {
  name: "collection",
  in: "path",
  required: true,
  schema: { $ref: "#/components/schemas/CollectionName" },
  description:
    "JSON document collection. Permission is mapped per collection (see collection-permissions).",
};

export const collectionPaths: OpenApiPaths = {
  "/api/collections/appSettings/logo": {
    post: {
      tags: ["Settings"],
      summary: "Upload business logo",
      description: `${permNote("SETTINGS")} multipart field \`logo\`.`,
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["logo"],
              properties: { logo: { type: "string", format: "binary" } },
            },
          },
        },
      },
      responses: {
        "200": okResponse({
          type: "object",
          properties: { url: { type: "string" } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}": {
    get: {
      tags: [
        "Collections",
        "Job Cards",
        "Billing",
        "Appointments",
        "Bookings",
        "Pickup/Drop",
        "Services",
        "Inventory",
        "Reports",
        "Settings",
      ],
      summary: "List collection items",
      description:
        "Generic CRUD read over AppJsonRow. Array collections return all items; singletons return the singleton document(s). " +
        "Permissions vary by collection (e.g. jobCards→JOB_CARDS, invoices→BILLING, appointments→APPOINTMENTS, pickupDropRequests→PICKUP_DROP, appSettings→SETTINGS). " +
        "See schemas JobCard, Invoice, Quotation, Appointment/Booking, PickupDropRequest, AppSettings.",
      security: bearerSecurity,
      parameters: [collectionParam],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}/snapshot": {
    post: {
      tags: ["Collections"],
      summary: "Replace array collection snapshot",
      description:
        "Replaces all rows for an array collection. Permission mapped per collection. " +
        "jobCards writes may require JOB_CARD_PRICING when pricing fields change.",
      security: bearerSecurity,
      parameters: [collectionParam],
      requestBody: jsonBody({
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}/{entityId}": {
    put: {
      tags: [
        "Collections",
        "Job Cards",
        "Billing",
        "Appointments",
        "Bookings",
        "Pickup/Drop",
        "Services",
        "Inventory",
        "Settings",
      ],
      summary: "Upsert collection entity",
      description:
        "Upsert one entity. For singletons use entityId=`default`. Structural Zod validation applies to invoices, jobCards, quotations, payroll, membership.",
      security: bearerSecurity,
      parameters: [
        collectionParam,
        { name: "entityId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: jsonBody({
        type: "object",
        additionalProperties: true,
        description: "Payload must be a JSON object; payload.id should match entityId when present",
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Collections"],
      summary: "Delete collection entity",
      description: "Permission mapped per collection.",
      security: bearerSecurity,
      parameters: [
        collectionParam,
        { name: "entityId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};

export const jobCardUploadPaths: OpenApiPaths = {
  "/api/job-cards/{jobCardId}/photos": {
    post: {
      tags: ["Job Cards"],
      summary: "Upload inspection photo",
      description: `${permNote("JOB_CARDS")} multipart field \`photo\`. Query \`type\` is required (BEFORE|AFTER).`,
      security: bearerSecurity,
      parameters: [
        { name: "jobCardId", in: "path", required: true, schema: { type: "string" } },
        {
          name: "type",
          in: "query",
          required: true,
          schema: { type: "string", enum: ["BEFORE", "AFTER"] },
        },
        {
          name: "photoId",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Optional stable photo id; generated when omitted",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["photo"],
              properties: {
                photo: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: {
        "201": okResponse({
          type: "object",
          properties: { url: { type: "string" } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const quotationPaths: OpenApiPaths = {
  "/api/quotations/convert-to-job": {
    post: {
      tags: ["Quotations", "Job Cards"],
      summary: "Convert quotation to job card",
      description: permNote("QUOTATIONS", "Atomically persists job card + updated quotation."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["jobCard", "quotation"],
        properties: {
          jobCard: { type: "object", additionalProperties: true },
          quotation: { type: "object", additionalProperties: true },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};
