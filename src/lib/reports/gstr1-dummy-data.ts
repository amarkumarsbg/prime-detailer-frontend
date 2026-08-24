/** Demo rows for GSTR-1 (Sales) — replace with live invoice + customer GST data later. */

export type Gstr1InvoiceDummyRow = {
  id: string;
  gstin: string;
  customerName: string;
  stateCode: string;
  stateName: string;
  invoiceNumber: string;
  invoiceDate: string;
  /** Inclusive of tax (₹) */
  invoiceValue: number;
  taxPercent: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export const GSTR1_DUMMY_INVOICE_ROWS: Gstr1InvoiceDummyRow[] = [
  {
    id: "1",
    gstin: "09AABCU9603R1ZX",
    customerName: "Sharma Motors Pvt Ltd",
    stateCode: "09",
    stateName: "Uttar Pradesh",
    invoiceNumber: "PD-INV/26-27/1842",
    invoiceDate: "2026-03-28T10:00:00.000Z",
    taxableValue: 125000,
    taxPercent: 18,
    cgst: 11250,
    sgst: 11250,
    igst: 0,
    invoiceValue: 147500,
  },
  {
    id: "2",
    gstin: "29AAACR5055K1ZU",
    customerName: "Zenith Auto Care",
    stateCode: "29",
    stateName: "Karnataka",
    invoiceNumber: "PD-INV/26-27/1841",
    invoiceDate: "2026-03-25T14:30:00.000Z",
    taxableValue: 84200,
    taxPercent: 18,
    cgst: 0,
    sgst: 0,
    igst: 15156,
    invoiceValue: 99356,
  },
  {
    id: "3",
    gstin: "27AAAFG2198M1ZQ",
    customerName: "Fleet Solutions India",
    stateCode: "27",
    stateName: "Maharashtra",
    invoiceNumber: "PD-INV/26-27/1838",
    invoiceDate: "2026-03-22T09:15:00.000Z",
    taxableValue: 45600.5,
    taxPercent: 18,
    cgst: 4104.05,
    sgst: 4104.05,
    igst: 0,
    invoiceValue: 53808.6,
  },
  {
    id: "4",
    gstin: "07AADCS0472N1ZV",
    customerName: "Capital Car Studio",
    stateCode: "07",
    stateName: "Delhi",
    invoiceNumber: "PD-INV/26-27/1835",
    invoiceDate: "2026-03-18T11:00:00.000Z",
    taxableValue: 22000,
    taxPercent: 5,
    cgst: 0,
    sgst: 0,
    igst: 1100,
    invoiceValue: 23100,
  },
  {
    id: "5",
    gstin: "33AABCT2218K1ZP",
    customerName: "Southside Detailing Co",
    stateCode: "33",
    stateName: "Tamil Nadu",
    invoiceNumber: "PD-INV/26-27/1829",
    invoiceDate: "2026-03-12T16:45:00.000Z",
    taxableValue: 67890,
    taxPercent: 18,
    cgst: 6110.1,
    sgst: 6110.1,
    igst: 0,
    invoiceValue: 80110.2,
  },
  {
    id: "6",
    gstin: "08AABCP5123L1ZJ",
    customerName: "Desert Shine Garage",
    stateCode: "08",
    stateName: "Rajasthan",
    invoiceNumber: "PD-INV/26-27/1821",
    invoiceDate: "2026-03-08T08:20:00.000Z",
    taxableValue: 31500,
    taxPercent: 18,
    cgst: 0,
    sgst: 0,
    igst: 5670,
    invoiceValue: 37170,
  },
];
