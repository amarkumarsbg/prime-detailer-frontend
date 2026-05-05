import type { Invoice } from "@/types";
import { aggregateSalesByHsn } from "@/lib/reports/gst-invoice-aggregates";
import { dateInPreset } from "@/lib/reports/report-period-presets";

export type HsnWiseSummaryRow = {
  hsn: string;
  itemName: string;
  totalQty: number;
  totalValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTaxAmount: number;
};

export function buildHsnWiseSalesSummaryRows(
  invoices: Invoice[],
  period: string
): HsnWiseSummaryRow[] {
  const filtered = invoices.filter((i) => dateInPreset(i.createdAt, period));
  return aggregateSalesByHsn(filtered).map((r) => {
    const tax = r.taxAmount;
    return {
      hsn: r.hsn,
      itemName: r.description || "—",
      totalQty: r.quantity,
      totalValue: Math.round((r.taxableValue + r.taxAmount) * 100) / 100,
      taxableValue: r.taxableValue,
      igst: 0,
      cgst: Math.round((tax / 2) * 100) / 100,
      sgst: Math.round((tax / 2) * 100) / 100,
      cess: 0,
      totalTaxAmount: tax,
    };
  });
}
