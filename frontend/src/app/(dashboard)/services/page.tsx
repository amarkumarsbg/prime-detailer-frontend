"use client";

import { useMemo, useState } from "react";
import type { ServiceCatalogItem } from "@/types";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import { AddAddonDialog } from "@/components/services/add-addon-dialog";
import { AddServicePackageDialog } from "@/components/services/add-service-package-dialog";
import { EditServiceCatalogDialog } from "@/components/services/edit-service-catalog-dialog";
import { EditAddonDialog } from "@/components/services/edit-addon-dialog";
import { ServicePackageCard } from "@/components/services/service-package-card";
import { ServiceAddonCard } from "@/components/services/service-addon-card";
import { ServiceCategoriesTab } from "@/components/services/service-categories-tab";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ServicesPage() {
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const removeFromCatalog = useServiceCatalogStore((s) => s.removeFromCatalog);
  const categoryRecords = useServiceCategoryStore((s) => s.categories);

  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState("packages");
  const [pageSize, setPageSize] = useState("5");
  const [page, setPage] = useState(1);

  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  /** Names added from “Add package” inline category creator (merged with category store). */
  const [inlineNewCategories, setInlineNewCategories] = useState<string[]>([]);

  const [editTarget, setEditTarget] = useState<ServiceCatalogItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addonEdit, setAddonEdit] = useState<ServiceCatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const extraForDialog = useMemo(
    () => [...categoryRecords.map((c) => c.name), ...inlineNewCategories],
    [categoryRecords, inlineNewCategories]
  );

  const categoryNames = useMemo(() => {
    const fromCatalog = catalog.map((s) => s.category);
    return Array.from(new Set([...extraForDialog, ...fromCatalog])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [extraForDialog, catalog]);

  const packages = useMemo(
    () => catalog.filter((s) => !s.isAddon),
    [catalog]
  );
  const addons = useMemo(
    () => catalog.filter((s) => s.isAddon),
    [catalog]
  );

  const kpis = useMemo(() => {
    const activePk = packages.filter((s) => s.isActive).length;
    const activeAd = addons.filter((s) => s.isActive).length;
    const highEndPk = packages.filter((s) => s.isHighEnd).length;
    return {
      packages: packages.length,
      activePackages: activePk,
      highEndPackages: highEndPk,
      addons: addons.length,
      activeAddons: activeAd,
    };
  }, [packages, addons]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [packages, search]);

  const filteredAddons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addons;
    return addons.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [addons, search]);

  const ps = Math.max(1, parseInt(pageSize, 10) || 5);
  const pkgPages = Math.max(1, Math.ceil(filteredPackages.length / ps));
  const addonPages = Math.max(1, Math.ceil(filteredAddons.length / ps));

  const pagedPackages = useMemo(() => {
    const start = (page - 1) * ps;
    return filteredPackages.slice(start, start + ps);
  }, [filteredPackages, page, ps]);

  const pagedAddons = useMemo(() => {
    const start = (page - 1) * ps;
    return filteredAddons.slice(start, start + ps);
  }, [filteredAddons, page, ps]);

  const handleSaveEdit = async (next: ServiceCatalogItem) => {
    try {
      await setCatalog((prev) => prev.map((s) => (s.id === next.id ? next : s)));
      setEditOpen(false);
      setEditTarget(null);
      toast.success("Service updated");
    } catch {
      toast.error("Could not update service. Is the API running?");
    }
  };

  const handleSaveAddon = async (next: ServiceCatalogItem) => {
    try {
      await setCatalog((prev) => prev.map((s) => (s.id === next.id ? next : s)));
      setAddonEdit(null);
      toast.success("Add-on updated");
    } catch {
      toast.error("Could not update add-on. Is the API running?");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeFromCatalog(deleteTarget.id);
      toast.success(`“${deleteTarget.name}” deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete. Is the API running?");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Service Management"
        actions={
          <>
            <Button className="gap-2" onClick={() => setPackageDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setAddonDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Add-on
            </Button>
            <AddServicePackageDialog
              open={packageDialogOpen}
              onOpenChange={setPackageDialogOpen}
              extraCategories={extraForDialog}
              setExtraCategories={setInlineNewCategories}
            />
            <AddAddonDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            { label: "PACKAGES", value: kpis.packages, accent: "text-foreground" },
            { label: "ACTIVE", value: kpis.activePackages, accent: "text-emerald-600" },
            {
              label: "HIGH-END",
              value: kpis.highEndPackages,
              accent: "text-amber-700 dark:text-amber-400",
            },
            { label: "ADD-ONS", value: kpis.addons, accent: "text-foreground" },
            { label: "ACTIVE", value: kpis.activeAddons, accent: "text-emerald-600" },
          ] as const
        ).map((k, i) => (
          <Card key={`${k.label}-${i}`} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {k.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums mt-1 ${k.accent}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v); setPage(1); }} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-0">
          <TabsList className="h-auto w-full sm:w-auto bg-transparent p-0 gap-0 rounded-none">
            <TabsTrigger
              value="packages"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-muted-foreground data-[state=active]:text-emerald-700"
            >
              Packages <span className="text-muted-foreground ml-1">({packages.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="addons"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-muted-foreground data-[state=active]:text-emerald-700"
            >
              Add-ons <span className="text-muted-foreground ml-1">({addons.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-muted-foreground data-[state=active]:text-violet-700"
            >
              Categories <span className="text-muted-foreground ml-1">({categoryRecords.length})</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-sm pb-2 sm:pb-0">
            <span className="text-muted-foreground whitespace-nowrap">SHOW:</span>
            <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search services or add-ons…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {mainTab === "packages" ? (
          <div className="mt-3 flex gap-2 sm:hidden">
            <Button className="flex-1 gap-2" onClick={() => setPackageDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </div>
        ) : mainTab === "addons" ? (
          <div className="mt-3 flex gap-2 sm:hidden">
            <Button className="flex-1 gap-2" variant="outline" onClick={() => setAddonDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Add-on
            </Button>
          </div>
        ) : null}

        <TabsContent value="packages" className="mt-6 space-y-6">
          {pagedPackages.length === 0 ? (
            <EmptyServicesState
              label="services"
              onAdd={() => setPackageDialogOpen(true)}
              addLabel="Add Service"
            />
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedPackages.map((service) => (
              <ServicePackageCard
                key={service.id}
                service={service}
                onEdit={() => {
                  setEditTarget(service);
                  setEditOpen(true);
                }}
                onDelete={() => setDeleteTarget(service)}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={pkgPages}
            total={filteredPackages.length}
            onPage={setPage}
            label="packages"
          />
        </TabsContent>

        <TabsContent value="addons" className="mt-6 space-y-6">
          {pagedAddons.length === 0 ? (
            <EmptyServicesState
              label="add-ons"
              onAdd={() => setAddonDialogOpen(true)}
              addLabel="Add Add-on"
            />
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedAddons.map((service) => (
              <ServiceAddonCard
                key={service.id}
                service={service}
                onEdit={() => setAddonEdit(service)}
                onDelete={() => setDeleteTarget(service)}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={addonPages}
            total={filteredAddons.length}
            onPage={setPage}
            label="add-ons"
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <ServiceCategoriesTab search={search} />
        </TabsContent>
      </Tabs>

      <EditServiceCatalogDialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditTarget(null);
        }}
        service={editTarget}
        categories={categoryNames}
        onSave={handleSaveEdit}
      />

      <EditAddonDialog
        open={!!addonEdit}
        onOpenChange={(o) => !o && setAddonEdit(null)}
        item={addonEdit}
        onSave={handleSaveAddon}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-w-md")}>
          <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "space-y-0")}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle>
                  Delete {deleteTarget?.isAddon ? "add-on" : "service"}?
                </DialogTitle>
                <DialogDescription>
                  This permanently deletes the item from the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {deleteTarget ? (
            <div className="space-y-3 px-6 py-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                <p className="font-medium leading-snug">{deleteTarget.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{deleteTarget.category}</p>
              </div>
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                This cannot be undone.
              </p>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyServicesState({
  label,
  addLabel,
  onAdd,
}: {
  label: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">No {label} yet.</p>
        <Button className="gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
  label,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/60">
      <p className="text-sm text-muted-foreground">
        Showing page {page} of {totalPages} ({total} total {label})
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
