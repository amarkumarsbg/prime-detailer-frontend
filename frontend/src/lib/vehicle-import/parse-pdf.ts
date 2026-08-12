/**
 * Extract vehicle rows from a text-based PDF (pdfjs text layer only — no OCR).
 * Prefer precision: incomplete/ambiguous lines become invalid later via validation.
 */
import {
  compactRegistrationForValidation,
  isValidIndianVehicleRegistration,
} from "@/lib/vehicle-registration";

const HEADERS = [
  "Registration Number",
  "Customer Phone",
  "Customer Name",
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
function findRegistrationInText(text: string): string | null {
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
    let text = ordered
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    // Skip likely header lines
    if (/registration|vehicle\s*number|number\s*plate/i.test(text) && /make|model|customer/i.test(text)) {
      continue;
    }

    const reg = findRegistrationInText(text);
    if (!reg) continue;

    const regKey = compactRegistrationForValidation(reg);
    if (seen.has(regKey)) continue;
    seen.add(regKey);

    const phones = text.match(phoneRe) ?? [];
    let phone = "";
    for (const raw of phones) {
      const digits = raw.replace(/\D/g, "").slice(-10);
      if (digits.length === 10) {
        phone = digits;
        break;
      }
    }

    const yearMatch = text.match(yearRe);
    const year = yearMatch?.[1] ?? "";

    const fuelMatch = text.match(fuelRe);
    const fuel = fuelMatch?.[1] ?? "";

    const segmentMatch = text.match(segmentRe);
    const segment = segmentMatch?.[1] ?? "";

    // Strip known tokens to leave name / make / model residue
    let residue = text;
    residue = residue.replace(new RegExp(reg.split("").join("[\\s-]*"), "i"), " ");
    if (phone) residue = residue.replace(phone, " ");
    for (const raw of phones) residue = residue.replace(raw, " ");
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
    // Heuristic: first 1–3 tokens = customer name, next = make, next = model
    let customerName = "";
    let make = "";
    let model = "";

    if (tokens.length >= 3) {
      customerName = tokens.slice(0, Math.min(2, tokens.length - 2)).join(" ");
      make = tokens[Math.min(2, tokens.length - 2)] ?? "";
      model = tokens.slice(Math.min(3, tokens.length - 1)).join(" ");
    } else if (tokens.length === 2) {
      make = tokens[0]!;
      model = tokens[1]!;
    } else if (tokens.length === 1) {
      make = tokens[0]!;
    }

    // If we only got a plate + weak residue, still emit the row — validation marks invalid
    rows.push([
      reg,
      phone,
      customerName,
      make,
      model,
      fuel,
      segment,
      year,
      "",
    ]);
  }

  if (rows.length === 0) {
    throw new Error(
      "No vehicle registration rows found in this PDF. Use a text-based PDF, or export to CSV/Excel."
    );
  }

  return {
    headers: [...HEADERS],
    rows,
  };
}
