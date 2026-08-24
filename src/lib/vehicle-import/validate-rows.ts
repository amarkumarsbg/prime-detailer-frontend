import type { Customer } from "@/types";
import { normalizeImportPhone, parseFuelType, parseSegment, parseYear } from "./normalize";
import {
  isValidIndianVehicleRegistration,
  registrationDuplicateKey,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import type {
  ParsedVehicleRow,
  ValidatedVehicleImportRow,
  VehicleImportColumnMapping,
} from "./types";

export function applyColumnMapping(
  headers: string[],
  rows: string[][],
  mapping: VehicleImportColumnMapping[]
): ParsedVehicleRow[] {
  const col = (key: VehicleImportColumnMapping["mappedTo"]) =>
    mapping.find((m) => m.mappedTo === key)?.index;

  const registrationCol = col("registrationNumber");
  const phoneCol = col("customerPhone");
  const customerIdCol = col("customerId");
  const customerNameCol = col("customerName");
  const makeCol = col("make");
  const modelCol = col("model");
  const fuelCol = col("fuelType");
  const segmentCol = col("segment");
  const yearCol = col("year");
  const colorCol = col("color");
  const variantCol = col("variant");
  const notesCol = col("notes");

  const parsed: ParsedVehicleRow[] = [];

  rows.forEach((cells, i) => {
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h || `Column ${idx + 1}`] = cells[idx] ?? "";
    });

    const get = (idx: number | undefined) =>
      idx != null ? (cells[idx] ?? "").trim() : "";

    const registrationNumber = get(registrationCol);
    const customerPhone = get(phoneCol);
    const customerId = get(customerIdCol);
    const customerName = get(customerNameCol);
    const make = get(makeCol);
    const model = get(modelCol);
    const fuelType = get(fuelCol);
    const segment = get(segmentCol);
    const year = get(yearCol);
    const color = get(colorCol);
    const variant = get(variantCol);
    const notes = get(notesCol);

    if (
      !registrationNumber &&
      !customerPhone &&
      !customerId &&
      !customerName &&
      !make &&
      !model
    ) {
      return;
    }

    parsed.push({
      rowNumber: i + 2,
      registrationNumber,
      customerPhone,
      customerId,
      customerName,
      make,
      model,
      fuelType,
      segment,
      year,
      color,
      variant,
      notes,
      raw,
    });
  });

  return parsed;
}

function resolveCustomer(
  row: ParsedVehicleRow,
  customers: Customer[]
): { id: string; name: string } | { error: string } {
  if (row.customerId.trim()) {
    const byId = customers.find((c) => c.id === row.customerId.trim());
    if (byId) return { id: byId.id, name: byId.name };
    return { error: "Customer ID not found" };
  }

  const phoneKey = normalizeImportPhone(row.customerPhone);
  if (phoneKey.length === 10) {
    const byPhone = customers.find(
      (c) => normalizeImportPhone(c.phone) === phoneKey
    );
    if (byPhone) return { id: byPhone.id, name: byPhone.name };
    return { error: "No customer with this phone" };
  }

  const name = row.customerName.trim().toLowerCase();
  if (name.length >= 2) {
    const matches = customers.filter((c) => c.name.trim().toLowerCase() === name);
    if (matches.length === 1) return { id: matches[0]!.id, name: matches[0]!.name };
    if (matches.length === 0) return { error: "Customer name not found" };
    return { error: "Multiple customers match this name — use phone or ID" };
  }

  return { error: "Customer phone, ID, or unique name is required" };
}

/**
 * Validate parsed rows. Customers must already exist; duplicates use compact reg key.
 */
export function validateImportRows(
  rows: ParsedVehicleRow[],
  customers: Customer[],
  existingRegKeys: Set<string>
): ValidatedVehicleImportRow[] {
  const seenInFile = new Set<string>();
  const currentYear = new Date().getFullYear();

  return rows.map((row) => {
    const sanitized = sanitizeVehicleRegistrationInput(row.registrationNumber);
    const regKey = registrationDuplicateKey(sanitized);

    if (row.parseUnreliable) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Could not reliably parse this PDF row",
        regKey,
      };
    }

    if (!sanitized) {
      return {
        ...row,
        status: "invalid",
        message: "Registration number is required",
        regKey,
      };
    }

    if (!isValidIndianVehicleRegistration(sanitized)) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Invalid registration number format",
        regKey,
      };
    }

    if (!row.make.trim()) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Make is required",
        regKey,
      };
    }

    if (!row.model.trim()) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Model is required",
        regKey,
      };
    }

    let resolvedFuel = parseFuelType(row.fuelType);
    if (row.fuelType.trim() && !resolvedFuel) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Invalid fuel type",
        regKey,
      };
    }
    resolvedFuel = resolvedFuel ?? "PETROL";

    let resolvedSegment = parseSegment(row.segment);
    if (row.segment.trim() && !resolvedSegment) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "invalid",
        message: "Invalid segment",
        regKey,
      };
    }
    resolvedSegment = resolvedSegment ?? "HATCHBACK";

    let resolvedYear: number | undefined;
    if (row.year.trim()) {
      const y = parseYear(row.year);
      if (y == null) {
        return {
          ...row,
          registrationNumber: sanitized,
          status: "invalid",
          message: "Invalid year",
          regKey,
        };
      }
      resolvedYear = y;
    } else {
      resolvedYear = currentYear;
    }

    const customer = resolveCustomer(row, customers);
    if ("error" in customer) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "unmatched_customer",
        message: customer.error,
        regKey,
      };
    }

    if (existingRegKeys.has(regKey)) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "already_exists",
        message: "Vehicle with this registration already exists",
        regKey,
        resolvedCustomerId: customer.id,
        resolvedCustomerName: customer.name,
      };
    }

    if (seenInFile.has(regKey)) {
      return {
        ...row,
        registrationNumber: sanitized,
        status: "duplicate_in_file",
        message: "Duplicate registration in this file",
        regKey,
        resolvedCustomerId: customer.id,
        resolvedCustomerName: customer.name,
      };
    }

    seenInFile.add(regKey);
    const color = row.color.trim() || "—";

    return {
      ...row,
      registrationNumber: sanitized,
      status: "ready",
      message: "Ready to import",
      regKey,
      resolvedCustomerId: customer.id,
      resolvedCustomerName: customer.name,
      resolvedFuelType: resolvedFuel,
      resolvedSegment,
      resolvedYear,
      resolvedColor: color,
    };
  });
}

export function summarizeImportRows(rows: ValidatedVehicleImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    unmatchedCustomer: rows.filter((r) => r.status === "unmatched_customer").length,
    alreadyExists: rows.filter((r) => r.status === "already_exists").length,
    duplicateInFile: rows.filter((r) => r.status === "duplicate_in_file").length,
  };
}
