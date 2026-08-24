import type { FuelType, VehicleSegment } from "@/types";
import type { VehicleImportColumnKey, VehicleImportColumnMapping } from "./types";
import { normalizePhoneDigits } from "@/lib/phone";
export { cellToString } from "@/lib/tabular-import/parse-tabular";

export function normalizeImportPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ");
}

const REG_ALIASES = new Set([
  "registration",
  "registration number",
  "registration no",
  "reg",
  "reg no",
  "reg number",
  "regn",
  "regn no",
  "vehicle number",
  "vehicle no",
  "vehicle registration",
  "veh no",
  "veh number",
  "number plate",
  "plate",
  "plate number",
  "plate no",
  "vahan",
  "rc number",
  "rc no",
]);

const CUSTOMER_PHONE_ALIASES = new Set([
  "customer phone",
  "customer mobile",
  "owner phone",
  "owner mobile",
  "phone",
  "phone number",
  "phone no",
  "mobile",
  "mobile number",
  "mobile no",
  "contact",
  "contact number",
  "contact no",
  "whatsapp",
  "cust phone",
  "cust mobile",
]);

const CUSTOMER_ID_ALIASES = new Set([
  "customer id",
  "customerid",
  "cust id",
  "owner id",
]);

const CUSTOMER_NAME_ALIASES = new Set([
  "customer",
  "customer name",
  "cust name",
  "owner",
  "owner name",
  "client",
  "client name",
  "party",
  "party name",
  "name",
]);

const MAKE_ALIASES = new Set([
  "make",
  "brand",
  "manufacturer",
  "oem",
  "car make",
  "vehicle make",
  "company",
]);
const MODEL_ALIASES = new Set([
  "model",
  "car model",
  "vehicle model",
  "variant model",
]);
const FUEL_ALIASES = new Set(["fuel", "fuel type", "fueltype"]);
const SEGMENT_ALIASES = new Set([
  "segment",
  "body type",
  "bodytype",
  "vehicle type",
  "vehicletype",
  "category",
]);
const YEAR_ALIASES = new Set(["year", "model year", "yom", "mfg year", "manufacture year"]);
const COLOR_ALIASES = new Set(["color", "colour"]);
const VARIANT_ALIASES = new Set(["variant", "trim", "version"]);
const NOTES_ALIASES = new Set(["notes", "note", "remarks", "remark", "comment"]);

export function guessColumnKey(header: string): VehicleImportColumnKey {
  const h = normalizeHeader(header);
  if (!h || /^column \d+$/.test(h)) return "ignore";

  if (
    REG_ALIASES.has(h) ||
    h.includes("registration") ||
    h.includes("number plate") ||
    (h.includes("plate") && !h.includes("template")) ||
    (h.includes("veh") && (h.includes("no") || h.includes("num") || h.includes("reg"))) ||
    h === "rc" ||
    h.startsWith("rc ")
  ) {
    return "registrationNumber";
  }
  if (CUSTOMER_ID_ALIASES.has(h) || (h.includes("customer") && h.includes("id"))) {
    return "customerId";
  }
  if (
    CUSTOMER_PHONE_ALIASES.has(h) ||
    h.includes("phone") ||
    h.includes("mobile") ||
    h.includes("whatsapp")
  ) {
    return "customerPhone";
  }
  if (
    CUSTOMER_NAME_ALIASES.has(h) ||
    (h.includes("customer") && h.includes("name")) ||
    h.includes("owner")
  ) {
    return "customerName";
  }
  if (h === "customer" || h === "cust") return "customerName";
  if (MAKE_ALIASES.has(h) || h.includes("brand") || h.includes("manufacturer")) return "make";
  if (MODEL_ALIASES.has(h) || (h.includes("model") && !h.includes("year"))) return "model";
  if (FUEL_ALIASES.has(h) || h.includes("fuel")) return "fuelType";
  if (SEGMENT_ALIASES.has(h) || h.includes("segment") || h.includes("body type")) {
    return "segment";
  }
  if (YEAR_ALIASES.has(h) || h === "yr") return "year";
  if (COLOR_ALIASES.has(h)) return "color";
  if (VARIANT_ALIASES.has(h)) return "variant";
  if (NOTES_ALIASES.has(h)) return "notes";
  return "ignore";
}

function looksLikeReg(value: string): boolean {
  const c = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length < 8 || c.length > 13) return false;
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{2,4}$/.test(c) || /^[0-9]{2}BH[0-9]{4}[A-Z]{2}$/.test(c);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, "").slice(-10).length === 10;
}

/**
 * Fill missing required mappings by sniffing sample cell values,
 * or positional fallback for simple 4-column files.
 */
