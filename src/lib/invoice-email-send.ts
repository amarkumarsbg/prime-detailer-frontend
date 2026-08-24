import { apiPost, ApiError } from "./api-client";
import { useCommunicationStore } from "@/store/communication-store";
import type { CustomerMessage } from "@/types";

export type InvoiceEmailAttachment = {
  filename: string;
  content: string;
};

export async function sendInvoiceEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: InvoiceEmailAttachment[];
}): Promise<CustomerMessage | null> {
  const res = await apiPost<{ ok: true; message?: CustomerMessage }>("/api/messaging/email", params);
  if (res.message) {
    useCommunicationStore.getState().addMessage(res.message);
    return res.message;
  }
  return null;
}

export function isResendNotConfiguredError(e: unknown): boolean {
  return e instanceof ApiError && e.code === "RESEND_NOT_CONFIGURED";
}
