"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SegmentPricing, ServiceCatalogItem } from "@/types";
import { Globe } from "lucide-react";

function flatSegmentPrice(p: number): SegmentPricing {
  return {
    HATCHBACK: p,
    SEDAN: p,
    SUV: p,
    LUXURY: p,
    MUV: p,
    COMPACT_SUV: p,
    BIKE: p,
  };
}

export function EditAddonDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: ServiceCatalogItem | null;
  onSave: (next: ServiceCatalogItem) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [active, setActive] = useState(true);
  const [globalScope, setGlobalScope] = useState(true);

  useEffect(() => {
    if (!item || !open) return;
    queueMicrotask(() => {
      setName(item.name);
      setDescription(item.description);
      setPrice(String(item.defaultPrice));
      setDurationMin(item.durationMinutes != null ? String(item.durationMinutes) : "");
      setActive(item.isActive);
      setGlobalScope((item.scope ?? "GLOBAL") === "GLOBAL");
    });
  }, [item, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const p = Math.max(0, parseFloat(price) || 0);
    if (!name.trim() || p <= 0) return;
    const durationMinutes = durationMin.trim() ? Math.max(0, parseInt(durationMin, 10)) : undefined;
    onSave({
      ...item,
      name: name.trim(),
      description: description.trim() || "—",
      defaultPrice: p,
      segmentPricing: flatSegmentPrice(p),
      durationMinutes,
      isActive: active,
      scope: globalScope ? "GLOBAL" : "BRANCH",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Add-on</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>
              Add-on Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Price — incl. GST (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the price the customer pays. GST is extracted automatically.
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Duration (min) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border p-3">
            <Checkbox
              id="ea-global"
              checked={globalScope}
              onCheckedChange={(c) => setGlobalScope(c === true)}
            />
            <Label htmlFor="ea-global" className="flex items-center gap-2 cursor-pointer">
              <Globe className="h-4 w-4 text-blue-600" />
              Global Add-on (Available to all branches)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ea-act" checked={active} onCheckedChange={(c) => setActive(c === true)} />
            <Label htmlFor="ea-act">Active (Available for selection)</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
