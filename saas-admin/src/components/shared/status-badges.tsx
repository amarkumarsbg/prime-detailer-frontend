import { Badge } from "@/components/ui/badge";
import type {
  SubscriptionStatus,
  SubscriptionPaymentStatus,
  GraceOrLockStatus,
  PlanCode,
} from "@/types";

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const map: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
    ACTIVE: { label: "Active", variant: "success" },
    PAST_DUE: { label: "Past Due", variant: "warning" },
    EXPIRED: { label: "Expired", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "muted" },
  };
  const cfg = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: SubscriptionPaymentStatus | null | undefined }) {
  if (!status) return <Badge variant="muted">—</Badge>;
  const map: Record<SubscriptionPaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "info" }> = {
    PAID: { label: "Paid", variant: "success" },
    PENDING: { label: "Pending", variant: "warning" },
    PROCESSING: { label: "Processing", variant: "info" },
    FAILED: { label: "Failed", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function GraceStatusBadge({ status }: { status: GraceOrLockStatus | undefined }) {
  if (!status || status === "OK") return null;
  const map: Record<string, { label: string; variant: "warning" | "destructive" | "muted" }> = {
    GRACE: { label: "Grace Period", variant: "warning" },
    LOCKED: { label: "Export Locked", variant: "destructive" },
    SUSPENDED: { label: "Suspended", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PlanBadge({ planCode }: { planCode: PlanCode }) {
  const map: Record<PlanCode, { label: string; variant: "default" | "secondary" | "outline" | "info" }> = {
    STARTER: { label: "Starter", variant: "secondary" },
    GROWTH: { label: "Growth", variant: "info" },
    BUSINESS: { label: "Business", variant: "default" },
    ENTERPRISE: { label: "Enterprise", variant: "default" },
    CUSTOM: { label: "Custom", variant: "outline" },
  };
  const cfg = map[planCode] ?? { label: planCode, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
