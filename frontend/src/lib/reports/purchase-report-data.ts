import type { Part, ProductPurchase } from "@/types";
import { dateInPreset } from "@/lib/reports/report-period-presets";
import type { Gstr2PurchaseDummyRow } from "@/lib/reports/gstr2-purchase-dummy-data";
import type { GstPurchaseHsnDummyRow } from "@/lib/reports/gst-purchase-hsn-dummy";

const DEFAULT_GST_RATE = 18;

function purchaseTaxableAndTax(gross: number, rate = DEFAULT_GST_RATE) {
  const taxable = Math.round((gross / (1 + rate / 100)) * 100) / 100;
  const tax = Math.round((gross - taxable) * 100) / 100;
  const half = Math.round((tax / 2) * 100) / 100;
  return { taxable, cgst: half, sgst: half, igst: 0, taxPercent: rate };
}

function purchaseGrossAmount(p: ProductPurchase, part?: Part): number {
  if (p.grandTotal != null && Number.isFinite(p.grandTotal)) {
    return Math.round(p.grandTotal * 100) / 100;
  }
  const litres = p.quantityMl / 1000;
  const unitCost = p.unitCost ?? part?.unitPrice ?? 0;
  return Math.round(litres * unitCost * 100) / 100;
}

export function buildGstr2PurchaseRows(
  purchases: ProductPurchase[],
  parts: Part[],
  period: string
): Gstr2PurchaseDummyRow[] {
  return purchases
    .filter((p) => dateInPreset(p.purchasedAt, period))
    .map((p) => {
      const part = parts.find((x) => x.id === p.partId);
      const invoiceValue = purchaseGrossAmount(p, part);
      const { taxable, cgst, sgst, igst, taxPercent } = purchaseTaxableAndTax(invoiceValue);
      return {
        id: p.id,
        gstin: "—",
        vendorName: p.vendorName,
        stateCode: "29",
        stateName: "Karnataka",
        invoiceNo: p.reference ?? p.id,
        originalInvoiceNo: "—",
        invoiceDate: p.purchasedAt,
        invoiceValue,
        invoiceType: "B2B",
        taxPercent,
        taxableValue: taxable,
        sgst,
        cgst,
        igst,
        cess: 0,
      };
    })
    .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
}

export function buildGstPurchaseHsnRows(
  purchases: ProductPurchase[],
  parts: Part[],
  period: string
): GstPurchaseHsnDummyRow[] {
  return purchases
    .filter((p) => dateInPreset(p.purchasedAt, period))
    .map((p) => {
      const part = parts.find((x) => x.id === p.partId);
      const qty = Math.round((p.quantityMl / 1000) * 100) / 100;
      const unitCost = p.unitCost ?? part?.unitPrice ?? 0;
      const amount = Math.round(qty * unitCost * 100) / 100;
      const { cgst, sgst, igst } = purchaseTaxableAndTax(amount);
      return {
        id: p.id,
        date: p.purchasedAt,
        invoiceNo: p.reference ?? p.id,
        originalInvNo: "—",
        partyGstin: "—",
        partyName: p.vendorName,
        itemName: part?.name ?? "Inventory item",
        hsn: part?.sku?.trim() || "27101980",
        qty,
        priceUnit: unitCost,
        sgst,
        cgst,
        igst,
        amount,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
