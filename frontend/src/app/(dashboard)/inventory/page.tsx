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
  litresToMl,
  mlToLitres,
  partStockValueInr,
  stockStatusShortLabel,
} from "@/lib/inventory-units";
import { formatDualUnitStockEquivalent } from "@/lib/inventory/multi-unit";
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
  Pencil,
  History,
  ArrowLeftRight,
  Warehouse,
  BookMarked,
  ShoppingCart,
} from "lucide-react";
import type { Part, PartCategory } from "@/types";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryBranchStockTab } from "@/components/inventory/inventory-branch-stock-tab";
import { InventoryTransfersTab } from "@/components/inventory/inventory-transfers-tab";
import { InventoryTransferLedgerTab } from "@/components/inventory/inventory-transfer-ledger-tab";
import { InventoryPurchasesTab } from "@/components/inventory/inventory-purchases-tab";
import { InventoryHistoryTab } from "@/components/inventory/inventory-history-tab";
import { InventoryPartHistoryDialog } from "@/components/inventory/inventory-part-history-dialog";
import { PartCategorySelect } from "@/components/inventory/part-category-select";
import { mergePartCategoryNames } from "@/lib/inventory/part-categories";
import { toast } from "sonner";
import { useInventoryStore, parseLitresInput } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { carsPossibleForPartAndService } from "@/lib/inventory/consumption";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isLowStockPart } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";

/** Primary units for stock; Litre uses ml-backed quantity like existing fluid parts. */
const PART_STOCK_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "Piece", label: "Piece" },
  { value: "Set", label: "Set" },
  { value: "Kg", label: "Kg" },
  { value: "Litre", label: "Litre (fluid)" },
  { value: "Roll", label: "Roll" },
  { value: "Box", label: "Box" },
  { value: "Pack", label: "Pack" },
  { value: "Carton", label: "Carton" },
  { value: "Pair", label: "Pair" },
];

type StockTableFilter = "all" | "low" | "out";

/** Keep focused fields visible when the mobile keyboard opens inside a dialog. */
function focusMobileFormField(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(max-width: 639px)").matches) return;
  const el = e.currentTarget;
  window.setTimeout(() => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 320);
}

