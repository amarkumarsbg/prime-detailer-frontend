"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Upload, UserX, Download, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isInactiveCustomer } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import {
  buildCustomerExportRows,
  downloadCustomersExcel,
  downloadCustomersPdf,
} from "@/lib/customer-export";
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils";
const addCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(1, "Address is required"),
});

type AddCustomerFormData = z.infer<typeof addCustomerSchema>;

function generateReferralCode(): string {
  return `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Normalize plate / search for fuzzy match (ignore spaces, dashes, case). */
function normalizeVehicleToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CustomersPage() {
  const router = useRouter();
  const { customers, addCustomer: addCustomerToStore, fetchCustomers } = useCustomerStore();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const tableData = useMemo(() => {
    const source =
      activeFilter === DASHBOARD_FILTER.INACTIVE
        ? customers.filter(isInactiveCustomer)
        : customers;
    return source.map((c) => {
      const customerVehicles = vehicles.filter((v) => v.customerId === c.id);
      const vehiclesCount = customerVehicles.length;
      const vehicleRegNormalizedList = customerVehicles.map((v) =>
        normalizeVehicleToken(v.registrationNumber)
      );
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        vehiclesCount,
        totalVisits: c.totalVisits,
        rewardPoints: c.rewardPoints,
        walletBalance: c.walletBalance,
        lastVisitDate: c.lastVisitDate,
        isInactive: c.isInactive,
        memberSince: c.createdAt,
        /** Hidden field for search (comma-separated normalized regs). */
        _vehicleRegSearch: vehicleRegNormalizedList.join(","),
      };
    }) as Record<string, unknown>[];
  }, [customers, vehicles, activeFilter]);

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (item: Record<string, unknown>) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
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
        <span className="text-muted-foreground">{item.vehiclesCount as number}</span>
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
    formState: { errors },
  } = useForm<AddCustomerFormData>({
    resolver: zodResolver(addCustomerSchema),
    defaultValues: { name: "", phone: "", email: "", address: "" },
  });

  const onSubmit = async (data: AddCustomerFormData) => {
    try {
      const created = await addCustomerToStore({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        referralCode: generateReferralCode(),
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

  return (
    <div className="space-y-4 sm:space-y-6">
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

      <DataTable
        data={tableData}
        columns={columns}
        defaultSortKey="memberSince"
        defaultSortDir="desc"
        searchPlaceholder="Search by name, phone, email, or vehicle number..."
        searchKeys={["name", "phone", "email"]}
        searchMatch={(item, q) => {
          const name = String(item.name ?? "").toLowerCase();
          const phone = String(item.phone ?? "").toLowerCase();
          const email = String(item.email ?? "").toLowerCase();
          if (name.includes(q) || phone.includes(q) || email.includes(q)) return true;
          const qReg = normalizeVehicleToken(q);
          if (qReg.length < 2) return false;
          const blob = String(item._vehicleRegSearch ?? "");
          if (!blob) return false;
          return blob.split(",").some((reg) => reg.includes(qReg));
        }}
        onRowClick={handleRowClick}
        renderMobileCard={(item) => (
          <>
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
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
              <span>
                <span className="font-medium text-foreground tabular-nums">{String(item.vehiclesCount)}</span>{" "}
                veh
              </span>
              <span aria-hidden className="text-border/80">
                ·
              </span>
              <span>
                <span className="font-medium text-foreground tabular-nums">{String(item.totalVisits)}</span>{" "}
                visits
              </span>
              <span aria-hidden className="text-border/80">
                ·
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatCurrency((item.walletBalance as number) ?? 0)}
                </span>
              </span>
              <span aria-hidden className="text-border/80">
                ·
              </span>
              <span>
                <span className="font-medium text-foreground tabular-nums">{String(item.rewardPoints)}</span> pts
              </span>
              {item.lastVisitDate ? (
                <>
                  <span aria-hidden className="text-border/80">
                    ·
                  </span>
                  <span>Last {formatDate(String(item.lastVisitDate))}</span>
                </>
              ) : null}
            </p>
          </>
        )}
      />

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
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
