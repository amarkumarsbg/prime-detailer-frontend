"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime, formatDate, cn } from "@/lib/utils";
import {
  formatMlAndLitres,
  formatPartStockQuantity,
  getStockStatus,
  isMlTrackedPart,
  litresToMl,
  partStockValueInr,
  stockStatusShortLabel,
} from "@/lib/inventory-units";
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
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
} from "lucide-react";
import type { Part, PartCategory } from "@/types";

/** Primary units for stock; Litre uses ml-backed quantity like existing fluid parts. */
const PART_STOCK_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "Piece", label: "Piece" },
  { value: "Set", label: "Set" },
  { value: "Kg", label: "Kg" },
  { value: "Litre", label: "Litre (fluid)" },
  { value: "Roll", label: "Roll" },
  { value: "Box", label: "Box" },
  { value: "Pair", label: "Pair" },
];
import { toast } from "sonner";
import { useInventoryStore, parseLitresInput } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { carsPossibleForPartAndService } from "@/lib/inventory/consumption";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isLowStockPart } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";

const allCategories: PartCategory[] = [
  "Engine",
  "Brakes",
  "Electrical",
  "Filters",
  "Suspension",
  "AC",
  "Body",
  "Lubricants",
  "Tires",
  "Detailing",
  "Other",
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
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const parts = useInventoryStore((s) => s.parts);
  const addPart = useInventoryStore((s) => s.addPart);
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
  };

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
    return list;
  }, [parts, activeFilter, stockTableFilter]);
  const stockMovements = useInventoryStore((s) => s.stockMovements);
  const productPurchases = useInventoryStore((s) => s.productPurchases);
  const addPurchase = useInventoryStore((s) => s.addPurchase);
  const recordStockAdjustment = useInventoryStore((s) => s.recordStockAdjustment);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
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
  const totalValue = parts.reduce((sum, p) => sum + partStockValueInr(p), 0);
  const lowStockCount = parts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Low Stock";
  }).length;
  const outOfStockCount = parts.filter((p) => {
    const s = getStockStatus(p);
    return s.label === "Out of Stock";
  }).length;

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
        return (
          <div className="inline-flex min-w-[4.5rem] flex-col gap-1">
            <span className="font-semibold text-sm tabular-nums leading-none">
              {formatPartStockQuantity(item)}
            </span>
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
      label: "Unit Price",
      sortable: true,
      className: "whitespace-nowrap text-right",
      render: (item: Part) => (
        <span className="tabular-nums">{formatCurrency(item.unitPrice)}</span>
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
      className: "w-12 text-right",
      render: (item: Part) => (
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
      ),
    },
  ],
    [openDeletePart]
  );

  const recentMovements = [...stockMovements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
      recordedBy: "usr-001",
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
      recordStockAdjustment({
        partId: adjustPartId,
        direction: adjustDirection,
        amountMl: n,
        reason: "Manual adjustment",
        performedBy: "usr-001",
      });
    } else {
      recordStockAdjustment({
        partId: adjustPartId,
        direction: adjustDirection,
        amountCount: Math.round(n),
        reason: "Manual adjustment",
        performedBy: "usr-001",
      });
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
      toast.error("Enter a valid unit price");
      return;
    }
    const qtyInput = Number(addPartQty);
    const reorderInput = Number(addPartReorder);
    if (Number.isNaN(qtyInput) || qtyInput < 0) {
      toast.error("Enter a valid initial quantity");
      return;
    }
    const now = new Date().toISOString();
    const id = `prt-${Date.now().toString(36)}`;

    if (addPartUnit === "Litre") {
      const reorderLitres =
        Number.isNaN(reorderInput) || reorderInput < 0 ? 0 : reorderInput;
      addPart({
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
        stockQuantityMl: litresToMl(qtyInput),
        reorderLevelMl: litresToMl(reorderLitres),
        lastRestocked: now,
      });
    } else {
      const qty = Math.round(qtyInput);
      const reorder =
        Number.isNaN(reorderInput) || reorderInput < 0 ? 0 : Math.round(reorderInput);
      const isKg = addPartUnit === "Kg";
      const isRoll = addPartUnit === "Roll";
      addPart({
        id,
        name,
        brand,
        sku,
        category: addPartCategory,
        quantity: qty,
        primaryUnit: addPartUnit,
        secondaryUnit: isKg ? "Grams" : isRoll ? "Sq.ft" : addPartUnit,
        conversionFactor: isKg ? 1000 : isRoll ? 50 : 1,
        unitPrice: price,
        reorderLevel: reorder,
        supplier,
        lastRestocked: now,
      });
    }

    toast.success("Catalog item created");
    setAddDialogOpen(false);
    resetAddPartForm();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Inventory"
        description="Spare parts, on-hand levels, and fluid tracking (stored in ml, displayed in litres)"
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
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New item
                </Button>
              </DialogTrigger>
              <DialogContent
                className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,720px)]")}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
                  <DialogTitle>New catalog item</DialogTitle>
                  <DialogDescription>
                    Choose Piece, Set, Kg, etc., or Litre for fluids — the table shows the same unit you pick.
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
                        <Label htmlFor="add-part-name">Part Name</Label>
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
                      <Label htmlFor="add-part-sku">SKU</Label>
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
                      <Label>Category</Label>
                      <Select
                        value={addPartCategory}
                        onValueChange={(v) => setAddPartCategory(v as PartCategory)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-part-unit">Stock unit</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="add-part-qty">
                        {addPartUnit === "Litre" ? "Initial stock (litres)" : "Initial quantity"}
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
                      <Label htmlFor="add-part-price">Unit Price (₹)</Label>
                      <Input
                        id="add-part-price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={addPartPrice}
                        onChange={(e) => setAddPartPrice(e.target.value)}
                        required
                      />
                    </div>
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
                    <Button type="submit">Create item</Button>
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
      </div>

      <Tabs defaultValue="parts">
        <TabsList className="bg-muted/60">
          <TabsTrigger
            value="parts"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Catalog
          </TabsTrigger>
          <TabsTrigger
            value="movements"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="purchases"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Intake
          </TabsTrigger>
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
          <DataTable
            data={partsForTable}
            columns={columns}
            searchPlaceholder="Search SKU, name, supplier…"
            searchKeys={["name", "sku", "category", "supplier", "brand"]}
            mobileCardBelow="lg"
            renderMobileCard={(item) => {
              const status = getStockStatus(item);
              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{item.name}</p>
                      {item.brand ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.brand}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
                      <span className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-sm tabular-nums whitespace-nowrap">
                        {formatPartStockQuantity(item)}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <span className="text-sm tabular-nums font-medium">{formatCurrency(item.unitPrice)}</span>
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
              );
            }}
          />
        </TabsContent>
        <TabsContent value="movements" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-7 shrink-0 rounded-full bg-primary" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight">Recent stock activity</h2>
          </div>
          <Card>
            <CardContent className="!p-0">
              <div className="divide-y divide-border">
                {recentMovements.map((m) => {
                  const part = parts.find((p) => p.id === m.partId);
                  const qtyLabel =
                    m.unit === "ML" ? `${m.quantity.toLocaleString("en-IN")} ml` : `${m.quantity} ${m.unit}`;
                  return (
                    <div key={m.id} className="flex items-center gap-4 p-4">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          m.type === "IN"
                            ? "bg-violet-100 dark:bg-violet-900/30"
                            : "bg-red-100 dark:bg-red-900/30"
                        }`}
                      >
                        {m.type === "IN" ? (
                          <ArrowDownCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        ) : (
                          <ArrowUpCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {m.type === "IN" ? "+" : "-"}
                          {qtyLabel} · {part?.name ?? m.partId}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.reason}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                        {formatDateTime(m.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="purchases" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-7 shrink-0 rounded-full bg-primary" aria-hidden />
            <h2 className="text-base font-semibold tracking-tight">Fluid purchases</h2>
          </div>
          <Card>
            <CardContent className="!p-0">
              <div className="divide-y divide-border">
                {productPurchases.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No intake logged yet.</p>
                ) : (
                  [...productPurchases]
                    .sort(
                      (a, b) =>
                        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
                    )
                    .map((pp) => {
                      const part = parts.find((p) => p.id === pp.partId);
                      return (
                        <div key={pp.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-sm">{part?.name ?? pp.partId}</p>
                            <p className="text-xs text-muted-foreground">
                              {pp.vendorName}
                              {pp.reference ? ` · ${pp.reference}` : ""}
                            </p>
                          </div>
                          <div className="text-sm text-right">
                            <p className="font-medium">{formatMlAndLitres(pp.quantityMl)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(pp.purchasedAt)}</p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
}
