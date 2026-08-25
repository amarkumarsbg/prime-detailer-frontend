"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, cn } from "@/lib/utils";
import {
  ALL_MOVEMENT_KINDS,
  inferMovementKind,
  MOVEMENT_KIND_LABEL,
  movementDirectionLabel,
  movementKindLabel,
  movementSignedQuantityText,
} from "@/lib/inventory/movement-labels";
import {
  buildInventoryHistoryExportRows,
  downloadInventoryHistoryExcel,
  downloadInventoryHistoryPdf,
} from "@/lib/inventory/history-export";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { InventoryPartHistoryDialog } from "@/components/inventory/inventory-part-history-dialog";
import type { StockMovementKind } from "@/types";
import { toast } from "sonner";

export function InventoryHistoryTab() {
  const movements = useInventoryStore((s) => s.stockMovements);
  const parts = useInventoryStore((s) => s.parts);
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);

  const [kind, setKind] = useState<string>("all");
  const [branchId, setBranchId] = useState("all");
  const [partId, setPartId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [historyPartId, setHistoryPartId] = useState<string | null>(null);

  const branchName = (id: string | undefined) =>
    id ? branches.find((b) => b.id === id)?.name ?? id : "—";
  const userName = (id: string) => staff.find((u) => u.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : null;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : null;
    return [...movements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((m) => {
        if (kind !== "all" && inferMovementKind(m) !== kind) return false;
        if (branchId !== "all" && m.branchId !== branchId) return false;
        if (partId !== "all" && m.partId !== partId) return false;
        const t = new Date(m.createdAt).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
        return true;
      })
      .map((m) => {
        const part = parts.find((p) => p.id === m.partId);
        return {
          ...m,
          partName: part?.name ?? m.partId,
          sku: part?.sku ?? "",
          kindLabel: movementKindLabel(m),
          branchName: branchName(m.branchId),
          userName: userName(m.performedBy),
          qtyLabel: movementSignedQuantityText(m),
          directionLabel: movementDirectionLabel(m),
          ref: m.jobCardId ?? m.purchaseId ?? m.transferId ?? m.invoiceId ?? "—",
        };
      });
  }, [movements, parts, kind, branchId, partId, from, to, branches, staff]);

  const exportRows = () =>
    buildInventoryHistoryExportRows(
      filtered,
      parts,
      branchName,
      userName
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Movement type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ALL_MOVEMENT_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {MOVEMENT_KIND_LABEL[k as StockMovementKind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={partId} onValueChange={setPartId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Part" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parts</SelectItem>
            {parts.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-[160px]" />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const rows = exportRows();
              if (!rows.length) {
                toast.message("No rows to export");
                return;
              }
              await downloadInventoryHistoryExcel(rows);
            }}
          >
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const rows = exportRows();
              if (!rows.length) {
                toast.message("No rows to export");
                return;
              }
              await downloadInventoryHistoryPdf(rows);
            }}
          >
            PDF
          </Button>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={[
          {
            key: "createdAt",
            label: "Date",
            render: (m) => formatDateTime(m.createdAt),
          },
          {
            key: "partName",
            label: "Part / SKU",
            render: (m) => (
              <button
                type="button"
                className="text-left"
                onClick={() => setHistoryPartId(m.partId)}
              >
                <p className="font-medium text-primary">{m.partName}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.sku}</p>
              </button>
            ),
          },
          { key: "kindLabel", label: "Type" },
          {
            key: "qtyLabel",
            label: "Qty",
            render: (m) => (
              <div className="leading-tight">
                <p className={cn("tabular-nums font-semibold", m.type === "OUT" ? "text-red-600" : "text-emerald-700")}>
                  {m.qtyLabel}
                </p>
                <p className={cn("text-[11px]", m.type === "OUT" ? "text-red-600/80" : "text-emerald-700/80")}>
                  {m.directionLabel}
                </p>
              </div>
            ),
          },
          { key: "branchName", label: "Branch", className: "hidden md:table-cell" },
          { key: "ref", label: "Job card / Ref", className: "hidden lg:table-cell" },
          {
            key: "customerName",
            label: "Customer",
            className: "hidden xl:table-cell",
            render: (m) => m.customerName || "—",
          },
          {
            key: "stock",
            label: "Before → After",
            className: "hidden lg:table-cell",
            render: (m) =>
              m.stockBeforeSecondary != null && m.stockAfterSecondary != null
                ? `${m.stockBeforeSecondary} → ${m.stockAfterSecondary}`
                : "—",
          },
          { key: "userName", label: "User", className: "hidden xl:table-cell" },
          {
            key: "actions",
            label: "",
            render: (m) => (
              <Button type="button" variant="ghost" size="icon" onClick={() => setHistoryPartId(m.partId)}>
                <History className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
        searchPlaceholder="Part name, SKU, notes…"
        searchMatch={(m, q) =>
          m.partName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.notes ?? "").toLowerCase().includes(q) ||
          m.kindLabel.toLowerCase().includes(q)
        }
        mobileCardBelow="lg"
        renderMobileCard={(m) => (
          <button type="button" className="w-full text-left space-y-1" onClick={() => setHistoryPartId(m.partId)}>
            <p className="font-medium">{m.partName}</p>
            <p className="text-xs text-muted-foreground">{m.kindLabel}</p>
            <p className={cn("text-xs font-semibold", m.type === "OUT" ? "text-red-600" : "text-emerald-700")}>
              {m.qtyLabel}
              <span className="ml-2 text-[11px] font-medium opacity-80">{m.directionLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</p>
          </button>
        )}
      />

      <InventoryPartHistoryDialog partId={historyPartId} onClose={() => setHistoryPartId(null)} />
    </div>
  );
}
