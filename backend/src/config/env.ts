import "dotenv/config";
import { z } from "zod";

/** Trim and treat empty string as unset (common .env copy/paste issue). */
function trimOpt(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  /** Account SID (AC…). Required for SMS when using Twilio. */
  TWILIO_ACCOUNT_SID: z.string().optional(),
  /** Primary auth token — OR use API key SID + secret below (not both required in .env; one path is enough). */
  TWILIO_AUTH_TOKEN: z.string().optional(),
  /** API key SID (SK…) + secret — preferred over auth token when using restricted keys. */
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  /** E.164 sender, e.g. +15005550006 (trial) or your Twilio number */
  TWILIO_FROM_NUMBER: z.string().optional(),
  /**
   * WhatsApp-enabled sender from Twilio, e.g. whatsapp:+14155238886 (sandbox) or whatsapp:+91… after approval.
   * Required only for server-side WhatsApp API; SMS OTP still uses TWILIO_FROM_NUMBER.
   */
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  /** Default +91; set +1 etc. if your users are not in India */
  TWILIO_TO_NUMBER_PREFIX: z.string().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  TWILIO_ACCOUNT_SID: trimOpt(process.env.TWILIO_ACCOUNT_SID),
  TWILIO_AUTH_TOKEN: trimOpt(process.env.TWILIO_AUTH_TOKEN),
  TWILIO_API_KEY_SID: trimOpt(process.env.TWILIO_API_KEY_SID),
  TWILIO_API_KEY_SECRET: trimOpt(process.env.TWILIO_API_KEY_SECRET),
  TWILIO_FROM_NUMBER: trimOpt(process.env.TWILIO_FROM_NUMBER),
  TWILIO_WHATSAPP_FROM: trimOpt(process.env.TWILIO_WHATSAPP_FROM),
  TWILIO_TO_NUMBER_PREFIX: trimOpt(process.env.TWILIO_TO_NUMBER_PREFIX),
});
