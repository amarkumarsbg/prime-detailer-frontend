import { buildAutoMapping } from "./normalize";
import {
  MAX_CUSTOMER_IMPORT_FILE_BYTES,
  MAX_CUSTOMER_IMPORT_ROWS,
  type CustomerImportParseResult,
} from "./types";
import {
  assertImportFileSize,
  parseCsvText,
  parseExcelBuffer,
} from "@/lib/tabular-import/parse-tabular";

export { parseCsvText } from "@/lib/tabular-import/parse-tabular";

export async function parseCustomerImportFile(file: File): Promise<CustomerImportParseResult> {
  assertImportFileSize(file, MAX_CUSTOMER_IMPORT_FILE_BYTES);
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  let headers: string[];
  let rows: string[][];
  let sourceLabel: string;

  if (ext === ".csv" || file.type === "text/csv") {
    const text = await file.text();
    ({ headers, rows } = parseCsvText(text));
    sourceLabel = file.name || "CSV file";
  } else if (ext === ".xlsx") {
    const buffer = await file.arrayBuffer();
    ({ headers, rows } = await parseExcelBuffer(buffer));
    sourceLabel = file.name || "Excel file";
  } else if (ext === ".xls") {
    throw new Error(
      "Legacy .xls is not supported. Save as .xlsx or CSV and try again."
    );
  } else if (ext === ".pdf" || file.type === "application/pdf") {
    const { parseCustomerPdf } = await import("./parse-pdf");
    ({ headers, rows } = await parseCustomerPdf(file));
    sourceLabel = file.name || "PDF file";
  } else {
    throw new Error("Unsupported file type. Use CSV, Excel (.xlsx), or PDF.");
  }

  if (rows.length > MAX_CUSTOMER_IMPORT_ROWS) {
    throw new Error(`Too many rows (max ${MAX_CUSTOMER_IMPORT_ROWS})`);
  }

  return {
    headers,
    rows,
    mapping: buildAutoMapping(headers),
    sourceLabel,
  };
}
