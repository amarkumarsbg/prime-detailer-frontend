import { env } from "../config/env.js";

export type ResendSendResult = { ok: true } | { ok: false; detail: string };

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function summarizeResendError(status: number, bodyText: string): string {
  const snippet = bodyText.trim().slice(0, 400);
  try {
    const j = JSON.parse(bodyText) as { message?: unknown };
    if (typeof j.message === "string" && j.message.length > 0) {
      return `${status}: ${j.message}`;
    }
  } catch {
    /* plain text body */
  }
  return snippet ? `${status}: ${snippet}` : `${status}: empty response from Resend`;
}

/** Sends via Resend REST API (same transport as password-reset mail). */
export async function sendViaResend(params: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<ResendSendResult> {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, detail: "RESEND_API_KEY is not set" };

  const from = env.MAIL_FROM ?? "Prime Detailers <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text?.trim() ? { text: params.text.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      const detail = summarizeResendError(res.status, txt);
      console.error("[resend] send error:", detail);
      return { ok: false, detail };
    }
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[resend] fetch failed:", e);
    return { ok: false, detail };
  }
}
