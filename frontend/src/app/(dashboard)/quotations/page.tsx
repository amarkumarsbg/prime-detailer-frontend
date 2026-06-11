"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { QuotationStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useVehicleStore } from "@/store/vehicle-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useCustomerStore } from "@/store/customer-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useQuotationStore } from "@/store/quotation-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { resolveJobBranchId } from "@/lib/job-from-appointment";
import { useSettingsStore } from "@/store/settings-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency } from "@/lib/utils";
import { sortByNewest } from "@/lib/sort-by-date";
import { buildQuotationWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError, apiPost } from "@/lib/api-client";
import { notifyQuotationConvertedWhatsApp } from "@/lib/whatsapp-automation-triggers";
import {
  findVehicleByNormalizedReg,
  INDIAN_VEHICLE_REG_HINT,
  isValidIndianVehicleRegistration,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import type {
  JobCard,
  Quotation,
  QuotationStatus,
  ServiceCatalogItem,
  ServiceItem,
  VehicleSegment,
} from "@/types";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRightCircle,
  MoreHorizontal,
  MessageCircle,
  ClipboardList,
  Eye,
  ChevronRight,
  Loader2,
} from "lucide-react";

function quotationCanConvertToJob(status: QuotationStatus): boolean {
  return status !== "CONVERTED" && status !== "REJECTED";
}

const TAB_VALUES: (QuotationStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
];

const TAB_LABELS: Record<QuotationStatus | "ALL", string> = {
  ALL: "All",
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
};

const TAX_RATE = 0.18;

const SEGMENT_OPTIONS: { value: VehicleSegment; label: string }[] = [
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "COMPACT_SUV", label: "Compact SUV" },
  { value: "MUV", label: "MUV" },
  { value: "LUXURY", label: "Luxury" },
];

function getServicePrice(
  catalog: ServiceCatalogItem[],
  serviceId: string,
  segment: VehicleSegment
): number {
  const svc = catalog.find((s) => s.id === serviceId);
  if (!svc) return 0;
  const price = svc.segmentPricing[segment as keyof typeof svc.segmentPricing];
  return price ?? svc.defaultPrice;
}

