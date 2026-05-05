import { apiPost, ApiError } from "./api-client";
import { whatsappDigits } from "./booking-confirmation-message";

export async function sendCustomerWhatsApp(phone: string, message: string): Promise<void> {
  await apiPost<{ ok: true }>("/api/messaging/whatsapp", { phone, message });
}

export function openWhatsAppComposer(phone: string, message: string): void {
  const url = `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function isWhatsAppNotConfiguredError(e: unknown): boolean {
  return e instanceof ApiError && e.code === "WHATSAPP_NOT_CONFIGURED";
}
