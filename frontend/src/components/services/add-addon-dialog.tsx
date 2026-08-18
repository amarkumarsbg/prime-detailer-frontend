"use client";

import { useEffect, useState } from "react";
import { Globe, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuthStore } from "@/store/auth-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useSettingsStore } from "@/store/settings-store";
import { isGstRegistered } from "@/lib/gst-tax";
import type { SegmentPricing, ServiceCatalogItem } from "@/types";
import { toast } from "sonner";

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

type AddAddonForm = {
  name: string;
  description: string;
  price: string;
  durationMin: string;
  active: boolean;
  globalAddon: boolean;
};

function emptyForm(): AddAddonForm {
  return {
    name: "",
    description: "",
    price: "",
    durationMin: "",
    active: true,
    globalAddon: true,
  };
}

export function AddAddonDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (item: ServiceCatalogItem) => void;
}) {
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const gstOn = isGstRegistered(useSettingsStore((s) => s.gstRegistrationStatus));
  const [form, setForm] = useState<AddAddonForm>(emptyForm);

  useEffect(() => {
    if (open) queueMicrotask(() => setForm(emptyForm()));
  }, [open]);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Add-on name is required");
      return;
    }
    const price = Math.max(0, parseFloat(form.price) || 0);
    if (price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    const durationMinutes = form.durationMin.trim()
      ? Math.max(0, parseInt(form.durationMin, 10))
      : undefined;
    if (durationMinutes == null || durationMinutes <= 0) {
      toast.error("Duration (minutes) is required");
      return;
    }

    const newItem: ServiceCatalogItem = {
      id: `svc-${Date.now()}`,
      name,
      description: form.description.trim() || "—",
      category: "Add-ons",
      defaultPrice: price,
      segmentPricing: flatSegmentPrice(price),
      isAddon: true,
      scope: form.globalAddon ? "GLOBAL" : "BRANCH",
      isActive: form.active,
      isHighEnd: false,
      incentivePercent: 3,
      durationMinutes,
      gstPercent: gstOn ? 18 : undefined,
      gstApplicable: gstOn,
    };

    setSaving(true);
    try {
      await setCatalog((prev) => [newItem, ...prev]);
      onCreated?.(newItem);
      onOpenChange(false);
      toast.success("Add-on created", { description: name });
    } catch {
      toast.error("Could not save add-on. Is the API running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90vh] overflow-y-auto")}>
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Add Add-on</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new add-on with name, description, price, and duration for your branch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="addon-name">
              Add-on Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addon-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Engine bay detail"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addon-desc">Description</Label>
            <Textarea
              id="addon-desc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this add-on include?"
              className="resize-y min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addon-price">
                Price — incl. GST (₹) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  ₹
                </span>
                <Input
                  id="addon-price"
                  type="number"
                  min={0}
                  step={1}
                  className="pl-7"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter the price the customer pays. GST is extracted automatically.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-dur">
                Duration (min) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="addon-dur"
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={form.durationMin}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox
              id="addon-global"
              checked={form.globalAddon}
              onCheckedChange={(c) => setForm((f) => ({ ...f, globalAddon: c === true }))}
            />
            <div>
              <Label htmlFor="addon-global" className="flex items-center gap-2 cursor-pointer font-medium">
                <Globe className="h-4 w-4 text-blue-600" />
                Global Add-on (Available to all branches)
              </Label>
              {!form.globalAddon && (
                <div className="mt-3 rounded-xl border-2 border-sky-200 bg-sky-50/70 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/30">
                  <div className="flex gap-2">
                    <Building2 className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-sky-950 dark:text-sky-50">
                        Branch: {currentBranch?.name ?? "Current Branch"}
                      </p>
                      <p className="text-xs text-sky-800/90 dark:text-sky-200/90 mt-1">
                        This add-on applies only to this branch.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="addon-active"
              checked={form.active}
              onCheckedChange={(c) => setForm((f) => ({ ...f, active: c === true }))}
            />
            <Label htmlFor="addon-active" className="text-sm font-medium cursor-pointer">
              Active (Available for selection)
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border px-0 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
