"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const saveCategory = () => {
    const result = addPartCategory(name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChange(result.name);
    setName("");
    setAdding(false);
    toast.success("Category added");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={value || undefined}
          onValueChange={(next) => {
            if (next === ADD_CATEGORY_VALUE) {
              setAdding(true);
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
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chemicals"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                saveCategory();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
          />
          <Button type="button" size="sm" onClick={saveCategory}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setAdding(false);
              setName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
