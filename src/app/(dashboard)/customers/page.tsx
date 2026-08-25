"use client";

import { useState, useMemo } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Upload, UserX, Download, ChevronDown, Loader2,
  Search, Car, Star, Wallet, CalendarDays, ArrowRight, Phone, Mail,
  LayoutGrid, List,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
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
import { ImportCustomersDialog } from "@/components/customers/import-customers-dialog";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isInactiveCustomer } from "@/lib/dashboard-filters";
import { useBranchScope } from "@/lib/branch-scope";
import { FilterBanner } from "@/components/shared/filter-banner";
import {
  buildCustomerExportRows,
  downloadCustomersExcel,
  downloadCustomersPdf,
} from "@/lib/customer-export";
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { referredByFromOptionalInput } from "@/lib/referral-eligibility";
import { NewCustomerReferralCodeField } from "@/components/customers/new-customer-referral-code-field";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";
import { VirtuosoGrid } from "react-virtuoso";

const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={style}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {children}
    </div>
  )
);
GridList.displayName = "GridList";

const GridItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props} className="flex flex-col min-h-[160px]">
      {children}
    </div>
  )
);
GridItem.displayName = "GridItem";

const addCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(1, "Address is required"),
  referredBy: z.string().optional(),
});

type AddCustomerFormData = z.infer<typeof addCustomerSchema>;

