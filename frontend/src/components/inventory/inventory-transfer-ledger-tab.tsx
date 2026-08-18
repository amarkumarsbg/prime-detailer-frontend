"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Clock, CircleDollarSign, CheckCircle2 } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";

type LedgerRow = {
  id: string;
  transferNumber: string;
  date: string;
  from: string;
  to: string;
  part: string;
  quantity: number;
  unit: string;
  transferValue: number;
  settlement: string;
  receivedDate: string;
  acknowledged: boolean;
  transferId: string;
};

export function InventoryTransferLedgerTab() {
  const transfers = useInventoryStore((s) => s.stockTransfers);
  const acknowledgeTransferCost = useInventoryStore((s) => s.acknowledgeTransferCost);
  const branches = useBranchStore((s) => s.branches);
  const branchLabel = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  const rows = useMemo(() => {
    const list: LedgerRow[] = [];
    for (const t of transfers) {
      if (t.status === "DRAFT" || t.status === "CANCELLED" || t.status === "REJECTED") continue;
      for (const item of t.items) {
        list.push({
          id: `${t.id}-${item.partId}`,
          transferNumber: t.transferNumber,
          date: t.createdAt,
          from: branchLabel(t.fromBranchId),
          to: branchLabel(t.toBranchId),
          part: item.partName,
          quantity: item.quantity,
          unit: item.unit,
          transferValue: item.lineValue,
          settlement: t.settlementStatus === "SETTLED" ? "Settled" : "Unsettled",
          receivedDate: t.receivedAt ?? "",
          acknowledged: t.costAcknowledged,
          transferId: t.id,
        });
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transfers, branches]);

  const summary = useMemo(() => {
    const active = transfers.filter(
      (t) => t.status !== "DRAFT" && t.status !== "CANCELLED" && t.status !== "REJECTED"
    );
    const total = active.reduce((s, t) => s + t.transferValue, 0);
    const inTransit = active
      .filter((t) => t.status === "IN_TRANSIT" || t.status === "PENDING" || t.status === "APPROVED")
      .reduce((s, t) => s + t.transferValue, 0);
    const settled = active.filter((t) => t.settlementStatus === "SETTLED").reduce((s, t) => s + t.transferValue, 0);
    const unsettled = Math.max(0, total - settled);
    return { total, inTransit, settled, unsettled };
  }, [transfers]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Transferred value" value={formatCurrency(summary.total)} icon={ArrowLeftRight} tone="blue" size="compact" surface="minimal" />
        <KPICard title="In transit / pending" value={formatCurrency(summary.inTransit)} icon={Clock} tone="amber" size="compact" surface="minimal" />
        <KPICard title="Unsettled" value={formatCurrency(summary.unsettled)} icon={CircleDollarSign} tone="orange" size="compact" surface="minimal" />
        <KPICard title="Settled" value={formatCurrency(summary.settled)} icon={CheckCircle2} tone="emerald" size="compact" surface="minimal" />
      </div>

      <DataTable
        data={rows}
        columns={[
          { key: "transferNumber", label: "Transfer #" },
          {
            key: "date",
            label: "Date",
            render: (r) => formatDate(r.date),
          },
          { key: "from", label: "From" },
          { key: "to", label: "To" },
          { key: "part", label: "Part" },
          {
            key: "quantity",
            label: "Qty",
            render: (r) => (
              <span className="tabular-nums">
                {r.quantity.toLocaleString("en-IN")} {r.unit}
              </span>
            ),
          },
          {
            key: "transferValue",
            label: "Value",
            render: (r) => <span className="tabular-nums">{formatCurrency(r.transferValue)}</span>,
          },
          {
            key: "settlement",
            label: "Settlement",
            render: (r) => (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  r.settlement === "Settled"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {r.settlement}
              </span>
            ),
          },
          {
            key: "receivedDate",
            label: "Received",
            className: "hidden lg:table-cell",
            render: (r) => (r.receivedDate ? formatDate(r.receivedDate) : "—"),
          },
          {
            key: "acknowledged",
            label: "Cost ack.",
            render: (r) =>
              r.acknowledged ? (
                <span className="text-xs text-emerald-700">Yes</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    acknowledgeTransferCost(r.transferId);
                    toast.success("Cost acknowledged.");
                  }}
                >
                  Acknowledge
                </Button>
              ),
          },
        ]}
        searchPlaceholder="Search transfer, part, branch…"
        searchKeys={["transferNumber", "part", "from", "to"]}
        mobileCardBelow="lg"
        renderMobileCard={(r) => (
          <div className="space-y-1">
            <p className="font-medium">{r.transferNumber}</p>
            <p className="text-xs text-muted-foreground">
              {r.from} → {r.to} · {r.part}
            </p>
            <p className="text-sm tabular-nums">{formatCurrency(r.transferValue)}</p>
          </div>
        )}
      />
    </div>
  );
}
