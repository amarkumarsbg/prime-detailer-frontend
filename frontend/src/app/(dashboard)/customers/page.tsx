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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useDashboardFilterStore, DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import { isInactiveCustomer } from "@/lib/dashboard-filters";
import { FilterBanner } from "@/components/shared/filter-banner";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
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
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Add Customer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
      />
    </div>
  );
}
