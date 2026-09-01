"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { getBranchCanonicalQty } from "@/lib/inventory/branch-stock";
import { quantityToCanonicalSecondary } from "@/lib/inventory/multi-unit";
import {
  TRANSFER_STATUS_LABEL,
  transferStatusClass,
} from "@/lib/inventory/movement-labels";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import { userCanCreate, userCanEdit } from "@/lib/rbac";
import type { StockTransfer, StockTransferItem, StockTransferStatus } from "@/types";

const NEXT_ACTIONS: Partial<Record<StockTransferStatus, StockTransferStatus[]>> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_TRANSIT", "RECEIVED", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
};

type DraftLine = {
  key: string;
  partId: string;
  quantity: string;
};

export function InventoryTransfersTab() {
  const parts = useInventoryStore((s) => s.parts);
  const stocks = useInventoryStore((s) => s.branchStocks);
  const transfers = useInventoryStore((s) => s.stockTransfers);
  const createStockTransfer = useInventoryStore((s) => s.createStockTransfer);
  const updateStockTransferStatus = useInventoryStore((s) => s.updateStockTransferStatus);
  const branches = useBranchStore((s) => s.branches);
  const user = useAuthStore((s) => s.user);
  const canEditInventory = userCanEdit(user, "INVENTORY");
  const canCreateInventory = userCanCreate(user, "INVENTORY");

  const [open, setOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([{ key: "1", partId: "", quantity: "" }]);

  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const activeParts = useMemo(() => parts.filter((p) => p.isActive !== false), [parts]);

  const branchLabel = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  const rows = useMemo(
    () =>
      [...transfers].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [transfers]
  );

  const resetForm = () => {
    setFromBranchId("");
    setToBranchId("");
    setReason("");
    setNotes("");
    setAsDraft(false);
    setLines([{ key: String(Date.now()), partId: "", quantity: "" }]);
  };

  const buildItems = (): StockTransferItem[] | { error: string } => {
    const items: StockTransferItem[] = [];
    for (const line of lines) {
      if (!line.partId) continue;
      const part = parts.find((p) => p.id === line.partId);
      if (!part) return { error: "Unknown part on a line." };
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return { error: `Enter a quantity for ${part.name}.` };
      const unit = part.primaryUnit;
      const unitCost = part.costPrice ?? part.unitPrice ?? 0;
      items.push({
        partId: part.id,
        partName: part.name,
        sku: part.sku,
        quantity: qty,
        unit,
        unitCost,
        lineValue: Math.round(qty * unitCost * 100) / 100,
      });
    }
    if (!items.length) return { error: "Add at least one part." };
    return items;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromBranchId || !toBranchId) {
      toast.error("From and To branch are required.");
      return;
    }
    if (fromBranchId === toBranchId) {
      toast.error("From and To branch cannot be the same.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    const items = buildItems();
    if ("error" in items) {
      toast.error(items.error);
      return;
    }
    for (const item of items) {
      const part = parts.find((p) => p.id === item.partId)!;
      const canonical = quantityToCanonicalSecondary(part, item.quantity, item.unit);
      const available = getBranchCanonicalQty(stocks, part, fromBranchId);
      if (canonical > available + 1e-9) {
        toast.error(`Only ${available.toLocaleString("en-IN")} available at source for ${part.name}.`);
        return;
      }
    }
    const result = createStockTransfer({
      fromBranchId,
      toBranchId,
      items,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      requestedBy: user?.id ?? "unknown",
      requestedByName: user?.name ?? "Staff",
      asDraft,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Transfer ${result.transfer.transferNumber} created.`);
    setOpen(false);
    resetForm();
  };

  const advance = (transfer: StockTransfer, status: StockTransferStatus) => {
    const result = updateStockTransferStatus(transfer.id, status, {
      id: user?.id ?? "unknown",
      name: user?.name ?? "Staff",
    });
    if (!result.ok) {
      toast.error(result.error ?? "Could not update transfer.");
      return;
    }
    toast.success(`Marked ${TRANSFER_STATUS_LABEL[status].toLowerCase()}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreateInventory && (
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create transfer
          </Button>
        )}
      </div>

      <DataTable
        data={rows}
        columns={[
          { key: "transferNumber", label: "Transfer #" },
          {
            key: "items",
            label: "Parts",
            render: (t) => (
              <span className="text-sm">
                {t.items.map((i) => i.partName).join(", ") || "—"}
              </span>
            ),
          },
          {
            key: "quantity",
            label: "Qty",
            className: "hidden md:table-cell",
            render: (t) => (
              <span className="tabular-nums">
                {t.items.reduce((s, i) => s + i.quantity, 0).toLocaleString("en-IN")}
              </span>
            ),
          },
          {
            key: "transferValue",
            label: "Value",
            render: (t) => (
              <span className="tabular-nums">{formatCurrency(t.transferValue)}</span>
            ),
          },
          {
            key: "fromBranchId",
            label: "From",
            render: (t) => branchLabel(t.fromBranchId),
          },
          {
            key: "toBranchId",
            label: "To",
            render: (t) => branchLabel(t.toBranchId),
          },
          {
            key: "status",
            label: "Status",
            render: (t) => (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${transferStatusClass(t.status)}`}>
                {TRANSFER_STATUS_LABEL[t.status]}
              </span>
            ),
          },
          {
            key: "requestedByName",
            label: "Requested by",
            className: "hidden lg:table-cell",
          },
          {
            key: "createdAt",
            label: "Date",
            className: "hidden md:table-cell",
            render: (t) => formatDate(t.createdAt),
          },
          {
            key: "actions",
            label: "",
            className: "text-right",
            render: (t) => {
              const next = NEXT_ACTIONS[t.status] ?? [];
              if (!next.length || !canEditInventory) return null;
              return (
                <div className="flex flex-wrap justify-end gap-1">
                  {next.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={status === "CANCELLED" || status === "REJECTED" ? "outline" : "default"}
                      onClick={() => advance(t, status)}
                    >
                      {TRANSFER_STATUS_LABEL[status]}
                    </Button>
                  ))}
                </div>
              );
            },
          },
        ]}
        searchPlaceholder="Search transfer #, part, branch…"
        searchMatch={(t, q) =>
          t.transferNumber.toLowerCase().includes(q) ||
          t.items.some((i) => i.partName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)) ||
          branchLabel(t.fromBranchId).toLowerCase().includes(q) ||
          branchLabel(t.toBranchId).toLowerCase().includes(q)
        }
        mobileCardBelow="lg"
        renderMobileCard={(t) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{t.transferNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {branchLabel(t.fromBranchId)} → {branchLabel(t.toBranchId)}
                </p>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${transferStatusClass(t.status)}`}>
                {TRANSFER_STATUS_LABEL[t.status]}
              </span>
            </div>
            <p className="text-sm tabular-nums">{formatCurrency(t.transferValue)}</p>
          </div>
        )}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-lg")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Create stock transfer</DialogTitle>
            <DialogDescription>
              Move available stock between branches. Quantity cannot exceed source stock.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>
                    From branch <span className="text-destructive">*</span>
                  </Label>
                  <Select value={fromBranchId} onValueChange={setFromBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    To branch <span className="text-destructive">*</span>
                  </Label>
                  <Select value={toBranchId} onValueChange={setToBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    Parts <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLines((prev) => [...prev, { key: String(Date.now()), partId: "", quantity: "" }])
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add part
                  </Button>
                </div>
                {lines.map((line) => {
                  const part = parts.find((p) => p.id === line.partId);
                  const available =
                    part && fromBranchId ? getBranchCanonicalQty(stocks, part, fromBranchId) : null;
                  return (
                    <div key={line.key} className="grid grid-cols-[1fr_6rem_auto] gap-2 items-end">
                      <Select
                        value={line.partId}
                        onValueChange={(partId) =>
                          setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, partId } : l)))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Part" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeParts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l))
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {available != null ? (
                        <p className="col-span-3 text-[11px] text-muted-foreground">
                          Available: {available.toLocaleString("en-IN")}{" "}
                          {part?.primaryUnit}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>Additional notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={asDraft}
                  onChange={(e) => setAsDraft(e.target.checked)}
                />
                Save as draft
              </label>
            </div>
            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create transfer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
