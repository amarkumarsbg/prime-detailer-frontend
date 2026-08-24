export type CustomerImportRowStatus =
  | "ready"
  | "invalid"
  | "already_exists"
  | "duplicate_in_file";

export type ParsedCustomerRow = {
  /** 1-based source row number for display */
  rowNumber: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  raw: Record<string, string>;
};

export type ValidatedCustomerImportRow = ParsedCustomerRow & {
  status: CustomerImportRowStatus;
  message: string;
  /** Last-10 digits when phone is valid */
  phoneKey: string;
};

export type CustomerImportColumnKey = "name" | "phone" | "email" | "address" | "ignore";

export type CustomerImportColumnMapping = {
  /** Original header text from the file */
  header: string;
  /** Column index in the sheet */
  index: number;
  mappedTo: CustomerImportColumnKey;
};

export type CustomerImportParseResult = {
  headers: string[];
  rows: string[][];
  /** Suggested mapping from auto-detect */
  mapping: CustomerImportColumnMapping[];
  sourceLabel: string;
};

export const MAX_CUSTOMER_IMPORT_ROWS = 5000;
export const MAX_CUSTOMER_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
