import type { CustomerImportColumnKey, CustomerImportColumnMapping } from "./types";

/** Same rule as backend customer.service + customer-store.findByPhone */
export function normalizeImportPhone(phone: string): string {
  return String(phone ?? "")
    .replace(/\D/g, "")
    .slice(-10);
}

export function placeholderEmailForPhone(phone: string): string {
  const digits = normalizeImportPhone(phone);
  return `noemail+${digits || "unknown"}@customers.placeholder`;
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    // Avoid scientific notation for phone numbers stored as numbers
    if (Number.isInteger(value) && Math.abs(value) >= 1e9) {
      return String(Math.trunc(value));
    }
    return String(value).trim();
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

const NAME_ALIASES = new Set([
  "name",
  "customer name",
  "customer",
  "full name",
  "fullname",
  "client name",
  "client",
  "party name",
]);

const PHONE_ALIASES = new Set([
  "phone",
  "phone number",
  "mobile",
  "mobile number",
  "mobile no",
  "mobile no.",
  "contact",
  "contact number",
  "contact no",
  "whatsapp",
  "whatsapp number",
  "cell",
  "cellphone",
]);

const EMAIL_ALIASES = new Set(["email", "email address", "e-mail", "mail"]);

const ADDRESS_ALIASES = new Set([
  "address",
  "full address",
  "customer address",
  "location",
  "city",
]);

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ");
}

export function guessColumnKey(header: string): CustomerImportColumnKey {
  const h = normalizeHeader(header);
  if (!h) return "ignore";
  if (NAME_ALIASES.has(h)) return "name";
  if (PHONE_ALIASES.has(h)) return "phone";
  if (EMAIL_ALIASES.has(h)) return "email";
  if (ADDRESS_ALIASES.has(h)) return "address";
  if (h.includes("phone") || h.includes("mobile") || h.includes("whatsapp")) return "phone";
  if (h.includes("email") || h.includes("mail")) return "email";
  if (h.includes("address")) return "address";
  if (h === "name" || h.endsWith(" name") || h.includes("customer")) return "name";
  return "ignore";
}

/** Prefer first match for each field; later duplicates become ignore. */
export function buildAutoMapping(headers: string[]): CustomerImportColumnMapping[] {
  const used = new Set<CustomerImportColumnKey>();
  return headers.map((header, index) => {
    let mappedTo = guessColumnKey(header);
    if (mappedTo !== "ignore") {
      if (used.has(mappedTo)) mappedTo = "ignore";
      else used.add(mappedTo);
    }
    return { header, index, mappedTo };
  });
}

export function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
