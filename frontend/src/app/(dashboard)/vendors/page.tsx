"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { VendorFormDialog } from "@/components/expenses/vendor-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useExpenseStore, type AddVendorDirectoryInput } from "@/store/expense-store";
import { useInventoryStore } from "@/store/inventory-store";
import type { ExpenseVendorProfile } from "@/types";
import { Info, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";

const VENDOR_HELP =
  "Manage supplier profiles. Spend comes from stock purchases (unit price × litres).";

type SortKey = "spend" | "name" | "recent";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "By spend" },
  { value: "recent", label: "Recent" },
  { value: "name", label: "A–Z" },
];

type VendorRow = {
  key: string;
  vendorName: string;
  profile: ExpenseVendorProfile | null;
  count: number;
  totalCost: number;
  lastAt: string | null;
};

export default function VendorsPage() {
  const purchases = useInventoryStore((s) => s.productPurchases);
  const parts = useInventoryStore((s) => s.parts);
  const renamePurchaseVendor = useInventoryStore((s) => s.renamePurchaseVendor);
  const vendorDirectory = useExpenseStore((s) => s.vendorDirectory);
  const expenses = useExpenseStore((s) => s.expenses);
  const addVendorDirectoryEntry = useExpenseStore((s) => s.addVendorDirectoryEntry);
  const updateVendorDirectoryEntry = useExpenseStore((s) => s.updateVendorDirectoryEntry);
  const removeVendorDirectoryEntry = useExpenseStore((s) => s.removeVendorDirectoryEntry);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<ExpenseVendorProfile | null>(null);
  const [createNameHint, setCreateNameHint] = useState("");

  const purchaseAgg = useMemo(() => {
    const byVendor = new Map<string, { count: number; totalCost: number; lastAt: string }>();
    for (const p of purchases) {
      const name = p.vendorName.trim() || "Unknown";
      const lineCost = (p.unitCost ?? 0) * (p.quantityMl / 1000);
      const prev = byVendor.get(name) ?? { count: 0, totalCost: 0, lastAt: p.purchasedAt };
      const totalCost = prev.totalCost + lineCost;
      const lastAt =
        new Date(p.purchasedAt) > new Date(prev.lastAt) ? p.purchasedAt : prev.lastAt;
      byVendor.set(name, {
        count: prev.count + 1,
        totalCost,
        lastAt,
      });
    }
    return byVendor;
  }, [purchases]);

  const rows = useMemo(() => {
    const byKey = new Map<string, VendorRow>();

    for (const profile of vendorDirectory) {
      const name = profile.name.trim();
      if (!name) continue;
      const agg = purchaseAgg.get(name);
      byKey.set(name.toLowerCase(), {
        key: profile.id,
        vendorName: name,
        profile,
        count: agg?.count ?? 0,
        totalCost: agg?.totalCost ?? 0,
        lastAt: agg?.lastAt ?? null,
      });
    }

    for (const [name, agg] of purchaseAgg.entries()) {
      const k = name.toLowerCase();
      if (byKey.has(k)) continue;
      byKey.set(k, {
        key: `purchase:${k}`,
        vendorName: name,
        profile: null,
        count: agg.count,
        totalCost: agg.totalCost,
        lastAt: agg.lastAt,
      });
    }

    for (const e of expenses) {
      const name = e.vendorName?.trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (byKey.has(k)) continue;
      byKey.set(k, {
        key: `expense:${k}`,
        vendorName: name,
        profile: null,
        count: 0,
        totalCost: 0,
        lastAt: e.date,
      });
    }

    return [...byKey.values()];
  }, [vendorDirectory, purchaseAgg, expenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? rows.filter((r) => r.vendorName.toLowerCase().includes(q)) : rows;

    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.vendorName.localeCompare(b.vendorName);
      if (sortKey === "recent") {
        const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return bt - at;
      }
      return b.totalCost - a.totalCost;
    });

    return list;
  }, [rows, query, sortKey]);

  const partsNote = parts.length
    ? `${parts.length} parts in catalog`
    : "Load inventory for more context.";

  const emptyMessage =
    rows.length === 0
      ? "No vendors yet. Add a vendor or record a stock purchase."
      : "No vendors match your search.";

  const openAdd = () => {
    setEditingVendor(null);
    setCreateNameHint("");
    setDialogOpen(true);
  };

  const openEdit = (row: VendorRow) => {
    if (row.profile) {
      setEditingVendor(row.profile);
      setCreateNameHint("");
    } else {
      setEditingVendor(null);
      setCreateNameHint(row.vendorName);
    }
    setDialogOpen(true);
  };

  const handleSave = async (input: AddVendorDirectoryInput): Promise<boolean> => {
    if (editingVendor) {
      const prevName = editingVendor.name;
      const updated = await updateVendorDirectoryEntry(editingVendor.id, input);
      if (!updated) {
        toast.error("Could not update vendor.");
        return false;
      }
      if (prevName.trim() !== updated.name.trim()) {
        renamePurchaseVendor(prevName, updated.name);
      }
      toast.success("Vendor updated.");
      return true;
    }
    const created = await addVendorDirectoryEntry(input);
    if (!created) {
      toast.error("Enter a vendor name.");
      return false;
    }
    if (createNameHint && createNameHint.trim() !== created.name.trim()) {
      renamePurchaseVendor(createNameHint, created.name);
    }
    toast.success("Vendor created.");
    return true;
  };

  const handleDelete = async (row: VendorRow) => {
    if (!row.profile) {
      toast.info("This vendor only appears from purchases or expenses.", {
        description: "Add them to the directory first, or change the name on those records.",
      });
      return;
    }
    const ok = await removeVendorDirectoryEntry(row.profile.id);
    if (!ok) {
      toast.error("Could not delete vendor.");
      return;
    }
    toast.success("Vendor removed from directory.");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Vendors"
        description={VENDOR_HELP}
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 md:hidden"
                    aria-label="About vendors"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                  {VENDOR_HELP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={sortKey === opt.value ? "default" : "outline"}
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={() => setSortKey(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          <Button size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Vendor
          </Button>
        </div>
      ) : (
        <>
          <MobileCardList className="space-y-2">
            {filtered.map((r) => (
              <MobileRowCard key={r.key} className="p-3 shadow-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-tight text-foreground">
                      {r.vendorName}
                    </p>
                    {!r.profile ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">From purchases / expenses</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleDelete(r)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  <span>
                    Purchases:{" "}
                    <span className="font-medium tabular-nums text-foreground">{r.count}</span>
                  </span>
                  <span className="mx-2 text-border">·</span>
                  <span>
                    Spend:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(r.totalCost)}
                    </span>
                  </span>
                </p>
                {r.lastAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last purchase:{" "}
                    <span className="font-medium text-foreground">{formatDate(r.lastAt)}</span>
                  </p>
                ) : null}
              </MobileRowCard>
            ))}
          </MobileCardList>

          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <DesktopTableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium">Purchases</th>
                    <th className="px-4 py-3 text-right font-medium">Est. spend</th>
                    <th className="px-4 py-3 text-right font-medium">Last purchase</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.key} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <div>
                          {r.vendorName}
                          {!r.profile ? (
                            <p className="text-[11px] font-normal text-muted-foreground">
                              From purchases / expenses
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(r.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.lastAt ? formatDate(r.lastAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void handleDelete(r)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DesktopTableWrap>
            <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
              Part labels: {partsNote}
            </p>
          </div>
        </>
      )}

      {filtered.length > 0 ? (
        <p className="px-1 text-xs text-muted-foreground md:hidden">Part labels: {partsNote}</p>
      ) : null}

      <VendorFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingVendor(null);
            setCreateNameHint("");
          }
        }}
        vendor={editingVendor}
        initialName={createNameHint}
        onSave={handleSave}
      />
    </div>
  );
}