function generateReferralCode(): string {
  return `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Normalize plate / search for fuzzy match (ignore spaces, dashes, case). */
function normalizeVehicleToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export default function CustomersPage() {
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  
  const filteredData = useCustomerStore((s) => s.customers);
  const total = useCustomerStore((s) => s.total);
  const totalPages = useCustomerStore((s) => s.totalPages);
  const currentPage = useCustomerStore((s) => s.page);
  const isLoading = useCustomerStore((s) => s.customersLoading);
  const isInitialLoaded = useCustomerStore((s) => s.isInitialLoaded);
  const fetchPaginatedCustomers = useCustomerStore((s) => s.fetchPaginatedCustomers);
  const addCustomerToStore = useCustomerStore((s) => s.addCustomer);
  const findByReferralCode = useCustomerStore((s) => s.findByReferralCode);
  const fetchCustomers = useCustomerStore((s) => s.fetchCustomers);

  const vehicles = useVehicleStore((s) => s.vehicles);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const { selectedBranchId } = useBranchScope();
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Customer ids that appear in at least one job card (same constraint the dashboard uses).
  const jobCustomerIds = useMemo(() => {
    const scoped = selectedBranchId
      ? jobCards.filter((jc) => jc.branchId === selectedBranchId)
      : jobCards;
    return new Set(scoped.map((jc) => jc.customerId));
  }, [jobCards, selectedBranchId]);

  const hasMore = currentPage < totalPages;

  const vehicleCountByCustomerId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vehicles) {
      counts.set(v.customerId, (counts.get(v.customerId) ?? 0) + 1);
    }
    return counts;
  }, [vehicles]);

  const customerVehicleCount = (item: Record<string, unknown>): number => {
    const fromRow = safeNumber(item.vehiclesCount, Number.NaN);
    if (Number.isFinite(fromRow)) return fromRow;
    const customerId = String(item.id ?? "");
    return vehicleCountByCustomerId.get(customerId) ?? 0;
  };

  const filters = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (activeFilter === DASHBOARD_FILTER.INACTIVE) params.isInactive = true;
    if (selectedBranchId && jobCustomerIds.size > 0) {
      // NOTE: For true server-side pagination by branch, we should ideally send branchId.
      // But passing an array of matching customerIds might be too large. 
      // Assuming the API supports branchId parameter:
      params.branchId = selectedBranchId;
    }
    return params;
  }, [activeFilter, selectedBranchId, jobCustomerIds]);

  const isFirstMount = React.useRef(true);

  React.useEffect(() => {
    const isDefaultFilters = Object.keys(filters).length === 0;

    if (isFirstMount.current && isInitialLoaded && !searchQuery && isDefaultFilters) {
      isFirstMount.current = false;
      return;
    }
    isFirstMount.current = false;

    fetchPaginatedCustomers({ page: 1, pageSize: 50, search: searchQuery, filters });
  }, [searchQuery, filters, fetchPaginatedCustomers, isInitialLoaded]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchPaginatedCustomers({ page: currentPage + 1, pageSize: 50, search: searchQuery, filters }, true);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchPaginatedCustomers({ page: newPage, pageSize: 50, search: searchQuery, filters });
  };

  /** Hide noemail placeholder addresses from display. */
  function displayEmail(email: string): string | null {
    if (!email || email.includes("@customers.placeholder")) return null;
    return email;
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (item: Record<string, unknown>) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {(item.avatar as string | null | undefined) ? (
              <AvatarImage src={item.avatar as string} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback className="text-xs">
              {getInitials((item.name as string) ?? "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name as string}</span>
            {Boolean(item.isInactive) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <UserX className="w-3 h-3" />
                Inactive
              </Badge>
            )}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      className: "whitespace-nowrap",
    },
    { key: "email", label: "Email", sortable: true },
    {
      key: "vehiclesCount",
      label: "Vehicles",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">{customerVehicleCount(item)}</span>
      ),
      sortable: true,
    },
    {
      key: "totalVisits",
      label: "Total Visits",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">{item.totalVisits as number}</span>
      ),
      sortable: true,
    },
    {
      key: "rewardPoints",
      label: "Reward Points",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium">{item.rewardPoints as number}</span>
      ),
      sortable: true,
    },
    {
      key: "walletBalance",
      label: "Wallet",
      render: (item: Record<string, unknown>) => (
        <span className="font-medium">{formatCurrency((item.walletBalance as number) ?? 0)}</span>
      ),
      sortable: true,
    },
    {
      key: "lastVisitDate",
      label: "Last Visit",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">
          {item.lastVisitDate ? formatDate(item.lastVisitDate as string) : "—"}
        </span>
      ),
      sortable: true,
    },
    {
      key: "memberSince",
      label: "Member Since",
      render: (item: Record<string, unknown>) => (
        <span className="text-muted-foreground">
          {formatDate(item.memberSince as string)}
        </span>
      ),
      sortable: true,
    },
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddCustomerFormData>({
    resolver: zodResolver(addCustomerSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", referredBy: "" },
  });

  const onSubmit = async (data: AddCustomerFormData) => {
    const referred = referredByFromOptionalInput(data.referredBy ?? "", findByReferralCode);
    if (referred.error) {
      toast.error(referred.error);
      return;
    }
    setAddingCustomer(true);
    try {
      const created = await addCustomerToStore({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        referralCode: generateReferralCode(),
        referredBy: referred.referredBy,
        totalVisits: 0,
        rewardPoints: 0,
        walletBalance: 0,
      });
      if (!created) {
        toast.error("This phone number is already registered", {
          description:
            "Each mobile number can only be used once. Open the existing customer or use a different number.",
        });
        return;
      }
      reset();
      setAddDialogOpen(false);
      toast.success("Customer added", { description: `${data.name} has been added successfully.` });
    } catch {
      toast.error("Could not add customer", {
        description: "Check that the API server is running (npm run dev in /backend).",
      });
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleRowClick = (item: Record<string, unknown>) => {
    router.push(`/customers/${item.id}`);
  };

  const handleExport = async (format: "excel" | "pdf") => {
    setExporting(true);
    try {
      await fetchCustomers();
      const latestCustomers = useCustomerStore.getState().customers;
      const latestVehicles = useVehicleStore.getState().vehicles;
      const rows = buildCustomerExportRows(latestCustomers, latestVehicles);
      if (rows.length === 0) {
        toast.error("No customers to export");
        return;
      }
      if (format === "excel") {
        await downloadCustomersExcel(rows);
        toast.success(`Exported ${rows.length} customer${rows.length === 1 ? "" : "s"} to Excel`);
      } else {
        await downloadCustomersPdf(rows);
        toast.success(`Exported ${rows.length} customer${rows.length === 1 ? "" : "s"} to PDF`);
      }
    } catch (e) {
      toast.error("Could not export customers", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  if (!storesReady && !isInitialLoaded && filteredData.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RefreshingBar show={!storesReady} />
      <PageHeader
        title="Customers"
        actions={
          <TooltipProvider delayDuration={300}>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={exporting}
                        aria-label="Export customers"
                      >
                        {exporting ? (
                          <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                        ) : (
                          <Download className="h-4 w-4 sm:mr-1.5" />
                        )}
                        <span className="hidden sm:inline">Export</span>
                        <ChevronDown className="ml-0.5 hidden h-3.5 w-3.5 opacity-60 sm:inline" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="sm:hidden">
                    Export
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="min-w-0 w-[var(--radix-popper-anchor-width)]"
                >
                  <DropdownMenuItem
                    disabled={exporting}
                    onClick={() => void handleExport("pdf")}
                  >
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={exporting}
                    onClick={() => void handleExport("excel")}
                  >
                    Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setImportDialogOpen(true)}
                    aria-label="Import customers"
                  >
                    <Upload className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="sm:hidden">
                  Import
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                className="min-w-0 flex-1 whitespace-nowrap sm:flex-none"
                onClick={() => setAddDialogOpen(true)}
                aria-label="Add customer"
              >
                <Plus className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Customer</span>
              </Button>
            </div>
          </TooltipProvider>
        }
      />

      {activeFilter === DASHBOARD_FILTER.INACTIVE && (
        <FilterBanner
          message="⚠ Showing inactive customers — no visit in 90+ days"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, or vehicle number\u2026"
            className="w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-border/80 bg-background overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex h-10 w-10 items-center justify-center transition-colors ${
              viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex h-10 w-10 items-center justify-center transition-colors ${
              viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
            aria-label="List view"
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {activeFilter === DASHBOARD_FILTER.INACTIVE
          ? `${filteredData.length} inactive customer${filteredData.length !== 1 ? "s" : ""}`
          : `${filteredData.length} customer${filteredData.length !== 1 ? "s" : ""}`}
      </p>

      {/* Card grid / List view */}
      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/85 py-16 text-muted-foreground">
          <p className="text-sm font-medium">No customers found</p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-primary hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <VirtuosoGrid
          useWindowScroll
          data={filteredData}
          endReached={loadMore}
          components={{
            List: GridList,
            Item: GridItem,
          }}
          itemContent={(index, itemRaw) => {
            const item = itemRaw as any;
            const avatarSrc = item.avatar as string | null | undefined;
            const email = displayEmail(String(item.email ?? ""));
            return (
              <Link
                key={String(item.id)}
                href={`/customers/${String(item.id)}`}
                className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 h-full"
              >
                {/* Header: avatar + name + contact */}
                <div className="p-4 flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0 ring-2 ring-border/50">
                    {avatarSrc ? (
                      <AvatarImage src={avatarSrc} alt="" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="text-sm font-semibold">
                      {getInitials(String(item.name ?? ""))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm leading-snug truncate">
                        {String(item.name)}
                      </p>
                      {Boolean(item.isInactive) && (
                        <Badge variant="secondary" className="shrink-0 gap-1 px-1.5 py-0 text-[10px] h-4">
                          <UserX className="h-2.5 w-2.5" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{String(item.phone)}</span>
                    </div>
                    {email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 bg-muted/20">
                    <div className="flex flex-col items-center py-2.5 gap-0.5">
                      <div className="flex items-center gap-1">
                        <Car className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-bold tabular-nums">{customerVehicleCount(item)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Vehicles</span>
                    </div>
                    <div className="flex flex-col items-center py-2.5 gap-0.5">
                      <span className="text-sm font-bold tabular-nums">{String(item.totalVisits)}</span>
                      <span className="text-[10px] text-muted-foreground">Visits</span>
                    </div>
                    <div className="flex flex-col items-center py-2.5 gap-0.5">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-500" />
                        <span className="text-sm font-bold tabular-nums">{String(item.rewardPoints)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Points</span>
                    </div>
                  </div>

                  {/* Footer: wallet + last visit + arrow */}
                  <div className="px-4 py-2.5 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1 text-xs">
                        <Wallet className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-semibold tabular-nums">
                          {formatCurrency((item.walletBalance as number) ?? 0)}
                        </span>
                      </div>
                      {item.lastVisitDate ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatDate(String(item.lastVisitDate))}</span>
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            );
          }}
        />
      ) : (
        /* ── List view — original DataTable ── */
        <DataTable<any>
          data={filteredData}
          columns={columns}
          defaultSortKey="memberSince"
          defaultSortDir="desc"
          hideSearch
          serverPagination={{
            page: currentPage,
            pageSize: 50,
            total,
            totalPages,
            onPageChange: handlePageChange,
            isLoading,
          }}
          onRowClick={(item) => router.push(`/customers/${String(item.id)}`)}
          renderMobileCard={(item) => (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  {(item.avatar as string | null | undefined) ? (
                    <AvatarImage src={item.avatar as string} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(String(item.name ?? ""))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium leading-tight">{String(item.name)}</p>
                    {Boolean(item.isInactive) ? (
                      <Badge variant="secondary" className="h-5 shrink-0 gap-0.5 px-1.5 text-[10px]">
                        <UserX className="h-2.5 w-2.5" />
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  <a
                    href={`tel:${String(item.phone).replace(/\s/g, "")}`}
                    className="text-[11px] text-primary leading-tight"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {String(item.phone)}
                  </a>
                </div>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-muted-foreground">
                <span><span className="font-medium text-foreground tabular-nums">{customerVehicleCount(item)}</span>{" "}veh</span>
                <span aria-hidden className="text-border/80">·</span>
                <span><span className="font-medium text-foreground tabular-nums">{String(item.totalVisits)}</span>{" "}visits</span>
                <span aria-hidden className="text-border/80">·</span>
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency((item.walletBalance as number) ?? 0)}</span>
                <span aria-hidden className="text-border/80">·</span>
                <span><span className="font-medium text-foreground tabular-nums">{String(item.rewardPoints)}</span> pts</span>
                {item.lastVisitDate ? (
                  <><span aria-hidden className="text-border/80">·</span><span>Last {formatDate(String(item.lastVisitDate))}</span></>
                ) : null}
              </p>
            </>
          )}
        />
      )}

      <ImportCustomersDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[90vh] sm:max-w-md")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register("name")} placeholder="Full name" />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} placeholder="+91-9876543210" />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="email@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  {...register("address")}
                  placeholder="Full address"
                  rows={3}
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address.message}</p>
                )}
              </div>
              <NewCustomerReferralCodeField
                id="referredBy"
                value={watch("referredBy") ?? ""}
                onChange={(value) => setValue("referredBy", value)}
              />
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)} disabled={addingCustomer}>
                Cancel
              </Button>
              <Button type="submit" disabled={addingCustomer}>
                {addingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {addingCustomer ? "Adding..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
