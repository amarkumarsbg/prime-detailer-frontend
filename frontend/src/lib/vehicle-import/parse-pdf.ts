/**
 * Extract vehicle rows from a text-based PDF (pdfjs text layer only — no OCR).
 * Prefer precision: incomplete/ambiguous lines become invalid later via validation.
 */
import {
  compactRegistrationForValidation,
  isValidIndianVehicleRegistration,
} from "@/lib/vehicle-registration";

/** Structured PDF / text-row headers (no free-text Customer Name column). */
export const VEHICLE_PDF_HEADERS = [
  "Registration Number",
  "Customer Phone",
  "Make",
  "Model",
  "Fuel Type",
  "Segment",
  "Year",
  "Color",
] as const;

const phoneRe =
  /(?:\+?\s*91[\s-]*)?(?:\d[\s-]*){10}|\b[6-9](?:[\s-]?\d){9}\b/g;

const yearRe = /\b(19[8-9]\d|20[0-2]\d)\b/;

const fuelRe = /\b(petrol|diesel|cng|electric|hybrid|ev)\b/i;

const segmentRe =
  /\b(hatchback|sedan|suv|luxury|muv|mpv|compact\s*suv|bike|motorcycle|scooter)\b/i;

/** Scan a compact alphanumeric string for an Indian plate substring. */
export function findRegistrationInText(text: string): string | null {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 8) return null;

  for (let len = Math.min(13, compact.length); len >= 8; len--) {
    for (let i = 0; i <= compact.length - len; i++) {
      const slice = compact.slice(i, i + len);
      if (isValidIndianVehicleRegistration(slice)) return slice;
    }
  }
  return null;
}

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

/**
 * Parse one PDF/text line into the 8-column vehicle shape:
 * Registration, Customer Phone, Make, Model, Fuel, Segment, Year, Color.
 *
 * Prefer delimited (comma/pipe/tab) 8-field rows; fall back to token heuristics
 * that never treat Make/Model as the customer name.
 */
export function parseVehiclePdfDataLine(text: string): string[] | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  // Skip likely header lines
  if (
    /registration|vehicle\s*number|number\s*plate/i.test(cleaned) &&
    /make|model|customer/i.test(cleaned)
  ) {
    return null;
  }

  const delimited = cleaned
    .split(/[,|;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Exact / near 8-column structure: Reg, Phone, Make, Model, Fuel, Segment, Year, Color
  if (delimited.length >= 8) {
    const reg = findRegistrationInText(delimited[0]!) ?? findRegistrationInText(cleaned);
    if (!reg) return null;
    const phone = normalizePhoneDigits(delimited[1]!);
    if (phone.length !== 10) return null;

    return [
      reg,
      phone,
      delimited[2] ?? "",
      delimited[3] ?? "",
      delimited[4] ?? "",
      delimited[5] ?? "",
      delimited[6] ?? "",
      delimited[7] ?? "",
    ];
  }

  // 7 fields sometimes omit color
  if (delimited.length === 7) {
    const reg = findRegistrationInText(delimited[0]!) ?? findRegistrationInText(cleaned);
    if (!reg) return null;
    const phone = normalizePhoneDigits(delimited[1]!);
    if (phone.length !== 10) return null;
    return [
      reg,
      phone,
      delimited[2] ?? "",
      delimited[3] ?? "",
      delimited[4] ?? "",
      delimited[5] ?? "",
      delimited[6] ?? "",
      "",
    ];
  }

  // Space-separated fallback (no commas)
  const reg = findRegistrationInText(cleaned);
  if (!reg) return null;

  const phones = cleaned.match(phoneRe) ?? [];
  let phone = "";
  for (const raw of phones) {
    const digits = normalizePhoneDigits(raw);
    if (digits.length === 10) {
      phone = digits;
      break;
    }
  }
  if (!phone) return null;

  const yearMatch = cleaned.match(yearRe);
  const year = yearMatch?.[1] ?? "";
  const fuelMatch = cleaned.match(fuelRe);
  const fuel = fuelMatch?.[1] ?? "";
  const segmentMatch = cleaned.match(segmentRe);
  const segment = segmentMatch?.[1] ?? "";

  let residue = cleaned;
  residue = residue.replace(new RegExp(reg.split("").join("[\\s-]*"), "i"), " ");
  for (const raw of phones) residue = residue.replace(raw, " ");
  residue = residue.replace(phone, " ");
  if (year) residue = residue.replace(year, " ");
  if (fuelMatch) residue = residue.replace(fuelMatch[0]!, " ");
  if (segmentMatch) residue = residue.replace(segmentMatch[0]!, " ");
  residue = residue
    .replace(
      /\b(registration|reg|no|number|plate|make|model|fuel|type|segment|year|color|colour|customer|owner|phone|mobile)\b/gi,
      " "
    )
    .replace(/[|,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = residue.split(" ").filter(Boolean);
  // Remaining tokens are Make + Model (+ optional Color) — never customer name
  const make = tokens[0] ?? "";
  const model = tokens[1] ?? "";
  const color = tokens.length > 2 ? tokens.slice(2).join(" ") : "";

  return [reg, phone, make, model, fuel, segment, year, color];
}

export async function parseVehiclePdf(
  file: File
): Promise<{ headers: string[]; rows: string[][] }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  type TextItem = { str: string; x: number; y: number };
  const lines: Array<{ y: number; items: TextItem[] }> = [];
  const yTolerance = 3;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const transform = "transform" in item ? (item.transform as number[]) : null;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const str = String(item.str).trim();

      let line = lines.find((l) => Math.abs(l.y - y) <= yTolerance);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ str, x, y });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  const rows: string[][] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const ordered = [...line.items].sort((a, b) => a.x - b.x);
    const text = ordered
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const parsed = parseVehiclePdfDataLine(text);
    if (!parsed) continue;

    const regKey = compactRegistrationForValidation(parsed[0]!);
    if (seen.has(regKey)) continue;
    seen.add(regKey);

    rows.push(parsed);
  }

  if (rows.length === 0) {
    throw new Error(
      "No vehicle registration rows found in this PDF. Use a text-based PDF, or export to CSV/Excel."
    );
  }

  return {
    headers: [...VEHICLE_PDF_HEADERS],
    rows,
  };
}
