"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  Car,
  Tag,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import type { SegmentPricing, ServiceCatalogItem } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type AddPackageForm = {
  name: string;
  description: string;
  category: string;
  hatch: string;
  sedan: string;
  suv: string;
  bike: string;
  gstApplicable: boolean;
  gstPercent: string;
  durationMin: string;
  maxDuration: string;
  active: boolean;
  incentivePercent: string;
  isHighEnd: boolean;
};

function emptyAddPackage(): AddPackageForm {
  return {
    name: "",
    description: "",
    category: "",
    hatch: "",
    sedan: "",
    suv: "",
    bike: "",
    gstApplicable: true,
    gstPercent: "18",
    durationMin: "",
    maxDuration: "",
    active: true,
    incentivePercent: "3",
    isHighEnd: false,
  };
}

const PRICING_QUICK_SEGMENTS: {
  key: keyof Pick<SegmentPricing, "HATCHBACK" | "SEDAN" | "SUV" | "BIKE">;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { key: "HATCHBACK", label: "Hatchback", hint: "Small cars", icon: "🚗" },
  { key: "SEDAN", label: "Sedan", hint: "Mid-size", icon: "🚙" },
  { key: "SUV", label: "SUV", hint: "Large", icon: "🚐" },
  { key: "BIKE", label: "Bike", hint: "Two-wheeler", icon: "🏍️" },
];

const PRICING_FORM_FIELD: Record<
  "HATCHBACK" | "SEDAN" | "SUV" | "BIKE",
  keyof Pick<AddPackageForm, "hatch" | "sedan" | "suv" | "bike">
> = {
  HATCHBACK: "hatch",
  SEDAN: "sedan",
  SUV: "suv",
  BIKE: "bike",
};

function slugifyCategoryName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "category";
}

type AddServicePackageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (item: ServiceCatalogItem) => void;
  trigger?: ReactNode;
  /** Service Catalog page: share extra category names with the page filter. */
  extraCategories?: string[];
  setExtraCategories?: React.Dispatch<React.SetStateAction<string[]>>;
};

