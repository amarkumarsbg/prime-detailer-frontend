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
} from "@/components/ui/dialog";
import { useServiceCategoryStore } from "@/store/service-category-store";
import type { ServiceCategoryRecord } from "@/types";
import { Plus, Pencil, Tag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Service Categories</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Manage company-specific categories. Bike-only categories restrict services to bike vehicle type.
          </p>
        </div>
        <Button
          className="gap-2 shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Create Category
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono">{c.slug}</span>
                <span className="mx-2">·</span>
                order: {c.order}
                {c.bikeOnly && (
                  <span className="ml-2 text-amber-700 dark:text-amber-400">· bike-only</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() => setEditRow(c)}
              aria-label={`Edit ${c.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

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
      <DialogContent className="sm:max-w-md">
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
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 text-violet-700">
            <Tag className="h-4 w-4" />
          </span>
          {initial ? "Edit Category" : "Add New Category"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            # Slug (identifier) <span className="text-destructive">*</span>
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
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex gap-3">
            <Checkbox
              id="bike-only"
              checked={bikeOnly}
              onCheckedChange={(c) => setBikeOnly(c === true)}
            />
            <div>
              <Label htmlFor="bike-only" className="text-amber-950 dark:text-amber-100 font-semibold cursor-pointer">
                Bike-only category
              </Label>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-1">
                Services in this category will only be available for bike vehicle type.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {initial ? "Update Category" : "Create Category"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
