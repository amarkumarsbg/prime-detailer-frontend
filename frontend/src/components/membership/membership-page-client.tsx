"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MEMBERSHIP_TIER_DAYS,
  useMembershipStore,
} from "@/store/membership-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import type { MembershipPackage, MembershipTier } from "@/types";
import { formatDate, formatInrFull } from "@/lib/utils";
import { Crown, Package, UserPlus } from "lucide-react";
import { toast } from "sonner";

const TIER_OPTIONS: { value: MembershipTier; label: string }[] = [
  { value: "MONTHLY", label: "Monthly (~30 days)" },
  { value: "QUARTERLY", label: "Quarterly (3 months)" },
  { value: "HALF_YEARLY", label: "Half yearly (6 months)" },
  { value: "YEARLY", label: "Yearly (365 days)" },
];

function tierBadgeVariant(tier: MembershipTier): "default" | "secondary" | "outline" {
  switch (tier) {
    case "MONTHLY":
      return "secondary";
    case "QUARTERLY":
      return "outline";
    default:
      return "default";
  }
}

type TabValue = "packages" | "assign";

export function MembershipPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [mainTab, setMainTab] = useState<TabValue>("packages");

  useEffect(() => {
    if (tabParam === "assign") setMainTab("assign");
  }, [tabParam]);

  const packages = useMembershipStore((s) => s.packages);
  const subscriptions = useMembershipStore((s) => s.subscriptions);
  const upsertPackage = useMembershipStore((s) => s.upsertPackage);
  const setPackageActive = useMembershipStore((s) => s.setPackageActive);
  const assignMembership = useMembershipStore((s) => s.assignMembership);
  const cancelMembership = useMembershipStore((s) => s.cancelMembership);
  const subscriptionEffectiveStatus = useMembershipStore((s) => s.subscriptionEffectiveStatus);

  const catalog = useServiceCatalogStore((s) => s.catalog);
  const customers = useCustomerStore((s) => s.customers);
  const vehicles = useVehicleStore((s) => s.vehicles);

  const activeServices = useMemo(
    () => [...catalog].filter((s) => s.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );

  const serviceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of catalog) m.set(s.id, s.name);
    return m;
  }, [catalog]);

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<MembershipPackage | null>(null);
  const [formName, setFormName] = useState("");
  const [formTier, setFormTier] = useState<MembershipTier>("MONTHLY");
  const [formPrice, setFormPrice] = useState("");
  const [formServiceIds, setFormServiceIds] = useState<Set<string>>(new Set());
  const [serviceFilter, setServiceFilter] = useState("");

  const openNewPackage = () => {
    setEditingPackage(null);
    setFormName("");
    setFormTier("MONTHLY");
    setFormPrice("");
    setFormServiceIds(new Set());
    setServiceFilter("");
    setPkgDialogOpen(true);
  };

  const openEditPackage = (p: MembershipPackage) => {
    setEditingPackage(p);
    setFormName(p.name);
    setFormTier(p.tier);
    setFormPrice(String(p.price));
    setFormServiceIds(new Set(p.includedServiceIds));
    setServiceFilter("");
    setPkgDialogOpen(true);
  };

  const filteredActiveServices = useMemo(() => {
    const q = serviceFilter.trim().toLowerCase();
    if (!q) return activeServices;
    return activeServices.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [activeServices, serviceFilter]);

  const orphanedSelectedIds = useMemo(() => {
    return Array.from(formServiceIds).filter((id) => !catalog.some((c) => c.id === id));
  }, [formServiceIds, catalog]);

  const savePackage = () => {
    const price = parseFloat(formPrice.replace(/,/g, ""));
    if (!formName.trim()) {
      toast.error("Enter a package name.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    if (formServiceIds.size === 0) {
      toast.error("Select at least one service.");
      return;
    }
    const now = new Date().toISOString();
    const pkg: MembershipPackage = {
      id: editingPackage?.id ?? `mem-pkg-${Date.now()}`,
      name: formName.trim(),
      tier: formTier,
      price,
      includedServiceIds: Array.from(formServiceIds),
      isActive: editingPackage?.isActive ?? true,
      createdAt: editingPackage?.createdAt ?? now,
    };
    upsertPackage(pkg);
    toast.success(editingPackage ? "Package updated." : "Package created.");
    setPkgDialogOpen(false);
  };

  const [assignCustomerId, setAssignCustomerId] = useState<string>("");
  const [assignVehicleId, setAssignVehicleId] = useState<string>("");
  const [assignPackageId, setAssignPackageId] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>("");

  const customerVehiclesForAssign = useMemo(() => {
    if (!assignCustomerId) return [];
    return vehicles
      .filter((v) => v.customerId === assignCustomerId)
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
  }, [assignCustomerId, vehicles]);

  useEffect(() => {
    setAssignVehicleId("");
  }, [assignCustomerId]);

  const activePackages = useMemo(() => packages.filter((p) => p.isActive), [packages]);

  const onAssign = () => {
    if (!assignCustomerId) {
      toast.error("Select a customer.");
      return;
    }
    if (!assignVehicleId) {
      toast.error("Select the vehicle this pass applies to.");
      return;
    }
    if (!assignPackageId) {
      toast.error("Select a package.");
      return;
    }
    const start = assignStartDate
      ? new Date(assignStartDate + "T12:00:00").toISOString()
      : undefined;
    const res = assignMembership({
      customerId: assignCustomerId,
      packageId: assignPackageId,
      vehicleId: assignVehicleId,
      startDate: start,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Membership activated (demo).");
    setAssignCustomerId("");
    setAssignVehicleId("");
    setAssignPackageId("");
    setAssignStartDate("");
  };

  const subsWithLabels = useMemo(() => {
    return subscriptions.map((sub) => {
      const cust = customers.find((c) => c.id === sub.customerId);
      const pkg = packages.find((p) => p.id === sub.packageId);
      const eff = subscriptionEffectiveStatus(sub);
      const veh = sub.vehicleId ? vehicles.find((v) => v.id === sub.vehicleId) : undefined;
      const vehicleLabel = veh
        ? `${veh.registrationNumber} · ${veh.make} ${veh.model}`
        : sub.vehicleId
          ? sub.vehicleId
          : "Customer-wide (legacy)";
      return {
        sub,
        custName: cust?.name ?? sub.customerId,
        pkgName: pkg?.name ?? sub.packageId,
        eff,
        vehicleLabel,
      };
    });
  }, [subscriptions, customers, packages, subscriptionEffectiveStatus, vehicles]);

  const setTab = (v: string) => {
    const t = v as TabValue;
    setMainTab(t);
    router.replace(t === "assign" ? "/membership?tab=assign" : "/membership", { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership"
        description="Add and edit services under Services in the sidebar, then tick them into each package here. Assign packages to customers on the second tab. Demo only — no payments."
      />

      <Tabs value={mainTab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="packages" className="gap-2">
            <Package className="h-4 w-4" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="assign" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Assign to customer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" onClick={openNewPackage} className="bg-violet-600 hover:bg-violet-700">
              <Crown className="mr-2 h-4 w-4" />
              Add package
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Membership packages</CardTitle>
              <CardDescription>
                Services are maintained under{" "}
                <Link href="/services" className="font-medium text-primary underline underline-offset-2">
                  Services
                </Link>
                ; pick them here per package.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2">Included services</th>
                    <th className="px-2 py-2 text-center">Active</th>
                    <th className="w-[100px] px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {packages.map((p) => (
                    <tr key={p.id} className="border-b border-border/80">
                      <td className="px-2 py-2 font-medium">{p.name}</td>
                      <td className="px-2 py-2">
                        <Badge variant={tierBadgeVariant(p.tier)}>{p.tier}</Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {MEMBERSHIP_TIER_DAYS[p.tier]} days
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatInrFull(p.price)}</td>
                      <td className="max-w-[280px] px-2 py-2 text-sm text-muted-foreground">
                        {p.includedServiceIds
                          .map((id) => serviceNameById.get(id) ?? id)
                          .join(", ")}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Switch
                          checked={p.isActive}
                          onCheckedChange={(c) => setPackageActive(p.id, c)}
                          aria-label={`Active ${p.name}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Button variant="outline" size="sm" onClick={() => openEditPackage(p)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="mt-6 space-y-6">
          {activePackages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No active packages. Create and activate a package under{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline"
                  onClick={() => setTab("packages")}
                >
                  Packages
                </button>{" "}
                first.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activate membership</CardTitle>
                <CardDescription>
                  One active pass per vehicle per customer (demo). Start date optional — defaults to today.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:max-w-lg">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={assignCustomerId || "none"} onValueChange={(v) => setAssignCustomerId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select customer</SelectItem>
                      {sortedCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select
                    value={assignVehicleId || "none"}
                    onValueChange={(v) => setAssignVehicleId(v === "none" ? "" : v)}
                    disabled={!assignCustomerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={assignCustomerId ? "Select vehicle" : "Pick customer first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select vehicle</SelectItem>
                      {customerVehiclesForAssign.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registrationNumber} · {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignCustomerId && customerVehiclesForAssign.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No vehicles on file — add one from the customer profile first.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Package</Label>
                  <Select value={assignPackageId || "none"} onValueChange={(v) => setAssignPackageId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select package</SelectItem>
                      {activePackages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {formatInrFull(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mem-start">Start date (optional)</Label>
                  <Input
                    id="mem-start"
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                  />
                </div>
                <Button type="button" className="bg-violet-600 hover:bg-violet-700" onClick={onAssign}>
                  Activate membership
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent subscriptions</CardTitle>
              <CardDescription>Status is evaluated from end date when you open this screen.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {subsWithLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
              ) : (
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                      <th className="px-2 py-2">Customer</th>
                      <th className="px-2 py-2">Vehicle</th>
                      <th className="px-2 py-2">Package</th>
                      <th className="px-2 py-2">Valid through</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="w-[100px] px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {subsWithLabels.map(({ sub, custName, pkgName, eff, vehicleLabel }) => (
                      <tr key={sub.id} className="border-b border-border/80">
                        <td className="px-2 py-2">{custName}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground max-w-[200px]">{vehicleLabel}</td>
                        <td className="px-2 py-2">{pkgName}</td>
                        <td className="px-2 py-2 tabular-nums">{formatDate(sub.endDate)}</td>
                        <td className="px-2 py-2">
                          <Badge
                            variant={
                              eff === "ACTIVE"
                                ? "default"
                                : eff === "EXPIRED"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {eff}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          {sub.status === "ACTIVE" && eff !== "EXPIRED" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                cancelMembership(sub.id);
                                toast.message("Membership cancelled (demo).");
                              }}
                            >
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Name</Label>
              <Input id="pkg-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={formTier} onValueChange={(v) => setFormTier(v as MembershipTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">Price (₹)</Label>
              <Input
                id="pkg-price"
                inputMode="decimal"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Included services</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formServiceIds.size} selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                New washes or services are created on the{" "}
                <Link href="/services" className="font-medium text-primary underline underline-offset-2">
                  Services
                </Link>{" "}
                page. Only <strong>active</strong> catalog items appear below; search to find them quickly.
              </p>
              {orphanedSelectedIds.length > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-900 dark:bg-amber-950/50">
                  This package still references IDs not in your current catalog:{" "}
                  {orphanedSelectedIds.join(", ")}. Re-add matching services or remove them from the package.
                </p>
              )}
              <Input
                placeholder="Search services by name or category…"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="h-9"
                aria-label="Filter services list"
              />
              <ScrollArea className="h-[200px] rounded-md border border-border p-3">
                <div className="space-y-3 pr-3">
                  {filteredActiveServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No active services match.{" "}
                      <Link href="/services" className="text-primary underline">
                            Open Services
                      </Link>
                    </p>
                  ) : (
                    filteredActiveServices.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-start gap-2 text-sm leading-tight"
                      >
                        <Checkbox
                          checked={formServiceIds.has(s.id)}
                          onCheckedChange={(checked) => {
                            setFormServiceIds((prev) => {
                              const next = new Set(prev);
                              if (checked === true) next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                        />
                        <span>
                          <span className="font-medium">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">{s.category}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPkgDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" className="bg-violet-600 hover:bg-violet-700" onClick={savePackage}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
