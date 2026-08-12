"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useCustomerStore } from "@/store/customer-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useQuotationStore } from "@/store/quotation-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { resolveJobBranchId } from "@/lib/job-from-appointment";
import { useSettingsStore } from "@/store/settings-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { cn, formatCurrency } from "@/lib/utils";
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
import {
  computeCustomerLookupMatches,
  queryLooksLikeVehicleReg,
} from "@/lib/customer-vehicle-lookup";
import type {
  JobCard,
  Quotation,
  QuotationStatus,
  ServiceCatalogItem,
  ServiceItem,
  Vehicle,
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
  Car,
  Search,
  ArrowLeft,
  Info,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

function QuotationFromQueryEffect({ setNewDialogOpen }: { setNewDialogOpen: (open: boolean) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setNewDialogOpen(true);
      router.replace("/quotations");
    }
  }, [searchParams, router, setNewDialogOpen]);

  return null;
}

export default function QuotationsPage() {
  const router = useRouter();
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();
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
  const { businessName, gstRegistrationStatus } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [convertingQuotationId, setConvertingQuotationId] = useState<string | null>(null);

  // New quotation form state
  const [currentStep, setCurrentStep] = useState<"customer" | "vehicle" | "details">("customer");

  const validateCustomerStep = () => {
    if (formCustomerId) return true;
    const name = newCustomerName.trim();
    const phoneDigits = newCustomerPhone.replace(/\D/g, "").slice(-10);
    let valid = true;
    if (!name) {
      setNewCustomerNameError("Name is required");
      valid = false;
    } else {
      setNewCustomerNameError("");
    }
    if (phoneDigits.length !== 10) {
      setNewCustomerPhoneError("Enter a valid 10-digit phone number");
      valid = false;
    } else {
      setNewCustomerPhoneError("");
    }
    return valid;
  };

  const validateVehicleStep = () => {
    if (formCustomerId) {
      if (!formVehicleId) {
        toast.error("Please select a vehicle or add a new one");
        return false;
      }
      return true;
    }
    const reg = newVehicleReg.trim().toUpperCase();
    const make = newVehicleMake.trim();
    const model = newVehicleModel.trim();
    let valid = true;
    if (!reg) {
      setNewVehicleRegError("Registration is required");
      valid = false;
    } else if (!isValidIndianVehicleRegistration(reg)) {
      setNewVehicleRegError("Enter a valid vehicle registration");
      valid = false;
    } else {
      setNewVehicleRegError("");
    }
    if (!make) {
      setNewVehicleMakeError("Make is required");
      valid = false;
    } else {
      setNewVehicleMakeError("");
    }
    if (!model) {
      setNewVehicleModelError("Model is required");
      valid = false;
    } else {
      setNewVehicleModelError("");
    }
    if (valid) {
      const regTaken = findVehicleByNormalizedReg(vehicles, reg);
      if (regTaken) {
        setNewVehicleRegError(`${regTaken.registrationNumber} is already in the system.`);
        valid = false;
      }
    }
    return valid;
  };

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [formCustomerId, setFormCustomerId] = useState<string>("");
  const [formVehicleId, setFormVehicleId] = useState<string>("");
  const [formSegment, setFormSegment] = useState<VehicleSegment>("HATCHBACK");
  const [addVehicleForExistingCustomerDialogOpen, setAddVehicleForExistingCustomerDialogOpen] = useState(false);
  const [newVehicleRegInput, setNewVehicleRegInput] = useState("");
  const [newVehicleMakeInput, setNewVehicleMakeInput] = useState("");
  const [newVehicleModelInput, setNewVehicleModelInput] = useState("");
  const [newVehicleSegmentInput, setNewVehicleSegmentInput] = useState<VehicleSegment>("HATCHBACK");
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModelsByBrand, setExtraModelsByBrand] = useState<Record<string, string[]>>({});
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");

  const brandNames = useMemo(() => getBrandNames(), [getBrandNames]);
  const allBrandsSorted = useMemo(
    () => [...new Set([...brandNames, ...extraBrands])].sort((a, b) => a.localeCompare(b)),
    [brandNames, extraBrands]
  );
  const modelOptions = useMemo(
    () => (newVehicleMakeInput ? getModels(newVehicleMakeInput) : []),
    [getModels, newVehicleMakeInput]
  );
  const allModelsSorted = useMemo(() => {
    const catalog = newVehicleMakeInput ? getModels(newVehicleMakeInput).map((m) => m.name) : [];
    const extra = newVehicleMakeInput ? extraModelsByBrand[newVehicleMakeInput] ?? [] : [];
    return [...new Set([...catalog, ...extra])].sort((a, b) => a.localeCompare(b));
  }, [newVehicleMakeInput, getModels, extraModelsByBrand]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerNameError, setNewCustomerNameError] = useState("");
  const [newCustomerPhoneError, setNewCustomerPhoneError] = useState("");
  const [newVehicleReg, setNewVehicleReg] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleRegError, setNewVehicleRegError] = useState("");
  const [newVehicleMakeError, setNewVehicleMakeError] = useState("");
  const [newVehicleModelError, setNewVehicleModelError] = useState("");
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

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === formCustomerId) ?? null,
    [customers, formCustomerId]
  );

  const hasExistingCustomer = Boolean(selectedExistingCustomer);

  const effectiveSegment = useMemo((): VehicleSegment => {
    if (hasExistingCustomer && selectedVehicle) return selectedVehicle.segment;
    return formSegment;
  }, [hasExistingCustomer, selectedVehicle, formSegment]);

  const formCalculations = useMemo(() => {
    const segment = effectiveSegment;
    let subtotal = 0;
    formServiceIds.forEach((sid) => {
      subtotal += getServicePrice(catalog, sid, segment);
    });
    const activeTaxRate = gstRegistrationStatus === "NOT_REGISTERED" ? 0 : TAX_RATE;
    const taxAmount = Math.round(subtotal * activeTaxRate);
    const grandTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, grandTotal };
  }, [formServiceIds, effectiveSegment, catalog, gstRegistrationStatus]);

  const segmentSelectLocked = hasExistingCustomer && !!selectedVehicle;
  const canSelectServices =
    hasExistingCustomer ? !!formVehicleId : true;

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

  useEffect(() => {
    if (hasExistingCustomer) return;
    const q = lookupQuery.trim();
    if (!q) return;
    const digits = q.replace(/\D/g, "");
    if (queryLooksLikeVehicleReg(q)) {
      const reg = sanitizeVehicleRegistrationInput(q);
      setNewVehicleReg((prev) => (prev === reg ? prev : reg));
      return;
    }
    if (digits.length >= 10) {
      const p10 = digits.slice(-10);
      setNewCustomerPhone((prev) => (prev === p10 ? prev : p10));
    }
  }, [lookupQuery, hasExistingCustomer]);

  const applySelectedCustomer = (customerId: string) => {
    const c = customers.find((row) => row.id === customerId);
    if (!c) return;
    setFormCustomerId(c.id);
    setLookupQuery("");
    const owned = vehicles
      .filter((v) => v.customerId === c.id)
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
    setFormVehicleId(owned[0]?.id ?? "");
    setLookupPanelCustomers([]);
    setNewCustomerNameError("");
    setNewCustomerPhoneError("");
  };

  const clearSelectedCustomer = () => {
    setFormCustomerId("");
    setFormVehicleId("");
  };

  const resetForm = () => {
    setCurrentStep("customer");
    setLookupQuery("");
    setLookupPanelCustomers([]);
    setFormCustomerId("");
    setFormVehicleId("");
    setFormSegment("HATCHBACK");
    setAddVehicleForExistingCustomerDialogOpen(false);
    setNewVehicleRegInput("");
    setNewVehicleMakeInput("");
    setNewVehicleModelInput("");
    setNewVehicleSegmentInput("HATCHBACK");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerNameError("");
    setNewCustomerPhoneError("");
    setNewVehicleReg("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setNewVehicleRegError("");
    setNewVehicleMakeError("");
    setNewVehicleModelError("");
    setFormServiceIds(new Set());
    setFormNotes("");
    setFormTerms("");
  };

  const handleExistingCustomerVehicleSelection = (value: string) => {
    if (value === "__add_new_vehicle__") {
      setFormVehicleId("");
      setNewVehicleRegInput("");
      setNewVehicleMakeInput("");
      setNewVehicleModelInput("");
      setNewVehicleSegmentInput("HATCHBACK");
      setAddVehicleForExistingCustomerDialogOpen(true);
      return;
    }

    setFormVehicleId(value);
  };

  const handleSaveVehicleForExistingCustomer = () => {
    if (!formCustomerId) {
      toast.error("Select a customer first");
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

    const customer = customers.find((c) => c.id === formCustomerId);
    if (!customer) {
      toast.error("Could not find the selected customer");
      return;
    }

    const inferredSegment = getModelSegment(make, model) ?? "HATCHBACK";
    const newVehicle: Vehicle = {
      id: `veh-quot-${Date.now()}`,
      customerId: formCustomerId,
      customerName: customer.name,
      registrationNumber: reg,
      make,
      model,
      segment: inferredSegment,
      fuelType: "PETROL",
      color: "—",
      year: new Date().getFullYear(),
    };

    setVehicles((prev) => [...prev, newVehicle]);
    setFormVehicleId(newVehicle.id);
    setFormSegment(newVehicle.segment);
    setAddVehicleForExistingCustomerDialogOpen(false);
    setNewVehicleRegInput("");
    setNewVehicleMakeInput("");
    setNewVehicleModelInput("");
    setNewVehicleSegmentInput("HATCHBACK");
    toast.success("Vehicle added", {
      description: `${reg} has been linked to ${customer.name} and selected for this quotation.`,
    });
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

    if (hasExistingCustomer) {
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

      let hasCustomerErrors = false;
      if (!name) {
        setNewCustomerNameError("Name is required");
        hasCustomerErrors = true;
      } else {
        setNewCustomerNameError("");
      }
      if (phoneDigits.length !== 10) {
        setNewCustomerPhoneError("Enter a valid 10-digit phone number");
        hasCustomerErrors = true;
      } else {
        setNewCustomerPhoneError("");
      }
      let hasVehicleErrors = false;
      if (!reg) {
        setNewVehicleRegError("Registration is required");
        hasVehicleErrors = true;
      } else if (!isValidIndianVehicleRegistration(reg)) {
        setNewVehicleRegError("Enter a valid vehicle registration");
        hasVehicleErrors = true;
      } else {
        setNewVehicleRegError("");
      }
      if (!make) {
        setNewVehicleMakeError("Make is required");
        hasVehicleErrors = true;
      } else {
        setNewVehicleMakeError("");
      }
      if (!model) {
        setNewVehicleModelError("Model is required");
        hasVehicleErrors = true;
      } else {
        setNewVehicleModelError("");
      }
      if (!hasVehicleErrors) {
        const regTaken = findVehicleByNormalizedReg(vehicles, reg);
        if (regTaken) {
          setNewVehicleRegError(
            `${regTaken.registrationNumber} is already in the system. Select an existing customer and vehicle or use ownership transfer.`
          );
          hasVehicleErrors = true;
        }
      }
      if (hasCustomerErrors || hasVehicleErrors) {
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
      taxRate: gstRegistrationStatus === "NOT_REGISTERED" ? 0 : TAX_RATE,
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
      <Suspense fallback={null}>
        <QuotationFromQueryEffect setNewDialogOpen={setNewDialogOpen} />
      </Suspense>
      <PageHeader
        title="Quotations & Estimates"
        description="Create and manage quotations, send estimates via WhatsApp, and convert to job cards"
        hideDescriptionOnMobile
        inlineActionsOnMobile
        actions={
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setNewDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
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
          size="compact"
          title="Total"
          value={kpis.total}
          icon={FileText}
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Pending"
          value={kpis.pendingApproval}
          icon={Clock}
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Approved"
          value={kpis.approved}
          icon={CheckCircle2}
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Converted"
          value={kpis.converted}
          icon={ArrowRightCircle}
          titleClassName="whitespace-nowrap"
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
          </DialogHeader>
          <form onSubmit={handleNewQuotationSubmit} className="space-y-4">
            {/* Stepper Progress Indicator */}
            <div className="space-y-2 border-b pb-4 mb-4">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Step {currentStep === "customer" ? 1 : currentStep === "vehicle" ? 2 : 3} of 3 —{" "}
                  {currentStep === "customer"
                    ? "Customer Information"
                    : currentStep === "vehicle"
                    ? "Vehicle Details"
                    : "Quotation Details"}
                </p>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: currentStep === "customer" ? "33.3%" : currentStep === "vehicle" ? "66.6%" : "100%",
                    }}
                    role="progressbar"
                    aria-valuenow={currentStep === "customer" ? 33 : currentStep === "vehicle" ? 66 : 100}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground shrink-0">
                  {currentStep === "customer" ? "33%" : currentStep === "vehicle" ? "66%" : "100%"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground leading-snug">
                <span className={cn("font-medium", currentStep === "customer" && "text-primary font-semibold")}>Customer</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={cn("font-medium", currentStep === "vehicle" && "text-primary font-semibold")}>Vehicle details</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={cn("font-medium", currentStep === "details" && "text-primary font-semibold")}>Review &amp; details</span>
              </div>
            </div>

            {/* STEP 1: Customer Information */}
            {currentStep === "customer" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quot-customer-lookup" className="text-sm font-medium">Search Existing Customer</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="quot-customer-lookup"
                      className="pl-9"
                      value={lookupQuery}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLookupQuery(next);
                        if (!next.trim()) clearSelectedCustomer();
                      }}
                      placeholder="Enter Mobile or Vehicle number"
                      autoComplete="off"
                    />
                  </div>
                  {lookupQuery.trim() ? (
                    <div className="rounded-md border border-border bg-background p-2 max-h-44 overflow-auto">
                      {lookupPanelCustomers.length > 0 ? (
                        <div className="space-y-1">
                          {lookupPanelCustomers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full rounded-md border border-transparent px-3 py-2 text-left hover:bg-muted/60"
                              onClick={() => applySelectedCustomer(c.id)}
                            >
                              <p className="text-sm font-medium text-foreground">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.phone}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground px-1 py-1.5">
                          No customer found. Continue below to fill details for a new prospect.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-sm">Customer Details</p>
                  {hasExistingCustomer ? (
                    <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{selectedExistingCustomer?.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{selectedExistingCustomer?.phone}</p>
                        {selectedExistingCustomer?.email && (
                          <p className="text-xs text-muted-foreground truncate">{selectedExistingCustomer.email}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSelectedCustomer}
                        className="shrink-0"
                      >
                        Change Customer
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 border rounded-lg p-3.5 bg-muted/5">
                      <div className="space-y-1.5">
                        <Label htmlFor="quot-new-name" className="text-xs">Full Name *</Label>
                        <Input
                          id="quot-new-name"
                          value={newCustomerName}
                          onChange={(e) => {
                            setNewCustomerName(e.target.value);
                            if (newCustomerNameError && e.target.value.trim()) {
                              setNewCustomerNameError("");
                            }
                          }}
                          placeholder="Customer name"
                          autoComplete="name"
                          className={cn("h-9", newCustomerNameError && "border-destructive focus-visible:ring-destructive/50")}
                        />
                        {newCustomerNameError && (
                          <p className="text-xs text-destructive">{newCustomerNameError}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quot-new-phone" className="text-xs">Phone Number *</Label>
                        <Input
                          id="quot-new-phone"
                          value={newCustomerPhone}
                          onChange={(e) => {
                            setNewCustomerPhone(e.target.value.replace(/\D/g, "").slice(-10));
                            const digits = e.target.value.replace(/\D/g, "").slice(-10);
                            if (newCustomerPhoneError && digits.length === 10) {
                              setNewCustomerPhoneError("");
                            }
                          }}
                          placeholder="Phone number"
                          maxLength={10}
                          className={cn("h-9", newCustomerPhoneError && "border-destructive focus-visible:ring-destructive/50")}
                        />
                        {newCustomerPhoneError && (
                          <p className="text-xs text-destructive">{newCustomerPhoneError}</p>
                        )}
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="quot-new-email" className="text-xs">Email (Optional)</Label>
                        <Input
                          id="quot-new-email"
                          type="email"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          placeholder="Email address"
                          autoComplete="email"
                          className="h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
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
                  <Button
                    type="button"
                    onClick={() => {
                      if (validateCustomerStep()) {
                        setCurrentStep("vehicle");
                      }
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Vehicle Details */}
            {currentStep === "vehicle" && (
              <div className="space-y-4">
                {hasExistingCustomer ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Vehicle Details</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewVehicleRegInput("");
                          setNewVehicleMakeInput("");
                          setNewVehicleModelInput("");
                          setNewVehicleSegmentInput("HATCHBACK");
                          setAddVehicleForExistingCustomerDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add New Vehicle
                      </Button>
                    </div>

                    {customerVehicles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                        {customerVehicles.map((v) => {
                          const isSelected = formVehicleId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setFormVehicleId(v.id);
                                setFormSegment(v.segment);
                              }}
                              className={cn(
                                "rounded-xl border-2 p-3 text-left transition-all flex flex-col justify-between h-28",
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-border hover:border-primary/30"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2 w-full">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Car className="w-8 h-8 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">
                                      {v.make} {v.model}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                      Reg: {v.registrationNumber}
                                    </p>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] self-start mt-1">
                                {v.segment.replace("_", " ")}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
                        <Car className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium">No vehicles registered for this customer</p>
                        <p className="text-xs text-muted-foreground mt-1">Click Add New Vehicle above to register one.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold">New Vehicle Details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="quot-new-reg" className="text-xs">Registration Number *</Label>
                        <Input
                          id="quot-new-reg"
                          value={newVehicleReg}
                          onChange={(e) => {
                            setNewVehicleReg(sanitizeVehicleRegistrationInput(e.target.value));
                            if (newVehicleRegError) {
                              setNewVehicleRegError("");
                            }
                          }}
                          placeholder="e.g. KA01AB1234"
                          maxLength={16}
                          className={cn("font-mono uppercase h-9", newVehicleRegError && "border-destructive focus-visible:ring-destructive/50")}
                        />
                        {newVehicleRegError ? (
                          <p className="text-xs text-destructive">{newVehicleRegError}</p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quot-new-make" className="text-xs">Make *</Label>
                        <Select
                          value={newVehicleMake || undefined}
                          onValueChange={(value) => {
                            setNewVehicleMake(value);
                            setNewVehicleModel("");
                            if (newVehicleMakeError) {
                              setNewVehicleMakeError("");
                            }
                          }}
                        >
                          <SelectTrigger
                            id="quot-new-make"
                            className={cn("h-9", newVehicleMakeError && "border-destructive focus-visible:ring-destructive/50")}
                          >
                            <SelectValue placeholder="Select make" />
                          </SelectTrigger>
                          <SelectContent>
                            {brandNames.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newVehicleMakeError && (
                          <p className="text-xs text-destructive">{newVehicleMakeError}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quot-new-model" className="text-xs">Model *</Label>
                        <Select
                          value={newVehicleModel || undefined}
                          onValueChange={(value) => {
                            setNewVehicleModel(value);
                            const inferredSegment = getModelSegment(newVehicleMake, value);
                            if (inferredSegment) {
                              setFormSegment(inferredSegment);
                            }
                            if (newVehicleModelError) {
                              setNewVehicleModelError("");
                            }
                          }}
                          disabled={!newVehicleMake}
                        >
                          <SelectTrigger
                            id="quot-new-model"
                            className={cn("h-9", newVehicleModelError && "border-destructive focus-visible:ring-destructive/50")}
                          >
                            <SelectValue placeholder={newVehicleMake ? "Select model" : "Select make first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {newVehicleMake ? getModels(newVehicleMake).map((model) => (
                              <SelectItem key={model.name} value={model.name}>
                                {model.name}
                              </SelectItem>
                            )) : null}
                          </SelectContent>
                        </Select>
                        {newVehicleModelError && (
                          <p className="text-xs text-destructive">{newVehicleModelError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Vehicle segment (pricing)</Label>
                  <Select
                    value={effectiveSegment}
                    onValueChange={(v) => {
                      if (!segmentSelectLocked) setFormSegment(v as VehicleSegment);
                    }}
                    disabled={segmentSelectLocked}
                  >
                    <SelectTrigger className="h-9">
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
                  <p className="text-[10px] text-muted-foreground">
                    {segmentSelectLocked
                      ? "Locked to the selected vehicle’s segment."
                      : hasExistingCustomer && !formVehicleId
                      ? "Pick a segment for pricing until you select a vehicle."
                      : "Used for segment-based service prices."}
                  </p>
                </div>

                {/* Inline dialog for adding new vehicle for existing customer */}
                <Dialog open={addVehicleForExistingCustomerDialogOpen} onOpenChange={setAddVehicleForExistingCustomerDialogOpen}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add New Vehicle</DialogTitle>
                      <DialogDescription>
                        Enter registration, brand, and model. Use + New if a brand or model is not in the list.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="quot-existing-vehicle-reg">Registration Number *</Label>
                        <Input
                          id="quot-existing-vehicle-reg"
                          value={newVehicleRegInput}
                          onChange={(e) => setNewVehicleRegInput(sanitizeVehicleRegistrationInput(e.target.value))}
                          placeholder="e.g. KA01AB1234"
                          maxLength={16}
                          className="font-mono uppercase"
                        />
                        <p className="text-xs text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="quot-existing-vehicle-make">Brand *</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 border-sky-300 bg-white px-2.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                              onClick={() => {
                                setNewBrandDraft("");
                                setNewBrandOpen(true);
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
                              setNewVehicleSegmentInput("HATCHBACK");
                            }}
                          >
                            <SelectTrigger id="quot-existing-vehicle-make">
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
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="quot-existing-vehicle-model">Model *</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!newVehicleMakeInput}
                              className="h-7 shrink-0 px-2.5 text-xs font-medium disabled:opacity-50"
                              onClick={() => {
                                if (!newVehicleMakeInput) return;
                                setNewModelDraft("");
                                setNewModelOpen(true);
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
                            <SelectTrigger id="quot-existing-vehicle-model">
                              <SelectValue placeholder={newVehicleMakeInput ? "Select model" : "Select brand first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {allModelsSorted.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddVehicleForExistingCustomerDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleSaveVehicleForExistingCustomer}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Brand add nested dialog */}
                <Dialog
                  open={newBrandOpen}
                  onOpenChange={setNewBrandOpen}
                >
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newBrandDraft.trim();
                          if (!t) return;
                          if (allBrandsSorted.some((b) => b.toLowerCase() === t.toLowerCase())) {
                            toast.message("Brand already in list");
                            return;
                          }
                          setExtraBrands((prev) => [...prev, t]);
                          setNewVehicleMakeInput(t);
                          setNewVehicleModelInput("");
                          setNewBrandOpen(false);
                          setNewBrandDraft("");
                          toast.success("Brand added", { description: t });
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setNewBrandOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          const t = newBrandDraft.trim();
                          if (!t) {
                            toast.error("Enter a brand name");
                            return;
                          }
                          if (allBrandsSorted.some((b) => b.toLowerCase() === t.toLowerCase())) {
                            toast.message("Brand already in list");
                            return;
                          }
                          setExtraBrands((prev) => [...prev, t]);
                          setNewVehicleMakeInput(t);
                          setNewVehicleModelInput("");
                          setNewBrandOpen(false);
                          setNewBrandDraft("");
                          toast.success("Brand added", { description: t });
                        }}
                      >
                        Add brand
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Model add nested dialog */}
                <Dialog
                  open={newModelOpen}
                  onOpenChange={setNewModelOpen}
                >
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add model</DialogTitle>
                      <DialogDescription>
                        Add a model for <span className="font-medium text-foreground">{newVehicleMakeInput}</span> when it is not listed.
                      </DialogDescription>
                    </DialogHeader>
                    <Input
                      placeholder="Model name"
                      value={newModelDraft}
                      onChange={(e) => setNewModelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newModelDraft.trim();
                          if (!t || !newVehicleMakeInput.trim()) return;
                          setExtraModelsByBrand((prev) => ({
                            ...prev,
                            [newVehicleMakeInput]: [...(prev[newVehicleMakeInput] ?? []), t],
                          }));
                          setNewVehicleModelInput(t);
                          const seg = getModelSegment(newVehicleMakeInput, t);
                          if (seg) setNewVehicleSegmentInput(seg);
                          setNewModelOpen(false);
                          setNewModelDraft("");
                          toast.success("Model added", { description: t });
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setNewModelOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          const t = newModelDraft.trim();
                          if (!t) {
                            toast.error("Enter a model name");
                            return;
                          }
                          if (!newVehicleMakeInput.trim()) return;
                          setExtraModelsByBrand((prev) => ({
                            ...prev,
                            [newVehicleMakeInput]: [...(prev[newVehicleMakeInput] ?? []), t],
                          }));
                          setNewVehicleModelInput(t);
                          const seg = getModelSegment(newVehicleMakeInput, t);
                          if (seg) setNewVehicleSegmentInput(seg);
                          setNewModelOpen(false);
                          setNewModelDraft("");
                          toast.success("Model added", { description: t });
                        }}
                      >
                        Add model
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="flex justify-between pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep("customer")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (validateVehicleStep()) {
                        setCurrentStep("details");
                      }
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Services & Details */}
            {currentStep === "details" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Services</Label>
                  <div className="rounded-lg border border-border p-3 max-h-48 overflow-y-auto space-y-2 bg-background">
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
                            className="text-sm font-medium leading-none cursor-pointer flex-1 text-foreground"
                          >
                            {svc.name}
                          </label>
                          <span className="text-sm text-muted-foreground tabular-nums">
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
                    <span className="font-medium tabular-nums">{formatCurrency(formCalculations.subtotal)}</span>
                  </div>
                  {gstRegistrationStatus !== "NOT_REGISTERED" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({Math.round(TAX_RATE * 100)}%)</span>
                      <span className="font-medium tabular-nums">{formatCurrency(formCalculations.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-2 border-t border-border text-foreground">
                    <span>Grand Total</span>
                    <span className="tabular-nums">{formatCurrency(formCalculations.grandTotal)}</span>
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

                <div className="flex justify-between pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep("vehicle")}
                  >
                    Back
                  </Button>
                  <Button type="submit">Create Quotation</Button>
                </div>
              </div>
            )}
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
                {selectedQuotation.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({Math.round((selectedQuotation.taxRate ?? 0) * 100)}%)</span>
                    <span>{formatCurrency(selectedQuotation.taxAmount)}</span>
                  </div>
                )}
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
