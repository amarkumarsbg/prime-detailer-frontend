import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  permNote,
  platformSecurity,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

export const messagingPaths: OpenApiPaths = {
  "/api/messaging/sms/test": {
    post: {
      tags: ["Messaging"],
      summary: "Send test SMS",
      description: permNote("SETTINGS", "Uses a fixed server test body."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/whatsapp/test": {
    post: {
      tags: ["Messaging"],
      summary: "Send test WhatsApp",
      description: permNote("SETTINGS", "Uses a fixed server test body."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/whatsapp": {
    post: {
      tags: ["Messaging"],
      summary: "Send transactional WhatsApp",
      description:
        "Requires JWT (any authenticated staff). Provide exactly one of `message` or `contentSid`.",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
          message: { type: "string", maxLength: 16384 },
          contentSid: { type: "string" },
          contentVariables: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/email": {
    post: {
      tags: ["Messaging", "Billing"],
      summary: "Send transactional email (e.g. invoice)",
      description: "Requires JWT. Uses Resend. Attachments are base64 (do not paste secrets).",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["to", "subject", "html"],
        properties: {
          to: { type: "string", format: "email" },
          subject: { type: "string", maxLength: 200 },
          html: { type: "string" },
          text: { type: "string" },
          attachments: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              required: ["filename", "content"],
              properties: {
                filename: { type: "string" },
                content: { type: "string", description: "Base64 file content" },
              },
            },
          },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "413": { $ref: "#/components/responses/PayloadTooLarge" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
};

export const attendancePaths: OpenApiPaths = {
  "/api/attendance": {
    get: {
      tags: ["Attendance"],
      summary: "List attendance records",
      description: permNote("ATTENDANCE"),
      security: bearerSecurity,
      parameters: [
        {
          name: "branchId",
          in: "query",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            records: {
              type: "array",
              items: ref("AttendanceRecord"),
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Attendance"],
      summary: "Reset all attendance records",
      description: permNote("ATTENDANCE", "Destructive admin reset."),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            ok: { type: "boolean" },
            records: { type: "array", items: {} },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const bootstrapPaths: OpenApiPaths = {
  "/api/bootstrap": {
    get: {
      tags: ["Bootstrap"],
      summary: "Shell bootstrap (thin)",
      description:
        "Requires JWT. Returns org-scoped branches, public branding (from appSettings), and subscription entitlement. " +
        "Does **not** return customers, vehicles, users, payroll, cash/bank, or other domain collections — load those via permission-scoped entity/collection APIs.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            branches: { type: "array", items: { type: "object", additionalProperties: true } },
            branding: {
              type: "object",
              description: "Public branding fields only (no bank/GST/PAN secrets)",
              additionalProperties: { type: "string" },
            },
            entitlement: { type: "object", additionalProperties: true, nullable: true },
          },
          required: ["branches", "branding"],
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const organizationPaths: OpenApiPaths = {
  "/api/organization/subscription": {
    get: {
      tags: ["Organization"],
      summary: "Studio subscription entitlement",
      description: "Requires JWT. Returns plan limits/status for the caller's organization (no internal notes).",
      security: bearerSecurity,
      responses: {
        "200": okResponse(ref("Organization")),
        ...commonErrorResponses(),
      },
    },
  },
};

export const platformPaths: OpenApiPaths = {
  "/api/platform/organizations": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List all organizations (platform)",
      description:
        "Requires PLATFORM_OWNER JWT **or** `X-Platform-Admin-Key`. Studio SUPER_ADMIN is not sufficient.",
      security: platformSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            organizations: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}": {
    get: {
      tags: ["SaaS Admin"],
      summary: "Get organization (platform)",
      description: "PLATFORM_OWNER JWT or X-Platform-Admin-Key.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/subscription": {
    patch: {
      tags: ["SaaS Admin"],
      summary: "Patch organization subscription",
      description: "PLATFORM_OWNER JWT or X-Platform-Admin-Key. Updates plan/limits/CTAs.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: jsonBody({
        type: "object",
        properties: {
          planCode: {
            type: "string",
            enum: ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE", "CUSTOM"],
          },
          planName: { type: "string" },
          status: {
            type: "string",
            enum: ["ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED"],
          },
          limits: {
            type: "object",
            properties: {
              maxBranches: { type: "integer", nullable: true },
              maxStaff: { type: "integer", nullable: true },
              maxCustomers: { type: "integer", nullable: true },
            },
          },
          maxBranchesOverride: { type: "integer", nullable: true },
          contactUsUrl: { type: "string", nullable: true },
          contactPhone: { type: "string", nullable: true },
          upgradeUrl: { type: "string", nullable: true },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
};
