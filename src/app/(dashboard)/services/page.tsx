"use client";

import { useEffect, useMemo, useState } from "react";
import type { ServiceCatalogItem, ServiceCategoryRecord } from "@/types";
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
import { KPICard } from "@/components/shared/kpi-card";
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
import {
  Plus,
  Search,
  Trash2,
  Package,
  CircleCheck,
  Star,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { userCanEdit, userCanDelete, userCanCreate } from "@/lib/rbac";

export default function ServicesPage() {
  const authUser = useAuthStore((s) => s.user);
  const canEdit = userCanEdit(authUser, "SERVICES");
  const canDelete = userCanDelete(authUser, "SERVICES");
  const canCreate = userCanCreate(authUser, "SERVICES");

  const catalog = useServiceCatalogStore((s) => s.catalog);
  const setCatalog = useServiceCatalogStore((s) => s.setCatalog);
  const removeFromCatalog = useServiceCatalogStore((s) => s.removeFromCatalog);
  const categoryRecords = useServiceCategoryStore((s) => s.categories);
  const setCategories = useServiceCategoryStore((s) => s.setCategories);

  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState("packages");
  const [pageSize, setPageSize] = useState("10");
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

  useEffect(() => {
    const existingKeys = new Set<string>();
    for (const row of categoryRecords) {
      existingKeys.add(row.name.trim().toLowerCase());
      existingKeys.add(row.slug.trim().toLowerCase());
    }

    const missingNames = Array.from(
      new Set(
        catalog
          .map((s) => s.category?.trim())
          .filter((v): v is string => Boolean(v && v.length > 0))
      )
    ).filter((name) => {
      const key = name.toLowerCase();
      return !existingKeys.has(key);
    });

    if (missingNames.length === 0) return;

    const slugify = (name: string): string => {
      const s = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return s || "category";
    };

    setCategories((prev) => {
      const next = [...prev];
      const takenIds = new Set(next.map((r) => r.id));
      const takenNameOrSlug = new Set<string>();
      for (const row of next) {
        takenNameOrSlug.add(row.name.trim().toLowerCase());
        takenNameOrSlug.add(row.slug.trim().toLowerCase());
      }

      let maxOrder = next.reduce((m, r) => Math.max(m, r.order || 0), 0);

      for (const rawName of missingNames) {
        const name = rawName.trim();
        const slug = slugify(name);
        const nameKey = name.toLowerCase();
        const slugKey = slug.toLowerCase();
        if (takenNameOrSlug.has(nameKey) || takenNameOrSlug.has(slugKey)) continue;

        const baseId = `cat-${slug}`;
        let id = baseId;
        let seq = 2;
        while (takenIds.has(id)) {
          id = `${baseId}-${seq}`;
          seq += 1;
        }

        const row: ServiceCategoryRecord = {
          id,
          name,
          slug,
          order: ++maxOrder,
          bikeOnly: false,
        };
        next.push(row);
        takenIds.add(id);
        takenNameOrSlug.add(nameKey);
        takenNameOrSlug.add(slugKey);
      }

      return next.sort((a, b) => a.order - b.order);
    });
  }, [catalog, categoryRecords, setCategories]);

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

  const headerActions = (
    <>
      {canCreate && (
        <div className="flex items-center gap-1.5 sm:hidden">
          <Button
            size="sm"
            className="h-9 shrink-0 px-2.5"
            onClick={() => setPackageDialogOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Service
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0 px-2.5"
            onClick={() => setAddonDialogOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add-on
          </Button>
        </div>
      )}
      {canCreate && (
        <div className="hidden gap-2 sm:flex">
          <Button className="gap-2" onClick={() => setPackageDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Service
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setAddonDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Add-on
          </Button>
        </div>
      )}
      <AddServicePackageDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        extraCategories={extraForDialog}
        setExtraCategories={setInlineNewCategories}
      />
      <AddAddonDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} />
    </>
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:gap-6">
      <PageHeader
        title="Services"
        description="Manage service packages, add-ons, and categories."
        hideDescriptionOnMobile
        inlineActionsOnMobile
        className="mb-0 max-md:mb-0"
        actions={headerActions}
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 sm:gap-3">
        <KPICard
          size="compact"
          title="Packages"
          value={kpis.packages}
          icon={Package}
          tone="violet"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
          className="min-w-[9.5rem] shrink-0 sm:min-w-0"
        />
        <KPICard
          size="compact"
          title="Active packages"
          value={kpis.activePackages}
          icon={CircleCheck}
          tone="emerald"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
          className="min-w-[9.5rem] shrink-0 sm:min-w-0"
        />
        <KPICard
          size="compact"
          title="High-end"
          value={kpis.highEndPackages}
          icon={Star}
          tone="amber"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
          className="min-w-[9.5rem] shrink-0 sm:min-w-0"
        />
        <KPICard
          size="compact"
          title="Add-ons"
          value={kpis.addons}
          icon={Puzzle}
          tone="blue"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
          className="min-w-[9.5rem] shrink-0 sm:min-w-0"
        />
        <KPICard
          size="compact"
          title="Active add-ons"
          value={kpis.activeAddons}
          icon={CircleCheck}
          tone="emerald"
          titleClassName="text-[11px] leading-tight sm:text-xs"
          valueClassName="text-lg sm:text-xl"
          className="min-w-[9.5rem] shrink-0 sm:min-w-0 sm:col-span-3 lg:col-span-1"
        />
      </div>

      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          setMainTab(v);
          setPage(1);
        }}
        className="w-full"
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:flex sm:w-auto sm:flex-none sm:rounded-none sm:bg-transparent sm:p-0">
              <TabsTrigger
                value="packages"
                className="min-h-10 gap-1 rounded-lg px-2 py-2 text-xs data-[state=active]:shadow-sm sm:min-h-0 sm:rounded-none sm:border-b-2 sm:border-transparent sm:bg-transparent sm:px-4 sm:py-2 sm:text-sm sm:data-[state=active]:border-emerald-600 sm:data-[state=active]:shadow-none data-[state=active]:text-emerald-700"
              >
                <span className="truncate">Packages</span>
                <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:hidden">
                  {packages.length}
                </span>
                <span className="hidden text-muted-foreground sm:inline">({packages.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="addons"
                className="min-h-10 gap-1 rounded-lg px-2 py-2 text-xs data-[state=active]:shadow-sm sm:min-h-0 sm:rounded-none sm:border-b-2 sm:border-transparent sm:bg-transparent sm:px-4 sm:py-2 sm:text-sm sm:data-[state=active]:border-emerald-600 sm:data-[state=active]:shadow-none data-[state=active]:text-emerald-700"
              >
                <span className="truncate">Add-ons</span>
                <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:hidden">
                  {addons.length}
                </span>
                <span className="hidden text-muted-foreground sm:inline">({addons.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                className="min-h-10 gap-1 rounded-lg px-2 py-2 text-xs data-[state=active]:shadow-sm sm:min-h-0 sm:rounded-none sm:border-b-2 sm:border-transparent sm:bg-transparent sm:px-4 sm:py-2 sm:text-sm sm:data-[state=active]:border-violet-600 sm:data-[state=active]:shadow-none data-[state=active]:text-violet-700"
              >
                <span className="truncate">Categories</span>
                <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:hidden">
                  {categoryRecords.length}
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  ({categoryRecords.length})
                </span>
              </TabsTrigger>
            </TabsList>
            <div className="hidden items-center gap-2 pb-0 text-sm md:flex">
              <span className="whitespace-nowrap text-muted-foreground">Show:</span>
              <Select
                value={pageSize}
                onValueChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9 sm:h-9"
              placeholder={
                mainTab === "categories"
                  ? "Search categories…"
                  : mainTab === "addons"
                    ? "Search add-ons…"
                    : "Search services…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <TabsContent value="packages" className="mt-3 space-y-3 sm:mt-6 sm:space-y-6">
          {pagedPackages.length === 0 ? (
            <EmptyServicesState
              label="services"
              onAdd={() => setPackageDialogOpen(true)}
              addLabel="Add Service"
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedPackages.map((service) => (
              <ServicePackageCard
                key={service.id}
                service={service}
                onEdit={canEdit ? () => {
                  setEditTarget(service);
                  setEditOpen(true);
                } : undefined}
                onDelete={canDelete ? () => setDeleteTarget(service) : undefined}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={pkgPages}
            total={filteredPackages.length}
            itemsPerPage={ps}
            onPage={setPage}
            label="packages"
            pageSize={pageSize}
            onPageSizeChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
        </TabsContent>

        <TabsContent value="addons" className="mt-3 space-y-3 sm:mt-6 sm:space-y-6">
          {pagedAddons.length === 0 ? (
            <EmptyServicesState
              label="add-ons"
              onAdd={() => setAddonDialogOpen(true)}
              addLabel="Add Add-on"
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedAddons.map((service) => (
              <ServiceAddonCard
                key={service.id}
                service={service}
                onEdit={canEdit ? () => setAddonEdit(service) : undefined}
                onDelete={canDelete ? () => setDeleteTarget(service) : undefined}
              />
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={addonPages}
            total={filteredAddons.length}
            itemsPerPage={ps}
            onPage={setPage}
            label="add-ons"
            pageSize={pageSize}
            onPageSizeChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-3 sm:mt-6">
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
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 max-md:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="max-md:flex-1"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="max-md:flex-1"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
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
  itemsPerPage,
  onPage,
  label,
  pageSize,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  onPage: (p: number) => void;
  label: string;
  pageSize?: string;
  onPageSizeChange?: (size: string) => void;
}) {
  if (total === 0) return null;

  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, total);
  const singlePage = totalPages <= 1;

  return (
    <div className="flex flex-col items-stretch justify-between gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:gap-3">
      <p className="text-center text-xs text-muted-foreground sm:text-left sm:text-sm">
        {singlePage
          ? `Showing all ${total} ${label}`
          : `Showing ${start}–${end} of ${total} ${label}`}
      </p>
      {singlePage ? null : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {pageSize && onPageSizeChange ? (
            <Select
              value={pageSize}
              onValueChange={(v) => {
                onPageSizeChange(v);
                onPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs md:hidden sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-[4.5rem] sm:h-8"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Prev
          </Button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-[4.5rem] sm:h-8"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
