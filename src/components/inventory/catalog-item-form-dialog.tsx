"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { isMlTrackedPart, litresToMl, mlToLitres } from "@/lib/inventory-units";
import { getCanonicalStockSecondary } from "@/lib/inventory/multi-unit";
import { PartCategorySelect } from "@/components/inventory/part-category-select";
import { PartUsedInFields } from "@/components/inventory/part-used-in-fields";
import {
  DEFAULT_PART_USED_IN,
  normalizePartUsedIn,
  type PartUsedIn,
} from "@/lib/inventory/part-used-in";
import { useInventoryStore } from "@/store/inventory-store";
import { useBranchStore } from "@/store/branch-store";
import { useBranchScope } from "@/lib/branch-scope";
import type { Part, PartCategory } from "@/types";

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

const SECONDARY_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "PCS", label: "PCS" },
  { value: "GM", label: "Grm" },
  { value: "ML", label: "ML" },
  { value: "Sq.ft", label: "Sq.ft" },
];

const DEFAULT_SECONDARY_BY_PRIMARY: Record<string, { unit: string; conversion: string }> = {
  Kg: { unit: "GM", conversion: "1000" },
  Litre: { unit: "ML", conversion: "1000" },
  Box: { unit: "PCS", conversion: "100" },
  Pack: { unit: "PCS", conversion: "100" },
  Carton: { unit: "PCS", conversion: "100" },
  Roll: { unit: "Sq.ft", conversion: "50" },
};

function normalizeSecondarySelectValue(raw: string): string {
  const t = raw.trim();
  if (!t || t === "NONE") return "";
  if (/^(gm|grm|gram|grams)$/i.test(t)) return "GM";
  if (/^ml$/i.test(t)) return "ML";
  if (/^(pcs|pc|piece|pieces)$/i.test(t)) return "PCS";
  if (/^sq\.?\s*ft$/i.test(t)) return "Sq.ft";
  const match = SECONDARY_UNIT_OPTIONS.find((o) => o.value.toLowerCase() === t.toLowerCase());
  return match?.value ?? t;
}

function reverseNormalizeSecondarySelectValue(raw: string): string {
  const t = raw.trim();
  if (!t) return "NONE";
  return t;
}

function focusMobileFormField(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(max-width: 639px)").matches) return;
  const el = e.currentTarget;
  window.setTimeout(() => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 320);
}

