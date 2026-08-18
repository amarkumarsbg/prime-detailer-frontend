"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { PartCategorySelect } from "@/components/inventory/part-category-select";
import { PartUsedInFields } from "@/components/inventory/part-used-in-fields";
import { DEFAULT_PART_USED_IN, type PartUsedIn } from "@/lib/inventory/part-used-in";
import { useInventoryStore } from "@/store/inventory-store";
import type { Part } from "@/types";

export function InventoryQuickAddPartDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (partId: string) => void;
}) {
  const addPart = useInventoryStore((s) => s.addPart);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Other");
  const [usedIn, setUsedIn] = useState<PartUsedIn[]>([...DEFAULT_PART_USED_IN]);
  const [cost, setCost] = useState("");
  const [sell, setSell] = useState("");
  const [unit, setUnit] = useState("Piece");

  const reset = () => {
    setName("");
    setSku("");
    setCategory("Other");
    setUsedIn([...DEFAULT_PART_USED_IN]);
    setCost("");
    setSell("");
    setUnit("Piece");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) {
      toast.error("Part name and SKU are required.");
      return;
    }
    const costPrice = Number(cost);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      toast.error("Cost price is required.");
      return;
    }
    const unitPrice = sell.trim() ? Number(sell) : costPrice;
    const id = `part-${Date.now()}`;
    const part: Part = {
      id,
      name: name.trim(),
      sku: sku.trim(),
      category,
      quantity: 0,
      primaryUnit: unit,
      secondaryUnit: unit,
      conversionFactor: 1,
      costPrice,
      unitPrice,
      reorderLevel: 0,
      supplier: "—",
      lastRestocked: new Date().toISOString(),
      gstApplicable: true,
      gstRate: 18,
      isActive: true,
      branchScope: "GLOBAL",
      usedIn,
    };
    addPart(part);
    toast.success("Part added to catalog.");
    onCreated(id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-md")}>
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Add part</DialogTitle>
          <DialogDescription>Create a catalog item without leaving this purchase.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 px-6 py-4">
          <div className="space-y-2">
            <Label>
              Part name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>
              SKU <span className="text-destructive">*</span>
            </Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>
              Category <span className="text-destructive">*</span>
            </Label>
            <PartCategorySelect value={category} onChange={setCategory} />
          </div>
          <PartUsedInFields value={usedIn} onChange={setUsedIn} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Cost price <span className="text-destructive">*</span>
              </Label>
              <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Selling price</Label>
              <Input type="number" min="0" step="0.01" value={sell} onChange={(e) => setSell(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <DialogFooter className="px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save part</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
