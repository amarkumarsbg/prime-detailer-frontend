"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mergePartCategoryNames } from "@/lib/inventory/part-categories";
import { useInventoryStore } from "@/store/inventory-store";

const ADD_CATEGORY_VALUE = "__add_category__";

export function PartCategorySelect({
  value,
  onChange,
  id,
  placeholder = "Select",
}: {
  value: string;
  onChange: (category: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const parts = useInventoryStore((s) => s.parts);
  const partCategories = useInventoryStore((s) => s.partCategories);
  const addPartCategory = useInventoryStore((s) => s.addPartCategory);
  const categories = useMemo(
    () => mergePartCategoryNames(parts, partCategories),
    [parts, partCategories]
  );

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = addPartCategory(name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChange(result.name);
    setName("");
    setOpen(false);
    toast.success("Category added");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={value || undefined}
          onValueChange={(next) => {
            if (next === ADD_CATEGORY_VALUE) {
              setOpen(true);
              return;
            }
            onChange(next);
          }}
        >
          <SelectTrigger id={id} className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={ADD_CATEGORY_VALUE} className="text-primary font-medium">
              + Add category
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1 px-3"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setName("");
        }}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-sm")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>
              This category will appear on new and existing catalog items.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-part-category">
                Category name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-part-category"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chemicals"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
