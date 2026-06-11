"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, UserX } from "lucide-react";
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
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isInactiveCustomer } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
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
  const { customers, addCustomer: addCustomerToStore } = useCustomerStore();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const activeFilter = useDashboardFilterStore((s) => s.activeFilter);
  const setActiveFilter = useDashboardFilterStore((s) => s.setActiveFilter);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customers and their vehicles"
        actions={
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        }
      />

      {activeFilter === DASHBOARD_FILTER.INACTIVE && (
        <FilterBanner
          message="⚠ Showing inactive customers — no visit in 90+ days"
          onDismiss={() => setActiveFilter(null)}
        />
      )}

      <div className="flex gap-2 md:hidden">
        <Button className="flex-1" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

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
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs">
                    {getInitials(String(item.name ?? ""))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium leading-snug truncate">{String(item.name)}</p>
                  <a
                    href={`tel:${String(item.phone).replace(/\s/g, "")}`}
                    className="text-xs text-primary mt-0.5 block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {String(item.phone)}
                  </a>
                </div>
              </div>
              {Boolean(item.isInactive) ? (
                <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                  <UserX className="w-3 h-3" />
                  Inactive
                </Badge>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Vehicles</dt>
                <dd className="font-medium tabular-nums">{String(item.vehiclesCount)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Visits</dt>
                <dd className="font-medium tabular-nums">{String(item.totalVisits)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Wallet</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency((item.walletBalance as number) ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Points</dt>
                <dd className="font-medium tabular-nums">{String(item.rewardPoints)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Last visit</dt>
                <dd>{item.lastVisitDate ? formatDate(String(item.lastVisitDate)) : "—"}</dd>
              </div>
            </dl>
          </>
        )}
      />

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
