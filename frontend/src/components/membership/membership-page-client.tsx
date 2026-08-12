"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import {
  DesktopTableWrap,
  MobileCardList,
  MobileRowCard,
} from "@/components/shared/mobile-table-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  membershipIncludedQuantity,
  useMembershipStore,
} from "@/store/membership-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useSettingsStore } from "@/store/settings-store";
import type { MembershipPackage, MembershipTier } from "@/types";
import { cn, formatDate, formatInrFull } from "@/lib/utils";
import { Crown, Package, Pencil, UserPlus, Search, X, Plus, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { notifyMembershipWelcomeWhatsApp } from "@/lib/whatsapp-automation-triggers";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { computeCustomerLookupMatches } from "@/lib/customer-vehicle-lookup";
import {
  INDIAN_VEHICLE_REG_HINT,
  findVehicleByNormalizedReg,
  isValidIndianVehicleRegistration,
  normalizeRegistrationNumber,
} from "@/lib/vehicle-registration";
import type { Customer, Vehicle, VehicleSegment } from "@/types";

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

function formatTierLabel(tier: MembershipTier): string {
  const found = TIER_OPTIONS.find((o) => o.value === tier);
  if (!found) return tier;
  return found.label.replace(/\s*\(.*\)$/, "");
}

function includedServiceLabel(name: string, quantity: number): string {
  return `${name} ×${quantity}`;
}

const MOBILE_SERVICES_PREVIEW = 2;

function MembershipPackageMobileCard({
  pkg,
  serviceLabels,
  onEdit,
  onToggleActive,
}: {
  pkg: MembershipPackage;
  serviceLabels: string[];
  onEdit: () => void;
  onToggleActive: (active: boolean) => void;
}) {
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const overflowCount = Math.max(0, serviceLabels.length - MOBILE_SERVICES_PREVIEW);
  const showTruncated = overflowCount > 0 && !servicesExpanded;
  const previewText = showTruncated
    ? serviceLabels.slice(0, MOBILE_SERVICES_PREVIEW).join(", ")
    : serviceLabels.join(", ");

  return (
    <MobileRowCard className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">{pkg.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={tierBadgeVariant(pkg.tier)} className="h-5 px-1.5 text-[10px] font-medium">
              {formatTierLabel(pkg.tier)}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {MEMBERSHIP_TIER_DAYS[pkg.tier]} days
            </span>
          </div>
          <p className="mt-2 text-lg font-bold tabular-nums leading-none">{formatInrFull(pkg.price)}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2.5"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {serviceLabels.length > 0 ? (
        <div className="mt-2.5 rounded-md bg-muted/35 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Services
          </p>
          <p className="mt-0.5 text-xs leading-snug text-foreground/90">
            {previewText}
            {showTruncated ? (
              <>
                {", "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setServicesExpanded(true)}
                >
                  +{overflowCount} more
                </button>
              </>
            ) : null}
          </p>
          {overflowCount > 0 && servicesExpanded ? (
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-primary hover:underline"
              onClick={() => setServicesExpanded(false)}
            >
              Show less
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center border-t border-border/50 pt-2.5">
        <label className="flex items-center gap-2">
          <Switch
            checked={pkg.isActive}
            onCheckedChange={onToggleActive}
            aria-label={`Active ${pkg.name}`}
          />
          <span
            className={cn(
              "text-xs font-medium",
              pkg.isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {pkg.isActive ? "Active" : "Inactive"}
          </span>
        </label>
      </div>
    </MobileRowCard>
  );
}

type TabValue = "packages" | "assign";

export function MembershipPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [mainTab, setMainTab] = useState<TabValue>("packages");

  useEffect(() => {
    if (tabParam === "assign") queueMicrotask(() => setMainTab("assign"));
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
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const businessName = useSettingsStore((s) => s.businessName);

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
  const [formServiceQuantities, setFormServiceQuantities] = useState<Record<string, number>>({});
  const [serviceFilter, setServiceFilter] = useState("");

  const selectedServiceIds = useMemo(
    () => Object.keys(formServiceQuantities),
    [formServiceQuantities]
  );

  const openNewPackage = () => {
    setEditingPackage(null);
    setFormName("");
    setFormTier("MONTHLY");
    setFormPrice("");
    setFormServiceQuantities({});
    setServiceFilter("");
    setPkgDialogOpen(true);
  };

  const openEditPackage = (p: MembershipPackage) => {
    setEditingPackage(p);
    setFormName(p.name);
    setFormTier(p.tier);
    setFormPrice(String(p.price));
    setFormServiceQuantities(
      Object.fromEntries(
        p.includedServiceIds.map((sid) => [sid, membershipIncludedQuantity(p, sid)])
      )
    );
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
    return selectedServiceIds.filter((id) => !catalog.some((c) => c.id === id));
  }, [selectedServiceIds, catalog]);

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
    if (selectedServiceIds.length === 0) {
      toast.error("Select at least one service.");
      return;
    }
    const now = new Date().toISOString();
    const pkg: MembershipPackage = {
      id: editingPackage?.id ?? `mem-pkg-${Date.now()}`,
      name: formName.trim(),
      tier: formTier,
      price,
      includedServiceIds: selectedServiceIds,
      includedServiceQuantities: Object.fromEntries(
        selectedServiceIds.map((sid) => [sid, Math.max(1, Math.floor(formServiceQuantities[sid] ?? 1))])
      ),
      isActive: editingPackage?.isActive ?? true,
      createdAt: editingPackage?.createdAt ?? now,
    };
    upsertPackage(pkg);
    toast.success(editingPackage ? "Package updated." : "Package created.");
    setPkgDialogOpen(false);
  };

  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModelsByBrand, setExtraModelsByBrand] = useState<Record<string, string[]>>({});

  const allBrandsSorted = useMemo(() => {
    const combined = new Set([...getBrandNames(), ...extraBrands]);
    return Array.from(combined).sort();
  }, [getBrandNames, extraBrands]);

  const [assignCustomerId, setAssignCustomerId] = useState<string>("");
  const [assignVehicleId, setAssignVehicleId] = useState<string>("");
  const [assignPackageId, setAssignPackageId] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>("");

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Customer[]>([]);

  // Nested vehicle creation dialog for existing customer
  const [addVehicleForExistingCustomerDialogOpen, setAddVehicleForExistingCustomerDialogOpen] = useState(false);
  const [newVehicleRegInput, setNewVehicleRegInput] = useState("");
  const [newVehicleMakeInput, setNewVehicleMakeInput] = useState("");
  const [newVehicleModelInput, setNewVehicleModelInput] = useState("");
  const [newVehicleSegmentInput, setNewVehicleSegmentInput] = useState<VehicleSegment>("HATCHBACK");

  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === assignCustomerId) || null,
    [assignCustomerId, customers]
  );

  const hasExistingCustomer = Boolean(selectedExistingCustomer);

  const customerVehiclesForAssign = useMemo(() => {
    if (!assignCustomerId) return [];
    return vehicles
      .filter((v) => v.customerId === assignCustomerId)
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
  }, [assignCustomerId, vehicles]);

  const allModelsSortedForExistingCustomer = useMemo(() => {
    if (!newVehicleMakeInput) return [];
    const fromCatalog = getModels(newVehicleMakeInput);
    const fromExtra = extraModelsByBrand[newVehicleMakeInput] || [];
    return Array.from(new Set([...fromCatalog.map((m) => (typeof m === "string" ? m : m.name)), ...fromExtra])).sort();
  }, [newVehicleMakeInput, getModels, extraModelsByBrand]);

  useEffect(() => {
    const trimmed = lookupQuery.trim();
    if (!trimmed) {
      setLookupPanelCustomers([]);
      return;
    }
    const id = window.setTimeout(() => {
      setLookupPanelCustomers(computeCustomerLookupMatches(trimmed, customers, vehicles));
    }, 280);
    return () => window.clearTimeout(id);
  }, [lookupQuery, customers, vehicles]);

  const applySelectedCustomer = (customerId: string) => {
    const c = customers.find((row) => row.id === customerId);
    if (!c) return;
    setAssignCustomerId(c.id);
    setLookupQuery("");
    const owned = vehicles
      .filter((v) => v.customerId === c.id)
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
    setAssignVehicleId(owned[0]?.id ?? "");
    setLookupPanelCustomers([]);
  };

  const clearSelectedCustomer = () => {
    setAssignCustomerId("");
    setAssignVehicleId("");
  };

  const handleSaveVehicleForExistingCustomer = () => {
    if (!assignCustomerId) {
      toast.error("Select customer first");
      return;
    }

    const reg = newVehicleRegInput.trim().toUpperCase();
    const make = newVehicleMakeInput.trim();
    const model = newVehicleModelInput.trim();
    if (!reg || !make || !model) {
      toast.error("Enter registration, make, and model");
      return;
    }

    if (!isValidIndianVehicleRegistration(reg)) {
      toast.error("Invalid vehicle registration", { description: INDIAN_VEHICLE_REG_HINT });
      return;
    }

    const existingVehicle = findVehicleByNormalizedReg(vehicles, reg);
    if (existingVehicle) {
      toast.error("Registration already in the system", {
        description: `${existingVehicle.registrationNumber} is already assigned to ${existingVehicle.customerName}.`,
      });
      return;
    }

    const customer = customers.find((c) => c.id === assignCustomerId);
    if (!customer) {
      toast.error("Could not find selected customer");
      return;
    }

    const inferredSegment = getModelSegment(make, model) ?? newVehicleSegmentInput;
    const newVehicle: Vehicle = {
      id: `veh-mem-${Date.now()}`,
      customerId: assignCustomerId,
      customerName: customer.name,
      registrationNumber: reg,
      make,
      model,
      segment: inferredSegment,
      fuelType: "PETROL",
      color: "—",
      year: new Date().getFullYear(),
    };

    setVehicles((prev) => [newVehicle, ...prev]);

    setAssignVehicleId(newVehicle.id);
    setAddVehicleForExistingCustomerDialogOpen(false);
    toast.success("Vehicle registered", { description: `${make} ${model} (${reg})` });
  };

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
    const pkg = packages.find((p) => p.id === assignPackageId);
    const cust = customers.find((c) => c.id === assignCustomerId);
    const veh = vehicles.find((v) => v.id === assignVehicleId);
    const subRow = useMembershipStore.getState().subscriptions.find((s) => s.id === res.id);
    if (pkg && cust && subRow) {
      const names = pkg.includedServiceIds
        .map((sid) => catalog.find((c) => c.id === sid)?.name)
        .filter((n): n is string => Boolean(n));
      notifyMembershipWelcomeWhatsApp({
        customerPhone: cust.phone,
        customerName: cust.name,
        customerId: cust.id,
        businessName,
        packageName: pkg.name,
        tier: pkg.tier,
        validUntilIso: subRow.endDate,
        vehicleReg: veh?.registrationNumber,
        includedServiceNames: names,
      });
    }
    toast.success("Membership activated.");
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
      <PageHeader title="Membership" />

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

        <TabsContent value="packages" className="mt-3 md:mt-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Membership packages</CardTitle>
              <Button
                type="button"
                onClick={openNewPackage}
                className="w-full shrink-0 bg-violet-600 hover:bg-violet-700 sm:w-auto"
              >
                <Crown className="mr-2 h-4 w-4" />
                Add package
              </Button>
            </CardHeader>
            <CardContent className="pb-2 md:pb-6">
              <MobileCardList className="space-y-2.5 pb-6">
                {packages.map((p) => (
                  (() => {
                    const serviceLabels = p.includedServiceIds.map((id) =>
                      includedServiceLabel(
                        serviceNameById.get(id) ?? id,
                        membershipIncludedQuantity(p, id)
                      )
                    );
                    return (
                  <MembershipPackageMobileCard
                    key={p.id}
                    pkg={p}
                    serviceLabels={serviceLabels}
                    onEdit={() => openEditPackage(p)}
                    onToggleActive={(c) => setPackageActive(p.id, c)}
                  />
                    );
                  })()
                ))}
              </MobileCardList>
              <DesktopTableWrap>
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
                            .map((id) =>
                              includedServiceLabel(
                                serviceNameById.get(id) ?? id,
                                membershipIncludedQuantity(p, id)
                              )
                            )
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
              </DesktopTableWrap>
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
                  One active pass per vehicle. Start date is optional and defaults to today.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:max-w-lg">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Customer</Label>
                  {!assignCustomerId ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-9 h-10 border-input"
                          value={lookupQuery}
                          onChange={(e) => setLookupQuery(e.target.value)}
                          placeholder="Search customer by name or phone..."
                        />
                        {lookupQuery.trim() && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                            onClick={() => {
                              setLookupQuery("");
                              setLookupPanelCustomers([]);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {lookupPanelCustomers.length > 0 && (
                        <div className="border border-border/80 rounded-xl bg-card overflow-hidden divide-y max-h-48 overflow-y-auto shadow-sm">
                          {lookupPanelCustomers.map((c) => {
                            const owned = vehicles.filter((v) => v.customerId === c.id);
                            return (
                              <div
                                key={c.id}
                                className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                                onClick={() => applySelectedCustomer(c.id)}
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-foreground leading-tight">{c.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{c.phone || "No phone"}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] bg-secondary/80 text-secondary-foreground font-medium px-2 py-0.5 rounded-full">
                                    {owned.length} {owned.length === 1 ? "vehicle" : "vehicles"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    selectedExistingCustomer && (
                      <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 space-y-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-base text-foreground leading-tight">{selectedExistingCustomer.name}</p>
                            <p className="text-xs text-muted-foreground">{selectedExistingCustomer.phone || "No phone"} · {selectedExistingCustomer.email || "No email"}</p>
                            {selectedExistingCustomer.address && (
                              <p className="text-xs text-muted-foreground/80 mt-1 leading-snug">{selectedExistingCustomer.address}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-violet-200 hover:bg-violet-100 text-violet-700 dark:border-violet-800 dark:hover:bg-violet-900/40 dark:text-violet-300"
                            onClick={clearSelectedCustomer}
                          >
                            Change Customer
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-semibold">Vehicle</Label>
                    {assignCustomerId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-violet-200 text-violet-700 bg-white hover:bg-violet-50 text-[11px] font-medium animate-pulse hover:animate-none"
                        onClick={() => {
                          setAddVehicleForExistingCustomerDialogOpen(true);
                          setNewVehicleRegInput("");
                          setNewVehicleMakeInput("");
                          setNewVehicleModelInput("");
                          setNewVehicleSegmentInput("HATCHBACK");
                        }}
                      >
                        + Register Vehicle
                      </Button>
                    )}
                  </div>

                  {!assignCustomerId ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-muted/5">
                      Please select a customer first.
                    </div>
                  ) : customerVehiclesForAssign.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-muted/5 space-y-2">
                      <p>No vehicles registered under this customer profile.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {customerVehiclesForAssign.map((v) => {
                        const selected = assignVehicleId === v.id;
                        return (
                          <div
                            key={v.id}
                            className={cn(
                              "rounded-xl border-2 p-3 text-left transition-all cursor-pointer relative shadow-sm hover:scale-[1.01] active:scale-[0.99]",
                              selected
                                ? "border-violet-600 bg-violet-50/20 dark:border-violet-500 dark:bg-violet-950/15"
                                : "border-border bg-card hover:border-violet-500/30"
                            )}
                            onClick={() => setAssignVehicleId(v.id)}
                          >
                            {selected && (
                              <CheckCircle2 className="absolute right-2 top-2 w-4 h-4 text-violet-600 dark:text-violet-400" />
                            )}
                            <div className="pr-5">
                              <p className="font-mono font-bold text-sm tracking-wider uppercase text-foreground leading-snug">
                                {v.registrationNumber}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 font-medium font-sans">
                                {v.make} {v.model}
                              </p>
                              <span className="inline-block mt-2 text-[9px] font-bold tracking-wider uppercase bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 px-1.5 py-0.5 rounded font-sans">
                                {v.segment}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                    className="date-input-icon-end pr-9"
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

      {/* Nested Add Vehicle dialog for membership customer */}
      <Dialog
        open={addVehicleForExistingCustomerDialogOpen}
        onOpenChange={setAddVehicleForExistingCustomerDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Vehicle</DialogTitle>
            <DialogDescription className="sr-only">
              Add a vehicle for the selected existing customer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mem-dialog-veh-reg" className="text-xs">Registration Number *</Label>
              <Input
                id="mem-dialog-veh-reg"
                value={newVehicleRegInput}
                onChange={(e) => setNewVehicleRegInput(e.target.value.toUpperCase())}
                placeholder="e.g. KA01AB1234"
                maxLength={16}
                className="font-mono uppercase h-9 border-input"
              />
              <p className="text-[10px] text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-dialog-veh-seg" className="text-xs">Type</Label>
              <Select
                value={newVehicleSegmentInput}
                onValueChange={(v) => setNewVehicleSegmentInput(v as VehicleSegment)}
              >
                <SelectTrigger id="mem-dialog-veh-seg" className="h-9 border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                  <SelectItem value="SEDAN">Sedan</SelectItem>
                  <SelectItem value="COMPACT_SUV">Compact SUV</SelectItem>
                  <SelectItem value="SUV">SUV</SelectItem>
                  <SelectItem value="LUXURY">Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mem-dialog-veh-make" className="text-xs">Brand *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 shrink-0 border-sky-300 bg-white px-2 text-[10px] font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                  onClick={() => {
                    setNewBrandOpen(true);
                    setNewBrandDraft("");
                  }}
                >
                  + New
                </Button>
              </div>
              <Select
                value={newVehicleMakeInput || undefined}
                onValueChange={(value) => {
                  setNewVehicleMakeInput(value);
                  setNewVehicleModelInput("");
                }}
              >
                <SelectTrigger id="mem-dialog-veh-make" className="h-9 border-input">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {allBrandsSorted.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mem-dialog-veh-model" className="text-xs">Model *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newVehicleMakeInput}
                  className="h-6 shrink-0 px-2 text-[10px] font-medium disabled:opacity-50"
                  onClick={() => {
                    if (!newVehicleMakeInput) return;
                    setNewModelOpen(true);
                    setNewModelDraft("");
                  }}
                >
                  + New
                </Button>
              </div>
              <Select
                value={newVehicleModelInput || undefined}
                onValueChange={(value) => {
                  setNewVehicleModelInput(value);
                  const inferredSegment = getModelSegment(newVehicleMakeInput, value);
                  if (inferredSegment) {
                    setNewVehicleSegmentInput(inferredSegment);
                  }
                }}
                disabled={!newVehicleMakeInput}
              >
                <SelectTrigger id="mem-dialog-veh-model" className="h-9 border-input">
                  <SelectValue placeholder={newVehicleMakeInput ? "Select model" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent>
                  {allModelsSortedForExistingCustomer.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddVehicleForExistingCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveVehicleForExistingCustomer}>
              Register Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Brand add dialog */}
      <Dialog open={newBrandOpen} onOpenChange={setNewBrandOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>
              Add a brand name when it is not in the catalog search list.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Brand name"
            value={newBrandDraft}
            onChange={(e) => setNewBrandDraft(e.target.value)}
            className="border-input"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewBrandOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                const b = newBrandDraft.trim();
                if (!b) return;
                setExtraBrands((prev) => [...prev, b]);
                setNewVehicleMakeInput(b);
                setNewBrandOpen(false);
              }}
            >
              Add Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Model add dialog */}
      <Dialog open={newModelOpen} onOpenChange={setNewModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add model</DialogTitle>
            <DialogDescription>
              Add a model name under brand "{newVehicleMakeInput}".
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Model name"
            value={newModelDraft}
            onChange={(e) => setNewModelDraft(e.target.value)}
            className="border-input"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewModelOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                const m = newModelDraft.trim();
                if (!m) return;
                setExtraModelsByBrand((prev) => ({
                  ...prev,
                  [newVehicleMakeInput]: [...(prev[newVehicleMakeInput] || []), m],
                }));
                setNewVehicleModelInput(m);
                setNewModelOpen(false);
              }}
            >
              Add Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent subscriptions</CardTitle>
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
                                toast.message("Membership cancelled.");
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
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[min(90vh,calc(100dvh-2rem))]")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>{editingPackage ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2 [scrollbar-gutter:stable]">
            <div className="grid gap-4 pb-2">
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
                    {selectedServiceIds.length} selected
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only active catalog services are listed below.
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
                          className="flex items-start justify-between gap-3 text-sm leading-tight"
                        >
                          <div className="flex min-w-0 cursor-pointer items-start gap-2">
                            <Checkbox
                              checked={formServiceQuantities[s.id] != null}
                              onCheckedChange={(checked) => {
                                setFormServiceQuantities((prev) => {
                                  const next = { ...prev };
                                  if (checked === true) {
                                    next[s.id] = Math.max(1, Math.floor(prev[s.id] ?? 1));
                                  } else {
                                    delete next[s.id];
                                  }
                                  return next;
                                });
                              }}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{s.name}</span>
                              <span className="block text-xs text-muted-foreground">{s.category}</span>
                            </span>
                          </div>
                          {formServiceQuantities[s.id] != null ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 px-0"
                                onClick={() => {
                                  setFormServiceQuantities((prev) => {
                                    const cur = Math.max(1, Math.floor(prev[s.id] ?? 1));
                                    if (cur <= 1) {
                                      const next = { ...prev };
                                      delete next[s.id];
                                      return next;
                                    }
                                    return { ...prev, [s.id]: cur - 1 };
                                  });
                                }}
                              >
                                -
                              </Button>
                              <span className="min-w-[2ch] text-center tabular-nums">
                                {formServiceQuantities[s.id]}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 px-0"
                                onClick={() => {
                                  setFormServiceQuantities((prev) => ({
                                    ...prev,
                                    [s.id]: Math.max(1, Math.floor(prev[s.id] ?? 1)) + 1,
                                  }));
                                }}
                              >
                                +
                              </Button>
                            </div>
                          ) : null}
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-6 py-4 sm:gap-0">
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
