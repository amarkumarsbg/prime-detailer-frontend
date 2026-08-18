import type { StockMovement, StockMovementKind, StockTransferStatus } from "@/types";

export const MOVEMENT_KIND_LABEL: Record<StockMovementKind, string> = {
  PURCHASE: "Purchase",
  ADJUSTMENT: "Stock Adjustment",
  TRANSFER_OUT: "Stock Transfer",
  TRANSFER_IN: "Transfer Received",
  JOB_CARD: "Job Card Usage",
  DIRECT_ISSUE: "Direct Issue",
  RETURN: "Return",
  OTHER: "Other",
};

export const ALL_MOVEMENT_KINDS: StockMovementKind[] = [
  "PURCHASE",
  "ADJUSTMENT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "JOB_CARD",
  "DIRECT_ISSUE",
  "RETURN",
  "OTHER",
];

export function inferMovementKind(m: StockMovement): StockMovementKind {
  if (m.movementKind) return m.movementKind;
  if (m.purchaseId) return "PURCHASE";
  if (m.transferId) return m.type === "IN" ? "TRANSFER_IN" : "TRANSFER_OUT";
  if (m.jobCardId) return "JOB_CARD";
  if (m.reason.toLowerCase().includes("counter sale")) return "DIRECT_ISSUE";
  if (m.reason.toLowerCase().includes("direct issue")) return "DIRECT_ISSUE";
  if (m.reason.toLowerCase().includes("return")) return "RETURN";
  if (m.reason.toLowerCase().includes("adjust")) return "ADJUSTMENT";
  return "OTHER";
}

export function movementKindLabel(m: StockMovement): string {
  const kind = inferMovementKind(m);
  if (kind === "DIRECT_ISSUE" && /counter sale/i.test(m.reason)) return "Counter Sale";
  return MOVEMENT_KIND_LABEL[kind];
}

export const TRANSFER_STATUS_LABEL: Record<StockTransferStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  APPROVED: "Approved",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function transferStatusClass(status: StockTransferStatus): string {
  switch (status) {
    case "RECEIVED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "IN_TRANSIT":
    case "APPROVED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "PENDING":
    case "DRAFT":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function paymentStatusClass(status: string): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "PARTIAL":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

export function paymentStatusLabel(status: string): string {
  if (status === "PARTIAL") return "Partially Paid";
  if (status === "PAID") return "Paid";
  return "Unpaid";
}
