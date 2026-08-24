import type { Invoice } from "@/types";
import { dateInPreset } from "@/lib/reports/report-period-presets";

const DEFAULT_HSN = "998714";

export type SalesHsnLineRow = {
  id: string;
  date: string;
  invoiceNo: string;
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

/** Line-level outward supplies for GST Sales (HSN) report; tax split 50/50 CGST/SGST (intra-state demo). */
export function buildSalesHsnLineRows(invoices: Invoice[], period: string): SalesHsnLineRow[] {
  const rows: SalesHsnLineRow[] = [];
  for (const inv of invoices) {
    if (!dateInPreset(inv.createdAt, period)) continue;
    const lineSum = inv.lineItems.reduce((s, l) => s + (l.total ?? 0), 0) || 1;
    const totalTax = inv.taxAmount ?? 0;
    for (const line of inv.lineItems) {
      const lineTotal = line.total ?? 0;
      const share = lineTotal / lineSum;
      const lineTax = totalTax * share;
      const hsn = (line.hsnSac && String(line.hsnSac).trim()) || DEFAULT_HSN;
      rows.push({
        id: `${inv.id}-${line.id}`,
        date: inv.createdAt,
        invoiceNo: inv.invoiceNumber,
        partyGstin: "—",
        partyName: inv.customerName,
        itemName: line.description,
        hsn,
        qty: line.quantity,
        priceUnit: line.unitPrice,
        sgst: Math.round((lineTax / 2) * 100) / 100,
        cgst: Math.round((lineTax / 2) * 100) / 100,
        igst: 0,
        amount: Math.round(lineTotal * 100) / 100,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
