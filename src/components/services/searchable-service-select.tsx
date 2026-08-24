"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddServicePackageDialog } from "@/components/services/add-service-package-dialog";
import type { ServiceCatalogItem } from "@/types";

export function ServiceSearchInput({
  value,
  onChange,
  placeholder = "Search services...",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8"
        aria-label="Search services"
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function filterCatalogServices(
  services: ServiceCatalogItem[],
  query: string
): ServiceCatalogItem[] {
  const q = query.trim().toLowerCase();
  const active = services.filter((s) => s.isActive && !s.isAddon);
  if (!q) return active;
  return active.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );
}

export function SearchableServiceSelect({
  id,
  value,
  onChange,
  services,
  placeholder = "Select service",
  required,
  unmatchedLabel,
}: {
  id?: string;
  value: string;
  onChange: (serviceId: string) => void;
  services: ServiceCatalogItem[];
  placeholder?: string;
  required?: boolean;
  unmatchedLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const filtered = useMemo(() => {
    const list = filterCatalogServices(services, query);
    if (value && value !== "__unmatched__" && !list.some((s) => s.id === value)) {
      const selected = services.find((s) => s.id === value);
      if (selected) return [selected, ...list];
    }
    return list;
  }, [services, query, value]);

  return (
    <>
      <Select
        required={required}
        value={value || undefined}
        onValueChange={(next) => {
          if (next === "__add_service__") {
            setAddOpen(true);
            return;
          }
          if (next === "__unmatched__") return;
          onChange(next);
        }}
        onOpenChange={(open) => {
          if (!open) setQuery("");
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(18rem,50vh)]">
          <div
            className="sticky top-0 z-10 border-b border-border bg-popover p-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ServiceSearchInput
              value={query}
              onChange={setQuery}
            />
          </div>
          <SelectItem value="__add_service__">
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Plus className="h-3.5 w-3.5" />
              Add services
            </span>
          </SelectItem>
          {unmatchedLabel ? (
            <SelectItem value="__unmatched__">{unmatchedLabel}</SelectItem>
          ) : null}
          {filtered.length === 0 && !unmatchedLabel ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No services match
            </div>
          ) : (
            filtered.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <AddServicePackageDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(item) => onChange(item.id)}
      />
    </>
  );
}
