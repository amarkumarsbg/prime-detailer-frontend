import twilio from "twilio";
import { env } from "../config/env.js";

let client: ReturnType<typeof twilio> | null = null;

function isTwilioConfigured(): boolean {
  const account = Boolean(env.TWILIO_ACCOUNT_SID?.trim());
  const token = Boolean(env.TWILIO_AUTH_TOKEN?.trim());
  const apiKey = Boolean(
    env.TWILIO_API_KEY_SID?.trim() && env.TWILIO_API_KEY_SECRET?.trim()
  );
  return account && (token || apiKey);
}

function getClient() {
  if (!client) {
    const accountSid = env.TWILIO_ACCOUNT_SID!.trim();
    const keySid = env.TWILIO_API_KEY_SID?.trim();
    const keySecret = env.TWILIO_API_KEY_SECRET?.trim();
    if (keySid && keySecret) {
      client = twilio(keySid, keySecret, { accountSid });
    } else {
      const token = env.TWILIO_AUTH_TOKEN?.trim();
      if (!token) {
        throw new Error(
          "Twilio: set TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET"
        );
      }
      client = twilio(accountSid, token);
    }
  }
  return client;
}

export function isTwilioSmsEnabled(): boolean {
  const from = Boolean(env.TWILIO_FROM_NUMBER?.trim());
  return isTwilioConfigured() && from;
}

/** WhatsApp uses the same Twilio account; sender is the WhatsApp-enabled number (sandbox or approved). */
export function isTwilioWhatsAppEnabled(): boolean {
  const from = Boolean(env.TWILIO_WHATSAPP_FROM?.trim());
  return isTwilioConfigured() && from;
}

/** National number without country code (e.g. 10 digits for India). */
export function toE164(nationalDigits: string): string {
  const raw = (env.TWILIO_TO_NUMBER_PREFIX ?? "+91").trim();
  const prefix = raw.startsWith("+") ? raw : `+${raw}`;
  const digits = nationalDigits.replace(/\D/g, "");
  return `${prefix}${digits}`;
}

/** Normalize UI / customer phone to E.164 for Twilio (SMS or WhatsApp). */
export function normalizePhoneToE164(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length >= 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return toE164(digits);
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return toE164(digits);
}

function whatsappChannelAddress(raw: string): string {
  const t = raw.trim();
  if (/^whatsapp:/i.test(t)) return t;
  const inner = t.startsWith("+") ? `+${t.replace(/\D/g, "")}` : `+${t.replace(/\D/g, "")}`;
  return `whatsapp:${inner}`;
}

export async function sendLoginOtpSms(
  e164To: string,
  code: string
): Promise<{ sid: string; status: string }> {
  const from = env.TWILIO_FROM_NUMBER!.trim();
  const msg = await getClient().messages.create({
    body: `Your Prime Detailers login code is ${code}. Valid 10 minutes. Do not share this code.`,
    from,
    to: e164To,
  });
  return { sid: msg.sid, status: msg.status ?? "unknown" };
}

/** Reuse for appointment/reminder SMS once Twilio is configured. */
export async function sendTransactionalSms(e164To: string, messageBody: string): Promise<void> {
  if (!isTwilioSmsEnabled()) {
    throw new Error(
      "Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER, and either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET)"
    );
  }
  await getClient().messages.create({
    body: messageBody,
    from: env.TWILIO_FROM_NUMBER!.trim(),
    to: e164To,
  });
}

/** Approved WhatsApp template (Content API) — use outside session / for utility messages. */
export type WhatsAppTemplateSend = {
  contentSid: string;
  /** Twilio expects JSON like `{ "1": "…", "2": "…" }` — string keys must match template variables. */
  contentVariables?: Record<string, string>;
};

/**
 * Send WhatsApp via Twilio.
 * - Pass a string for a free-form `body` (session / sandbox).
 * - Pass `{ contentSid, contentVariables }` for an approved template (matches Twilio Console Content).
 */
export async function sendWhatsAppMessage(
  toPhoneInput: string,
  messageBodyOrTemplate: string | WhatsAppTemplateSend
): Promise<{ sid: string; status: string }> {
  if (!isTwilioWhatsAppEnabled()) {
    throw new Error(
      "Twilio WhatsApp is not configured (set TWILIO_WHATSAPP_FROM=whatsapp:+… with the same account credentials as SMS)"
    );
  }
  const e164 = normalizePhoneToE164(toPhoneInput);
  const to = whatsappChannelAddress(e164);
  const from = whatsappChannelAddress(env.TWILIO_WHATSAPP_FROM!.trim());

  const isTemplate = typeof messageBodyOrTemplate === "object" && messageBodyOrTemplate !== null;

  const msg = isTemplate
    ? await getClient().messages.create({
        from,
        to,
        contentSid: messageBodyOrTemplate.contentSid.trim(),
        ...(messageBodyOrTemplate.contentVariables &&
        Object.keys(messageBodyOrTemplate.contentVariables).length > 0
          ? {
              contentVariables: JSON.stringify(messageBodyOrTemplate.contentVariables),
            }
          : {}),
      })
    : await getClient().messages.create({
        from,
        to,
        body: messageBodyOrTemplate,
      });

  return { sid: msg.sid, status: msg.status ?? "unknown" };
}