export default function InventoryPage() {
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const user = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const performedBy = user?.id ?? "unknown";
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const parts = useInventoryStore((s) => s.parts);
  const savedPartCategories = useInventoryStore((s) => s.partCategories);
  const addPart = useInventoryStore((s) => s.addPart);
  const updatePart = useInventoryStore((s) => s.updatePart);
  const removePart = useInventoryStore((s) => s.removePart);

  const [stockTableFilter, setStockTableFilter] = useState<StockTableFilter>("all");

  const [addPartName, setAddPartName] = useState("");
  const [addPartBrand, setAddPartBrand] = useState("");
  const [addPartSku, setAddPartSku] = useState("");
  const [addPartCategory, setAddPartCategory] = useState<PartCategory>("Other");
  const [addPartUnit, setAddPartUnit] = useState("Piece");
  const [addPartQty, setAddPartQty] = useState("");
  const [addPartPrice, setAddPartPrice] = useState("");
  const [addPartReorder, setAddPartReorder] = useState("");
  const [addPartSupplier, setAddPartSupplier] = useState("");
  const [addPartBarcode, setAddPartBarcode] = useState("");
  const [addPartSecondaryUnit, setAddPartSecondaryUnit] = useState("");
  const [addPartConversionRate, setAddPartConversionRate] = useState("1");
  const [addPartSecondaryPrice, setAddPartSecondaryPrice] = useState("");
  const [addPartDescription, setAddPartDescription] = useState("");
  const [addPartCost, setAddPartCost] = useState("");
  const [addPartGstRate, setAddPartGstRate] = useState("18");
  const [addPartHsn, setAddPartHsn] = useState("");
  const [addPartGstApplicable, setAddPartGstApplicable] = useState(true);
  const [addPartActive, setAddPartActive] = useState(true);
  const [addPartBranchScope, setAddPartBranchScope] = useState("GLOBAL");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [historyPartId, setHistoryPartId] = useState<string | null>(null);

  const resetAddPartForm = () => {
    setAddPartName("");
    setAddPartBrand("");
    setAddPartSku("");
    setAddPartCategory("Other");
    setAddPartUnit("Piece");
    setAddPartQty("");
    setAddPartPrice("");
    setAddPartReorder("");
    setAddPartSupplier("");
    setAddPartBarcode("");
    setAddPartSecondaryUnit("");
    setAddPartConversionRate("1");
    setAddPartSecondaryPrice("");
    setAddPartDescription("");
    setAddPartCost("");
    setAddPartGstRate("18");
    setAddPartHsn("");
    setAddPartGstApplicable(true);
    setAddPartActive(true);
    setAddPartBranchScope("GLOBAL");
    setEditingPartId(null);
  };

  const openEditPart = useCallback((part: Part) => {
    setEditingPartId(part.id);
    setAddPartName(part.name);
    setAddPartBrand(part.brand ?? "");
    setAddPartSku(part.sku);
    setAddPartCategory(part.category);
    setAddPartUnit(part.primaryUnit || "Piece");
    setAddPartBarcode(part.barcode ?? "");
    setAddPartSupplier(part.supplier === "—" ? "" : part.supplier);
    setAddPartPrice(String(part.unitPrice ?? ""));
    setAddPartSecondaryPrice(
      part.unitPriceSecondary != null ? String(part.unitPriceSecondary) : ""
    );
    setAddPartDescription(part.description ?? "");
    setAddPartCost(part.costPrice != null ? String(part.costPrice) : "");
    setAddPartGstRate(part.gstRate != null ? String(part.gstRate) : "18");
    setAddPartHsn(part.hsnCode ?? "");
    setAddPartGstApplicable(part.gstApplicable !== false);
    setAddPartActive(part.isActive !== false);
    setAddPartBranchScope(part.branchScope ?? "GLOBAL");
    if (isMlTrackedPart(part)) {
      setAddPartUnit("Litre");
      setAddPartSecondaryUnit("ML");
      setAddPartConversionRate("1000");
      setAddPartQty(String(mlToLitres(part.stockQuantityMl ?? 0)));
      setAddPartReorder(
        part.reorderLevelMl != null ? String(mlToLitres(part.reorderLevelMl)) : ""
      );
    } else {
      const sec = part.secondaryUnit?.trim() ?? "";
      const dual =
        !!sec &&
        sec.toLowerCase() !== (part.primaryUnit || "").toLowerCase() &&
        part.conversionFactor > 1;
      setAddPartSecondaryUnit(dual ? sec : "");
      setAddPartConversionRate(dual ? String(part.conversionFactor) : "1");
      setAddPartQty(String(part.quantity ?? 0));
      setAddPartReorder(String(part.reorderLevel ?? ""));
    }
    setAddDialogOpen(true);
  }, []);

  const partsForTable = useMemo(() => {
    let list = parts;
    if (activeFilter === DASHBOARD_FILTER.LOW_STOCK) {
      list = list.filter(isLowStockPart);
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
  }, [parts, activeFilter, stockTableFilter, categoryFilter]);
  const catalogCategories = useMemo(
    () => mergePartCategoryNames(parts, savedPartCategories),
    [parts, savedPartCategories]
  );
  const productPurchases = useInventoryStore((s) => s.productPurchases);
  const stockTransfers = useInventoryStore((s) => s.stockTransfers);
  const addPurchase = useInventoryStore((s) => s.addPurchase);
  const recordStockAdjustment = useInventoryStore((s) => s.recordStockAdjustment);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  const [purchasePartId, setPurchasePartId] = useState("");
  const [purchaseVendor, setPurchaseVendor] = useState("");
  const [purchaseLitres, setPurchaseLitres] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");

  const [adjustPartId, setAdjustPartId] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"IN" | "OUT">("IN");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [deletingPart, setDeletingPart] = useState(false);

  const totalParts = parts.length;
  const totalStockItems = parts.reduce((sum, p) => sum + (p.quantity > 0 || (p.stockQuantityMl ?? 0) > 0 ? 1 : 0), 0);
  const totalValue = parts.reduce((sum, p) => sum + partStockValueInr(p), 0);
  const lowStockCount = parts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Low Stock";
  }).length;
  const outOfStockCount = parts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Out of Stock";
  }).length;
  const pendingTransfers = stockTransfers.filter(
    (t) => t.status === "PENDING" || t.status === "APPROVED" || t.status === "IN_TRANSIT"
  ).length;
  const outstandingPurchases = productPurchases.reduce((sum, p) => sum + purchaseDue(p), 0);

  const partsById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const openDeletePart = useCallback((part: Part) => {
    setDeleteTarget(part);
  }, []);

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
      if (purchasePartId === deleteTarget.id) setPurchasePartId("");
      toast.success("Catalog item deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete item. Is the API running?");
    } finally {
      setDeletingPart(false);
    }
  }, [deleteTarget, removePart, adjustPartId, purchasePartId]);

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
      label: "Stock",
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
      className: "hidden lg:table-cell",
    },
    {
      key: "actions",
      label: "",
      className: "w-[8.5rem] text-right",
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
            onClick={(e) => {
              e.stopPropagation();
              updatePart(item.id, { isActive: item.isActive === false });
              toast.success(item.isActive === false ? "Part activated" : "Part deactivated");
            }}
          >
            {item.isActive === false ? "Activate" : "Deactivate"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openEditPart(item);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              openDeletePart(item);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ],
    [openDeletePart, openEditPart, branches, updatePart]
  );

  const mlPartsForPurchase = parts.filter((p) => isMlTrackedPart(p));

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ml = parseLitresInput(purchaseLitres);
    if (!purchasePartId || !purchaseVendor.trim() || ml == null || ml <= 0) {
      toast.error("Enter a valid part, vendor, and quantity (litres).");
      return;
    }
    addPurchase({
      partId: purchasePartId,
      vendorName: purchaseVendor.trim(),
      quantityMl: ml,
      reference: purchaseRef.trim() || undefined,
      purchasedAt: new Date().toISOString(),
      recordedBy: performedBy,
    });
    toast.success("Purchase recorded and stock updated.");
    setPurchaseDialogOpen(false);
    setPurchasePartId("");
    setPurchaseVendor("");
    setPurchaseLitres("");
    setPurchaseRef("");
  };

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

  const handleAddPartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = addPartName.trim();
    const brand = addPartBrand.trim() || undefined;
    const sku = addPartSku.trim();
    const supplier = addPartSupplier.trim() || "—";
    if (!name || !sku) {
      toast.error("Enter part name and SKU");
      return;
    }
    const price = Number(addPartPrice);
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid selling price");
      return;
    }
    const costPrice = Number(addPartCost);
    if (!editingPartId && (Number.isNaN(costPrice) || addPartCost.trim() === "" || costPrice < 0)) {
      toast.error("Cost price is required");
      return;
    }
    const qtyInput = Number(addPartQty);
    const reorderInput = Number(addPartReorder);
    if (Number.isNaN(qtyInput) || qtyInput < 0) {
      toast.error("Enter a valid initial quantity");
      return;
    }
    const now = new Date().toISOString();
    const existing = editingPartId ? parts.find((p) => p.id === editingPartId) : null;
    const id = existing?.id ?? `prt-${Date.now().toString(36)}`;

    let next: Part;
    if (addPartUnit === "Litre") {
      const reorderLitres =
        Number.isNaN(reorderInput) || reorderInput < 0 ? 0 : reorderInput;
      next = {
        id,
        name,
        brand,
        sku,
        category: addPartCategory,
        quantity: 0,
        primaryUnit: "Litre",
        secondaryUnit: "ML",
        conversionFactor: 1000,
        unitPrice: price,
        reorderLevel: 0,
        supplier,
        barcode: addPartBarcode.trim() || undefined,
        stockQuantityMl: litresToMl(qtyInput),
        reorderLevelMl: litresToMl(reorderLitres),
        lastRestocked: existing?.lastRestocked ?? now,
        description: addPartDescription.trim() || undefined,
        costPrice: Number.isFinite(costPrice) && addPartCost.trim() !== "" ? costPrice : existing?.costPrice,
        gstRate: Number(addPartGstRate) || 0,
        hsnCode: addPartHsn.trim() || undefined,
        gstApplicable: addPartGstApplicable,
        isActive: addPartActive,
        branchScope: addPartBranchScope,
      };
    } else {
      const qty = Math.round(qtyInput);
      const reorder =
        Number.isNaN(reorderInput) || reorderInput < 0 ? 0 : Math.round(reorderInput);
      const isKg = addPartUnit === "Kg";
      const isRoll = addPartUnit === "Roll";
      const isBox = addPartUnit === "Box" || addPartUnit === "Pack" || addPartUnit === "Carton";
      const secondaryUnit =
        addPartSecondaryUnit.trim() ||
        (isKg ? "Grams" : isRoll ? "Sq.ft" : isBox ? "PCS" : addPartUnit);
      const conversionRaw = Number(addPartConversionRate);
      const conversionFactor =
        Number.isFinite(conversionRaw) && conversionRaw > 0
          ? conversionRaw
          : isKg
            ? 1000
            : isRoll
              ? 50
              : isBox
                ? 100
                : 1;
      const secondaryPriceRaw = Number(addPartSecondaryPrice);
      const unitPriceSecondary =
        Number.isFinite(secondaryPriceRaw) && secondaryPriceRaw >= 0
          ? secondaryPriceRaw
          : conversionFactor > 1
            ? price / conversionFactor
            : undefined;
      next = {
        id,
        name,
        brand,
        sku,
        barcode: addPartBarcode.trim() || undefined,
        category: addPartCategory,
        quantity: qty,
        primaryUnit: addPartUnit,
        secondaryUnit,
        conversionFactor,
        unitPrice: price,
        unitPriceSecondary,
        stockQuantitySecondary: conversionFactor > 1 ? qty * conversionFactor : undefined,
        reorderLevel: reorder,
        supplier,
        lastRestocked: existing?.lastRestocked ?? now,
        description: addPartDescription.trim() || undefined,
        costPrice: Number.isFinite(costPrice) && addPartCost.trim() !== "" ? costPrice : existing?.costPrice,
        gstRate: Number(addPartGstRate) || 0,
        hsnCode: addPartHsn.trim() || undefined,
        gstApplicable: addPartGstApplicable,
        isActive: addPartActive,
        branchScope: addPartBranchScope,
      };
    }

    if (existing) {
      updatePart(existing.id, next);
      toast.success("Catalog item updated");
    } else {
      addPart(next);
      toast.success("Catalog item created");
    }
    setAddDialogOpen(false);
    resetAddPartForm();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Inventory"
        description="Parts catalog, branch stock, transfers, purchases, and movement history"
        actions={
          <div className="flex flex-wrap gap-2">
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
            <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Log purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Log fluid purchase</DialogTitle>
                  <DialogDescription>
                    Vendor, timestamp (now), and litres received. Stock updates in millilitres.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePurchaseSubmit} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Fluid part</Label>
                    <Select value={purchasePartId} onValueChange={setPurchasePartId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        {mlPartsForPurchase.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Input
                      value={purchaseVendor}
                      onChange={(e) => setPurchaseVendor(e.target.value)}
                      placeholder="Supplier name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity (litres)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={purchaseLitres}
                      onChange={(e) => setPurchaseLitres(e.target.value)}
                      placeholder="e.g. 24"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (optional)</Label>
                    <Input
                      value={purchaseRef}
                      onChange={(e) => setPurchaseRef(e.target.value)}
                      placeholder="PO number"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={addDialogOpen}
              onOpenChange={(open) => {
                setAddDialogOpen(open);
                if (!open) resetAddPartForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingPartId(null);
                    resetAddPartForm();
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New item
                </Button>
              </DialogTrigger>
              <DialogContent
                className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,720px)]")}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
                  <DialogTitle>{editingPartId ? "Edit catalog item" : "New catalog item"}</DialogTitle>
                  <DialogDescription>
                    {editingPartId
                      ? "Update units, conversion, pricing, and on-hand quantity. Primary = pack unit; secondary = count unit (e.g. 1 Box = 12 PCS)."
                      : "Choose Piece, Set, Kg, etc., or Litre for fluids. For packs, set secondary unit + conversion (e.g. 1 Box = 12 PCS)."}
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={handleAddPartSubmit}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 [-webkit-overflow-scrolling:touch]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="add-part-name">
                          Part Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="add-part-name"
                          placeholder="e.g. Brake Pad Set"
                          value={addPartName}
                          onChange={(e) => setAddPartName(e.target.value)}
                          onFocus={focusMobileFormField}
                          autoComplete="off"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-part-brand">Brand</Label>
                        <Input
                          id="add-part-brand"
                          placeholder="e.g. Bosch"
                          value={addPartBrand}
                          onChange={(e) => setAddPartBrand(e.target.value)}
                          onFocus={focusMobileFormField}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-sku">
                        SKU / Part number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="add-part-sku"
                        placeholder="e.g. BRK-PAD-001"
                        value={addPartSku}
                        onChange={(e) => setAddPartSku(e.target.value)}
                        onFocus={focusMobileFormField}
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-barcode">Barcode (optional)</Label>
                      <Input
                        id="add-part-barcode"
                        placeholder="Scan or enter barcode"
                        value={addPartBarcode}
                        onChange={(e) => setAddPartBarcode(e.target.value)}
                        onFocus={focusMobileFormField}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Category <span className="text-destructive">*</span>
                      </Label>
                      <PartCategorySelect
                        value={addPartCategory}
                        onChange={setAddPartCategory}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-unit">Primary unit</Label>
                      <Select value={addPartUnit} onValueChange={setAddPartUnit}>
                        <SelectTrigger id="add-part-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PART_STOCK_UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {addPartUnit !== "Litre" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="add-part-secondary-unit">Secondary unit (optional)</Label>
                          <Input
                            id="add-part-secondary-unit"
                            placeholder="e.g. PCS, GM, ML"
                            value={addPartSecondaryUnit}
                            onChange={(e) => setAddPartSecondaryUnit(e.target.value)}
                            onFocus={focusMobileFormField}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="add-part-conversion">Conversion (1 primary = ? secondary)</Label>
                          <Input
                            id="add-part-conversion"
                            type="number"
                            min={1}
                            step={1}
                            placeholder="e.g. 100 for 1 BOX = 100 PCS"
                            value={addPartConversionRate}
                            onChange={(e) => setAddPartConversionRate(e.target.value)}
                            onFocus={focusMobileFormField}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="add-part-qty">
                        {addPartUnit === "Litre"
                          ? editingPartId
                            ? "On-hand stock (litres)"
                            : "Initial stock (litres)"
                          : editingPartId
                            ? `On-hand quantity (${addPartUnit})`
                            : "Initial quantity"}
                      </Label>
                      <Input
                        id="add-part-qty"
                        type="number"
                        min="0"
                        step={addPartUnit === "Litre" ? "0.01" : "1"}
                        placeholder="0"
                        value={addPartQty}
                        onChange={(e) => setAddPartQty(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-price">Selling price (₹)</Label>
                      <Input
                        id="add-part-price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 500 per BOX"
                        value={addPartPrice}
                        onChange={(e) => setAddPartPrice(e.target.value)}
                        required
                      />
                    </div>
                    {addPartUnit !== "Litre" && (
                      <div className="space-y-2">
                        <Label htmlFor="add-part-secondary-price">Secondary unit price (₹, optional)</Label>
                        <Input
                          id="add-part-secondary-price"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Auto from primary ÷ conversion"
                          value={addPartSecondaryPrice}
                          onChange={(e) => setAddPartSecondaryPrice(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="add-part-reorder">
                        {addPartUnit === "Litre" ? "Reorder at (litres)" : `Reorder level (${addPartUnit})`}
                      </Label>
                      <Input
                        id="add-part-reorder"
                        type="number"
                        min="0"
                        step={addPartUnit === "Litre" ? "0.01" : "1"}
                        placeholder="0"
                        value={addPartReorder}
                        onChange={(e) => setAddPartReorder(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="add-part-supplier">Supplier</Label>
                      <Input
                        id="add-part-supplier"
                        placeholder="e.g. Bosch India (optional)"
                        value={addPartSupplier}
                        onChange={(e) => setAddPartSupplier(e.target.value)}
                        onFocus={focusMobileFormField}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="add-part-description">Description</Label>
                      <Textarea
                        id="add-part-description"
                        value={addPartDescription}
                        onChange={(e) => setAddPartDescription(e.target.value)}
                        placeholder="Optional notes about this part"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-cost">
                        Cost price {editingPartId ? "" : <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="add-part-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={addPartCost}
                        onChange={(e) => setAddPartCost(e.target.value)}
                        required={!editingPartId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-gst">GST rate %</Label>
                      <Input
                        id="add-part-gst"
                        type="number"
                        min="0"
                        step="0.01"
                        value={addPartGstRate}
                        onChange={(e) => setAddPartGstRate(e.target.value)}
                        disabled={!addPartGstApplicable}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-hsn">HSN code</Label>
                      <Input
                        id="add-part-hsn"
                        value={addPartHsn}
                        onChange={(e) => setAddPartHsn(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch scope</Label>
                      <Select value={addPartBranchScope} onValueChange={setAddPartBranchScope}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GLOBAL">All branches</SelectItem>
                          {branches.filter((b) => b.isActive).map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={addPartGstApplicable}
                        onCheckedChange={(v) => setAddPartGstApplicable(v === true)}
                      />
                      GST applicable
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={addPartActive}
                        onCheckedChange={(v) => setAddPartActive(v === true)}
                      />
                      Active
                    </label>
                  </div>
                  </div>
                  <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAddDialogOpen(false);
                        resetAddPartForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">{editingPartId ? "Save changes" : "Create item"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
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

      <Tabs defaultValue="parts" className="space-y-4">
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
                        onClick={() => openEditPart(item)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => openDeletePart(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
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
          <InventoryPurchasesTab />
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
