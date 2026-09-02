"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import {
  formatMlAndLitres,
  formatPartStockQuantity,
  getStockStatus,
  isMlTrackedPart,
  partStockValueInr,
  stockStatusShortLabel,
} from "@/lib/inventory-units";
import { formatDualUnitStockEquivalent, hasDualUnitPart } from "@/lib/inventory/multi-unit";
import { getBranchCanonicalQty } from "@/lib/inventory/branch-stock";
import { useBranchScope } from "@/lib/branch-scope";
import { purchaseDue } from "@/lib/inventory/purchase-math";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Trash2,
  History,
  ArrowLeftRight,
  Warehouse,
  BookMarked,
  ShoppingCart,
} from "lucide-react";
import type { Part } from "@/types";
import { InventoryBranchStockTab } from "@/components/inventory/inventory-branch-stock-tab";
import { InventoryTransfersTab } from "@/components/inventory/inventory-transfers-tab";
import { InventoryTransferLedgerTab } from "@/components/inventory/inventory-transfer-ledger-tab";
import { InventoryPurchasesTab } from "@/components/inventory/inventory-purchases-tab";
import { InventoryHistoryTab } from "@/components/inventory/inventory-history-tab";
import { InventoryPartHistoryDialog } from "@/components/inventory/inventory-part-history-dialog";
import { CatalogItemFormDialog } from "@/components/inventory/catalog-item-form-dialog";
import { mergePartCategoryNames } from "@/lib/inventory/part-categories";
import { buildLatestPurchaseByPartId } from "@/lib/inventory/purchase-item-flow";
import { toast } from "sonner";
import { useInventoryStore } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { carsPossibleForPartAndService } from "@/lib/inventory/consumption";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isLowStockPart } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { userCanCreate, userCanDelete, userCanEdit } from "@/lib/rbac";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

type StockTableFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const storesReady = useDashboardStoresReady();
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const user = useAuthStore((s) => s.user);
  const canEditInventory = userCanEdit(user, "INVENTORY");
  const canCreateInventory = userCanCreate(user, "INVENTORY");
  const canDeleteInventory = userCanDelete(user, "INVENTORY");
  const branches = useBranchStore((s) => s.branches);
  const performedBy = user?.id ?? "unknown";
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const parts = useInventoryStore((s) => s.parts);
  const branchStocks = useInventoryStore((s) => s.branchStocks);
  const savedPartCategories = useInventoryStore((s) => s.partCategories);
  const updatePart = useInventoryStore((s) => s.updatePart);
  const removePart = useInventoryStore((s) => s.removePart);

  const { selectedBranchId } = useBranchScope();

  const getBranchScopedPart = useCallback((part: Part, branchId: string | null): Part => {
    if (!branchId) return part;
    const branchSecondaryQty = getBranchCanonicalQty(branchStocks, part, branchId);
    const cloned = { ...part };
    if (isMlTrackedPart(part)) {
      cloned.stockQuantityMl = branchSecondaryQty;
    } else {
      const cf = hasDualUnitPart(part) ? part.conversionFactor : 1;
      cloned.quantity = branchSecondaryQty / cf;
    }
    return cloned;
  }, [branchStocks]);

  const scopedParts = useMemo(() => {
    return parts.map((p) => getBranchScopedPart(p, selectedBranchId));
  }, [parts, selectedBranchId, getBranchScopedPart]);

  const [stockTableFilter, setStockTableFilter] = useState<StockTableFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [historyPartId, setHistoryPartId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [inventoryTab, setInventoryTab] = useState("parts");
  const [openCreatePurchaseToken, setOpenCreatePurchaseToken] = useState(0);
  const [openPurchaseRequest, setOpenPurchaseRequest] = useState<{ purchaseId: string; token: number } | null>(null);
  const consumeCreatePurchaseToken = useCallback(() => {
    setOpenCreatePurchaseToken(0);
  }, []);
  const consumeOpenPurchaseRequest = useCallback(() => {
    setOpenPurchaseRequest(null);
  }, []);

  const openEditPart = useCallback((part: Part) => {
    if (!canEditInventory) {
      toast.error("You do not have permission to edit catalog items.");
      return;
    }
    setEditingPart(part);
    setAddDialogOpen(true);
  }, [canEditInventory]);

  const openDeletePart = useCallback((part: Part) => {
    if (!canDeleteInventory) {
      toast.error("You do not have permission to delete catalog items.");
      return;
    }
    setDeleteTarget(part);
  }, [canDeleteInventory]);

  const partsForTable = useMemo(() => {
    let list = scopedParts;
    if (activeFilter === DASHBOARD_FILTER.LOW_STOCK) {
      // Use getStockStatus so this filter matches exactly what the dashboard badge counted
      // ("Low Stock" only; Out-of-Stock items are excluded from the badge count).
      list = list.filter((p) => getStockStatus(p).label === "Low Stock");
    }
    if (stockTableFilter === "low") {
      list = list.filter((p) => getStockStatus(p).label === "Low Stock");
    } else if (stockTableFilter === "out") {
      list = list.filter((p) => getStockStatus(p).label === "Out of Stock");
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [scopedParts, activeFilter, stockTableFilter, categoryFilter]);
  const catalogCategories = useMemo(
    () => mergePartCategoryNames(parts, savedPartCategories),
    [parts, savedPartCategories]
  );
  const productPurchases = useInventoryStore((s) => s.productPurchases);
  const stockTransfers = useInventoryStore((s) => s.stockTransfers);
  const recordStockAdjustment = useInventoryStore((s) => s.recordStockAdjustment);

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);

  const [adjustPartId, setAdjustPartId] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"IN" | "OUT">("IN");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [deletingPart, setDeletingPart] = useState(false);

  const totalParts = parts.length;
  const totalStockItems = scopedParts.reduce((sum, p) => sum + (p.quantity > 0 || (p.stockQuantityMl ?? 0) > 0 ? 1 : 0), 0);
  const totalValue = scopedParts.reduce((sum, p) => sum + partStockValueInr(p), 0);
  const lowStockCount = scopedParts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Low Stock";
  }).length;
  const outOfStockCount = scopedParts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Out of Stock";
  }).length;
  const pendingTransfers = stockTransfers.filter(
    (t) => t.status === "PENDING" || t.status === "APPROVED" || t.status === "IN_TRANSIT"
  ).length;
  const outstandingPurchases = productPurchases.reduce((sum, p) => sum + purchaseDue(p), 0);

  const partsById = useMemo(() => new Map(scopedParts.map((p) => [p.id, p])), [scopedParts]);

  const latestPurchaseByPartId = useMemo(
    () => buildLatestPurchaseByPartId(productPurchases),
    [productPurchases]
  );

  const openRelatedPurchase = useCallback((partId: string) => {
    const meta = latestPurchaseByPartId.get(partId);
    if (!meta?.purchaseId) {
      toast.error("No related purchase found for this item.");
      return;
    }
    setInventoryTab("purchases");
    if (canEditInventory) {
      setOpenPurchaseRequest({ purchaseId: meta.purchaseId, token: Date.now() });
    }
  }, [latestPurchaseByPartId, canEditInventory]);

  const deleteLinkedServiceCount = useMemo(() => {
    if (!deleteTarget) return 0;
    return catalog.filter((s) =>
      s.consumptionProfile?.some((l) => l.partId === deleteTarget.id)
    ).length;
  }, [catalog, deleteTarget]);

  const confirmDeletePart = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingPart(true);
    try {
      await removePart(deleteTarget.id);
      if (adjustPartId === deleteTarget.id) setAdjustPartId("");
      toast.success("Catalog item deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete item. Is the API running?");
    } finally {
      setDeletingPart(false);
    }
  }, [deleteTarget, removePart, adjustPartId]);

  const columns = useMemo(
    () => [
    {
      key: "name",
      label: "Part",
      render: (item: Part) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.brand ? (
            <p className="text-xs text-muted-foreground">{item.brand}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{item.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      className: "hidden lg:table-cell",
      render: (item: Part) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap">
          {item.category}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Stock in hand",
      sortable: true,
      className: "whitespace-nowrap",
      render: (item: Part) => {
        const status = getStockStatus(item);
        const equivalent = formatDualUnitStockEquivalent(item);
        return (
          <div className="inline-flex min-w-[4.5rem] flex-col gap-1">
            <span className="font-semibold text-sm tabular-nums leading-none">
              {formatPartStockQuantity(item)}
            </span>
            {equivalent ? (
              <span className="text-[10px] text-muted-foreground leading-none">
                = {equivalent}
              </span>
            ) : null}
            <span
              className={`inline-flex w-fit max-w-full items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${status.className}`}
              title={status.label}
            >
              <span className="lg:hidden">{stockStatusShortLabel(status.label)}</span>
              <span className="hidden lg:inline">{status.label}</span>
            </span>
          </div>
        );
      },
    },
    {
      key: "efficiency",
      label: "Est. cars (wash)",
      className: "hidden xl:table-cell",
      render: (item: Part) => {
        const normalWashService =
          catalog.find((s) => s.id === "srv-001") ?? catalog.find((s) => s.id === "svc-016");
        const advancedWashService =
          catalog.find((s) => s.id === "srv-002") ?? catalog.find((s) => s.id === "svc-017");
        const premiumWashService =
          catalog.find((s) => s.id === "srv-005") ?? catalog.find((s) => s.id === "svc-021");
        if (!normalWashService || !isMlTrackedPart(item) || item.id !== "part-002") {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        const n = carsPossibleForPartAndService(item, normalWashService);
        const a = advancedWashService
          ? carsPossibleForPartAndService(item, advancedWashService)
          : 0;
        const p = premiumWashService
          ? carsPossibleForPartAndService(item, premiumWashService)
          : 0;
        return (
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{n}</span> normal
            {" · "}
            <span className="text-foreground font-medium">{a}</span> advanced
            {" · "}
            <span className="text-foreground font-medium">{p}</span> premium
          </div>
        );
      },
    },
    {
      key: "unitPrice",
      label: "Selling",
      sortable: true,
      className: "whitespace-nowrap text-right",
      render: (item: Part) => (
        <span className="tabular-nums">{formatCurrency(item.unitPrice)}</span>
      ),
    },
    {
      key: "costPrice",
      label: "Cost",
      className: "hidden md:table-cell whitespace-nowrap text-right",
      render: (item: Part) => (
        <span className="tabular-nums text-muted-foreground">
          {item.costPrice != null ? formatCurrency(item.costPrice) : "—"}
        </span>
      ),
    },
    {
      key: "gstRate",
      label: "GST",
      className: "hidden xl:table-cell",
      render: (item: Part) =>
        item.gstApplicable === false ? "—" : `${item.gstRate ?? 0}%`,
    },
    {
      key: "branchScope",
      label: "Scope",
      className: "hidden xl:table-cell",
      render: (item: Part) => {
        const scope = item.branchScope ?? "GLOBAL";
        const label =
          scope === "GLOBAL" ? "All branches" : branches.find((b) => b.id === scope)?.name ?? scope;
        return <span className="text-xs text-muted-foreground">{label}</span>;
      },
    },
    {
      key: "isActive",
      label: "Status",
      className: "hidden lg:table-cell",
      render: (item: Part) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
            item.isActive === false
              ? "bg-muted text-muted-foreground"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          }`}
        >
          {item.isActive === false ? "Inactive" : "Active"}
        </span>
      ),
    },
    {
      key: "reorderLevel",
      label: "Reorder at",
      className: "hidden md:table-cell",
      render: (item: Part) => (
        <span className="text-muted-foreground text-sm">
          {isMlTrackedPart(item)
            ? formatMlAndLitres(item.reorderLevelMl ?? 0)
            : item.reorderLevel}
        </span>
      ),
    },
    {
      key: "supplier",
      label: "Supplier",
      className: "hidden lg:table-cell min-w-[13rem]",
      render: (item: Part) => {
        const meta = latestPurchaseByPartId.get(item.id);
        if (!meta) return <span className="text-xs text-muted-foreground">Vendor: — · Purchase: —</span>;
        return (
          <div className="max-w-[13rem] text-xs text-muted-foreground">
            <p className="truncate">Vendor: {meta.vendorName || "—"}</p>
            <button
              type="button"
              className="truncate text-left text-primary hover:underline"
              onClick={() => openRelatedPurchase(item.id)}
            >
              Open purchase: {meta.supplierInvoiceNumber ?? meta.purchaseNumber ?? "—"}
            </button>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      className: "w-[10rem] text-right",
      render: (item: Part) => (
        <div className="inline-flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={`History for ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setHistoryPartId(item.id);
            }}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            aria-label={`Open purchase for ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openRelatedPurchase(item.id);
            }}
          >
            Open purchase
          </Button>
        </div>
      ),
    },
  ],
    [branches, latestPurchaseByPartId, openRelatedPurchase]
  );

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parts.find((x) => x.id === adjustPartId);
    if (!p) return;
    const n = Number(adjustAmount);
    if (!adjustPartId || Number.isNaN(n) || n <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (isMlTrackedPart(p)) {
      const result = recordStockAdjustment({
        partId: adjustPartId,
        direction: adjustDirection,
        amountMl: n,
        reason: "Manual adjustment",
        performedBy,
        branchId: selectedBranchId ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not adjust stock.");
        return;
      }
    } else {
      const result = recordStockAdjustment({
        partId: adjustPartId,
        direction: adjustDirection,
        amountCount: Math.round(n),
        reason: "Manual adjustment",
        performedBy,
        branchId: selectedBranchId ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not adjust stock.");
        return;
      }
    }
    toast.success("Stock adjusted.");
    setAdjustDialogOpen(false);
    setAdjustAmount("");
  };

  if (!storesReady && catalog.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Inventory"
        description="Parts catalog, branch stock, transfers, purchases, and movement history"
        hideDescriptionOnMobile
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditInventory && (
              <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Adjust quantity</Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Adjust on-hand quantity</DialogTitle>
                  <DialogDescription>
                    Fluids: enter millilitres. Counted parts: enter whole units.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAdjustSubmit} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Part</Label>
                    <Select value={adjustPartId} onValueChange={setAdjustPartId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        {parts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={adjustDirection}
                        onValueChange={(v) => setAdjustDirection(v as "IN" | "OUT")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">Stock In</SelectItem>
                          <SelectItem value="OUT">Stock Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder={adjustPartId && partsById.get(adjustPartId) && isMlTrackedPart(partsById.get(adjustPartId)!) ? "ml" : "units"}
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Apply</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
            {canCreateInventory && (
              <Button
                onClick={() => {
                  setInventoryTab("purchases");
                  setOpenCreatePurchaseToken((v) => v + 1);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create purchase
              </Button>
            )}
            {(canCreateInventory || canEditInventory) && (
              <CatalogItemFormDialog
                open={addDialogOpen}
                onOpenChange={(open) => {
                  setAddDialogOpen(open);
                  if (!open) setEditingPart(null);
                }}
                editingPart={editingPart}
              />
            )}
          </div>
        }
      />

      {activeFilter === DASHBOARD_FILTER.LOW_STOCK && (
        <FilterBanner
          message="Showing lines at or below reorder — narrow list from the dashboard filter"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalParts}</p>
              <p className="text-sm text-muted-foreground">Catalog lines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStockItems}</p>
              <p className="text-sm text-muted-foreground">Lines in stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              <p className="text-sm text-muted-foreground">On-hand value</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStockCount}</p>
              <p className="text-sm text-muted-foreground">Reorder soon</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
              <p className="text-sm text-muted-foreground">Unavailable</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/30">
              <ArrowLeftRight className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTransfers}</p>
              <p className="text-sm text-muted-foreground">Open transfers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!flex !items-center gap-4 !px-5 !py-6 sm:!px-6 sm:!py-7">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(outstandingPurchases)}</p>
              <p className="text-sm text-muted-foreground">Purchase dues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={inventoryTab} onValueChange={setInventoryTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 flex-nowrap scrollbar-none">
          {(
            [
              ["parts", "Parts catalog", Package],
              ["branch-stock", "Branch stock", Warehouse],
              ["transfers", "Transfers", ArrowLeftRight],
              ["ledger", "Transfer ledger", BookMarked],
              ["purchases", "Purchases", ShoppingCart],
              ["history", "History", History],
            ] as const
          ).map(([value, label, Icon]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-medium shadow-none gap-1.5 text-muted-foreground sm:px-4",
                "hover:text-foreground",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground",
                "data-[state=active]:shadow-none"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="parts" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-7 shrink-0 rounded-full bg-primary" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight">Parts catalog</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="inventory-stock-filter" className="text-muted-foreground shrink-0">
              Availability
            </Label>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {catalogCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stockTableFilter}
              onValueChange={(v) => setStockTableFilter(v as StockTableFilter)}
            >
              <SelectTrigger id="inventory-stock-filter" className="w-full sm:w-[220px]">
                <SelectValue placeholder="All lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lines</SelectItem>
                <SelectItem value="low">Below reorder</SelectItem>
                <SelectItem value="out">None on hand</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
          <DataTable
            data={partsForTable}
            columns={columns}
            searchPlaceholder="Search SKU, name, barcode, supplier…"
            searchKeys={["name", "sku", "barcode", "category", "supplier", "brand"]}
            mobileCardBelow="lg"
            renderMobileCard={(item) => {
              const status = getStockStatus(item);
              const equivalent = formatDualUnitStockEquivalent(item);
              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{item.name}</p>
                      {item.brand ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.brand}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                      {item.barcode ? (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          Barcode {item.barcode}
                        </p>
                      ) : null}
                      <span className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                        {item.category}
                      </span>
                      {(() => {
                        const meta = latestPurchaseByPartId.get(item.id);
                        if (!meta) {
                          return (
                            <p className="mt-1 text-xs text-muted-foreground">Vendor: — · Purchase: —</p>
                          );
                        }
                        return (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <p>Vendor: {meta.vendorName || "—"}</p>
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => openRelatedPurchase(item.id)}
                            >
                              Open purchase: {meta.supplierInvoiceNumber ?? meta.purchaseNumber ?? "—"}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-sm tabular-nums whitespace-nowrap">
                        {formatPartStockQuantity(item)}
                      </p>
                      {equivalent ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">= {equivalent}</p>
                      ) : null}
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <span className="text-sm tabular-nums font-medium">{formatCurrency(item.unitPrice)}</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRelatedPurchase(item.id)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                        Open purchase
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </TabsContent>
        <TabsContent value="branch-stock" className="mt-4 space-y-4">
          <InventoryBranchStockTab />
        </TabsContent>
        <TabsContent value="transfers" className="mt-4 space-y-4">
          <InventoryTransfersTab />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4 space-y-4">
          <InventoryTransferLedgerTab />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4 space-y-4">
          <InventoryPurchasesTab
            openCreateToken={openCreatePurchaseToken}
            onCreateTokenConsumed={consumeCreatePurchaseToken}
            openPurchaseRequest={openPurchaseRequest}
            onOpenPurchaseRequestConsumed={consumeOpenPurchaseRequest}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4">
          <InventoryHistoryTab />
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deletingPart && setDeleteTarget(null)}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-md")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "space-y-0")}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle>Delete catalog item?</DialogTitle>
                <DialogDescription>
                  This permanently deletes the item and related records from the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {deleteTarget ? (
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                <p className="font-medium leading-snug">{deleteTarget.name}</p>
                {deleteTarget.brand ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{deleteTarget.brand}</p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-muted-foreground">{deleteTarget.sku}</p>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Removed from the parts catalog</li>
                <li>Stock movements and purchase history deleted</li>
                {deleteLinkedServiceCount > 0 ? (
                  <li>
                    Unlinked from {deleteLinkedServiceCount} service
                    {deleteLinkedServiceCount === 1 ? "" : "s"}
                  </li>
                ) : null}
              </ul>
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                This cannot be undone.
              </p>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deletingPart}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingPart}
              onClick={() => void confirmDeletePart()}
            >
              {deletingPart ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InventoryPartHistoryDialog partId={historyPartId} onClose={() => setHistoryPartId(null)} />
    </div>
  );
}
