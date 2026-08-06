"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Car, ChevronRight, Crown, Pencil, Plus, Star, MessageSquare, Wallet, Copy, Share2, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JobCardStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badge";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useWalletStore } from "@/store/wallet-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useCommunicationStore } from "@/store/communication-store";
import {
  MEMBERSHIP_TIER_DAYS,
  useMembershipStore,
} from "@/store/membership-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { formatCurrency, formatDate, formatInrFull, getInitials, cn } from "@/lib/utils";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { getTransferTagForCustomer } from "@/lib/ownership-transfers";
import {
  findVehicleByNormalizedReg,
  INDIAN_VEHICLE_REG_ERROR_SHORT,
  isValidIndianVehicleRegistration,
} from "@/lib/vehicle-registration";
import type { Vehicle, JobCard, Invoice, WalletTransaction, FuelType, VehicleSegment } from "@/types";

const fuelTypes: FuelType[] = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"];
const vehicleSegments: VehicleSegment[] = ["HATCHBACK", "SEDAN", "SUV", "LUXURY", "MUV", "COMPACT_SUV"];

function vehicleColorHex(colorName: string): string {
  const lower = colorName.toLowerCase();
  if (lower.includes("white") || lower.includes("arctic") || lower.includes("polar")) return "#f8fafc";
  if (lower.includes("black") || lower.includes("midnight") || lower.includes("oberon") || lower.includes("abyss")) return "#1e293b";
  if (lower.includes("grey") || lower.includes("gray") || lower.includes("silver") || lower.includes("steel")) return "#64748b";
  if (lower.includes("red") || lower.includes("fiery") || lower.includes("radiant")) return "#dc2626";
  if (lower.includes("blue") || lower.includes("nexa") || lower.includes("teal")) return "#2563eb";
  if (lower.includes("orange")) return "#ea580c";
  if (lower.includes("beige") || lower.includes("rocky")) return "#d4a574";
  if (lower.includes("green")) return "#16a34a";
  return "#6366f1";
}

interface CustomerAddVehicleFormData {
  registrationNumber: string;
  make: string;
  model: string;
  variant?: string;
  fuelType: FuelType;
  segment: VehicleSegment;
  color: string;
  year: number;
  notes?: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const vehicleList = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<CustomerAddVehicleFormData>({
    defaultValues: {
      fuelType: "PETROL",
      segment: "HATCHBACK",
      year: new Date().getFullYear(),
    },
  });

  /* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() */
  const watchFuelType = watch("fuelType");
  const watchSegment = watch("segment");
  /* eslint-enable react-hooks/incompatible-library */

  const { customers: allCustomers, updateCustomer, findByPhone } = useCustomerStore();
  const customer = useMemo(() => {
    return allCustomers.find((c) => c.id === id) ?? null;
  }, [id, allCustomers]);

  const customerVehicles = useMemo(() => {
    return vehicleList.filter((v) => v.customerId === id);
  }, [id, vehicleList]);

  const jobCards = useJobCardStore((s) => s.jobCards);
  const invoices = useInvoiceStore((s) => s.invoices);

