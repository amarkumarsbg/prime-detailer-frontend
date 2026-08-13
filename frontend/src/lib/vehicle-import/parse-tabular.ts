import { buildAutoMapping, refineAutoMapping } from "./normalize";
import {
  MAX_VEHICLE_IMPORT_FILE_BYTES,
  MAX_VEHICLE_IMPORT_ROWS,
  type VehicleImportParseResult,
} from "./types";
import {
  assertImportFileSize,
  parseCsvText,
  parseExcelBuffer,
} from "@/lib/tabular-import/parse-tabular";

export { parseCsvText } from "@/lib/tabular-import/parse-tabular";

export async function parseVehicleImportFile(file: File): Promise<VehicleImportParseResult> {
  assertImportFileSize(file, MAX_VEHICLE_IMPORT_FILE_BYTES);
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  let headers: string[];
  let rows: string[][];
  let sourceLabel: string;

  if (ext === ".csv" || file.type === "text/csv") {
    ({ headers, rows } = parseCsvText(await file.text()));
    sourceLabel = file.name || "CSV file";
  } else if (ext === ".xlsx") {
    ({ headers, rows } = await parseExcelBuffer(await file.arrayBuffer()));
    sourceLabel = file.name || "Excel file";
  } else if (ext === ".xls") {
    throw new Error("Legacy .xls is not supported. Save as .xlsx or CSV and try again.");
  } else if (ext === ".pdf" || file.type === "application/pdf") {
    const { parseVehiclePdf } = await import("./parse-pdf");
    ({ headers, rows } = await parseVehiclePdf(file));
    sourceLabel = file.name || "PDF file";
  } else {
    throw new Error("Unsupported file type. Use CSV, Excel (.xlsx), or PDF.");
  }

  if (rows.length > MAX_VEHICLE_IMPORT_ROWS) {
    throw new Error(`Too many rows (max ${MAX_VEHICLE_IMPORT_ROWS})`);
  }

  return {
    headers,
    rows,
    mapping: refineAutoMapping(buildAutoMapping(headers), rows),
    sourceLabel,
  };
}
