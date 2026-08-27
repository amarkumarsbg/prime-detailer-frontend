"use client";

import { Badge } from "@/components/ui/badge";
import { normalizeJobCardStatus } from "@/lib/job-card-status";
import type { JobCardStatus, InvoiceStatus, QuotationStatus } from "@/types";

const JOB_CARD_STATUS_CONFIG: Record<JobCardStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" }> = {
  RECEIVED: { label: "Received", variant: "warning" },
  INSPECTION: { label: "Inspection", variant: "info" },
  AWAITING_SERVICE: { label: "Awaiting Service", variant: "info" },
  QUALITY_CHECK: { label: "Quality Check", variant: "info" },
  READY: { label: "Ready", variant: "purple" },
  DELIVERED: { label: "Delivered", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ISSUED: { label: "Issued", variant: "info" },
  PARTIALLY_PAID: { label: "Partial", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
};

const QUOTATION_STATUS_CONFIG: Record<QuotationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SENT: { label: "Sent", variant: "info" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CONVERTED: { label: "Converted", variant: "default" },
};

export function JobCardStatusBadge({
  status,
  className,
}: {
  status: JobCardStatus | string;
  className?: string;
}) {
  const normalized = normalizeJobCardStatus(status);
  const config = JOB_CARD_STATUS_CONFIG[normalized];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus | string | undefined | null;
  className?: string;
}) {
  const config =
    status && Object.prototype.hasOwnProperty.call(INVOICE_STATUS_CONFIG, status)
      ? INVOICE_STATUS_CONFIG[status as InvoiceStatus]
      : { label: (status ?? "Unknown").toString() || "Unknown", variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const config = QUOTATION_STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