  const customerJobCards = useMemo(() => {
    return jobCards
      .filter((jc) => jc.customerId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [id, jobCards]);

  const customerInvoices = useMemo(() => {
    return invoices
      .filter((inv) => inv.customerId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [id, invoices]);

  const { getByCustomer } = useWalletStore();
  const customerWalletTransactions = useMemo(() => {
    return getByCustomer(id);
  }, [id, getByCustomer]);

  const messages = useCommunicationStore((s) => s.messages);
  const customerMessages = useMemo(() => {
    return messages
      .filter((m) => m.customerId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [id, messages]);

  const membershipSubscriptions = useMembershipStore((s) => s.subscriptions);
  const packages = useMembershipStore((s) => s.packages);
  const getActiveMembership = useMembershipStore((s) => s.getActiveMembership);
  const subscriptionEffectiveStatus = useMembershipStore((s) => s.subscriptionEffectiveStatus);
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const serviceNameByCatalogId = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of catalog) m.set(s.id, s.name);
    return m;
  }, [catalog]);

  const activeMembershipByVehicle = useMemo(() => {
    if (!customer) return [];
    return customerVehicles
      .map((v) => {
        const sub = getActiveMembership(customer.id, v.id);
        if (!sub) return null;
        const pkg = packages.find((p) => p.id === sub.packageId);
        if (!pkg) return null;
        const ms = new Date(sub.endDate).getTime() - Date.now();
        const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
        return { vehicle: v, sub, pkg, daysLeft };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [customer, customerVehicles, getActiveMembership, packages]);

  const legacyActiveMembership = useMemo(() => {
    if (!customer) return undefined;
    return membershipSubscriptions.find(
      (s) =>
        s.customerId === customer.id &&
        !s.vehicleId &&
        subscriptionEffectiveStatus(s) === "ACTIVE"
    );
  }, [customer, membershipSubscriptions, subscriptionEffectiveStatus]);

  const legacyMembershipPackage = useMemo(
    () => packages.find((p) => p.id === legacyActiveMembership?.packageId),
    [packages, legacyActiveMembership?.packageId]
  );

  const membershipHistoryLines = useMemo(() => {
    if (!customer) return [];
    type Line = {
      usedAt: string;
      serviceName: string;
      vehicleLabel: string;
      jobCardId?: string;
    };
    const lines: Line[] = [];
    for (const sub of membershipSubscriptions.filter((s) => s.customerId === customer.id)) {
      const veh = sub.vehicleId ? vehicleList.find((x) => x.id === sub.vehicleId) : undefined;
      const vehicleLabel = veh
        ? `${veh.registrationNumber} (${veh.make} ${veh.model})`
        : sub.vehicleId
          ? sub.vehicleId
          : "Customer-wide";
      for (const u of sub.usageHistory ?? []) {
        lines.push({
          usedAt: u.usedAt,
          serviceName: u.serviceName ?? serviceNameByCatalogId.get(u.serviceCatalogId) ?? u.serviceCatalogId,
          vehicleLabel,
          jobCardId: u.jobCardId,
        });
      }
    }
    return lines.sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());
  }, [customer, membershipSubscriptions, vehicleList, serviceNameByCatalogId]);

  const referralCount = useMemo(() => {
    return allCustomers.filter((c) => c.referredBy === customer?.referralCode).length;
  }, [allCustomers, customer?.referralCode]);

  const normalizeJobCardStatus = (status: string) => {
    return status as JobCard["status"];
  };

  const getPaymentMethod = (inv: Invoice) => {
    if (inv.payments.length === 0) return "—";
    const method = inv.payments[0].method;
    return method === "UPI" ? "UPI" : method === "CARD" ? "Card" : "Cash";
  };

  const handleCopyReferralCode = () => {
    if (customer?.referralCode) {
      navigator.clipboard.writeText(customer.referralCode);
      toast.success("Referral code copied to clipboard");
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const startEditing = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditEmail(customer.email);
    setEditAddress(customer.address || "");
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const saveEditing = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const phoneTrim = editPhone.trim();
    const other = findByPhone(phoneTrim);
    if (other && other.id !== id) {
      toast.error("This phone number is already registered to another customer", {
        description: `${other.name} uses this number.`,
      });
      return;
    }
    try {
      const ok = await updateCustomer(id, {
        name: editName.trim(),
        phone: phoneTrim,
        email: editEmail.trim(),
        address: editAddress.trim(),
      });
      if (!ok) {
        toast.error("Could not save: phone number conflict");
        return;
      }
      setIsEditing(false);
      toast.success("Customer updated successfully");
    } catch {
      toast.error("Could not save customer", {
        description: "Check that the API server is running.",
      });
    }
  };

  const handleShareViaWhatsApp = async () => {
    if (!customer?.referralCode) return;
    const phone = customer.phone?.trim();
    if (!phone) {
      toast.error("Add a phone number to send via WhatsApp");
      return;
    }
    const message = `Use my referral code ${customer.referralCode} at Prime Detailers for exclusive benefits!`;
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("Referral message sent", { description: phone });
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: "Referral code via WhatsApp",
        message: `${customer.name} · ${customer.referralCode}`,
        href: `/customers/${customer.id}`,
      });
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Twilio not configured — finish sending in the WhatsApp app.",
        });
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  };

  const openAddVehicle = () => {
    reset({
      fuelType: "PETROL",
      segment: "HATCHBACK",
      year: new Date().getFullYear(),
      registrationNumber: "",
      make: "",
      model: "",
      variant: "",
      color: "",
      notes: "",
    });
    setAddVehicleOpen(true);
  };

  const onAddVehicle = (data: CustomerAddVehicleFormData) => {
    const c = allCustomers.find((cust) => cust.id === id);
    if (!c) return;
    const dup = findVehicleByNormalizedReg(vehicleList, data.registrationNumber);
    if (dup) {
      if (dup.customerId === id) {
        toast.error("This registration is already on file for this customer", {
          description: `${dup.registrationNumber} — ${dup.make} ${dup.model}`,
        });
      } else {
        toast.error("Registration belongs to another customer", {
          description: `${dup.registrationNumber} is assigned to ${dup.customerName}. Transfer ownership under Vehicles if needed.`,
        });
      }
      return;
    }
    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      customerId: id,
      customerName: c.name,
      registrationNumber: data.registrationNumber.toUpperCase(),
      make: data.make,
      model: data.model,
      variant: data.variant || undefined,
      fuelType: data.fuelType,
      segment: data.segment,
      color: data.color,
      year: data.year,
      notes: data.notes || undefined,
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    reset({
      fuelType: "PETROL",
      segment: "HATCHBACK",
      year: new Date().getFullYear(),
    });
    setAddVehicleOpen(false);
    toast.success("Vehicle added", { description: `${data.registrationNumber.toUpperCase()} has been registered.` });
  };

  if (!customer) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Button variant="ghost" onClick={() => router.push("/customers")} asChild>
          <Link href="/customers">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Customer not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: "Customers", href: "/customers" },
        { label: customer.name },
      ]} />

      {customer.isInactive && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">This customer is marked as inactive (no visit in 90+ days).</p>
        </div>
      )}

      <Card className="border-border">
        <CardContent className="!p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <Avatar className="h-16 w-16 shrink-0 mt-1">
              <AvatarFallback className="text-lg">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <p className="text-muted-foreground mt-1">{customer.phone}</p>
                <p className="text-muted-foreground">{customer.email}</p>
                {customer.address && (
                  <p className="text-muted-foreground mt-1">{customer.address}</p>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Wallet Balance
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-primary" />
                    <p className="font-bold text-base">{formatCurrency(customer.walletBalance)}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Member Since
                  </span>
                  <p className="font-semibold text-sm">{formatDate(customer.createdAt)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Last Visit
                  </span>
                  <p className="font-semibold text-sm">{customer.lastVisitDate ? formatDate(customer.lastVisitDate) : "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Referral Code
                  </span>
                  <div className="flex items-center gap-1">
                    <p className="font-mono font-semibold text-sm">{customer.referralCode}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyReferralCode}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleShareViaWhatsApp}>
                      <Share2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {referralCount > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {referralCount} {referralCount === 1 ? "person" : "people"} used this code
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
                    Reward Points
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" />
                    <p className="font-bold text-base">{customer.rewardPoints}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-muted/50 w-full sm:w-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="service-history">Service History</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="communications">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Customer Information</CardTitle>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
                  <Button size="sm" onClick={saveEditing}>Save</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Name</p>
                  {isEditing ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <p className="font-medium">{customer.name}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  {isEditing ? (
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  ) : (
                    <p className="font-medium">{customer.phone}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  {isEditing ? (
                    <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  ) : (
                    <p className="font-medium">{customer.email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Address</p>
                  {isEditing ? (
                    <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  ) : (
                    <p className="font-medium">{customer.address || "—"}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Referral Code</p>
                  <p className="font-mono font-medium">{customer.referralCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Visits</p>
                  <p className="font-medium">{customer.totalVisits}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Visit</p>
                  <p className="font-medium">{customer.lastVisitDate ? formatDate(customer.lastVisitDate) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="font-medium">{formatCurrency(customer.walletBalance)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reward Points</p>
                  <p className="font-medium">{customer.rewardPoints}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{formatDate(customer.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Vehicles</CardTitle>
              <Button variant="outline" size="sm" type="button" onClick={openAddVehicle}>
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </CardHeader>
            <CardContent>
              {customerVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No vehicles registered
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customerVehicles.map((vehicle: Vehicle) => {
                    const transferTag = getTransferTagForCustomer(vehicle, id);
                    const vehicleHasMembership =
                      customer != null && getActiveMembership(customer.id, vehicle.id) != null;
                    return (
                      <Link
                        key={vehicle.id}
                        href={`/vehicles/${vehicle.id}`}
                        className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Card className="h-full border-border transition-all hover:border-primary/35 hover:bg-muted/40 hover:shadow-sm">
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex gap-4">
                              <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15"
                                aria-hidden
                              >
                                <Car className="h-6 w-6" strokeWidth={1.75} />
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="font-mono text-base font-semibold leading-tight tracking-tight text-foreground">
                                  {vehicle.registrationNumber}
                                </p>
                                <p className="text-sm font-medium leading-snug text-foreground">
                                  {vehicle.make} {vehicle.model}
                                  {vehicle.variant ? (
                                    <span className="font-normal text-muted-foreground">
                                      {" "}
                                      · {vehicle.variant}
                                    </span>
                                  ) : null}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {vehicleHasMembership ? (
                                    <Badge
                                      variant="default"
                                      className="gap-1 bg-violet-600 font-medium hover:bg-violet-600"
                                    >
                                      <Crown className="h-3 w-3" />
                                      Membership
                                    </Badge>
                                  ) : null}
                                  <Badge variant="secondary" className="font-medium">
                                    {vehicle.fuelType}
                                  </Badge>
                                  {vehicle.segment ? (
                                    <Badge variant="outline" className="font-normal">
                                      {vehicle.segment.replace(/_/g, " ")}
                                    </Badge>
                                  ) : null}
                                  <span className="text-xs tabular-nums text-muted-foreground">{vehicle.year}</span>
                                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span
                                      className="size-3 shrink-0 rounded-full border border-border shadow-inner"
                                      style={{ backgroundColor: vehicleColorHex(vehicle.color) }}
                                      title={vehicle.color}
                                    />
                                    <span className="min-w-0 truncate">{vehicle.color}</span>
                                  </span>
                                </div>
                                {transferTag ? (
                                  <p
                                    className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full border px-2.5 py-1 text-[12px] leading-snug"
                                    style={{
                                      backgroundColor: "#FFFBEB",
                                      borderColor: "#FCD34D",
                                      color: "#92400E",
                                    }}
                                  >
                                    <span>
                                      Transferred from {transferTag.fromCustomerName} · {transferTag.formattedDate}
                                    </span>
                                  </p>
                                ) : null}
                              </div>
                              <ChevronRight
                                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/80"
                                aria-hidden
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Vehicle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onAddVehicle)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cust-registrationNumber">Registration Number</Label>
                    <Input
                      id="cust-registrationNumber"
                      placeholder="KA-01-AB-1234"
                      maxLength={16}
                      {...register("registrationNumber", {
                        required: "Required",
                        validate: (v) =>
                          isValidIndianVehicleRegistration(String(v)) || INDIAN_VEHICLE_REG_ERROR_SHORT,
                      })}
                    />
                    {errors.registrationNumber && (
                      <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-year">Year</Label>
                    <Input
                      id="cust-year"
                      type="number"
                      placeholder="2024"
                      {...register("year", { valueAsNumber: true, required: "Required" })}
                    />
                    {errors.year && (
                      <p className="text-sm text-destructive">{errors.year.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cust-make">Make</Label>
                    <Input id="cust-make" placeholder="Maruti" {...register("make", { required: "Required" })} />
                    {errors.make && (
                      <p className="text-sm text-destructive">{errors.make.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-model">Model</Label>
                    <Input id="cust-model" placeholder="Swift" {...register("model", { required: "Required" })} />
                    {errors.model && (
                      <p className="text-sm text-destructive">{errors.model.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cust-variant">Variant (optional)</Label>
                  <Input id="cust-variant" placeholder="VXI" {...register("variant")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fuel Type</Label>
                    <Select
                      value={watchFuelType}
                      onValueChange={(v) => setValue("fuelType", v as FuelType)}
                    >
                      <SelectTrigger className={cn(errors.fuelType && "border-destructive")}>
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        {fuelTypes.map((ft) => (
                          <SelectItem key={ft} value={ft}>
                            {ft}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.fuelType && (
                      <p className="text-sm text-destructive">{errors.fuelType.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Segment</Label>
                    <Select
                      value={watchSegment}
                      onValueChange={(v) => setValue("segment", v as VehicleSegment)}
                    >
                      <SelectTrigger className={cn(errors.segment && "border-destructive")}>
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleSegments.map((seg) => (
                          <SelectItem key={seg} value={seg}>
                            {seg.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.segment && (
                      <p className="text-sm text-destructive">{errors.segment.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-color">Color</Label>
                    <Input id="cust-color" placeholder="Pearl Arctic White" {...register("color", { required: "Required" })} />
                    {errors.color && (
                      <p className="text-sm text-destructive">{errors.color.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cust-notes">Notes (optional)</Label>
                  <Textarea id="cust-notes" placeholder="Additional notes..." {...register("notes")} />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddVehicleOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Vehicle</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Wallet Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerWalletTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No wallet transactions yet
                </p>
              ) : (
                <div className="space-y-3">
                  {customerWalletTransactions.map((wt: WalletTransaction) => (
                    <div
                      key={wt.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={wt.type === "CREDIT" ? "default" : "secondary"}>
                            {wt.type}
                          </Badge>
                          <span className="text-sm font-medium">
                            {wt.type === "CREDIT" ? "+" : "-"}
                            {formatCurrency(wt.amount)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{wt.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Source: {wt.source.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Balance: {formatCurrency(wt.balanceAfter)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(wt.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membership" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-5 w-5 text-violet-600" />
                Membership
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/membership?tab=assign">Manage in Membership</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeMembershipByVehicle.length === 0 && !legacyActiveMembership ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active membership on any vehicle. Assign a package from the Membership page (link a pass to a
                  vehicle).
                </p>
              ) : (
                <div className="space-y-4">
                  {activeMembershipByVehicle.map(({ vehicle, sub, pkg, daysLeft }) => (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/25"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                        Vehicle
                      </p>
                      <p className="font-mono text-base font-semibold">{vehicle.registrationNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {vehicle.make} {vehicle.model}
                      </p>
                      {daysLeft <= 7 && daysLeft >= 0 && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"} — renew from Membership.
                          </span>
                        </div>
                      )}
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Package</p>
                        <p className="font-semibold">{pkg.name}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{pkg.tier}</Badge>
                        <span className="text-xs text-muted-foreground self-center">
                          {MEMBERSHIP_TIER_DAYS[pkg.tier]} days window
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Valid from</p>
                          <p className="text-sm font-medium tabular-nums">{formatDate(sub.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valid until</p>
                          <p className="text-sm font-medium tabular-nums">{formatDate(sub.endDate)}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">List price</p>
                        <p className="text-sm font-medium tabular-nums">{formatInrFull(pkg.price)}</p>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">Included services</p>
                        <ul className="list-inside list-disc text-sm text-muted-foreground space-y-1">
                          {pkg.includedServiceIds.map((sid) => (
                            <li key={sid}>{serviceNameByCatalogId.get(sid) ?? sid}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                  {legacyActiveMembership && legacyMembershipPackage ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <Badge variant="outline" className="mb-2">
                        Customer-wide (legacy)
                      </Badge>
                      <p className="font-semibold">{legacyMembershipPackage.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Valid until {formatDate(legacyActiveMembership.endDate)}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-2">Full membership usage history</p>
                {membershipHistoryLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recorded redemptions yet.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                    {membershipHistoryLines.map((line, idx) => (
                      <li
                        key={`${line.usedAt}-${line.serviceName}-${idx}`}
                        className="flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2"
                      >
                        <span className="font-medium">{line.serviceName}</span>
                        <span className="text-xs text-muted-foreground">
                          {line.vehicleLabel} ·{" "}
                          {new Date(line.usedAt).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {line.jobCardId ? (
                            <>
                              {" "}
                              ·{" "}
                              <Link href={`/job-cards/${line.jobCardId}`} className="text-primary underline">
                                Job
                              </Link>
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service History</CardTitle>
            </CardHeader>
            <CardContent>
              {customerJobCards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No service history
                </p>
              ) : (
                <div className="space-y-3">
                  {customerJobCards.map((jc: JobCard) => (
                    <Link
                      key={jc.id}
                      href={`/job-cards/${jc.id}`}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {jc.jobNumber}
                          </span>
                          <JobCardStatusBadge status={normalizeJobCardStatus(jc.status)} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {jc.vehicleRegNumber} &middot; {jc.vehicleMakeModel}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {jc.services.map((s) => s.name).join(", ")}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground sm:ml-4">
                        {formatDate(jc.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {customerInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No invoices
                </p>
              ) : (
                <div className="space-y-3">
                  {customerInvoices.map((inv: Invoice) => (
                    <Link
                      key={inv.id}
                      href={`/billing/${inv.id}`}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {inv.invoiceNumber}
                          </span>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                        <p className="text-sm font-semibold mt-1">
                          {formatCurrency(inv.grandTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Payment: {getPaymentMethod(inv)}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground sm:ml-4">
                        {formatDate(inv.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="feedback" className="space-y-4">
          <CustomerFeedback />
        </TabsContent>
        <TabsContent value="communications" className="space-y-4">
          <CustomerCommunications customerId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StarRating({ rating, onRate, size = "md" }: { rating: number; onRate?: (r: number) => void; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate?.(star)}
          className={`${onRate ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
          type="button"
        >
          <Star
            className={`${dim} ${star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}

function CustomerFeedback() {
  const [feedbacks, setFeedbacks] = useState<
    { id: string; jobCardId: string; jobNumber: string; rating: number; comment: string; createdAt: string }[]
  >([]);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [showForm, setShowForm] = useState(false);

  const avgRating = feedbacks.length > 0
    ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
    : 0;

  const handleSubmit = () => {
    if (newRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setFeedbacks((prev) => [
      { id: `fb-${Date.now()}`, jobCardId: "", jobNumber: "General", rating: newRating, comment: newComment, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setNewRating(0);
    setNewComment("");
    setShowForm(false);
    toast.success("Feedback submitted");
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="!p-5 text-center">
            <p className="text-3xl font-bold">{avgRating.toFixed(1)}</p>
            <StarRating rating={Math.round(avgRating)} size="sm" />
            <p className="text-xs text-muted-foreground mt-1">{feedbacks.length} reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!p-5 text-center flex flex-col items-center justify-center h-full">
            <p className="text-3xl font-bold">{feedbacks.filter((f) => f.rating >= 4).length}</p>
            <p className="text-sm text-muted-foreground">Positive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="!p-5 flex items-center justify-center h-full">
            <Button onClick={() => setShowForm(!showForm)} className="w-full">
              <MessageSquare className="w-4 h-4 mr-2" />
              Add Feedback
            </Button>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Rating</p>
              <StarRating rating={newRating} onRate={setNewRating} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Comment (optional)</p>
              <Textarea
                placeholder="Share your experience..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>Submit</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback History</CardTitle>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No feedback yet</p>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <StarRating rating={fb.rating} size="sm" />
                    <span className="text-xs text-muted-foreground">{formatDate(fb.createdAt)}</span>
                  </div>
                  {fb.comment && <p className="text-sm">{fb.comment}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Job: {fb.jobNumber}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function CustomerCommunications({ customerId }: { customerId: string }) {
  const messages = useCommunicationStore((s) => s.messages);
  const customerMessages = useMemo(() => {
    return messages
      .filter((m) => m.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customerId, messages]);

  if (customerMessages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No messages sent to this customer yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Message History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customerMessages.map((msg) => {
            const isEmail = msg.type === "email";
            const isWhatsApp = msg.type === "whatsapp";
            return (
              <div key={msg.id} className="p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isWhatsApp 
                        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" 
                        : isEmail 
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" 
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    }`}>
                      {isWhatsApp ? (
                        <MessageSquare className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                      ) : isEmail ? (
                        <Mail className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <MessageSquare className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm capitalize">{msg.type}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          msg.status === "sent" 
                            ? "bg-emerald-150 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" 
                            : "bg-rose-150 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}>
                          {msg.status === "sent" ? "Delivered" : "Failed"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{msg.recipient}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(msg.createdAt)}</span>
                </div>
                
                {msg.subject && (
                  <p className="text-sm font-semibold mt-3">{msg.subject}</p>
                )}
                
                {isEmail ? (
                  <div 
                    className="text-sm text-muted-foreground mt-2 border border-border/50 rounded-lg p-3 bg-background/50 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: msg.body }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap border border-border/50 rounded-lg p-3 bg-background/50">
                    {msg.body}
                  </div>
                )}

                {msg.error && (
                  <p className="text-xs text-rose-600 mt-2 font-medium bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-150 dark:border-rose-900/30">
                    Error: {msg.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
