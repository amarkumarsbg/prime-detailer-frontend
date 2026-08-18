import type { InventoryPurchaseLine, InventoryPaymentStatus, ProductPurchase } from "@/types";

export function calcPurchaseLine(input: {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  gstRate: number;
}): InventoryPurchaseLine {
  const quantity = Math.max(0, input.quantity);
  const unitPrice = Math.max(0, input.unitPrice);
  const discount = Math.max(0, input.discount);
  const gstRate = Math.max(0, input.gstRate);
  const taxableAmount = Math.max(0, Math.round((quantity * unitPrice - discount) * 100) / 100);
  const gstAmount = Math.round(taxableAmount * (gstRate / 100) * 100) / 100;
  const lineTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
  return {
    partId: input.partId,
    partName: input.partName,
    sku: input.sku,
    quantity,
    unit: input.unit,
    unitPrice,
    discount,
    gstRate,
    taxableAmount,
    gstAmount,
    lineTotal,
  };
}

export function calcPurchaseTotals(lines: InventoryPurchaseLine[], roundOff = 0) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
  const discountTotal = Math.round(lines.reduce((s, l) => s + l.discount, 0) * 100) / 100;
  const gstTotal = Math.round(lines.reduce((s, l) => s + l.gstAmount, 0) * 100) / 100;
  const beforeRound =
    Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const grandTotal = Math.round((beforeRound + roundOff) * 100) / 100;
  return { subtotal, discountTotal, gstTotal, grandTotal };
}

export function purchaseGrandTotal(p: ProductPurchase): number {
  if (p.grandTotal != null && Number.isFinite(p.grandTotal)) return p.grandTotal;
  return (p.unitCost ?? 0) * (p.quantityMl / 1000);
}

export function purchaseAmountPaid(p: ProductPurchase): number {
  return Math.max(0, p.amountPaid ?? 0);
}

export function purchaseDue(p: ProductPurchase): number {
  return Math.max(0, Math.round((purchaseGrandTotal(p) - purchaseAmountPaid(p)) * 100) / 100);
}

export function derivePaymentStatus(p: ProductPurchase): InventoryPaymentStatus {
  if (p.paymentStatus) return p.paymentStatus;
  const due = purchaseDue(p);
  const paid = purchaseAmountPaid(p);
  if (paid <= 0.01) return "UNPAID";
  if (due <= 0.01) return "PAID";
  return "PARTIAL";
}
