/** Demo inward-supply rows for GSTR-2 — replace with vendor purchase store later. */

export type Gstr2PurchaseDummyRow = {
  id: string;
  gstin: string;
  /** Supplier / vendor name */
  vendorName: string;
  stateCode: string;
  stateName: string;
  invoiceNo: string;
  originalInvoiceNo?: string;
  invoiceDate: string;
  invoiceValue: number;
  invoiceType: string;
  taxPercent: number;
  taxableValue: number;
  sgst: number;
  cgst: number;
  igst: number;
  cess: number;
};

export const GSTR2_DUMMY_PURCHASE_ROWS: Gstr2PurchaseDummyRow[] = [
  {
    id: "1",
    gstin: "09AABCU9603R2ZY",
    vendorName: "Auto Parts Wholesale UP",
    stateCode: "09",
    stateName: "Uttar Pradesh",
    invoiceNo: "VPUR/26-04/901",
    originalInvoiceNo: "—",
    invoiceDate: "2026-04-08T12:00:00.000Z",
    invoiceValue: 59000,
    invoiceType: "B2B",
    taxPercent: 18,
    taxableValue: 50000,
    sgst: 4500,
    cgst: 4500,
    igst: 0,
    cess: 0,
  },
  {
    id: "2",
    gstin: "29AAACR5055K2ZV",
    vendorName: "Karnataka Lubricants Pvt Ltd",
    stateCode: "29",
    stateName: "Karnataka",
    invoiceNo: "KLPL-INV-4402",
    invoiceDate: "2026-04-07T09:30:00.000Z",
    invoiceValue: 129764,
    invoiceType: "B2B",
    taxPercent: 18,
    taxableValue: 110000,
    sgst: 0,
    cgst: 0,
    igst: 19764,
    cess: 0,
  },
  {
    id: "3",
    gstin: "27AAAFG2198M2ZR",
    vendorName: "Maharashtra Chemicals",
    stateCode: "27",
    stateName: "Maharashtra",
    invoiceNo: "MC/26/P/1188",
    invoiceDate: "2026-04-06T15:00:00.000Z",
    invoiceValue: 35400,
    invoiceType: "B2B",
    taxPercent: 5,
    taxableValue: 33714.29,
    sgst: 842.86,
    cgst: 842.86,
    igst: 0,
    cess: 0,
  },
];
