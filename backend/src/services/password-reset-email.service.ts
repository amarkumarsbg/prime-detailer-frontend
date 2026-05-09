import { env } from "../config/env.js";

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

export type SendPasswordResetEmailResult =
  | { ok: true }
  | { ok: false; detail: string };

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

/** Sends via Resend; returns why it failed when not ok (for operator/dev messages). */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<SendPasswordResetEmailResult> {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, detail: "RESEND_API_KEY is not set" };

  /** Resend rejects random From addresses unless the domain is verified — default is safest for trials. */
  const from = env.MAIL_FROM ?? "Prime Detailers <onboarding@resend.dev>";
  const safeUrl = resetUrl.trim();
  const hrefAttr = safeUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "Reset your Prime Detailers password",
        html: `
          <p>You requested to reset your password for Prime Detailers.</p>
          <p><a href="${hrefAttr}">Choose a new password</a></p>
          <p>If you didn't request this, you can safely ignore this message.</p>
          <p style="font-size:12px;color:#666;">This link expires in about one hour.</p>
        `,
        text: `Choose a new password (${safeUrl})\nIf you didn't request this, ignore this email. This link expires in about one hour.`,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      const detail = summarizeResendError(res.status, txt);
      console.error("[password-reset-email] Resend error:", detail);
      return { ok: false, detail };
    }
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[password-reset-email] Resend fetch failed:", e);
    return { ok: false, detail };
  }
}
