/**
 * Canonical phone normalization for CRM lookup / import / OTP last-10 digits.
 * Same rule as backend customer uniqueness and customer-store.findByPhone.
 */
export function normalizePhoneDigits(phone: string): string {
  return String(phone ?? "")
    .replace(/\D/g, "")
    .slice(-10);
}

/** @deprecated Prefer normalizePhoneDigits — kept for import module call sites. */
export function normalizeImportPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}