export default function QuotationsPage() {
  const router = useRouter();
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const getNextJobNumber = useJobCardStore((s) => s.getNextJobNumber);
  const quotationList = useQuotationStore((s) => s.quotations);
  const sortedQuotations = useMemo(
    () => sortByNewest(quotationList, "createdAt"),
    [quotationList]
  );
  const addQuotation = useQuotationStore((s) => s.addQuotation);
  const updateQuotation = useQuotationStore((s) => s.updateQuotation);
  const getNextQuotationNumber = useQuotationStore((s) => s.getNextQuotationNumber);
  const authUser = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const branches = useBranchStore((s) => s.branches);
  const businessName = useSettingsStore((s) => s.businessName);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [convertingQuotationId, setConvertingQuotationId] = useState<string | null>(null);

  // New quotation form state
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [formCustomerId, setFormCustomerId] = useState<string>("");
  const [formVehicleId, setFormVehicleId] = useState<string>("");
  const [formSegment, setFormSegment] = useState<VehicleSegment>("HATCHBACK");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newVehicleReg, setNewVehicleReg] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [formServiceIds, setFormServiceIds] = useState<Set<string>>(new Set());
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("");

  const customerVehicles = useMemo(() => {
    if (!formCustomerId) return [];
    return vehicles.filter((v) => v.customerId === formCustomerId);
  }, [formCustomerId, vehicles]);

  const selectedVehicle = useMemo(() => {
    if (!formVehicleId) return null;
    return vehicles.find((v) => v.id === formVehicleId);
  }, [formVehicleId, vehicles]);

  const effectiveSegment = useMemo((): VehicleSegment => {
    if (customerMode === "existing" && selectedVehicle) return selectedVehicle.segment;
    return formSegment;
  }, [customerMode, selectedVehicle, formSegment]);

  const formCalculations = useMemo(() => {
    const segment = effectiveSegment;
    let subtotal = 0;
    formServiceIds.forEach((sid) => {
      subtotal += getServicePrice(catalog, sid, segment);
    });
    const taxAmount = Math.round(subtotal * TAX_RATE);
    const grandTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, grandTotal };
  }, [formServiceIds, effectiveSegment, catalog]);

  const segmentSelectLocked = customerMode === "existing" && !!selectedVehicle;
  const canSelectServices =
    customerMode === "existing" ? !!formVehicleId : true;

  const kpis = useMemo(() => {
    const total = quotationList.length;
    const pendingApproval = quotationList.filter(
      (q) => q.status === "SENT"
    ).length;
    const approved = quotationList.filter((q) => q.status === "APPROVED").length;
    const converted = quotationList.filter(
      (q) => q.status === "CONVERTED"
    ).length;
    return { total, pendingApproval, approved, converted };
  }, [quotationList]);

  const resetForm = () => {
    setCustomerMode("existing");
    setFormCustomerId("");
    setFormVehicleId("");
    setFormSegment("HATCHBACK");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewVehicleReg("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setFormServiceIds(new Set());
    setFormNotes("");
    setFormTerms("");
  };

  const handleNewQuotationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formServiceIds.size === 0) {
      toast.error("Please select at least one service");
      return;
    }

    let customerId: string;
    let customerName: string;
    let customerPhone: string;
    let vehicleId: string;
    let vehicleRegNumber: string;
    let vehicleMakeModel: string;
    let vehicleSegment: VehicleSegment;

    if (customerMode === "existing") {
      if (!formCustomerId || !formVehicleId) {
        toast.error("Please select customer and vehicle");
        return;
      }
      const customer = customers.find((c) => c.id === formCustomerId);
      const vehicle = vehicles.find((v) => v.id === formVehicleId);
      if (!customer || !vehicle) return;
      customerId = customer.id;
      customerName = customer.name;
      customerPhone = customer.phone;
      vehicleId = vehicle.id;
      vehicleRegNumber = vehicle.registrationNumber;
      vehicleMakeModel = `${vehicle.make} ${vehicle.model}`;
      vehicleSegment = vehicle.segment;
    } else {
      const name = newCustomerName.trim();
      const phoneDigits = newCustomerPhone.replace(/\D/g, "").slice(-10);
      const reg = newVehicleReg.trim().toUpperCase();
      const make = newVehicleMake.trim();
      const model = newVehicleModel.trim();
      if (!name || phoneDigits.length !== 10) {
        toast.error("Enter name and a valid 10-digit phone number");
        return;
      }
      if (!reg || !make || !model) {
        toast.error("Enter vehicle registration, make, and model");
        return;
      }
      if (!isValidIndianVehicleRegistration(reg)) {
        toast.error("Invalid vehicle registration", { description: INDIAN_VEHICLE_REG_HINT });
        return;
      }
      const regTaken = findVehicleByNormalizedReg(vehicles, reg);
      if (regTaken) {
        toast.error("Registration already in the system", {
          description: `${regTaken.registrationNumber} is assigned to ${regTaken.customerName}. Select an existing customer and vehicle, or use ownership transfer.`,
        });
        return;
      }
      customerName = name;
      customerPhone =
        newCustomerPhone.replace(/\D/g, "").length >= 10 && newCustomerPhone.startsWith("+")
          ? newCustomerPhone.trim()
          : `+91-${phoneDigits}`;
      const vehicleIdNew = `veh-quot-${Date.now()}`;
      vehicleId = vehicleIdNew;
      vehicleRegNumber = reg;
      vehicleMakeModel = `${make} ${model}`.trim();
      vehicleSegment = formSegment;

      let createdCustomer;
      try {
        createdCustomer = await addCustomer({
          name: customerName,
          phone: customerPhone,
          email:
            newCustomerEmail.trim() ||
            `noemail+${phoneDigits}@customers.placeholder`,
          address: "",
          referralCode: `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          totalVisits: 0,
          rewardPoints: 0,
          walletBalance: 0,
        });
      } catch {
        toast.error("Could not create customer", {
          description: "Check that the API server is running.",
        });
        return;
      }
      if (!createdCustomer) {
        toast.error("This phone number is already registered", {
          description: "Use Existing customer or a different mobile number.",
        });
        return;
      }
      customerId = createdCustomer.id;

      setVehicles((prev) => [
        ...prev,
        {
          id: vehicleIdNew,
          customerId,
          customerName,
          registrationNumber: vehicleRegNumber,
          make,
          model,
          segment: formSegment,
          fuelType: "PETROL",
          color: "—",
          year: new Date().getFullYear(),
        },
      ]);
    }

    const createdBy = authUser?.id ?? "usr-004";
    const newQuotation: Quotation = {
      id: `quot-${Date.now()}`,
      quotationNumber: getNextQuotationNumber(),
      customerId,
      customerName,
      customerPhone,
      vehicleId,
      vehicleRegNumber,
      vehicleMakeModel,
      vehicleSegment,
      services: Array.from(formServiceIds).map((sid) => {
        const svc = catalog.find((s) => s.id === sid)!;
        const price = getServicePrice(catalog, sid, vehicleSegment);
        return { serviceCatalogId: sid, name: svc.name, price };
      }),
      subtotal: formCalculations.subtotal,
      taxRate: TAX_RATE,
      taxAmount: formCalculations.taxAmount,
      grandTotal: formCalculations.grandTotal,
      status: "DRAFT",
      sentViaWhatsApp: false,
      notes: formNotes.trim() || undefined,
      termsAndConditions: formTerms || undefined,
      validUntil: format(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd"
      ),
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addQuotation(newQuotation);
    pushActivityLog({
      action: "CREATED",
      entityType: "QUOTATION",
      entityId: newQuotation.id,
      entityLabel: newQuotation.quotationNumber,
      details: `Quotation ${newQuotation.quotationNumber} created for ${newQuotation.customerName}`,
    });
    toast.success("Quotation created", {
      description: `${newQuotation.quotationNumber} has been saved as draft.`,
    });
    setNewDialogOpen(false);
    resetForm();
  };

  const finalizeQuotationWhatsApp = (q: Quotation) => {
    const now = new Date().toISOString();
    const patch: Partial<Quotation> = {
      sentViaWhatsApp: true,
      updatedAt: now,
      ...(q.status === "DRAFT" ? { status: "SENT" as const } : {}),
    };
    updateQuotation(q.id, patch);
    setSelectedQuotation((sel) =>
      sel?.id === q.id ? { ...sel, ...patch } : sel
    );
    pushActivityLog({
      action: "WHATSAPP_SENT",
      entityType: "QUOTATION",
      entityId: q.id,
      entityLabel: q.quotationNumber,
      details: `Estimate ${q.quotationNumber} sent to ${q.customerName} via WhatsApp`,
    });
  };

  const handleSendWhatsApp = async (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    const message = buildQuotationWhatsAppMessage(q);
    const phone = q.customerPhone;
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Quotation sent via WhatsApp" : "Quotation — WhatsApp composer",
        message: `${q.quotationNumber} → ${phone}`,
        href: "/quotations",
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      finalizeQuotationWhatsApp(q);
      toast.success("Quotation sent via WhatsApp", {
        description: `${q.customerName} · ${phone}`,
      });
      notify("api");
    } catch (err) {
      if (isWhatsAppNotConfiguredError(err)) {
        openWhatsAppComposer(phone, message);
        finalizeQuotationWhatsApp(q);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio WhatsApp on the server.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: err instanceof ApiError ? err.message : "Could not send",
      });
    }
  };

  const handleConvertToJobCard = async (q: Quotation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!quotationCanConvertToJob(q.status)) return;
    if (q.services.length === 0) {
      toast.error("Add at least one service", {
        description: "This quotation has no line items to carry over to a job card.",
      });
      return;
    }

    setConvertingQuotationId(q.id);

    const jobId = `jc-q-${Date.now().toString(36)}`;
    const jobNumber = getNextJobNumber();
    const now = new Date().toISOString();

    const serviceItems: ServiceItem[] = q.services.map((s, idx) => {
      const cat = catalog.find((c) => c.id === s.serviceCatalogId);
      return {
        id: `si-${jobId}-${idx}`,
        jobCardId: jobId,
        serviceCatalogId: s.serviceCatalogId,
        name: s.name,
        price: s.price,
        isCompleted: false,
        durationMinutes: cat?.durationMinutes,
      };
    });

    const incentivePercent = 5;
    const incentiveAmount = Math.round((q.grandTotal * incentivePercent) / 100);

    const newJob: JobCard = {
      id: jobId,
      jobNumber,
      branchId: resolveJobBranchId(currentBranch, branches),
      customerId: q.customerId,
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      vehicleId: q.vehicleId,
      vehicleRegNumber: q.vehicleRegNumber,
      vehicleMakeModel: q.vehicleMakeModel,
      vehicleSegment: q.vehicleSegment,
      status: "RECEIVED",
      reportedIssues: `Converted from quotation ${q.quotationNumber}`,
      expectedDelivery: new Date(Date.now() + 86400000).toISOString(),
      services: serviceItems,
      estimatedAmount: q.grandTotal,
      incentivePercent,
      incentiveAmount,
      termsAndConditions: q.termsAndConditions,
      notes: q.notes,
      quotationId: q.id,
      createdBy: authUser?.id ?? "usr-004",
      createdAt: now,
      updatedAt: now,
    };

    const patch: Partial<Quotation> = {
      status: "CONVERTED",
      convertedToJobCardId: jobId,
      updatedAt: now,
    };

    const updatedQuotation: Quotation = { ...q, ...patch };

    try {
      await apiPost("/api/quotations/convert-to-job", {
        jobCard: newJob,
        quotation: updatedQuotation,
      });
    } catch {
      toast.error("Could not create job card", {
        description: "Check that the API server is running and try again.",
      });
      setConvertingQuotationId(null);
      return;
    }

    useJobCardStore.setState((s) => ({
      jobCards: [newJob, ...s.jobCards.filter((jc) => jc.id !== newJob.id)],
    }));
    useQuotationStore.setState((s) => ({
      quotations: s.quotations.map((x) => (x.id === q.id ? updatedQuotation : x)),
    }));

    setSelectedQuotation((sel) => (sel?.id === q.id ? updatedQuotation : sel));

    pushActivityLog({
      action: "STATUS_CHANGED",
      entityType: "QUOTATION",
      entityId: q.id,
      entityLabel: q.quotationNumber,
      details: `${q.quotationNumber} converted to job ${jobNumber}`,
    });
    pushActivityLog({
      action: "CREATED",
      entityType: "JOB_CARD",
      entityId: jobId,
      entityLabel: jobNumber,
      details: `Job ${jobNumber} created from ${q.quotationNumber}`,
    });

    toast.success("Converted to Job Card", {
      description: `${q.quotationNumber} → ${jobNumber}`,
    });

    notifyQuotationConvertedWhatsApp(q, jobNumber, jobId, businessName);
    setDetailsDialogOpen(false);
    router.push(`/job-cards/${jobId}`);
    setConvertingQuotationId(null);
  };

  const handleViewDetails = (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedQuotation(q);
    setDetailsDialogOpen(true);
  };

  const toggleService = (serviceId: string) => {
    setFormServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const columns = [
    {
      key: "quotationNumber",
      label: "Quotation #",
      render: (item: Quotation) => (
        <span className="font-mono font-medium">{item.quotationNumber}</span>
      ),
      className: "font-mono",
    },
    {
      key: "customer",
      label: "Customer",
      render: (item: Quotation) => (
        <div>
          <div className="font-medium">{item.customerName}</div>
          <div className="text-xs text-muted-foreground">{item.customerPhone}</div>
        </div>
      ),
    },
    {
      key: "vehicle",
      label: "Vehicle",
      render: (item: Quotation) => (
        <div>
          <div className="font-medium">{item.vehicleRegNumber}</div>
          <div className="text-xs text-muted-foreground">
            {item.vehicleMakeModel}
          </div>
        </div>
      ),
    },
    {
      key: "services",
      label: "Services",
      render: (item: Quotation) => (
        <span className="text-muted-foreground line-clamp-2 max-w-[180px]">
          {item.services.map((s) => s.name).join(", ")}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (item: Quotation) => (
        <span className="font-semibold">{formatCurrency(item.grandTotal)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Quotation) => <QuotationStatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Quotation) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => handleViewDetails(item, e)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  {quotationCanConvertToJob(item.status) && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => handleSendWhatsApp(item, e)}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Send via WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={convertingQuotationId === item.id}
                        onClick={(e) => void handleConvertToJobCard(item, e)}
                      >
                        {convertingQuotationId === item.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ClipboardList className="mr-2 h-4 w-4" />
                        )}
                        Convert to Job Card
                      </DropdownMenuItem>
                    </>
                  )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: quotationList.length };
    quotationList.forEach((q) => {
      c[q.status] = (c[q.status] ?? 0) + 1;
    });
    return c;
  }, [quotationList]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Quotations & Estimates"
        description="Create and manage quotations, send estimates via WhatsApp, and convert to job cards"
        actions={
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Quotation
          </Button>
        }
      />

      {/* Conversion flow */}
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <div className="h-1 bg-linear-to-r from-primary via-primary/70 to-primary/40" aria-hidden />
        <CardContent className="py-4 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center mb-4">
            Typical workflow
          </p>
          <div className="flex items-center justify-center gap-1 sm:gap-3 flex-wrap max-w-2xl mx-auto">
            <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 shadow-sm">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">Quotation</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 hidden sm:block" />
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
              <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">Job card</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 hidden sm:block" />
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
              <ArrowRightCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">Invoice</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          title="Total Quotations"
          value={kpis.total}
          icon={FileText}
        />
        <KPICard
          title="Pending Approval"
          value={kpis.pendingApproval}
          icon={Clock}
        />
        <KPICard
          title="Approved"
          value={kpis.approved}
          icon={CheckCircle2}
        />
        <KPICard
          title="Converted to Job Card"
          value={kpis.converted}
          icon={ArrowRightCircle}
        />
      </div>

      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="space-y-1 border-b border-border/80 bg-muted/20 pb-4">
          <CardTitle className="text-base font-semibold">Quotation list</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filter by status or search across customers and vehicles.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TAB_VALUES.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="data-[state=active]:shadow-sm">
                  {TAB_LABELS[tab]} ({tabCounts[tab] ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_VALUES.map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-6 focus-visible:outline-none">
                <DataTable<Quotation>
                  data={
                    tab === "ALL"
                      ? sortedQuotations
                      : sortedQuotations.filter((q) => q.status === tab)
                  }
                  columns={columns}
                  searchPlaceholder="Search by quotation #, customer, or vehicle..."
                  searchKeys={[
                    "quotationNumber",
                    "customerName",
                    "vehicleRegNumber",
                    "vehicleMakeModel",
                  ]}
                  pageSize={10}
                  onRowClick={(item) => {
                    setSelectedQuotation(item);
                    setDetailsDialogOpen(true);
                  }}
                  renderMobileCard={(item) => {
                    const q = item as Quotation;
                    return (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs font-semibold">{q.quotationNumber}</span>
                          <QuotationStatusBadge status={q.status} />
                        </div>
                        <p className="mt-2 font-medium leading-snug">{q.customerName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.vehicleRegNumber} · {q.vehicleMakeModel}
                        </p>
                        <p className="mt-3 text-lg font-bold tabular-nums">{formatCurrency(q.grandTotal)}</p>
                      </>
                    );
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* New Quotation Dialog */}
      <Dialog
        open={newDialogOpen}
        onOpenChange={(open) => {
          setNewDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
            <DialogDescription>
              Choose an existing customer and vehicle, or add a new prospect with vehicle details. Segment sets
              service pricing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNewQuotationSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-1">
              <Button
                type="button"
                variant={customerMode === "existing" ? "default" : "ghost"}
                size="sm"
                className="flex-1 min-w-[140px]"
                onClick={() => {
                  setCustomerMode("existing");
                  setFormCustomerId("");
                  setFormVehicleId("");
                }}
              >
                Existing customer
              </Button>
              <Button
                type="button"
                variant={customerMode === "new" ? "default" : "ghost"}
                size="sm"
                className="flex-1 min-w-[140px]"
                onClick={() => {
                  setCustomerMode("new");
                  setFormCustomerId("");
                  setFormVehicleId("");
                }}
              >
                New prospect
              </Button>
            </div>

            {customerMode === "existing" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={formCustomerId}
                    onValueChange={(v) => {
                      setFormCustomerId(v);
                      setFormVehicleId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select
                    value={formVehicleId}
                    onValueChange={setFormVehicleId}
                    disabled={!formCustomerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerVehicles.length === 0 && formCustomerId ? (
                        <SelectItem value="__no_vehicle__" disabled>
                          No vehicles on file — use New prospect
                        </SelectItem>
                      ) : (
                        customerVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.registrationNumber} — {v.make} {v.model}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {customerMode === "new" && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium">Prospect &amp; vehicle</p>
                <p className="text-xs text-muted-foreground -mt-2">
                  Saves to your customer and vehicle lists when you create the quotation.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quot-new-name">Name *</Label>
                    <Input
                      id="quot-new-name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quot-new-phone">Phone *</Label>
                    <Input
                      id="quot-new-phone"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="quot-new-email">Email (optional)</Label>
                    <Input
                      id="quot-new-email"
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="quot-new-reg">Registration *</Label>
                    <Input
                      id="quot-new-reg"
                      value={newVehicleReg}
                      onChange={(e) => setNewVehicleReg(sanitizeVehicleRegistrationInput(e.target.value))}
                      placeholder="e.g. KA-01-AB-1234 or 22BH5678KA"
                      maxLength={16}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quot-new-make">Make *</Label>
                    <Input
                      id="quot-new-make"
                      value={newVehicleMake}
                      onChange={(e) => setNewVehicleMake(e.target.value)}
                      placeholder="e.g. Maruti"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quot-new-model">Model *</Label>
                    <Input
                      id="quot-new-model"
                      value={newVehicleModel}
                      onChange={(e) => setNewVehicleModel(e.target.value)}
                      placeholder="e.g. Swift"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Vehicle segment (pricing)</Label>
              <Select
                value={effectiveSegment}
                onValueChange={(v) => {
                  if (!segmentSelectLocked) setFormSegment(v as VehicleSegment);
                }}
                disabled={segmentSelectLocked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {segmentSelectLocked
                  ? "Locked to the selected vehicle’s segment."
                  : customerMode === "existing" && !formVehicleId
                  ? "Pick a segment for pricing until you select a vehicle."
                  : "Used for segment-based service prices."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Services</Label>
              <div className="rounded-lg border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                {catalog.filter((s) => s.isActive).map((svc) => {
                  const price = getServicePrice(catalog, svc.id, effectiveSegment);
                  return (
                    <div
                      key={svc.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`svc-${svc.id}`}
                        checked={formServiceIds.has(svc.id)}
                        onCheckedChange={() => toggleService(svc.id)}
                        disabled={!canSelectServices}
                      />
                      <label
                        htmlFor={`svc-${svc.id}`}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {svc.name}
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(formCalculations.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (18%)</span>
                <span>{formatCurrency(formCalculations.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Grand Total</span>
                <span>{formatCurrency(formCalculations.grandTotal)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quot-notes">Notes</Label>
              <Textarea
                id="quot-notes"
                placeholder="e.g. customer requests, follow-up reminders, scope clarifications…"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
                className="resize-y min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Shown on the quotation details and kept with the estimate record.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quot-terms">Terms & Conditions</Label>
              <Textarea
                id="quot-terms"
                placeholder="Payment terms, warranty, etc."
                value={formTerms}
                onChange={(e) => setFormTerms(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create Quotation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedQuotation?.quotationNumber ?? "Quotation Details"}
            </DialogTitle>
            <DialogDescription>
              Full quotation details and status
            </DialogDescription>
          </DialogHeader>
          {selectedQuotation && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <QuotationStatusBadge status={selectedQuotation.status} />
                <span className="text-sm text-muted-foreground">
                  Valid until {format(new Date(selectedQuotation.validUntil), "dd MMM yyyy")}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedQuotation.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedQuotation.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="font-medium">{selectedQuotation.vehicleRegNumber}</p>
                  <p className="text-sm text-muted-foreground">{selectedQuotation.vehicleMakeModel}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Services</p>
                <ul className="space-y-1">
                  {selectedQuotation.services.map((s) => (
                    <li key={s.serviceCatalogId} className="flex justify-between text-sm">
                      <span>{s.name}</span>
                      <span>{formatCurrency(s.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedQuotation.notes?.trim() && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2">
                    {selectedQuotation.notes}
                  </p>
                </div>
              )}
              <div className="pt-2 border-t border-border space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (18%)</span>
                  <span>{formatCurrency(selectedQuotation.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Grand Total</span>
                  <span>{formatCurrency(selectedQuotation.grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
          {selectedQuotation && (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              {selectedQuotation.convertedToJobCardId ? (
                <Button variant="default" asChild className="w-full sm:w-auto">
                  <Link href={`/job-cards/${selectedQuotation.convertedToJobCardId}`}>
                    View Job Card
                  </Link>
                </Button>
              ) : quotationCanConvertToJob(selectedQuotation.status) ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={(e) => void handleSendWhatsApp(selectedQuotation, e)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send via WhatsApp
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={convertingQuotationId === selectedQuotation.id}
                    onClick={() => void handleConvertToJobCard(selectedQuotation)}
                  >
                    {convertingQuotationId === selectedQuotation.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardList className="mr-2 h-4 w-4" />
                    )}
                    Convert to Job Card
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
