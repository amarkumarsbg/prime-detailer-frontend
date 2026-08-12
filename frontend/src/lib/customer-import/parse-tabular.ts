import { buildAutoMapping, cellToString } from "./normalize";
import {
  MAX_CUSTOMER_IMPORT_FILE_BYTES,
  MAX_CUSTOMER_IMPORT_ROWS,
  type CustomerImportParseResult,
} from "./types";

function assertFileSize(file: File) {
  if (file.size > MAX_CUSTOMER_IMPORT_FILE_BYTES) {
    throw new Error("File is too large (max 5 MB)");
  }
}

/** Minimal CSV parser supporting quoted fields. */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    // Ignore trailing empty line
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else if (ch === "\r") {
      // ignore; handle on \n
    } else {
      field += ch;
    }
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) pushRow();

  if (rows.length === 0) {
    throw new Error("CSV file is empty");
  }

  const headers = rows[0]!.map((h, idx) => h || `Column ${idx + 1}`);
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

async function parseExcelBuffer(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: string[][] }> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // Browser: ArrayBuffer via Uint8Array; ExcelJS typings expect Node Buffer
  await workbook.xlsx.load(new Uint8Array(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook has no sheets");

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as Array<unknown>;
    // ExcelJS is 1-indexed; index 0 is unused
    const cells: string[] = [];
    const max = Math.max(values.length - 1, 0);
    for (let c = 1; c <= max; c++) {
      cells.push(cellToString(values[c]));
    }
    if (cells.some((c) => c)) matrix.push(cells);
  });

  if (matrix.length === 0) throw new Error("Spreadsheet is empty");

  const colCount = Math.max(...matrix.map((r) => r.length));
  const normalized = matrix.map((r) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push("");
    return copy;
  });

  const headers = normalized[0]!.map((h, idx) => h || `Column ${idx + 1}`);
  return { headers, rows: normalized.slice(1) };
}

export async function parseCustomerImportFile(file: File): Promise<CustomerImportParseResult> {
  assertFileSize(file);
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
