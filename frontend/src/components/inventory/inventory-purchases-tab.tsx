"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { KPICard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { formatCurrency, cn } from "@/lib/utils";
import { resolveSessionBranchId } from "@/lib/all-branches";
import { useBranchScope } from "@/lib/branch-scope";
import { calcPurchaseLine, calcPurchaseTotals, purchaseDue, purchaseGrandTotal, purchaseAmountPaid } from "@/lib/inventory/purchase-math";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useExpenseStore, type AddVendorDirectoryInput } from "@/store/expense-store";
import { useAuthStore } from "@/store/auth-store";
import {
  backfillPurchaseExpenses,
  postPurchasePaymentToCashBank,
  syncPurchaseToExpense,
} from "@/lib/inventory/sync-purchase-expense";
import { CatalogItemFormDialog } from "@/components/inventory/catalog-item-form-dialog";
import { PurchaseExpandableTable } from "@/components/inventory/purchase-expandable-table";
import { VendorFormDialog } from "@/components/expenses/vendor-form-dialog";
import { VendorPurchasePaymentDialog } from "@/components/vendors/vendor-purchase-payment-dialog";
import type { InventoryPurchaseLine, Part, ProductPurchase } from "@/types";
import { Package, CircleDollarSign, Wallet, AlertCircle } from "lucide-react";

type DraftItem = {
  key: string;
  partId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  gstRate: string;
};

function emptyItem(): DraftItem {
  return { key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, partId: "", quantity: "1", unitPrice: "", discount: "0", gstRate: "18" };
}

function applyPartToDraftItems(prev: DraftItem[], part: Part, targetKey?: string | null): DraftItem[] {
  const patch = {
    partId: part.id,
    unitPrice: String(part.costPrice ?? part.unitPrice ?? ""),
    gstRate: part.gstApplicable === false ? "0" : String(part.gstRate ?? 18),
  };
  if (targetKey && prev.some((i) => i.key === targetKey)) {
    return prev.map((i) => (i.key === targetKey ? { ...i, ...patch } : i));
  }
  const emptyIdx = prev.findIndex((i) => !i.partId);
  if (emptyIdx >= 0) {
    const next = [...prev];
    next[emptyIdx] = { ...next[emptyIdx]!, ...patch };
    return next;
  }
  return [...prev, { ...emptyItem(), ...patch }];
}

