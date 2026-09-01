import type { Expense, ExpensePaymentMethod, ExpensePaymentStatus, PaymentMethod, ProductPurchase } from "@/types";
import { apiGet } from "@/lib/api-client";
import { purchaseGrandTotal } from "@/lib/inventory/purchase-math";
import { useAuthStore } from "@/store/auth-store";
import { useCashBankStore } from "@/store/cash-bank-store";
import { useExpenseStore } from "@/store/expense-store";
import { userCanCreate } from "@/lib/rbac";

function mapPaymentMethod(method?: PaymentMethod): ExpensePaymentMethod {
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "CARD";
  return "CASH";
}

function expenseStatusFromPurchase(purchase: ProductPurchase): ExpensePaymentStatus {
  const paid = purchase.amountPaid ?? 0;
  const total = purchaseGrandTotal(purchase);
  if (paid <= 0.01) return "PENDING";
  if (total - paid <= 0.01) return "PAID";
  return "PARTIAL";
}

async function hydrateExpensesIfEmpty() {
  if (useExpenseStore.getState().expenses.length > 0) return;
  try {
    const data = await apiGet<{ items?: Expense[] }>("/api/collections/expenses");
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length > 0) useExpenseStore.setState({ expenses: items });
  } catch {
    /* keep local */
  }
}

/** Create or update the Expenses bill that Accounting uses for this purchase. */
export async function syncPurchaseToExpense(
  purchase: ProductPurchase,
  actor: { createdBy: string; createdByName: string }
): Promise<void> {
  const total = purchaseGrandTotal(purchase);
  if (!(total > 0)) {
    throw new Error("Purchase total is missing; cannot post to Expenses.");
  }
  await hydrateExpensesIfEmpty();
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
  const purchaseDay = (purchase.purchasedAt || new Date().toISOString()).slice(0, 10);
  // Use local calendar date (not UTC) so expenses appear on the correct day for
  // IST and other UTC+ timezones where late-night payments cross UTC midnight.
  const localDateStr = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const lastPaymentDate = purchase.payments?.length
    ? localDateStr(purchase.payments[purchase.payments.length - 1]!.paidAt)
    : null;
  const date = lastPaymentDate ?? purchaseDay;

  const existing = useExpenseStore.getState().expenses.find((e) => e.purchaseId === purchase.id);
  if (existing) {
    const ok = await useExpenseStore.getState().updateExpense(existing.id, {
      title,
      amount: total,
      amountPaid: status === "PARTIAL" ? paid : status === "PAID" ? total : 0,
      paymentStatus: status,
      paymentMethod,
      vendorName: purchase.vendorName,
      date,
      branchId: purchase.branchId || existing.branchId,
      description,
    });
    if (!ok) throw new Error("Could not update the linked expense.");
    return;
  }

  await useExpenseStore.getState().addExpense({
    title,
    category: "SUPPLIES",
    description,
    amount: total,
    amountPaid: status === "PARTIAL" ? paid : undefined,
    date,
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
export async function postPurchasePaymentToCashBank(input: {
  amount: number;
  method: PaymentMethod;
  accountId?: string;
  vendorName: string;
  purchaseNumber?: string;
  referenceNumber?: string;
}): Promise<boolean> {
  if (!(input.amount > 0)) return false;
  const cash = useCashBankStore.getState();
  const accountId =
    input.accountId ||
    cash.accounts.find((a) => a.type === "cash")?.id ||
    cash.accounts.find((a) => a.type === "bank")?.id ||
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

/** Ensure every purchase has an expense bill (for purchases made before linking). */
export async function backfillPurchaseExpenses(
  purchases: ProductPurchase[],
  actor: { createdBy: string; createdByName: string }
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!userCanCreate(user, "EXPENSES")) {
    return; // Don't attempt backfill if the user lacks expense creation permission
  }

  await hydrateExpensesIfEmpty();
  const linked = new Set(
    useExpenseStore
      .getState()
      .expenses.map((e) => e.purchaseId)
      .filter((id): id is string => Boolean(id))
  );
  for (const purchase of purchases) {
    if (linked.has(purchase.id)) continue;
    if (purchaseGrandTotal(purchase) <= 0) continue;
    try {
      await syncPurchaseToExpense(purchase, actor);
      linked.add(purchase.id);
    } catch (err) {
      console.warn("Failed to backfill expense for purchase", purchase.id, err);
    }
  }
}
