import type { Invoice, InvoiceLineItem, InvoiceStatus, Payment, PaymentMethod } from "@/types";
import { filterCounterSaleParts } from "@/lib/inventory/part-used-in";
import type { Part } from "@/types";

export type CounterSaleCartLine = {
  partId: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineDiscount: number;
  hsnSac?: string;
};

export function counterSaleLineTotal(line: CounterSaleCartLine): number {
  const gross = line.quantity * line.unitPrice;
  return Math.max(0, Math.round((gross - (line.lineDiscount || 0)) * 100) / 100);
}

export function counterSaleCartSubtotal(lines: CounterSaleCartLine[]): number {
  return Math.round(lines.reduce((s, l) => s + counterSaleLineTotal(l), 0) * 100) / 100;
}

export function counterSaleInvoiceStatus(grandTotal: number, paid: number): InvoiceStatus {
  if (paid >= grandTotal - 0.01) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

export function isCounterSaleInvoice(inv: Pick<Invoice, "source">): boolean {
  return inv.source === "COUNTER_SALE";
}

export function catalogForCounterSale(parts: Part[]): Part[] {
  return filterCounterSaleParts(parts);
}

export function buildCounterSaleInvoice(input: {
  id: string;
  invoiceNumber: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lines: CounterSaleCartLine[];
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  receivedInAccountId?: string;
  receivedInAccountName?: string;
  notes?: string;
  createdAt: string;
}): Invoice {
  const subtotal = counterSaleCartSubtotal(input.lines);
  const lineItems: InvoiceLineItem[] = input.lines.map((line, i) => ({
    id: `li-cs-${input.id}-${i}`,
    description: line.name,
    type: "PARTS",
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: counterSaleLineTotal(line),
    hsnSac: line.hsnSac,
    lineDiscount: line.lineDiscount || undefined,
  }));
  const paid = Math.min(Math.max(0, input.paidAmount), input.grandTotal);
  const payments: Payment[] =
    paid > 0.01
      ? [
          {
            id: `pay-${input.id}`,
            invoiceId: input.id,
            amount: paid,
            method: input.paymentMethod,
            paidAt: input.createdAt,
            receivedInAccountId: input.receivedInAccountId,
            receivedInAccountName: input.receivedInAccountName,
          },
        ]
      : [];
  return {
    id: input.id,
    invoiceNumber: input.invoiceNumber,
    jobCardId: "",
    jobNumber: "Counter Sale",
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    vehicleRegNumber: "—",
    lineItems,
    subtotal,
    taxRate: input.taxRate,
    taxAmount: input.taxAmount,
    discountAmount: input.discountAmount,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal: input.grandTotal,
    status: counterSaleInvoiceStatus(input.grandTotal, paid),
    payments,
    notes: input.notes,
    createdAt: input.createdAt,
    source: "COUNTER_SALE",
    branchId: input.branchId,
    inventoryDeductedAt: input.createdAt,
  };
}