export function InventoryPurchasesTab() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);
  const addInventoryPurchase = useInventoryStore((s) => s.addInventoryPurchase);
  const updateInventoryPurchase = useInventoryStore((s) => s.updateInventoryPurchase);
  const branches = useBranchStore((s) => s.branches);
  const vendors = useExpenseStore((s) => s.vendorDirectory);
  const addVendorDirectoryEntry = useExpenseStore((s) => s.addVendorDirectoryEntry);
  const user = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const { selectedBranchId } = useBranchScope();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductPurchase | null>(null);
  const isEditing = editTarget !== null;
  const [quickPartOpen, setQuickPartOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const quickPartTargetKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Blocks purchase-dialog dismiss while a nested dialog is closing (Radix focus restore). */
  const suppressPurchaseDismissRef = useRef(false);
  const pendingCreatedPartRef = useRef<Part | null>(null);
  const suppressDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [roundOff, setRoundOff] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [payTarget, setPayTarget] = useState<ProductPurchase | null>(null);

  const beginNestedDialog = () => {
    if (suppressDismissTimerRef.current) {
      clearTimeout(suppressDismissTimerRef.current);
      suppressDismissTimerRef.current = null;
    }
    suppressPurchaseDismissRef.current = true;
  };

  const endNestedDialogSoon = () => {
    if (suppressDismissTimerRef.current) clearTimeout(suppressDismissTimerRef.current);
    suppressDismissTimerRef.current = setTimeout(() => {
      suppressPurchaseDismissRef.current = false;
      suppressDismissTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (suppressDismissTimerRef.current) clearTimeout(suppressDismissTimerRef.current);
    };
  }, []);

  // After "New part" closes, select the created part on the target purchase line.
  useEffect(() => {
    if (quickPartOpen) return;
    const pending = pendingCreatedPartRef.current;
    if (!pending) return;
    pendingCreatedPartRef.current = null;
    const fromStore =
      useInventoryStore.getState().parts.find((p) => p.id === pending.id) ?? pending;
    const targetKey = quickPartTargetKeyRef.current;
    quickPartTargetKeyRef.current = null;
    setItems((prev) => applyPartToDraftItems(prev, fromStore, targetKey));
  }, [quickPartOpen, parts]);

  useEffect(() => {
    if (purchases.length === 0) return;
    void backfillPurchaseExpenses(purchases, {
      createdBy: user?.id ?? "unknown",
      createdByName: user?.name ?? user?.email ?? "staff",
    });
  }, [purchases, user?.id, user?.name, user?.email]);

  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const hasMultipleBranches = activeBranches.length > 1;
  const activeParts = useMemo(() => parts.filter((p) => p.isActive !== false), [parts]);
  const partsForSelect = useMemo(() => {
    const byId = new Map(activeParts.map((p) => [p.id, p]));
    for (const item of items) {
      if (!item.partId || byId.has(item.partId)) continue;
      const missing = parts.find((p) => p.id === item.partId);
      if (missing) byId.set(missing.id, missing);
    }
    return [...byId.values()];
  }, [activeParts, items, parts]);
  const branchLabel = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? id : "—");

  const scopedPurchases = useMemo(() => {
    if (!selectedBranchId) return purchases;
    return purchases.filter((p) => p.branchId === selectedBranchId);
  }, [purchases, selectedBranchId]);

  const computedLines: InventoryPurchaseLine[] = useMemo(() => {
    return items
      .map((item) => {
        const part = parts.find((p) => p.id === item.partId);
        if (!part) return null;
        return calcPurchaseLine({
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: Number(item.quantity) || 0,
          unit: part.primaryUnit,
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          gstRate: part.gstApplicable === false ? 0 : Number(item.gstRate) || 0,
        });
      })
      .filter((x): x is InventoryPurchaseLine => x != null);
  }, [items, parts]);

  const totals = useMemo(
    () => calcPurchaseTotals(computedLines, Number(roundOff) || 0),
    [computedLines, roundOff]
  );

  const summary = useMemo(() => {
    const totalPurchases = scopedPurchases.length;
    const totalAmount = scopedPurchases.reduce((s, p) => s + purchaseGrandTotal(p), 0);
    const paid = scopedPurchases.reduce((s, p) => s + purchaseAmountPaid(p), 0);
    const outstanding = scopedPurchases.reduce((s, p) => s + purchaseDue(p), 0);
    return { totalPurchases, totalAmount, paid, outstanding };
  }, [scopedPurchases]);

  const defaultBranchId = () => {
    if (activeBranches.length === 1) return activeBranches[0]!.id;
    if (selectedBranchId) return selectedBranchId;
    return resolveSessionBranchId(currentBranch, user?.branchId);
  };

  const reset = () => {
    setSupplierName("");
    setSupplierId("");
    setBranchId(defaultBranchId());
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setInvoiceNo("");
    setInvoiceFileName("");
    setNotes("");
    setRoundOff("0");
    setAmountPaid("0");
    setItems([emptyItem()]);
    setEditTarget(null);
  };

  const openEdit = (purchase: ProductPurchase) => {
    setEditTarget(purchase);
    setSupplierName(purchase.vendorName);
    setSupplierId(purchase.supplierId ?? "");
    setBranchId(purchase.branchId ?? defaultBranchId());
    setPurchaseDate(purchase.purchasedAt.slice(0, 10));
    setDueDate(purchase.dueDate?.slice(0, 10) ?? "");
    setInvoiceNo(purchase.supplierInvoiceNumber ?? "");
    setInvoiceFileName(purchase.invoiceFileName ?? "");
    setNotes(purchase.notes ?? "");
    setRoundOff(String(purchase.roundOff ?? 0));
    setAmountPaid(String(purchase.amountPaid ?? 0));
    setItems(
      purchase.items?.map((line) => ({
        key: `line-edit-${line.partId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partId: line.partId,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        discount: String(line.discount ?? 0),
        gstRate: String(line.gstRate ?? 18),
      })) ?? [emptyItem()]
    );
    setOpen(true);
  };

  const patchItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleAddSupplier = async (input: AddVendorDirectoryInput): Promise<boolean> => {
    const created = await addVendorDirectoryEntry(input);
    if (!created) {
      toast.error("Enter a vendor name.");
      return false;
    }
    setSupplierName(created.name);
    setSupplierId(created.id);
    toast.success("Supplier added to vendors.");
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error("Supplier is required.");
      return;
    }
    if (!branchId) {
      toast.error("Branch is required.");
      return;
    }
    if (!purchaseDate) {
      toast.error("Purchase date is required.");
      return;
    }
    if (!computedLines.length) {
      toast.error("Add at least one part.");
      return;
    }

    if (isEditing) {
      const result = updateInventoryPurchase(editTarget.id, {
        vendorName: supplierName.trim(),
        supplierId: supplierId || undefined,
        branchId,
        purchasedAt: new Date(purchaseDate).toISOString(),
        dueDate: dueDate || undefined,
        supplierInvoiceNumber: invoiceNo.trim() || undefined,
        invoiceFileName: invoiceFileName || undefined,
        notes: notes.trim() || undefined,
        items: computedLines,
        roundOff: Number(roundOff) || 0,
        recordedBy: user?.id ?? "unknown",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await syncPurchaseToExpense(result.purchase, {
          createdBy: user?.id ?? "unknown",
          createdByName: user?.name ?? user?.email ?? "staff",
        });
      } catch {
        // best-effort
      }
      toast.success(`Purchase ${result.purchase.purchaseNumber} updated.`);
      setOpen(false);
      reset();
      return;
    }
    const result = addInventoryPurchase({
      vendorName: supplierName.trim(),
      supplierId: supplierId || undefined,
      branchId,
      purchasedAt: new Date(purchaseDate).toISOString(),
      dueDate: dueDate || undefined,
      supplierInvoiceNumber: invoiceNo.trim() || undefined,
      invoiceFileName: invoiceFileName || undefined,
      notes: notes.trim() || undefined,
      items: computedLines,
      roundOff: Number(roundOff) || 0,
      recordedBy: user?.id ?? "unknown",
      amountPaid: Number(amountPaid) || 0,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      await syncPurchaseToExpense(result.purchase, {
        createdBy: user?.id ?? "unknown",
        createdByName: user?.name ?? user?.email ?? "staff",
      });
      const paidNow = Number(amountPaid) || 0;
      if (paidNow > 0.01) {
        await postPurchasePaymentToCashBank({
          amount: paidNow,
          method: "CASH",
          vendorName: result.purchase.vendorName,
          purchaseNumber: result.purchase.purchaseNumber,
        });
      }
    } catch (err) {
      toast.error("Purchase saved, but Expenses / Accounting sync failed", {
        description: err instanceof Error ? err.message : "Open Expenses and retry payment.",
      });
      setOpen(false);
      reset();
      return;
    }
    toast.success(
      `Purchase ${result.purchase.purchaseNumber} saved. Stock updated${
        hasMultipleBranches ? ` at ${branchLabel(branchId)}` : ""
      }.`
    );
    setOpen(false);
    reset();
  };

  const rows = useMemo(
    () =>
      [...scopedPurchases].sort(
        (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      ),
    [scopedPurchases]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Total purchases" value={summary.totalPurchases} icon={Package} tone="slate" size="compact" surface="minimal" />
        <KPICard title="Total amount" value={formatCurrency(summary.totalAmount)} icon={CircleDollarSign} tone="blue" size="compact" surface="minimal" />
        <KPICard title="Paid" value={formatCurrency(summary.paid)} icon={Wallet} tone="emerald" size="compact" surface="minimal" />
        <KPICard title="Outstanding" value={formatCurrency(summary.outstanding)} icon={AlertCircle} tone="orange" size="compact" surface="minimal" />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create purchase
        </Button>
      </div>

      <PurchaseExpandableTable
        purchases={rows}
        onPay={(p) => setPayTarget(p)}
        onEdit={openEdit}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          // Nested catalog/vendor dialogs must not dismiss or reset the purchase form.
          if (
            !v &&
            (quickPartOpen || vendorDialogOpen || suppressPurchaseDismissRef.current)
          ) {
            return;
          }
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,720px)] sm:max-w-3xl")}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (quickPartOpen || vendorDialogOpen || suppressPurchaseDismissRef.current) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (quickPartOpen || vendorDialogOpen || suppressPurchaseDismissRef.current) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (quickPartOpen || vendorDialogOpen || suppressPurchaseDismissRef.current) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
            <DialogTitle>{isEditing ? `Edit purchase ${editTarget?.purchaseNumber ?? ""}` : "Create purchase"}</DialogTitle>
            {!hasMultipleBranches ? (
              <p className="text-xs text-muted-foreground">
                Stock increases at {activeBranches[0]?.name ?? "this branch"}.
              </p>
            ) : null}
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="purchase-supplier">
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="purchase-supplier"
                      list="purchase-supplier-list"
                      placeholder="Select or type supplier"
                      value={supplierName}
                      autoComplete="off"
                      className="min-w-0 flex-1"
                      onChange={(e) => {
                        const name = e.target.value;
                        setSupplierName(name);
                        const vendor = vendors.find((x) => x.name === name);
                        setSupplierId(vendor?.id ?? "");
                      }}
                    />
                    <datalist id="purchase-supplier-list">
                      {vendors.map((v) => (
                        <option key={v.id} value={v.name} />
                      ))}
                    </datalist>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-1 px-3"
                      onClick={() => {
                        beginNestedDialog();
                        setVendorDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
                {hasMultipleBranches ? (
                  <div className="space-y-1.5">
                    <Label>
                      Branch <span className="text-destructive">*</span>
                    </Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeBranches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Stock is added at this branch.
                    </p>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="purchase-date">
                    Purchase date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="purchase-date"
                    type="date"
                    className="date-input-icon-end pr-9"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purchase-due">Due date</Label>
                  <Input
                    id="purchase-due"
                    type="date"
                    className="date-input-icon-end pr-9"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purchase-invoice-no">Supplier Invoice Number</Label>
                  <Input
                    id="purchase-invoice-no"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="purchase-invoice-file">Invoice file</Label>
                  <Input
                    id="purchase-invoice-file"
                    type="file"
                    accept="image/*,.pdf"
                    className="cursor-pointer"
                    onChange={(e) => setInvoiceFileName(e.target.files?.[0]?.name ?? "")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="purchase-notes">Notes</Label>
                  <Input
                    id="purchase-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Purchase Items
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const empty = items.find((i) => !i.partId);
                      quickPartTargetKeyRef.current = empty?.key ?? items[0]?.key ?? null;
                      beginNestedDialog();
                      setQuickPartOpen(true);
                    }}
                  >
                    New part
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setItems((prev) => [...prev, emptyItem()]);
                    requestAnimationFrame(() => {
                      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                    });
                  }}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add item
                  </Button>
                </div>
              </div>

              <div className="hidden gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_4.5rem_4rem_5.5rem_2rem]">
                <span>Part</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Disc.</span>
                <span>GST %</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const matched = calcPurchaseLineFromDraft(item, parts);
                  return (
                    <div
                      key={item.key}
                      className="relative grid grid-cols-2 items-end gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_4.5rem_4rem_5.5rem_2rem] sm:items-center sm:border-0 sm:p-0"
                    >
                      <div className="col-span-2 min-w-0 pr-9 sm:col-span-1 sm:pr-0">
                        <Label className="mb-1 text-xs sm:sr-only">Part</Label>
                        <Select
                          value={item.partId || undefined}
                          onValueChange={(partId) => {
                            const part = parts.find((p) => p.id === partId);
                            patchItem(item.key, {
                              partId,
                              unitPrice: part ? String(part.costPrice ?? part.unitPrice ?? "") : item.unitPrice,
                              gstRate: part?.gstApplicable === false ? "0" : String(part?.gstRate ?? 18),
                            });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select part" />
                          </SelectTrigger>
                          <SelectContent>
                            {partsForSelect.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <Label className="mb-1 text-xs sm:sr-only">Qty</Label>
                        <Input
                          className="h-9 px-2"
                          type="number"
                          min="0.001"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="mb-1 text-xs sm:sr-only">Price</Label>
                        <Input
                          className="h-9 px-2"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => patchItem(item.key, { unitPrice: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="mb-1 text-xs sm:sr-only">Discount</Label>
                        <Input
                          className="h-9 px-2"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => patchItem(item.key, { discount: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="mb-1 text-xs sm:sr-only">GST %</Label>
                        <Input
                          className="h-9 px-2"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.gstRate}
                          onChange={(e) => patchItem(item.key, { gstRate: e.target.value })}
                        />
                      </div>
                      <p className="col-span-2 text-right text-xs tabular-nums text-muted-foreground sm:col-span-1 sm:text-sm sm:text-foreground">
                        {formatCurrency(matched?.lineTotal ?? 0)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-2 h-8 w-8 text-destructive sm:static sm:justify-self-end"
                        onClick={() =>
                          setItems((prev) =>
                            prev.length === 1
                              ? [emptyItem()]
                              : prev.filter((l) => l.key !== item.key)
                          )
                        }
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border/60 bg-background/95 px-6 py-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs sm:max-w-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-right tabular-nums">{formatCurrency(totals.subtotal)}</span>
                <span className="text-muted-foreground">Discount</span>
                <span className="text-right tabular-nums">{formatCurrency(totals.discountTotal)}</span>
                <span className="text-muted-foreground">GST</span>
                <span className="text-right tabular-nums">{formatCurrency(totals.gstTotal)}</span>
                <Label htmlFor="purchase-round-off" className="text-xs text-muted-foreground">
                  Round off
                </Label>
                <Input
                  id="purchase-round-off"
                  className="h-7 w-full justify-self-end sm:w-24 sm:justify-self-end"
                  type="number"
                  step="0.01"
                  value={roundOff}
                  onChange={(e) => setRoundOff(e.target.value)}
                />
                <Label htmlFor="purchase-paid-now" className="text-xs text-muted-foreground">
                  Paid now
                </Label>
                <Input
                  id="purchase-paid-now"
                  className="h-7 w-full sm:w-24 sm:justify-self-end"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
                <span className="pt-1 font-semibold">Grand total</span>
                <span className="pt-1 text-right text-sm font-semibold tabular-nums">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 sm:flex-none">
                  {isEditing ? "Save changes" : "Create purchase"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VendorPurchasePaymentDialog
        purchase={payTarget}
        open={!!payTarget}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null);
        }}
      />

      <VendorFormDialog
        open={vendorDialogOpen}
        onOpenChange={(next) => {
          if (next) beginNestedDialog();
          setVendorDialogOpen(next);
          if (!next) endNestedDialogSoon();
        }}
        initialName={supplierName}
        onSave={handleAddSupplier}
      />

      <CatalogItemFormDialog
        open={quickPartOpen}
        onOpenChange={(next) => {
          if (next) beginNestedDialog();
          setQuickPartOpen(next);
          if (!next) {
            if (!pendingCreatedPartRef.current) {
              quickPartTargetKeyRef.current = null;
            }
            endNestedDialogSoon();
          }
        }}
        onCreated={(part) => {
          pendingCreatedPartRef.current = part;
          beginNestedDialog();
        }}
      />
    </div>
  );
}

function calcPurchaseLineFromDraft(item: DraftItem, parts: { id: string; name: string; sku: string; primaryUnit: string; gstApplicable?: boolean }[]) {
  const part = parts.find((p) => p.id === item.partId);
  if (!part) return null;
  return calcPurchaseLine({
    partId: part.id,
    partName: part.name,
    sku: part.sku,
    quantity: Number(item.quantity) || 0,
    unit: part.primaryUnit,
    unitPrice: Number(item.unitPrice) || 0,
    discount: Number(item.discount) || 0,
    gstRate: part.gstApplicable === false ? 0 : Number(item.gstRate) || 0,
  });
}
