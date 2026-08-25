"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Building2, Clock, Package, User, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import {
  inferMovementKind,
  movementDirectionLabel,
  movementKindLabel,
  movementSignedQuantityText,
} from "@/lib/inventory/movement-labels";
import {
  formatMlAndLitres,
  formatPartStockQuantity,
  getStockStatus,
  isMlTrackedPart,
} from "@/lib/inventory-units";
import { getCanonicalStockSecondary } from "@/lib/inventory/multi-unit";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import type { StockMovement, StockMovementKind } from "@/types";

function kindBadgeClass(kind: StockMovementKind) {
  switch (kind) {
    case "PURCHASE":
    case "TRANSFER_IN":
    case "RETURN":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "DIRECT_ISSUE":
    case "JOB_CARD":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "TRANSFER_OUT":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "ADJUSTMENT":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function kindBorderClass(kind: StockMovementKind) {
  switch (kind) {
    case "PURCHASE":
    case "TRANSFER_IN":
    case "RETURN":
      return "border-l-emerald-500";
    case "DIRECT_ISSUE":
    case "JOB_CARD":
    case "TRANSFER_OUT":
      return "border-l-orange-500";
    case "ADJUSTMENT":
      return "border-l-sky-500";
    default:
      return "border-l-muted-foreground";
  }
}

function formatQty(n: number, digits = 3) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function movementRef(
  m: StockMovement,
  purchaseNumber?: string
): string {
  if (m.purchaseId) return purchaseNumber ?? m.purchaseId;
  return m.invoiceId ?? m.jobCardId ?? m.transferId ?? m.id;
}

export function InventoryPartHistoryDialog({
  partId,
  onClose,
}: {
  partId: string | null;
  onClose: () => void;
}) {
  const parts = useInventoryStore((s) => s.parts);
  const movements = useInventoryStore((s) => s.stockMovements);
  const purchases = useInventoryStore((s) => s.productPurchases);
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);
  const part = parts.find((p) => p.id === partId);

  const rows = useMemo(() => {
    if (!partId) return [];
    return movements
      .filter((m) => m.partId === partId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, partId]);

  const stats = useMemo(() => {
    const qtyUsed = rows.reduce((sum, m) => {
      const kind = inferMovementKind(m);
      if (m.type !== "OUT") return sum;
      if (kind !== "JOB_CARD" && kind !== "DIRECT_ISSUE") return sum;
      return sum + (m.displayQuantity ?? m.quantity);
    }, 0);
    const costPrice = part?.costPrice ?? 0;
    const onHand = part ? getCanonicalStockSecondary(part) : 0;
    const costValue = onHand * costPrice;
    return { events: rows.length, qtyUsed, costValue };
  }, [rows, part]);

  const chartData = useMemo(() => {
    const chronological = [...rows].reverse();
    const points: { t: number; label: string; qty: number }[] = [];
    chronological.forEach((m, i) => {
      const t = new Date(m.createdAt).getTime();
      if (Number.isNaN(t)) return;
      if (i === 0 && m.stockBeforeSecondary != null) {
        points.push({
          t: t - 1,
          label: formatDateTime(m.createdAt),
          qty: m.stockBeforeSecondary,
        });
      }
      if (m.stockAfterSecondary != null) {
        points.push({
          t,
          label: formatDateTime(m.createdAt),
          qty: m.stockAfterSecondary,
        });
      }
    });
    return points;
  }, [rows]);

  const status = part ? getStockStatus(part) : null;
  const minLevel = part
    ? isMlTrackedPart(part)
      ? formatMlAndLitres(part.reorderLevelMl ?? 0)
      : String(part.reorderLevel)
    : "—";

  return (
    <Dialog open={!!partId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        mobileVariant="fullscreen"
        className={cn(
          "flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden p-0",
          "sm:left-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh sm:max-w-md",
          "sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-y-0 sm:border-l sm:border-r-0",
          "sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right"
        )}
      >
        <div className="flex items-start justify-between gap-3 bg-primary px-4 py-4 text-primary-foreground">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-foreground/30">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate pr-0 text-base font-semibold leading-tight text-primary-foreground">
                {part?.name ?? "Part history"}
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-primary-foreground/70">
                {part ? `${part.sku} · ${part.category} · ${part.primaryUnit}` : "Movement trail"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={onClose}
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-primary-foreground/10 bg-primary px-4 pb-4 text-primary-foreground">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/60">
              Current stock
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">
              {part ? formatPartStockQuantity(part) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/60">
              Min level
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight text-amber-200">
              {minLevel}
            </p>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                Cost price
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">
                {formatCurrency(part?.costPrice ?? 0)}
              </p>
            </div>
            {status ? (
              <span
                className={cn(
                  "mt-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  status.className
                )}
              >
                {status.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-border bg-muted/40 px-4 py-3 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Events
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{stats.events}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Qty used
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatQty(stats.qtyUsed, 1)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cost value
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {formatCurrency(stats.costValue)}
            </p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-4 py-4">
            <section>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Stock level over time
              </div>
              {chartData.length >= 2 ? (
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" hide />
                      <YAxis width={32} tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        formatter={(value) => [Number(value ?? 0), "Stock"]}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="qty"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  Not enough data for chart
                </p>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Movement timeline
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {rows.length} {rows.length === 1 ? "event" : "events"}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No movements recorded yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((m) => {
                    const kind = inferMovementKind(m);
                    const purchase = m.purchaseId
                      ? purchases.find((p) => p.id === m.purchaseId)
                      : undefined;
                    const directionLabel = movementDirectionLabel(m);
                    const qtySigned = movementSignedQuantityText(m);
                    return (
                      <article
                        key={m.id}
                        className={cn(
                          "rounded-md border border-border bg-card py-2.5 pl-3 pr-3 border-l-4",
                          kindBorderClass(kind)
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                kindBadgeClass(kind)
                              )}
                            >
                              {movementKindLabel(m)}
                            </span>
                            <span className="truncate rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {movementRef(m, purchase?.purchaseNumber)}
                            </span>
                          </div>
                          <div className="shrink-0 text-right leading-tight">
                            <span
                              className={cn(
                                "block text-sm font-semibold tabular-nums",
                                m.type === "OUT"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-emerald-700 dark:text-emerald-400"
                              )}
                            >
                              {qtySigned}
                            </span>
                            <span
                              className={cn(
                                "text-[11px]",
                                m.type === "OUT"
                                  ? "text-red-600/80 dark:text-red-400/80"
                                  : "text-emerald-700/80 dark:text-emerald-400/80"
                              )}
                            >
                              {directionLabel}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(m.createdAt)}
                          </span>
                          {m.branchId ? (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {branches.find((b) => b.id === m.branchId)?.name ?? m.branchId}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {staff.find((u) => u.id === m.performedBy)?.name ?? m.performedBy}
                          </span>
                          {m.stockBeforeSecondary != null && m.stockAfterSecondary != null ? (
                            <span className="ml-auto tabular-nums">
                              {formatQty(m.stockBeforeSecondary, 2)} → {formatQty(m.stockAfterSecondary, 2)}
                            </span>
                          ) : null}
                        </div>
                        {m.reason || m.notes ? (
                          <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                            {m.notes || m.reason}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
