import type { Notification } from "@/store/notification-store";
import type { Expense, Invoice, JobCard, PickupDropRequest } from "@/types";
import { buildJobBranchMap, invoiceBranchId } from "@/lib/branch-scope";

export type NotificationBranchContext = {
  jobBranchMap: Map<string, string>;
  invoiceById: Map<string, Invoice>;
  expenseById: Map<string, Expense>;
  pickupByJobNumber: Map<string, string>;
};

export function buildNotificationBranchContext(
  jobCards: JobCard[],
  invoices: Invoice[],
  expenses: Expense[],
  pickupRequests: PickupDropRequest[]
): NotificationBranchContext {
  const jobBranchMap = buildJobBranchMap(jobCards);
  const pickupByJobNumber = new Map(
    pickupRequests.map((r) => [r.jobNumber, r.branchId])
  );
  return {
    jobBranchMap,
    invoiceById: new Map(invoices.map((i) => [i.id, i])),
    expenseById: new Map(expenses.map((e) => [e.id, e])),
    pickupByJobNumber,
  };
}

/**
 * Resolve branch for a notification.
 * - `undefined` = org-wide (visible only when header is “All branches”)
 * - `string` = branch-specific
 * - `null` = unknown / not tied to a branch (hidden when a branch is selected)
 */
export function resolveNotificationBranchId(
  notification: Notification,
  ctx: NotificationBranchContext
): string | null | undefined {
  if (notification.branchId) return notification.branchId;

  const href = notification.href?.trim();
  if (!href) return undefined;

  const jobMatch = href.match(/^\/job-cards\/([^/?#]+)/);
  if (jobMatch) {
    return ctx.jobBranchMap.get(jobMatch[1]) ?? null;
  }

  const billingMatch = href.match(/^\/billing\/([^/?#]+)/);
  if (billingMatch) {
    const inv = ctx.invoiceById.get(billingMatch[1]);
    if (!inv) return null;
    return invoiceBranchId(inv, ctx.jobBranchMap) ?? null;
  }

  const expenseMatch = href.match(/^\/expenses\/([^/?#]+)/);
  if (expenseMatch) {
    return ctx.expenseById.get(expenseMatch[1])?.branchId ?? null;
  }

  if (href.startsWith("/pickup-drop") && notification.message) {
    const jobNum = notification.message.split("→")[0]?.trim().split(" ")[0];
    if (jobNum && ctx.pickupByJobNumber.has(jobNum)) {
      return ctx.pickupByJobNumber.get(jobNum);
    }
  }

  return undefined;
}

export function filterNotificationsByBranch(
  notifications: Notification[],
  branchId: string | null,
  ctx: NotificationBranchContext
): Notification[] {
  if (!branchId) return notifications;
  return notifications.filter((n) => {
    const resolved = resolveNotificationBranchId(n, ctx);
    if (resolved === undefined) return false;
    if (resolved === null) return false;
    return resolved === branchId;
  });
}
