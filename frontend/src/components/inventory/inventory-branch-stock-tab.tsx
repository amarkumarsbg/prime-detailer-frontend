"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { getStockStatus, isMlTrackedPart, formatPartStockQuantity } from "@/lib/inventory-units";
import { getCanonicalStockSecondary, hasDualUnitPart, formatDualUnitStockEquivalent } from "@/lib/inventory/multi-unit";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useAuthStore } from "@/store/auth-store";
import type { Part } from "@/types";

type StockStatusFilter = "all" | "In Stock" | "Low Stock" | "Out of Stock";

function branchStockStatus(qty: number, minStock: number) {
  if (qty <= 0) {
    return {
      label: "Out of Stock" as const,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  if (minStock > 0 && qty <= minStock) {
    return {
      label: "Low Stock" as const,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  return {
    label: "In Stock" as const,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

type BranchStockRow = {
  id: string;
  partId: string;
  partName: string;
  sku: string;
  branchId: string;
  branchName: string;
  quantity: number;
  unit: string;
  minStock: number;
  location: string;
  status: string;
  part: Part;
};

export function InventoryBranchStockTab() {
  const parts = useInventoryStore((s) => s.parts);
  const branchStocks = useInventoryStore((s) => s.branchStocks);
  const recordStockAdjustment = useInventoryStore((s) => s.recordStockAdjustment);
  const updateBranchStockMeta = useInventoryStore((s) => s.updateBranchStockMeta);
  const branches = useBranchStore((s) => s.branches);
  const user = useAuthStore((s) => s.user);

  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [adjustRow, setAdjustRow] = useState<BranchStockRow | null>(null);
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Stock adjustment");
  const [notes, setNotes] = useState("");
  const [locationDraft, setLocationDraft] = useState("");

  const activeBranches = useMemo(
    () => branches.filter((b) => b.isActive),
    [branches]
  );

  const rows = useMemo(() => {
    const list: BranchStockRow[] = [];
    for (const part of parts) {
      if (part.isActive === false) continue;
      const allocated = branchStocks.filter((s) => s.partId === part.id);
      const catalog = getCanonicalStockSecondary(part);
      const catalogStatus = getStockStatus(part).label;
      if (allocated.length === 0) {
        list.push({
          id: `cat-${part.id}`,
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          branchId: "",
          branchName: "Catalog (unallocated)",
          quantity: catalog,
          unit: isMlTrackedPart(part) ? "ml" : part.primaryUnit,
          minStock: part.reorderLevelMl ?? part.reorderLevel ?? 0,
          location: "—",
          status: catalogStatus,
          part,
        });
        continue;
      }
      for (const stock of allocated) {
        const branch = branches.find((b) => b.id === stock.branchId);
        const min = stock.minStock ?? part.reorderLevelMl ?? part.reorderLevel ?? 0;
        const status = branchStockStatus(stock.quantity, min);
        const scopedPart = { ...part };
        if (isMlTrackedPart(part)) {
          scopedPart.stockQuantityMl = stock.quantity;
        } else {
          const cf = hasDualUnitPart(part) ? part.conversionFactor : 1;
          scopedPart.quantity = stock.quantity / cf;
        }
        list.push({
          id: stock.id,
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          branchId: stock.branchId,
          branchName: branch?.name ?? stock.branchId,
          quantity: stock.quantity,
          unit: isMlTrackedPart(part) ? "ml" : part.primaryUnit,
          minStock: min,
          location: stock.location ?? "—",
          status: status.label,
          part: scopedPart,
        });
      }
    }
    return list.filter((row) => {
      if (branchFilter !== "all" && row.branchId !== branchFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [parts, branchStocks, branches, branchFilter, statusFilter]);

  const openAdjust = (row: BranchStockRow) => {
    setAdjustRow(row);
    setDirection("IN");
    setQty("");
    setReason("Stock adjustment");
    setNotes("");
    setLocationDraft(row.location === "—" ? "" : row.location);
  };

  const submitAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustRow) return;
    const part = parts.find((p) => p.id === adjustRow.partId);
    if (!part) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    let branchId = adjustRow.branchId;
    if (!branchId) {
      if (activeBranches.length === 1) branchId = activeBranches[0]!.id;
      else {
        toast.error("Choose a branch to allocate this catalog stock.");
        return;
      }
    }
    const result = isMlTrackedPart(part)
      ? recordStockAdjustment({
          partId: part.id,
          direction,
          amountMl: n,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          performedBy: user?.id ?? "unknown",
          branchId,
        })
      : recordStockAdjustment({
          partId: part.id,
          direction,
          amountCount: n,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          performedBy: user?.id ?? "unknown",
          branchId,
        });
    if (!result.ok) {
      toast.error(result.error ?? "Could not adjust stock.");
      return;
    }
    if (locationDraft.trim()) {
      updateBranchStockMeta(part.id, branchId, { location: locationDraft.trim() });
    }
    toast.success("Stock adjusted.");
    setAdjustRow(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {activeBranches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StockStatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Stock status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="In Stock">In Stock</SelectItem>
            <SelectItem value="Low Stock">Low Stock</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={rows}
        columns={[
          {
            key: "partName",
            label: "Part",
            render: (item) => (
              <div>
                <p className="font-medium">{item.partName}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
              </div>
            ),
          },
          { key: "branchName", label: "Branch" },
          {
            key: "quantity",
            label: "Quantity",
            render: (item) => {
              const equivalent = formatDualUnitStockEquivalent(item.part);
              return (
                <div className="flex flex-col gap-0.5">
                  <span className="tabular-nums font-medium whitespace-nowrap">
                    {formatPartStockQuantity(item.part)}
                  </span>
                  {equivalent && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none mt-0.5">
                      = {equivalent}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "minStock",
            label: "Min. stock",
            className: "hidden md:table-cell",
            render: (item) => (
              <span className="text-muted-foreground tabular-nums">{item.minStock}</span>
            ),
          },
          {
            key: "location",
            label: "Location",
            className: "hidden lg:table-cell",
          },
          {
            key: "status",
            label: "Status",
            render: (item) => {
              const s = getStockStatus(item.part);
              return (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${s.className}`}>
                  {s.label}
                </span>
              );
            },
          },
          {
            key: "actions",
            label: "",
            className: "text-right",
            render: (item) => (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openAdjust(item)}
              >
                Adjust
              </Button>
            ),
          },
        ]}
        searchPlaceholder="Search part, SKU, or branch…"
        searchKeys={["partName", "sku", "branchName", "location"]}
        mobileCardBelow="lg"
        renderMobileCard={(item) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.partName}</p>
                <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.branchName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-semibold tabular-nums leading-none">
                  {formatPartStockQuantity(item.part)}
                </span>
                {(() => {
                  const eq = formatDualUnitStockEquivalent(item.part);
                  return eq ? (
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5 whitespace-nowrap">
                      = {eq}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => openAdjust(item)}>
              Adjust stock
            </Button>
          </div>
        )}
      />

      <Dialog open={!!adjustRow} onOpenChange={(open) => !open && setAdjustRow(null)}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-md")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Stock adjustment</DialogTitle>
            <DialogDescription>
              {adjustRow
                ? `${adjustRow.partName} · ${adjustRow.branchName || "Select a branch"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdjust} className="space-y-4 px-6 py-4">
            {!adjustRow?.branchId && activeBranches.length > 1 ? (
              <div className="space-y-2">
                <Label>
                  Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={adjustRow?.branchId || undefined}
                  onValueChange={(id) =>
                    setAdjustRow((row) => (row ? { ...row, branchId: id } : row))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Allocate to branch" />
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
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as "IN" | "OUT")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Increase</SelectItem>
                    <SelectItem value="OUT">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stock adjustment">Stock adjustment</SelectItem>
                  <SelectItem value="Direct issue">Direct issue</SelectItem>
                  <SelectItem value="Return">Return</SelectItem>
                  <SelectItem value="Count correction">Count correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                placeholder="Shelf / bay (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <DialogFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setAdjustRow(null)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