export function CatalogItemFormDialog({
  open,
  onOpenChange,
  editingPart = null,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPart?: Part | null;
  onCreated?: (part: Part) => void;
}) {
  const parts = useInventoryStore((s) => s.parts);
  const addPart = useInventoryStore((s) => s.addPart);
  const updatePart = useInventoryStore((s) => s.updatePart);
  const branches = useBranchStore((s) => s.branches);
  const { selectedBranchId } = useBranchScope();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<PartCategory>("Other");
  const [usedIn, setUsedIn] = useState<PartUsedIn[]>([...DEFAULT_PART_USED_IN]);
  const [unit, setUnit] = useState("Piece");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [reorder, setReorder] = useState("");
  const [supplier, setSupplier] = useState("");
  const [barcode, setBarcode] = useState("");
  const [secondaryUnit, setSecondaryUnit] = useState("");
  const [conversionRate, setConversionRate] = useState("1");
  const [secondaryPrice, setSecondaryPrice] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [hsn, setHsn] = useState("");
  const [gstApplicable, setGstApplicable] = useState(true);
  const [active, setActive] = useState(true);
  const [branchScope, setBranchScope] = useState("GLOBAL");
  const [editingCanonicalSecondary, setEditingCanonicalSecondary] = useState<number | null>(null);
  
  // Flags to prevent infinite loops between qty-capture and conversion-recalc effects
  const skipQtyCapture = useRef(false);  // Set by second effect to skip first effect
  const skipConversionRecalc = useRef(false);  // Set by first effect to skip second effect

  const reset = () => {
    setName("");
    setBrand("");
    setSku("");
    setCategory("Other");
    setUsedIn([...DEFAULT_PART_USED_IN]);
    setUnit("Piece");
    setQty("");
    setPrice("");
    setReorder("");
    setSupplier("");
    setBarcode("");
    setSecondaryUnit("");
    setConversionRate("1");
    setSecondaryPrice("");
    setDescription("");
    setCost("");
    setGstRate("18");
    setHsn("");
    setGstApplicable(true);
    setActive(true);
    setBranchScope("GLOBAL");
    setEditingCanonicalSecondary(null);
  };

  useEffect(() => {
    if (!open) return;
    if (!editingPart) {
      reset();
      return;
    }
    const part = editingPart;
    // Use the quantity shown in the editor context (already branch-scoped in inventory page)
    // so changing conversion recalculates on-hand immediately and consistently.
    const primaryQty = Number(part.quantity ?? 0);
    const conv = Number(part.conversionFactor ?? 1);
    const sec = part.secondaryUnit?.trim() ?? "";
    const pri = part.primaryUnit?.trim() ?? "";
    const dual = !!sec && !!pri && sec.toLowerCase() !== pri.toLowerCase() && Number.isFinite(conv) && conv > 1;
    const canonicalFromEditor = isMlTrackedPart(part)
      ? (part.stockQuantityMl ?? 0)
      : dual
        ? primaryQty * conv
        : Math.round(primaryQty);
    setEditingCanonicalSecondary(canonicalFromEditor);
    setName(part.name);
    setBrand(part.brand ?? "");
    setSku(part.sku);
    setCategory(part.category);
    setUsedIn(normalizePartUsedIn(part.usedIn));
    setUnit(part.primaryUnit || "Piece");
    setBarcode(part.barcode ?? "");
    setSupplier(part.supplier === "—" ? "" : part.supplier);
    setPrice(String(part.unitPrice ?? ""));
    setSecondaryPrice(part.unitPriceSecondary != null ? String(Math.round(part.unitPriceSecondary * 100) / 100) : "");
    setDescription(part.description ?? "");
    setCost(part.costPrice != null ? String(part.costPrice) : "");
    setGstRate(part.gstRate != null ? String(part.gstRate) : "18");
    setHsn(part.hsnCode ?? "");
    setGstApplicable(part.gstApplicable !== false);
    setActive(part.isActive !== false);
    setBranchScope(part.branchScope ?? "GLOBAL");
    if (isMlTrackedPart(part)) {
      setUnit("Litre");
      setSecondaryUnit("ML");
      setConversionRate("1000");
      setQty(String(mlToLitres(part.stockQuantityMl ?? 0)));
      setReorder(part.reorderLevelMl != null ? String(mlToLitres(part.reorderLevelMl)) : "");
    } else {
      const sec = part.secondaryUnit?.trim() ?? "";
      const dual =
        !!sec &&
        sec.toLowerCase() !== (part.primaryUnit || "").toLowerCase() &&
        part.conversionFactor > 1;
      setSecondaryUnit(dual ? normalizeSecondarySelectValue(sec) : "");
      setConversionRate(dual ? String(part.conversionFactor) : "1");
      setQty(String(part.quantity ?? 0));
      setReorder(String(part.reorderLevel ?? ""));
    }
  }, [open, editingPart]);

  // When user manually edits quantity, capture it as the new canonical stock
  // Note: conversionRate is NOT in dependencies - we capture qty changes independently
  useEffect(() => {
    if (!open || !editingPart) return;
    
    // If the second effect just updated qty due to conversion change, skip this
    if (skipQtyCapture.current) {
      skipQtyCapture.current = false;
      return;
    }
    
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum)) return;
    
    // Set flag so the second effect knows canonical was just updated by user
    skipConversionRecalc.current = true;
    
    if (unit === "Litre") {
      setEditingCanonicalSecondary(litresToMl(qtyNum));
      return;
    }

    const sec = secondaryUnit.trim();
    const conversionRaw = Number(conversionRate);
    const conversion = Number.isFinite(conversionRaw) && conversionRaw > 0 ? conversionRaw : 1;
    const dual = !!sec && sec.toLowerCase() !== unit.trim().toLowerCase() && conversion > 1;

    if (dual) {
      // User entered primary qty, convert to canonical secondary
      setEditingCanonicalSecondary(Math.round(qtyNum * conversion * 1000) / 1000);
    } else {
      setEditingCanonicalSecondary(qtyNum);
    }
  }, [qty, unit, secondaryUnit, open, editingPart]);

  // When conversion rate changes, recalculate qty to preserve canonical stock
  useEffect(() => {
    if (!open || !editingPart || editingCanonicalSecondary == null) return;
    
    // If the first effect just updated canonical due to user input, skip recalc
    if (skipConversionRecalc.current) {
      skipConversionRecalc.current = false;
      return;
    }
    
    // Set flag so the first effect knows qty is being updated automatically
    skipQtyCapture.current = true;
    
    if (unit === "Litre") {
      setQty(String(mlToLitres(editingCanonicalSecondary)));
      return;
    }

    const sec = secondaryUnit.trim();
    const conversionRaw = Number(conversionRate);
    const conversion = Number.isFinite(conversionRaw) && conversionRaw > 0 ? conversionRaw : 1;
    const dual = !!sec && sec.toLowerCase() !== unit.trim().toLowerCase() && conversion > 1;

    if (dual) {
      const primaryQty = editingCanonicalSecondary / conversion;
      const pretty = Number.isInteger(primaryQty)
        ? String(primaryQty)
        : String(Math.round(primaryQty * 1000) / 1000);
      setQty(pretty);
    } else {
      setQty(String(Math.round(editingCanonicalSecondary)));
    }
  }, [open, editingPart, editingCanonicalSecondary, unit, secondaryUnit, conversionRate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = name.trim();
    const trimmedBrand = brand.trim() || undefined;
    const trimmedSku = sku.trim();
    const supplierVal = supplier.trim() || "—";
    if (!trimmedName || !trimmedSku) {
      toast.error("Enter part name and SKU");
      return;
    }
    const sellingPrice = price.trim() === "" ? 0 : Number(price);
    if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
      toast.error("Enter a valid selling price");
      return;
    }
    const costPrice = Number(cost);
    if (!editingPart && (Number.isNaN(costPrice) || cost.trim() === "" || costPrice < 0)) {
      toast.error("Cost price is required");
      return;
    }
    const qtyInput = Number(qty);
    const reorderInput = Number(reorder);
    if (Number.isNaN(qtyInput) || qtyInput < 0) {
      toast.error("Enter a valid opening stock");
      return;
    }
    const now = new Date().toISOString();
    const existing = editingPart ? parts.find((p) => p.id === editingPart.id) : null;
    const id = existing?.id ?? `prt-${Date.now().toString(36)}`;
    const isLitre = unit === "Litre";
    let qtyValue = isLitre ? qtyInput : Math.round(qtyInput);
    const reorderValue =
      Number.isNaN(reorderInput) || reorderInput < 0
        ? 0
        : isLitre
          ? reorderInput
          : Math.round(reorderInput);
    const isKg = unit === "Kg";
    const isRoll = unit === "Roll";
    const isBox = unit === "Box" || unit === "Pack" || unit === "Carton";
    // Normalize "NONE" (Select placeholder) to empty string for storage
    const rawSecondaryUnit = secondaryUnit.trim() === "NONE" ? "" : secondaryUnit.trim();
    const nextSecondaryUnit =
      rawSecondaryUnit ||
      (isLitre ? "ML" : isKg ? "GM" : isRoll ? "Sq.ft" : isBox ? "PCS" : unit);
    const conversionRaw = Number(conversionRate);
    // If no secondary unit selected, conversion is always 1
    const conversionFactor = !rawSecondaryUnit
      ? 1
      : Number.isFinite(conversionRaw) && conversionRaw > 0
        ? conversionRaw
        : isLitre
          ? 1000
          : isKg
            ? 1000
            : isRoll
              ? 50
              : isBox
                ? 100
                : 1;
    const secondaryPriceRaw = secondaryPrice.trim() !== "" ? Number(secondaryPrice) : NaN;
    const unitPriceSecondary =
      Number.isFinite(secondaryPriceRaw) && secondaryPriceRaw >= 0
        ? secondaryPriceRaw
        : conversionFactor > 1
          ? sellingPrice / conversionFactor
          : undefined;
    const mlTracked =
      isLitre && nextSecondaryUnit.trim().toUpperCase() === "ML" && conversionFactor === 1000;

    // Editing conversion for dual-unit parts should preserve canonical stock.
    // Only when user changed conversion rate, NOT when they manually edited on-hand qty.
    const preserveCanonicalOnEdit =
      !!existing &&
      !mlTracked &&
      !!rawSecondaryUnit &&
      rawSecondaryUnit.toLowerCase() !== unit.trim().toLowerCase() &&
      conversionFactor > 1 &&
      editingCanonicalSecondary == null; // null means user didn't touch qty — preserve old canonical
    let stockQuantitySecondaryOverride: number | undefined;
    if (preserveCanonicalOnEdit) {
      const canonical = getCanonicalStockSecondary(existing);
      stockQuantitySecondaryOverride = canonical;
      qtyValue = Math.floor(canonical / conversionFactor);
    } else if (!!rawSecondaryUnit && conversionFactor > 1 && editingCanonicalSecondary != null) {
      // User manually edited qty — editingCanonicalSecondary was set by the qty-capture effect
      stockQuantitySecondaryOverride = editingCanonicalSecondary;
      qtyValue = Math.round(editingCanonicalSecondary / conversionFactor);
    }

    const next: Part = mlTracked
      ? {
          id,
          name: trimmedName,
          brand: trimmedBrand,
          sku: trimmedSku,
          category,
          quantity: 0,
          primaryUnit: "Litre",
          secondaryUnit: nextSecondaryUnit,
          conversionFactor,
          unitPrice: sellingPrice,
          unitPriceSecondary,
          reorderLevel: 0,
          supplier: supplierVal,
          barcode: barcode.trim() || undefined,
          stockQuantityMl: litresToMl(qtyValue),
          reorderLevelMl: litresToMl(reorderValue),
          lastRestocked: existing?.lastRestocked ?? now,
          description: description.trim() || undefined,
          costPrice: Number.isFinite(costPrice) && cost.trim() !== "" ? costPrice : existing?.costPrice,
          gstRate: Number(gstRate) || 0,
          hsnCode: hsn.trim() || undefined,
          gstApplicable,
          isActive: active,
          branchScope,
          usedIn,
        }
      : {
          id,
          name: trimmedName,
          brand: trimmedBrand,
          sku: trimmedSku,
          barcode: barcode.trim() || undefined,
          category,
          quantity: qtyValue,
          primaryUnit: unit,
          secondaryUnit: nextSecondaryUnit,
          conversionFactor,
          unitPrice: sellingPrice,
          unitPriceSecondary,
          stockQuantitySecondary:
            stockQuantitySecondaryOverride ??
            (conversionFactor > 1 ? qtyValue * conversionFactor : undefined),
          reorderLevel: reorderValue,
          supplier: supplierVal,
          lastRestocked: existing?.lastRestocked ?? now,
          description: description.trim() || undefined,
          costPrice: Number.isFinite(costPrice) && cost.trim() !== "" ? costPrice : existing?.costPrice,
          gstRate: Number(gstRate) || 0,
          hsnCode: hsn.trim() || undefined,
          gstApplicable,
          isActive: active,
          branchScope,
          usedIn,
        };

    if (existing) {
      // When primary unit changes away from Litre, clear the old ML stock field
      // so getCanonicalStockSecondary uses the correct representation.
      const patch = unit !== "Litre" && existing.primaryUnit === "Litre"
        ? { ...next, stockQuantityMl: undefined }
        : next;
      updatePart(existing.id, patch, { branchId: selectedBranchId ?? undefined });
      toast.success("Catalog item updated");
    } else {
      const created = addPart(next);
      toast.success("Catalog item created");
      onCreated?.(created);
    }
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent
        className={cn(
          dialogMobileSheetContentClasses,
          "z-80 max-h-[min(92dvh,880px)] sm:max-w-4xl"
        )}
        overlayClassName="z-[80]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-radix-select-content], [data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
          e.stopPropagation();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-radix-select-content], [data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
          e.stopPropagation();
        }}
      >
        <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
          <DialogTitle>{editingPart ? "Edit catalog item" : "New catalog item"}</DialogTitle>
          <DialogDescription>
            {editingPart
              ? "Update units, conversion, pricing, and on-hand quantity. Primary = pack unit; secondary = count unit (e.g. 1 Box = 12 PCS)."
              : "Choose Piece, Set, Kg, etc., or Litre for fluids. For packs, set secondary unit + conversion (e.g. 1 Box = 12 PCS)."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault(); }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 [-webkit-overflow-scrolling:touch]">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-part-name">
                  Part Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="catalog-part-name"
                  placeholder="e.g. Brake Pad Set"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={focusMobileFormField}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-sku">
                  SKU / Part number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="catalog-part-sku"
                  placeholder="e.g. BRK-PAD-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  onFocus={focusMobileFormField}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-brand">Brand</Label>
                <Input
                  id="catalog-part-brand"
                  placeholder="e.g. Bosch"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  onFocus={focusMobileFormField}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-barcode">Barcode (optional)</Label>
                <Input
                  id="catalog-part-barcode"
                  placeholder="Scan or enter barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onFocus={focusMobileFormField}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <PartCategorySelect value={category} onChange={setCategory} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-unit">Primary unit</Label>
                <Select
                  value={unit}
                  onValueChange={(nextUnit) => {
                    setUnit(nextUnit);
                    const preset = DEFAULT_SECONDARY_BY_PRIMARY[nextUnit];
                    if (preset) {
                      setSecondaryUnit(preset.unit);
                      setConversionRate(preset.conversion);
                    }
                  }}
                >
                  <SelectTrigger id="catalog-part-unit">
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
                <Label htmlFor="catalog-part-secondary-unit">Secondary unit (optional)</Label>
                <Select
                  value={reverseNormalizeSecondarySelectValue(secondaryUnit)}
                  onValueChange={(val) => setSecondaryUnit(normalizeSecondarySelectValue(val))}
                >
                  <SelectTrigger id="catalog-part-secondary-unit">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECONDARY_UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-conversion">Conversion (1 primary = ? secondary)</Label>
                <Input
                  id="catalog-part-conversion"
                  type="number"
                  min={1}
                  step="any"
                  placeholder="e.g. 1000 for 1 Litre = 1000 ML"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  onFocus={focusMobileFormField}
                  disabled={secondaryUnit === "NONE" || secondaryUnit === ""}
                />
                <p className="text-[11px] text-muted-foreground">
                  Stock is tracked in secondary units. Example: 1 Box = 12 PCS means on-hand sync uses PCS internally.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-qty">
                  {editingPart
                    ? `On-hand quantity (${unit})`
                    : unit === "Litre"
                      ? "Opening stock (litres)"
                      : "Opening stock"}
                </Label>
                <Input
                  id="catalog-part-qty"
                  type="number"
                  min="0"
                  step={unit === "Litre" ? "0.01" : "1"}
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Displayed in {unit}; converted stock remains consistent across inventory, purchases, and branch stock.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-reorder">Reorder level ({unit})</Label>
                <Input
                  id="catalog-part-reorder"
                  type="number"
                  min="0"
                  step={unit === "Litre" ? "0.01" : "1"}
                  placeholder="0"
                  value={reorder}
                  onChange={(e) => setReorder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-cost">
                  Cost price {editingPart ? "" : <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="catalog-part-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required={!editingPart}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-price">Selling price (₹) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="catalog-part-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 500 per BOX"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-secondary-price">Secondary unit price (₹, optional)</Label>
                <Input
                  id="catalog-part-secondary-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Auto from primary ÷ conversion"
                  value={secondaryPrice}
                  onChange={(e) => setSecondaryPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-gst">GST rate %</Label>
                <Input
                  id="catalog-part-gst"
                  type="number"
                  min="0"
                  step="0.01"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  disabled={!gstApplicable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-hsn">HSN code</Label>
                <Input
                  id="catalog-part-hsn"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Branch scope</Label>
                <Select value={branchScope} onValueChange={setBranchScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">All branches</SelectItem>
                    {branches
                      .filter((b) => b.isActive)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <PartUsedInFields value={usedIn} onChange={setUsedIn} />
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={gstApplicable}
                    onCheckedChange={(v) => setGstApplicable(v === true)}
                  />
                  GST applicable
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
                  Active
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-supplier">Supplier</Label>
                <Input
                  id="catalog-part-supplier"
                  placeholder="e.g. Bosch India (optional)"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  onFocus={focusMobileFormField}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-part-description">Description</Label>
                <Textarea
                  id="catalog-part-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this part"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingPart ? "Save changes" : "Create item"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
