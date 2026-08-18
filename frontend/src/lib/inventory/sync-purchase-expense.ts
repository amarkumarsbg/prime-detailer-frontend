import type { ExpensePaymentMethod, ExpensePaymentStatus, PaymentMethod, ProductPurchase } from "@/types";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useExpenseStore } from "@/store/expense-store";

function mapPaymentMethod(method?: PaymentMethod): ExpensePaymentMethod {
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "CARD";
  return "CASH";
}

function expenseStatusFromPurchase(purchase: ProductPurchase): ExpensePaymentStatus {
  const paid = purchase.amountPaid ?? 0;
  const total = purchase.grandTotal ?? 0;
  if (paid <= 0.01) return "PENDING";
  if (total - paid <= 0.01) return "PAID";
  return "PARTIAL";
}

/** Create or update the Expenses bill that Accounting uses for this purchase. */
export async function syncPurchaseToExpense(
  purchase: ProductPurchase,
  actor: { createdBy: string; createdByName: string }
): Promise<void> {
  const total = purchase.grandTotal ?? 0;
  if (!(total > 0)) return;
  const status = expenseStatusFromPurchase(purchase);
  const paid = purchase.amountPaid ?? 0;
  const lastMethod = purchase.payments?.[purchase.payments.length - 1]?.method;
  const paymentMethod = mapPaymentMethod(lastMethod);
  const title = `Purchase ${purchase.purchaseNumber ?? purchase.id}`;
  const description =
    purchase.notes?.trim() ||
    `Inventory purchase from ${purchase.vendorName}${
      purchase.supplierInvoiceNumber ? ` · ${purchase.supplierInvoiceNumber}` : ""
    }`;

  const existing = useExpenseStore.getState().expenses.find((e) => e.purchaseId === purchase.id);
  if (existing) {
    await useExpenseStore.getState().updateExpense(existing.id, {
      title,
      amount: total,
      amountPaid: status === "PARTIAL" ? paid : status === "PAID" ? total : 0,
      paymentStatus: status,
      paymentMethod,
      vendorName: purchase.vendorName,
      date: purchase.purchasedAt.slice(0, 10),
      branchId: purchase.branchId || existing.branchId,
      description,
    });
    return;
  }

  await useExpenseStore.getState().addExpense({
    title,
    category: "SUPPLIES",
    description,
    amount: total,
    amountPaid: status === "PARTIAL" ? paid : undefined,
    date: purchase.purchasedAt.slice(0, 10),
    vendorName: purchase.vendorName,
    paymentStatus: status,
    paymentMethod,
    createdBy: actor.createdBy,
    createdByName: actor.createdByName,
    branchId: purchase.branchId || "",
    purchaseId: purchase.id,
  });
}

/** Post a vendor payout to Cash & Bank so Accounting cashbook moves. */
export function postPurchasePaymentToCashBank(input: {
  amount: number;
  method: PaymentMethod;
  accountId?: string;
  vendorName: string;
  purchaseNumber?: string;
  referenceNumber?: string;
}): boolean {
  if (!(input.amount > 0)) return false;
  const cash = useCashBankStore.getState();
  const accountId =
    input.accountId ||
    cash.accounts.find((a) => a.type === "cash")?.id ||
    cash.accounts[0]?.id;
  if (!accountId) return false;
  const notes = [
    input.purchaseNumber ? `Purchase ${input.purchaseNumber}` : "Vendor purchase payment",
    input.referenceNumber,
  ]
    .filter(Boolean)
    .join(" · ");
  return cash.recordOutgoing({
    accountId,
    amount: input.amount,
    dateIso: new Date().toISOString().slice(0, 10),
    party: input.vendorName,
    mode: input.method,
    notes,
  });
}
