import type { Vehicle } from "@/types";

/** Normalizes registration for duplicate checks (case- and space-insensitive). */
export function normalizeRegistrationNumber(reg: string): string {
  return reg.trim().toUpperCase().replace(/\s/g, "");
}

/** Compact key for import/export duplicate checks (ignores spaces and hyphens). */
export function registrationDuplicateKey(reg: string): string {
  return normalizeRegistrationNumber(reg).replace(/-/g, "");
}

export function findVehicleByNormalizedReg(vehicles: Vehicle[], registrationInput: string): Vehicle | undefined {
  const key = registrationDuplicateKey(registrationInput);
  return vehicles.find((v) => registrationDuplicateKey(v.registrationNumber) === key);
}

/** Short message for inline form errors. */
export const INDIAN_VEHICLE_REG_ERROR_SHORT =
  "Invalid plate. Use format like KA-01-AB-1234, UP-12-UP-12, or 22BH5678KA (letters, digits, hyphens only).";

/** Longer hint for toasts / helper text. */
export const INDIAN_VEHICLE_REG_HINT =
  "Format: KA-01-AB-1234 or 22BH1234AA (letters, numbers, hyphens only)";

/** Strips invalid characters while typing; caps length for typical plates. */
export function sanitizeVehicleRegistrationInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 16);
}

/** Compact form (no spaces/hyphens) for pattern checks. */
export function compactRegistrationForValidation(reg: string): string {
  return normalizeRegistrationNumber(reg).replace(/-/g, "");
}

/**
 * Common Indian formats, compact: state + district + series + number, or BH series.
 * - Standard: LL + 1–2 digits + 1–3 letters + 2–4 digits (e.g. KA01AB1234, UP12UP12)
 * - Bharat: DD + BH + 4 digits + LL (e.g. 22BH5678KA)
 */
export function isValidIndianVehicleRegistration(reg: string): boolean {
  if (!reg || typeof reg !== "string") return false;
  const trimmed = reg.trim();
  // Allow only letters, digits, and hyphens (no spaces in the middle, no other special characters)
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) return false;

  const c = trimmed.toUpperCase().replace(/-/g, "");
  // Allow 9-character and 10-character patterns, but keep typical limits (e.g. 7 to 13 characters)
  if (c.length < 7 || c.length > 13) return false;

  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}[A-Z0-9]?$/;
  const bhSeries = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  return standard.test(c) || bhSeries.test(c);
}
