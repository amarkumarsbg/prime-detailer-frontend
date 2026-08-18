import type { Invoice, InvoiceLineItem, MembershipPackage } from "@/types";
import { computeGstFromSubtotal } from "@/lib/gst-tax";
import { useInvoiceStore } from "@/store/invoice-store";
import { useMembershipStore } from "@/store/membership-store";
import { useSettingsStore } from "@/store/settings-store";

export function buildMembershipInvoice(input: {
  id: string;
  invoiceNumber: string;
  membershipId: string;
  packageName: string;
  packagePrice: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegNumber: string;
  branchId?: string;
  createdAt: string;
}): Invoice {
  const unitPrice = Math.round(input.packagePrice * 100) / 100;
  const lineItems: InvoiceLineItem[] = [
    {
      id: `li-mem-${input.id}`,
      description: `${input.packageName} membership`,
      type: "SERVICE",
      quantity: 1,
      unitPrice,
      total: unitPrice,
      hsnSac: "998714",
    },
  ];
  return {
    id: input.id,
    invoiceNumber: input.invoiceNumber,
    jobCardId: "",
    jobNumber: "Membership",
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    vehicleRegNumber: input.vehicleRegNumber || "—",
    lineItems,
    subtotal: unitPrice,
    taxRate: input.taxRate,
    taxAmount: input.taxAmount,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal: input.grandTotal,
    status: "ISSUED",
    payments: [],
    createdAt: input.createdAt,
    membershipId: input.membershipId,
    membershipPackageName: input.packageName,
    source: "MEMBERSHIP",
    branchId: input.branchId,
  };
}

export async function createInvoiceForMembershipActivation(input: {
  membershipId: string;
  pkg: Pick<MembershipPackage, "name" | "price">;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegNumber?: string;
  branchId?: string;
}): Promise<{ ok: true; invoiceId: string; invoiceNumber: string } | { ok: false; error: string }> {
  const invoiceStore = useInvoiceStore.getState();
  const existing = invoiceStore.invoices.find(
    (inv) => inv.source === "MEMBERSHIP" && inv.membershipId === input.membershipId
  );
  if (existing) {
    return { ok: true, invoiceId: existing.id, invoiceNumber: existing.invoiceNumber };
  }

  const packagePrice = Math.round((input.pkg.price ?? 0) * 100) / 100;
  if (!(packagePrice > 0)) {
    return { ok: false, error: "Package price must be greater than zero to create an invoice." };
  }

  const gst = computeGstFromSubtotal(
    packagePrice,
    useSettingsStore.getState().gstRegistrationStatus
  );
  const now = new Date().toISOString();
  const invoice = buildMembershipInvoice({
    id: `inv-mem-${Date.now()}`,
    invoiceNumber: invoiceStore.getNextInvoiceNumber(),
    membershipId: input.membershipId,
    packageName: input.pkg.name,
    packagePrice,
    taxRate: gst.taxRate,
    taxAmount: gst.taxAmount,
    grandTotal: gst.grandTotal,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    vehicleRegNumber: input.vehicleRegNumber ?? "—",
    branchId: input.branchId,
    createdAt: now,
  });

  await invoiceStore.addInvoice(invoice);
  useMembershipStore.getState().linkMembershipInvoice(input.membershipId, invoice.id);
  return { ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}
