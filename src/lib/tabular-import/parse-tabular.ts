/** Shared cell coercion for CSV / Excel import parsers. */
export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    // Avoid scientific notation for phone numbers stored as numbers
    if (Number.isInteger(value) && Math.abs(value) >= 1e9) {
      return String(Math.trunc(value));
    }
    return String(value).trim();
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
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

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: string[][] }> {
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

export function assertImportFileSize(file: File, maxBytes: number, label = "File"): void {
  if (file.size > maxBytes) {
    throw new Error(`${label} is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
  }
}
