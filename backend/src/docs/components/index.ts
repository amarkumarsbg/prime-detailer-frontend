import { schemaComponents } from "./schemas.js";
import { responseComponents } from "./responses.js";

export const openApiComponents = {
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Studio JWT from login / OTP verify / change-password. Click Authorize and paste the token only (no `Bearer ` prefix).",
    },
    PlatformAdminKey: {
      type: "apiKey",
      in: "header",
      name: "X-Platform-Admin-Key",
      description:
        "SaaS platform admin key for `/api/platform/*`. Alternative to a PLATFORM_OWNER JWT. Never commit real keys.",
    },
  },
  schemas: schemaComponents,
  responses: responseComponents,
} as const;