export function AddServicePackageDialog({
  open,
  onOpenChange,
  onCreated,
  trigger,
  extraCategories: extraCategoriesProp,
  setExtraCategories: setExtraCategoriesProp,
}: AddServicePackageDialogProps) {
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const currentBranch = useAuthStore((s) => s.currentBranch);

  const [internalExtra, setInternalExtra] = useState<string[]>([]);
  const extraCategories = extraCategoriesProp ?? internalExtra;
  const setExtraCategories = setExtraCategoriesProp ?? setInternalExtra;

  const [addForm, setAddForm] = useState<AddPackageForm>(emptyAddPackage);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catOrder, setCatOrder] = useState("99");
  const [catBikeOnly, setCatBikeOnly] = useState(false);
  const slugTouched = useRef(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setAddForm(emptyAddPackage()));
    }
  }, [open]);

  useEffect(() => {
    if (categoryDialogOpen) {
      queueMicrotask(() => {
        setCatName("");
        setCatSlug("");
        setCatOrder("99");
        setCatBikeOnly(false);
        slugTouched.current = false;
      });
    }
  }, [categoryDialogOpen]);

  useEffect(() => {
    if (!categoryDialogOpen || slugTouched.current) return;
    queueMicrotask(() => setCatSlug(slugifyCategoryName(catName)));
  }, [catName, categoryDialogOpen]);

  const categories = useMemo(
    () =>
      Array.from(new Set([...catalog.map((s) => s.category), ...extraCategories])).sort((a, b) =>
        a.localeCompare(b)
      ),
    [catalog, extraCategories]
  );

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = catName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (extraCategories.includes(name) || catalog.some((s) => s.category === name)) {
      toast.error("A category with this name already exists");
      return;
    }
    setExtraCategories((prev) => [...prev, name]);
    setAddForm((f) => ({ ...f, category: name }));
    setCategoryDialogOpen(false);
    toast.success("Category created", { description: name });
  };

  const handleAddPackage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = addForm.name.trim();
    const description = addForm.description.trim();
    const category = addForm.category.trim();
    if (!name) {
      toast.error("Service name is required");
      return;
    }
    if (!category) {
      toast.error("Select or create a category");
      return;
    }
    const h = Math.max(0, parseFloat(addForm.hatch) || 0);
    const s = Math.max(0, parseFloat(addForm.sedan) || 0);
    const u = Math.max(0, parseFloat(addForm.suv) || 0);
    const bike = Math.max(0, parseFloat(addForm.bike) || 0);
    if (h === 0 && s === 0 && u === 0 && bike === 0) {
      toast.error("Enter at least one vehicle price");
      return;
    }
    const segmentPricing: SegmentPricing = {
      HATCHBACK: h,
      SEDAN: s,
      SUV: u,
      LUXURY: Math.round(Math.max(s * 1.35, u * 1.1)),
      MUV: Math.round((s + u) / 2),
      COMPACT_SUV: Math.round((h + u) / 2),
      BIKE: bike,
    };
    const incentive = Math.min(100, Math.max(0, parseFloat(addForm.incentivePercent) || 0));
    const gstPct = addForm.gstApplicable ? Math.min(100, Math.max(0, parseFloat(addForm.gstPercent) || 0)) : undefined;
    const durationMinutes = addForm.durationMin.trim()
      ? Math.max(0, parseInt(addForm.durationMin, 10))
      : undefined;
    const maxDurationMinutes = addForm.maxDuration.trim()
      ? Math.max(0, parseInt(addForm.maxDuration, 10))
      : undefined;

    const newItem: ServiceCatalogItem = {
      id: `svc-${Date.now()}`,
      name,
      description: description || "—",
      category,
      defaultPrice: Math.round((h + s + u + bike) / 4) || Math.max(h, s, u, bike),
      segmentPricing,
      isActive: addForm.active,
      isHighEnd: addForm.isHighEnd,
      incentivePercent: incentive,
      gstApplicable: addForm.gstApplicable,
      gstPercent: gstPct,
      durationMinutes,
      maxDurationMinutes,
    };
    setCatalog((prev) => [newItem, ...prev]);
    onOpenChange(false);
    setAddForm(emptyAddPackage());
    toast.success("Service package created", { description: name });
    onCreated?.(newItem);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto gap-0 p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Add Service Package</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new service with category, pricing by vehicle type, GST, and duration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPackage} className="space-y-5 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="asp-pkg-name">Service Name</Label>
              <Input
                id="asp-pkg-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Premium Wash"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Service Category
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  + New
                </Button>
              </div>
              <Select
                value={addForm.category || undefined}
                onValueChange={(v) => setAddForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="asp-pkg-category" className="h-10 w-full">
                  <SelectValue placeholder="— Select category —" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asp-pkg-desc">Description</Label>
              <Textarea
                id="asp-pkg-desc"
                rows={4}
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what this package includes…"
                className="resize-y min-h-[100px]"
              />
            </div>

            <div
              className={cn(
                "rounded-xl border-2 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/30"
              )}
            >
              <div className="flex items-start gap-2">
                <Car className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div>
                  <p className="font-medium text-foreground">Pricing by Vehicle Type</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Set prices for each vehicle type:
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRICING_QUICK_SEGMENTS.map(({ key, label, hint, icon }) => {
                  const fk = PRICING_FORM_FIELD[key];
                  return (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-normal flex flex-col gap-0.5">
                        <span className="text-lg leading-none" aria-hidden>
                          {icon}
                        </span>
                        <span className="text-foreground">{label}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">{hint}</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          ₹
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="pl-7 h-9"
                          placeholder="0"
                          value={addForm[fk]}
                          onChange={(e) =>
                            setAddForm((f) => ({ ...f, [fk]: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl border-2 border-amber-200/90 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/25"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="asp-pkg-gst"
                    checked={addForm.gstApplicable}
                    onCheckedChange={(c) =>
                      setAddForm((f) => ({ ...f, gstApplicable: c === true }))
                    }
                  />
                  <Label htmlFor="asp-pkg-gst" className="text-sm font-medium cursor-pointer">
                    GST Applicable
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="asp-pkg-gst-rate" className="text-sm text-muted-foreground whitespace-nowrap">
                    GST Rate:
                  </Label>
                  <Input
                    id="asp-pkg-gst-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="h-9 w-20"
                    disabled={!addForm.gstApplicable}
                    value={addForm.gstPercent}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, gstPercent: e.target.value }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asp-pkg-dur">Duration (minutes)</Label>
                <Input
                  id="asp-pkg-dur"
                  type="number"
                  min={0}
                  placeholder="e.g. 40"
                  value={addForm.durationMin}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, durationMin: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asp-pkg-max-dur">Max Duration (optional)</Label>
                <Input
                  id="asp-pkg-max-dur"
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={addForm.maxDuration}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, maxDuration: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">For range like 40–50 mins</p>
              </div>
            </div>

            <div className="rounded-xl border-2 border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/30">
              <div className="flex gap-2">
                <Building2 className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-950 dark:text-sky-50">
                    Branch: {currentBranch?.name ?? "Current Branch"}
                  </p>
                  <p className="text-xs text-sky-800/90 dark:text-sky-200/90 mt-1">
                    This service will be assigned to your branch automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="asp-pkg-active"
                  checked={addForm.active}
                  onCheckedChange={(c) =>
                    setAddForm((f) => ({ ...f, active: c === true }))
                  }
                />
                <Label htmlFor="asp-pkg-active" className="text-sm font-medium cursor-pointer">
                  Active (Available for booking)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="asp-pkg-high-end"
                  checked={addForm.isHighEnd}
                  onCheckedChange={(c) =>
                    setAddForm((f) => ({ ...f, isHighEnd: c === true }))
                  }
                />
                <Label htmlFor="asp-pkg-high-end" className="text-sm font-medium cursor-pointer">
                  High-end service
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="asp-pkg-incentive" className="text-sm whitespace-nowrap">
                  Incentive %
                </Label>
                <Input
                  id="asp-pkg-incentive"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="h-9 w-20"
                  value={addForm.incentivePercent}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, incentivePercent: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/80">
              <Tag className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription className="sr-only">
                Create a category for organizing services.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="asp-cat-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="asp-cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Car Wash, Bike Services…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asp-cat-slug">
                # Slug (identifier) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="asp-cat-slug"
                value={catSlug}
                onChange={(e) => {
                  slugTouched.current = true;
                  setCatSlug(e.target.value);
                }}
                placeholder="e.g. car_wash"
                required
              />
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, digits, underscores. Auto-generated from name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asp-cat-order">Display Order</Label>
              <Input
                id="asp-cat-order"
                type="number"
                value={catOrder}
                onChange={(e) => setCatOrder(e.target.value)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">Lower number = appears first</p>
            </div>
            <div
              className={cn(
                "rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30"
              )}
            >
              <div className="flex gap-3">
                <Checkbox
                  id="asp-cat-bike"
                  checked={catBikeOnly}
                  onCheckedChange={(c) => setCatBikeOnly(c === true)}
                />
                <div>
                  <Label htmlFor="asp-cat-bike" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                    <span aria-hidden>🏍️</span> Bike-only category
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Services in this category will only be available for bike vehicle type.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
