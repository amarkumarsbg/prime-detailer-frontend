import type { CustomerImportColumnKey, CustomerImportColumnMapping } from "./types";
import { normalizePhoneDigits } from "@/lib/phone";
export { cellToString } from "@/lib/tabular-import/parse-tabular";

/** Same rule as backend customer.service + customer-store.findByPhone */
export function normalizeImportPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

export function placeholderEmailForPhone(phone: string): string {
  const digits = normalizeImportPhone(phone);
  return `noemail+${digits || "unknown"}@customers.placeholder`;
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
