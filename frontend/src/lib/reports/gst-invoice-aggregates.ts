import type { Invoice, InvoiceLineItem } from "@/types";

const DEFAULT_HSN = "998714";

function lineHsn(line: InvoiceLineItem): string {
  return (line.hsnSac && String(line.hsnSac).trim()) || DEFAULT_HSN;
}

export type HsnSalesRow = {
  hsn: string;
  description: string;
  taxableValue: number;
  taxAmount: number;
  invoiceCount: number;
  quantity: number;
};

/**
 * Aggregate outward (sales) invoice lines by HSN for GST-style reports.
 * Taxable value per line uses line total minus proportional tax when taxRate > 0.
 */
export function aggregateSalesByHsn(invoices: Invoice[]): HsnSalesRow[] {
  const map = new Map<
    string,
    { taxable: number; tax: number; qty: number; desc: string; inv: Set<string> }
  >();

  for (const inv of invoices) {
    const rate = inv.taxRate ?? 0;
    const totalTax = inv.taxAmount ?? 0;
    const lineSum = inv.lineItems.reduce((s, l) => s + (l.total ?? 0), 0) || 1;

    for (const line of inv.lineItems) {
      const hsn = lineHsn(line);
      const lineTotal = line.total ?? 0;
      const share = lineSum > 0 ? lineTotal / lineSum : 0;
      const lineTax = rate > 0 ? totalTax * share : 0;
      const taxable = Math.max(0, lineTotal - lineTax);
      const prev = map.get(hsn) ?? {
        taxable: 0,
        tax: 0,
        qty: 0,
        desc: line.description,
        inv: new Set<string>(),
      };
      prev.taxable += taxable;
      prev.tax += lineTax;
      prev.qty += line.quantity ?? 0;
      prev.inv.add(inv.id);
      if (!prev.desc && line.description) prev.desc = line.description;
      map.set(hsn, prev);
    }
  }

  return Array.from(map.entries())
    .map(([hsn, v]) => ({
      hsn,
      description: v.desc,
      taxableValue: Math.round(v.taxable * 100) / 100,
      taxAmount: Math.round(v.tax * 100) / 100,
      invoiceCount: v.inv.size,
      quantity: v.qty,
    }))
    .sort((a, b) => a.hsn.localeCompare(b.hsn));
}

export type Gstr1LineRow = {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  vehicleReg: string;
  taxableValue: number;
  taxAmount: number;
  grandTotal: number;
};

export function buildGstr1SalesRows(invoices: Invoice[]): Gstr1LineRow[] {
  return [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.createdAt,
      customerName: inv.customerName,
      vehicleReg: inv.vehicleRegNumber,
      taxableValue: Math.round((inv.subtotal ?? 0) * 100) / 100,
      taxAmount: Math.round((inv.taxAmount ?? 0) * 100) / 100,
      grandTotal: inv.grandTotal,
    }));
}
