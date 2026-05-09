import { apiPost, ApiError } from "./api-client";

export async function sendInvoiceEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  await apiPost<{ ok: true }>("/api/messaging/email", params);
}

export function isResendNotConfiguredError(e: unknown): boolean {
  return e instanceof ApiError && e.code === "RESEND_NOT_CONFIGURED";
}
