import {
  isValidEmail,
  normalizeImportPhone,
  placeholderEmailForPhone,
} from "./normalize";
import type {
  CustomerImportColumnMapping,
  ParsedCustomerRow,
  ValidatedCustomerImportRow,
} from "./types";

export function applyColumnMapping(
  headers: string[],
  rows: string[][],
  mapping: CustomerImportColumnMapping[]
): ParsedCustomerRow[] {
  const nameCol = mapping.find((m) => m.mappedTo === "name")?.index;
  const phoneCol = mapping.find((m) => m.mappedTo === "phone")?.index;
  const emailCol = mapping.find((m) => m.mappedTo === "email")?.index;
  const addressCol = mapping.find((m) => m.mappedTo === "address")?.index;

  const parsed: ParsedCustomerRow[] = [];

  rows.forEach((cells, i) => {
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h || `Column ${idx + 1}`] = cells[idx] ?? "";
    });

    const name = nameCol != null ? (cells[nameCol] ?? "").trim() : "";
    const phone = phoneCol != null ? (cells[phoneCol] ?? "").trim() : "";
    let email = emailCol != null ? (cells[emailCol] ?? "").trim() : "";
    const address = addressCol != null ? (cells[addressCol] ?? "").trim() : "";

    // Skip completely empty rows
    if (!name && !phone && !email && !address) return;

    if (!email && phone) {
      email = placeholderEmailForPhone(phone);
    }

    parsed.push({
      rowNumber: i + 2, // assume row 1 is header
      name,
      phone,
      email,
      address,
      raw,
    });
  });

  return parsed;
}

/**
 * Validate parsed rows against existing customers (by last-10 phone digits).
 * `existingPhoneKeys` should already be normalized last-10 digit strings.
 */
export function validateImportRows(
  rows: ParsedCustomerRow[],
  existingPhoneKeys: Set<string>
): ValidatedCustomerImportRow[] {
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const phoneKey = normalizeImportPhone(row.phone);
    const name = row.name.trim();

    if (!name) {
      return {
        ...row,
        status: "invalid",
        message: "Name is required",
        phoneKey,
      };
    }

    if (phoneKey.length !== 10) {
      return {
        ...row,
        status: "invalid",
        message: "Phone must contain 10 digits",
        phoneKey,
      };
    }

    if (row.email && !isValidEmail(row.email) && !row.email.endsWith("@customers.placeholder")) {
      return {
        ...row,
        status: "invalid",
        message: "Invalid email address",
        phoneKey,
      };
    }

    if (existingPhoneKeys.has(phoneKey)) {
      return {
        ...row,
        status: "already_exists",
        message: "Customer with this phone already exists",
        phoneKey,
      };
    }

    if (seenInFile.has(phoneKey)) {
      return {
        ...row,
        status: "duplicate_in_file",
        message: "Duplicate phone in this file",
        phoneKey,
      };
    }

    seenInFile.add(phoneKey);
    return {
      ...row,
      status: "ready",
      message: "Ready to import",
      phoneKey,
    };
  });
}

export function summarizeImportRows(rows: ValidatedCustomerImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    alreadyExists: rows.filter((r) => r.status === "already_exists").length,
    duplicateInFile: rows.filter((r) => r.status === "duplicate_in_file").length,
  };
}
