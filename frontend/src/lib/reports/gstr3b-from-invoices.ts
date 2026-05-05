import type { Invoice } from "@/types";
import { dateInPreset } from "@/lib/reports/report-period-presets";

export type Gstr3bOutwardSlice = {
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
};

export function computeGstr3bOutwardFromInvoices(
  invoices: Invoice[],
  period: string
): Gstr3bOutwardSlice {
  let taxable = 0;
  let tax = 0;
  for (const inv of invoices) {
    if (!dateInPreset(inv.createdAt, period)) continue;
    taxable += inv.subtotal ?? 0;
    tax += inv.taxAmount ?? 0;
  }
  const t = Math.round(tax * 100) / 100;
  return {
    taxableValue: Math.round(taxable * 100) / 100,
    igst: 0,
    cgst: Math.round((t / 2) * 100) / 100,
    sgst: Math.round((t / 2) * 100) / 100,
    cess: 0,
  };
}
