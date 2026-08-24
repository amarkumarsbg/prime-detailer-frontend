import { dateInPreset } from "@/lib/reports/report-period-presets";

export type GstPurchaseHsnDummyRow = {
  id: string;
  date: string;
  invoiceNo: string;
  originalInvNo: string;
  partyGstin: string;
  partyName: string;
  itemName: string;
  hsn: string;
  qty: number;
  priceUnit: number;
  sgst: number;
  cgst: number;
  igst: number;
  amount: number;
};

export const GST_PURCHASE_HSN_DUMMY: GstPurchaseHsnDummyRow[] = [
  {
    id: "p1",
    date: new Date().toISOString(),
    invoiceNo: "PINV-2401",
    originalInvNo: "—",
    partyGstin: "27AABCU9603R1ZM",
    partyName: "Auto Parts Wholesale Pvt Ltd",
    itemName: "Engine oil 5W-30 (bulk)",
    hsn: "27101980",
    qty: 24,
    priceUnit: 850,
    sgst: 1836,
    cgst: 1836,
    igst: 0,
    amount: 20400,
  },
  {
    id: "p2",
    date: new Date().toISOString(),
    invoiceNo: "PINV-2402",
    originalInvNo: "—",
    partyGstin: "09AAACR5055K1Z5",
    partyName: "North India Supplies",
    itemName: "Brake pads set",
    hsn: "87083000",
    qty: 4,
    priceUnit: 3200,
    sgst: 0,
    cgst: 0,
    igst: 2304,
    amount: 12800,
  },
];

export function filterPurchaseHsnByPeriod(
  rows: GstPurchaseHsnDummyRow[],
  period: string
): GstPurchaseHsnDummyRow[] {
  return rows.filter((r) => dateInPreset(r.date, period));
}