export function refineAutoMapping(
  mapping: VehicleImportColumnMapping[],
  rows: string[][]
): VehicleImportColumnMapping[] {
  const next = mapping.map((m) => ({ ...m }));
  const used = new Set<VehicleImportColumnKey>(
    next.map((m) => m.mappedTo).filter((k) => k !== "ignore")
  );

  const assign = (index: number, key: VehicleImportColumnKey) => {
    if (used.has(key)) return;
    const col = next.find((m) => m.index === index);
    if (!col || col.mappedTo !== "ignore") return;
    col.mappedTo = key;
    used.add(key);
  };

  const sample = rows.slice(0, 15);
  for (const col of next) {
    if (col.mappedTo !== "ignore") continue;
    const values = sample.map((r) => (r[col.index] ?? "").trim()).filter(Boolean);
    if (values.length === 0) continue;
    const regHits = values.filter(looksLikeReg).length;
    const phoneHits = values.filter(looksLikePhone).length;
    if (regHits >= Math.ceil(values.length * 0.5) && !used.has("registrationNumber")) {
      assign(col.index, "registrationNumber");
    } else if (phoneHits >= Math.ceil(values.length * 0.5) && !used.has("customerPhone")) {
      assign(col.index, "customerPhone");
    }
  }

  const missingRequired =
    !used.has("registrationNumber") ||
    !used.has("make") ||
    !used.has("model") ||
    (!used.has("customerPhone") && !used.has("customerId") && !used.has("customerName"));

  // Simple files without clear headers: col0=Reg, col1=Customer, col2=Make, col3=Model
  if (missingRequired && next.length >= 4) {
    const defaults: VehicleImportColumnKey[] = [
      "registrationNumber",
      "customerName",
      "make",
      "model",
    ];

    const firstVals = sample.map((r) => (r[0] ?? "").trim()).filter(Boolean);
    const secondVals = sample.map((r) => (r[1] ?? "").trim()).filter(Boolean);
    if (
      firstVals.length > 0 &&
      firstVals.filter(looksLikePhone).length >= Math.ceil(firstVals.length * 0.5)
    ) {
      defaults[0] = "customerPhone";
      defaults[1] = "registrationNumber";
    } else if (
      secondVals.length > 0 &&
      secondVals.filter(looksLikePhone).length >= Math.ceil(secondVals.length * 0.5)
    ) {
      defaults[1] = "customerPhone";
    }

    for (let i = 0; i < 4; i++) {
      const key = defaults[i]!;
      if (used.has(key)) continue;
      const col = next[i];
      if (!col || col.mappedTo !== "ignore") continue;
      col.mappedTo = key;
      used.add(key);
    }
  }

  return next;
}

export function buildAutoMapping(headers: string[]): VehicleImportColumnMapping[] {
  const used = new Set<VehicleImportColumnKey>();
  return headers.map((header, index) => {
    let mappedTo = guessColumnKey(header);
    if (mappedTo !== "ignore") {
      if (used.has(mappedTo)) mappedTo = "ignore";
      else used.add(mappedTo);
    }
    return { header, index, mappedTo };
  });
}

export function mappingHasRequiredFields(mapping: VehicleImportColumnMapping[]): boolean {
  const keys = new Set(mapping.map((m) => m.mappedTo));
  return keys.has("registrationNumber") && keys.has("make") && keys.has("model");
}

export function mappingHasCustomerField(mapping: VehicleImportColumnMapping[]): boolean {
  const keys = new Set(mapping.map((m) => m.mappedTo));
  return keys.has("customerPhone") || keys.has("customerId") || keys.has("customerName");
}

const FUEL_MAP: Record<string, FuelType> = {
  petrol: "PETROL",
  gasoline: "PETROL",
  diesel: "DIESEL",
  cng: "CNG",
  electric: "ELECTRIC",
  ev: "ELECTRIC",
  hybrid: "HYBRID",
};

const SEGMENT_MAP: Record<string, VehicleSegment> = {
  hatchback: "HATCHBACK",
  hatch: "HATCHBACK",
  sedan: "SEDAN",
  suv: "SUV",
  luxury: "LUXURY",
  muv: "MUV",
  mpv: "MUV",
  "compact suv": "COMPACT_SUV",
  compact_suv: "COMPACT_SUV",
  compactSUV: "COMPACT_SUV",
  bike: "BIKE",
  motorcycle: "BIKE",
  scooter: "BIKE",
};

export function parseFuelType(raw: string): FuelType | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (FUEL_MAP[key]) return FUEL_MAP[key]!;
  const upper = raw.trim().toUpperCase();
  if (["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"].includes(upper)) {
    return upper as FuelType;
  }
  return null;
}

export function parseSegment(raw: string): VehicleSegment | null {
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!key) return null;
  if (SEGMENT_MAP[key]) return SEGMENT_MAP[key]!;
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "_");
  const allowed: VehicleSegment[] = [
    "HATCHBACK",
    "SEDAN",
    "SUV",
    "LUXURY",
    "MUV",
    "COMPACT_SUV",
    "BIKE",
  ];
  if (allowed.includes(upper as VehicleSegment)) return upper as VehicleSegment;
  return null;
}

export function parseYear(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const y = Number(digits.slice(0, 4));
  if (!Number.isFinite(y)) return null;
  const max = new Date().getFullYear() + 1;
  if (y < 1980 || y > max) return null;
  return y;
}
