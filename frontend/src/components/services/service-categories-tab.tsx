"use client";

import { useMemo, useState, useRef } from "react";
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
import { useServiceCategoryStore } from "@/store/service-category-store";
import type { ServiceCategoryRecord } from "@/types";
import { Plus, Pencil, Tag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ServiceCategoriesTab({ search }: { search: string }) {
  const categories = useServiceCategoryStore((s) => s.categories);
  const upsert = useServiceCategoryStore((s) => s.upsert);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ServiceCategoryRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...categories].sort((a, b) => a.order - b.order);
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q)
      );
    }
    return list;
  }, [categories, search]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Service Categories</h2>
          <p className="mt-1 hidden max-w-xl text-xs text-muted-foreground sm:block">
            Manage company-specific categories. Bike-only categories restrict services to bike vehicle type.
          </p>
        </div>
        <Button
          className="h-10 w-full gap-2 shrink-0 sm:h-9 sm:w-auto"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Create Category
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">No categories found.</p>
          <Button className="mt-3 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Category
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm sm:px-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                <Tag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  {c.bikeOnly ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      Bike-only
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="font-mono">{c.slug}</span>
                  <span className="mx-1.5">·</span>
                  order {c.order}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground sm:h-8 sm:w-8"
                onClick={() => setEditRow(c)}
                aria-label={`Edit ${c.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={null}
        onSave={(row) => {
          upsert(row);
          toast.success("Category created");
        }}
      />
      <CategoryFormDialog
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        initial={editRow}
        onSave={(row) => {
          upsert(row);
          toast.success("Category updated");
          setEditRow(null);
        }}
      />
    </div>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ServiceCategoryRecord | null;
  onSave: (row: ServiceCategoryRecord) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-md")}>
        {open ? (
          <CategoryFormFields
            key={initial?.id ?? "create"}
            initial={initial}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryFormFields({
  initial,
  onSave,
  onClose,
}: {
  initial: ServiceCategoryRecord | null;
  onSave: (row: ServiceCategoryRecord) => void;
  onClose: () => void;
}) {
  const slugTouched = useRef(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [order, setOrder] = useState(String(initial?.order ?? 99));
  const [bikeOnly, setBikeOnly] = useState(initial?.bikeOnly ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const s = slug.trim();
    if (!n || !s) {
      toast.error("Name and slug are required");
      return;
    }
    const o = Math.max(0, parseInt(order, 10) || 0);
    onSave({
      id: initial?.id ?? `cat-${Date.now()}`,
      name: n,
      slug: s,
      order: o,
      bikeOnly,
    });
    onClose();
  };

  return (
    <>
      <DialogHeader className={dialogMobileSheetHeaderClasses}>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 text-violet-700">
            <Tag className="h-4 w-4" />
          </span>
          {initial ? "Edit Category" : "Add New Category"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
        <div className="space-y-2">
          <Label>
            Category Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              if (!initial && !slugTouched.current) setSlug(slugify(v));
            }}
            placeholder="e.g. Car Wash, Bike Services…"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>
            Slug (identifier) <span className="text-destructive">*</span>
          </Label>
          <Input
            value={slug}
            onChange={(e) => {
              slugTouched.current = true;
              setSlug(e.target.value);
            }}
            placeholder="e.g. car_wash"
            required
          />
          <p className="text-xs text-muted-foreground">
            Only lowercase letters, digits, underscores. Auto-generated from name.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Display Order</Label>
          <Input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Lower number = appears first</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex gap-3">
            <Checkbox
              id="bike-only"
              checked={bikeOnly}
              onCheckedChange={(c) => setBikeOnly(c === true)}
            />
            <div>
              <Label
                htmlFor="bike-only"
                className="cursor-pointer font-semibold text-amber-950 dark:text-amber-100"
              >
                Bike-only category
              </Label>
              <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                Services in this category will only be available for bike vehicle type.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 border-0 p-0 sm:justify-end">
          <Button type="button" variant="outline" className="max-md:flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="max-md:flex-1">
            {initial ? "Update Category" : "Create Category"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
