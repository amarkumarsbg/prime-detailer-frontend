"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJobCardStore } from "@/store/job-card-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { filterByBranchId, useBranchScope } from "@/lib/branch-scope";
import { cn } from "@/lib/utils";
import type { Customer, Vehicle, PickupDropRequest, PickupDropStatus, PickupDropType, VehicleSegment } from "@/types";
import { Plus, ChevronsUpDown, Search, Check, ChevronRight, Car } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { buildPickupDropWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import {
  isDatetimeLocalInPast,
  localDatetimeLocalInputMin,
} from "@/lib/booking-calendar-validation";
import {
  INDIAN_VEHICLE_REG_HINT,
  isValidIndianVehicleRegistration,
  sanitizeVehicleRegistrationInput,
  findVehicleByNormalizedReg,
  normalizeRegistrationNumber,
} from "@/lib/vehicle-registration";
import { useVehicleStore } from "@/store/vehicle-store";
import { PickupDropJobGroupCard } from "@/components/pickup-drop/pickup-drop-job-group-card";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import {
  computeCustomerLookupMatches,
  queryLooksLikeVehicleReg,
} from "@/lib/customer-vehicle-lookup";
import {
  groupPickupDropByJob,
  pickupDropAddressFieldLabel,
  pickupDropGroupMatchesFilters,
  PICKUP_DROP_STATUS_LABEL,
  resolvePickupDropAddressForJobCard,
  validatePickupDropAdvance,
} from "@/lib/pickup-drop-flow";

function customerPhoneFromPickupRequest(r: PickupDropRequest): string | undefined {
  const direct = r.customerPhone?.trim();
  if (direct) return direct;
  const m = r.notes?.match(/Phone:\s*([^\n]+)/i);
  return m?.[1]?.trim() || undefined;
}

function formatDatetimeLocalInput(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function defaultScheduledDatetimeLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return formatDatetimeLocalInput(d);
}

const STATUS_OPTIONS: { value: PickupDropStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "DRIVER_ASSIGNED", label: "Driver Assigned" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_SERVICE", label: "In Service" },
  { value: "DELIVERED", label: "Delivered" },
];

const TYPE_OPTIONS: { value: PickupDropType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "PICKUP", label: "Pickup" },
  { value: "DROP", label: "Drop" },
];

const selectTriggerClass =
  "border-input transition-[border-color,box-shadow] duration-[1200ms] ease-[cubic-bezier(0.45,0,0.55,1)] data-[state=open]:border-emerald-600 data-[state=open]:shadow-[0_0_0_1px_rgba(16,133,88,0.25)]";

const selectContentClass =
  "data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=open]:!fade-in-0 data-[state=closed]:!fade-out-0 data-[state=open]:!zoom-in-95 data-[state=closed]:!zoom-out-95 data-[state=open]:!duration-[1200ms] data-[state=closed]:duration-[1000ms]";

const dialogSurfaceClass =
  "!duration-[1200ms] data-[state=open]:!duration-[1200ms] data-[state=closed]:!duration-[1000ms]";

export default function PickupDropPage() {
  const { jobCards } = useJobCardStore();
  const { requests, addRequest, assignDriver, advanceStatus } = usePickupDropStore();
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);
  const appointments = useAppointmentStore((s) => s.appointments);
  const customers = useCustomerStore((s) => s.customers);
  const { selectedBranchId, viewingLabel } = useBranchScope();

  const [statusFilter, setStatusFilter] = useState<PickupDropStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<PickupDropType | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<"customer" | "vehicle" | "details">("customer");
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();

  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleSegment, setVehicleSegment] = useState<VehicleSegment>("HATCHBACK");

  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModelsByBrand, setExtraModelsByBrand] = useState<Record<string, string[]>>({});
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");

  const makeOptions = useMemo(() => getBrandNames(), [getBrandNames]);
  const allBrandsSorted = useMemo(
    () => [...new Set([...makeOptions, ...extraBrands])].sort((a, b) => a.localeCompare(b)),
    [makeOptions, extraBrands]
  );
  const allModelsSorted = useMemo(() => {
    const catalog = vehicleMake ? getModels(vehicleMake).map((m) => m.name) : [];
    const extra = vehicleMake ? extraModelsByBrand[vehicleMake] ?? [] : [];
    return [...new Set([...catalog, ...extra])].sort((a, b) => a.localeCompare(b));
  }, [vehicleMake, getModels, extraModelsByBrand]);

  const validateCustomerStep = () => {
    if (hasExistingCustomer) return true;
    if (!newCustomerName.trim()) {
      toast.error("Enter the customer name.");
      return false;
    }
    const phoneDigits = newCustomerPhone.replace(/\D/g, "").slice(-10);
    if (!newCustomerPhone.trim() || phoneDigits.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return false;
    }
    return true;
  };

  const validateVehicleStep = () => {
    if (hasExistingCustomer) {
      if (!selectedVehicleId) {
        toast.error("Select a vehicle or add a new one.");
        return false;
      }
      return true;
    }
    const reg = vehicleReg.trim().toUpperCase();
    const make = vehicleMake.trim();
    const model = vehicleModel.trim();
    if (!reg || !make || !model) {
      toast.error("Enter vehicle registration, make, and model.");
      return false;
    }
    if (!isValidIndianVehicleRegistration(reg)) {
      toast.error("Invalid vehicle registration", { description: INDIAN_VEHICLE_REG_HINT });
      return false;
    }
    const dup = findVehicleByNormalizedReg(vehicles, reg);
    if (dup) {
      toast.error(`${dup.registrationNumber} is already in the system.`);
      return false;
    }
    return true;
  };

  const handleDialogOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (open) {
      setNewBranchId(selectedBranchId || scopedBranches[0]?.id || "");
      setNewScheduledLocal(defaultScheduledDatetimeLocal());
    } else {
      resetForm();
    }
  };

  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Customer[]>([]);

  // Nested vehicle creation dialog for existing customers
  const [addVehicleForExistingCustomerDialogOpen, setAddVehicleForExistingCustomerDialogOpen] = useState(false);
  const [newVehicleRegInput, setNewVehicleRegInput] = useState("");
  const [newVehicleMakeInput, setNewVehicleMakeInput] = useState("");
  const [newVehicleModelInput, setNewVehicleModelInput] = useState("");
  const [newVehicleSegmentInput, setNewVehicleSegmentInput] = useState<VehicleSegment>("HATCHBACK");

  const [requestAddress, setRequestAddress] = useState("");
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [newScheduledLocal, setNewScheduledLocal] = useState("");
  const [reqType, setReqType] = useState<PickupDropType>("PICKUP");
  const [driverId, setDriverId] = useState<string>("unassigned");
  const [notes, setNotes] = useState("");

  const scopedJobCards = useMemo(
    () => filterByBranchId(jobCards, (jc) => jc.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === existingCustomerId) ?? null,
    [customers, existingCustomerId]
  );

  const hasExistingCustomer = Boolean(selectedExistingCustomer);

  const vehiclesForCustomer = useMemo(() => {
    if (!existingCustomerId) return [];
    return vehicles.filter((v) => v.customerId === existingCustomerId);
  }, [existingCustomerId, vehicles]);

  const allModelsSortedForExistingCustomer = useMemo(() => {
    const catalog = newVehicleMakeInput ? getModels(newVehicleMakeInput).map((m) => m.name) : [];
    const extra = newVehicleMakeInput ? extraModelsByBrand[newVehicleMakeInput] ?? [] : [];
    return [...new Set([...catalog, ...extra])].sort((a, b) => a.localeCompare(b));
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

  useEffect(() => {
    if (hasExistingCustomer) return;
    const q = lookupQuery.trim();
    if (!q) return;
    const digits = q.replace(/\D/g, "");
    if (queryLooksLikeVehicleReg(q)) {
      const reg = sanitizeVehicleRegistrationInput(q);
      setVehicleReg((prev) => (prev === reg ? prev : reg));
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
    setExistingCustomerId(c.id);
    setLookupQuery("");
    const owned = vehicles
      .filter((v) => v.customerId === c.id)
      .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
    setSelectedVehicleId(owned[0]?.id ?? "");
    setLookupPanelCustomers([]);
  };

  const clearSelectedCustomer = () => {
    setExistingCustomerId(null);
    setSelectedVehicleId(null);
  };

  const handleSaveVehicleForExistingCustomer = () => {
    if (!existingCustomerId) {
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

    const customer = customers.find((c) => c.id === existingCustomerId);
    if (!customer) {
      toast.error("Could not find selected customer");
      return;
    }

    const inferredSegment = getModelSegment(make, model) ?? newVehicleSegmentInput;
    const newVehicle: Vehicle = {
      id: `veh-pd-${Date.now()}`,
      customerId: existingCustomerId,
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

    setSelectedVehicleId(newVehicle.id);
    setAddVehicleForExistingCustomerDialogOpen(false);
    toast.success("Vehicle registered", { description: `${make} ${model} (${reg})` });
  };

  const scopedRequests = useMemo(
    () => filterByBranchId(requests, (r) => r.branchId, selectedBranchId),
    [requests, selectedBranchId]
  );

  const scopedBranches = useMemo(() => {
    const active = branches.filter((b) => b.isActive);
    if (!selectedBranchId) return active;
    return active.filter((b) => b.id === selectedBranchId);
  }, [branches, selectedBranchId]);

  const filteredGroups = useMemo(() => {
    return groupPickupDropByJob(scopedRequests).filter((group) =>
      pickupDropGroupMatchesFilters(group, statusFilter, typeFilter)
    );
  }, [scopedRequests, statusFilter, typeFilter]);

  const kpis = useMemo(() => {
    const all = scopedRequests;
    return {
      total: all.length,
      pending: all.filter((r) => r.status === "PENDING").length,
      driverAssigned: all.filter((r) => r.status === "DRIVER_ASSIGNED").length,
      inService: all.filter((r) => r.status === "IN_SERVICE").length,
      delivered: all.filter((r) => r.status === "DELIVERED").length,
    };
  }, [scopedRequests]);

  const resetForm = () => {
    setCurrentStep("customer");
    setExistingCustomerId(null);
    setSelectedVehicleId(null);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setLookupQuery("");
    setLookupPanelCustomers([]);
    setRequestAddress("");
    setNewBranchId("");
    setNewScheduledLocal("");
    setReqType("PICKUP");
    setDriverId("unassigned");
    setNotes("");
    setVehicleReg("");
    setVehicleMake("");
    setVehicleModel("");
    setVehicleSegment("HATCHBACK");
    setExtraBrands([]);
    setExtraModelsByBrand({});
    setNewBrandOpen(false);
    setNewBrandDraft("");
    setNewModelOpen(false);
    setNewModelDraft("");
    setAddVehicleForExistingCustomerDialogOpen(false);
    setNewVehicleRegInput("");
    setNewVehicleMakeInput("");
    setNewVehicleModelInput("");
    setNewVehicleSegmentInput("HATCHBACK");
  };

  const handleCreate = () => {
    const driver =
      driverId !== "unassigned"
        ? staff.find((d) => d.id === driverId)
        : undefined;

    const addr = requestAddress.trim();
    if (!addr) {
      toast.error(`Enter the ${pickupDropAddressFieldLabel(reqType).toLowerCase()}.`);
      return;
    }
    if (!newBranchId) {
      toast.error("Select a branch.");
      return;
    }
    if (!newScheduledLocal) {
      toast.error("Select a scheduled date and time.");
      return;
    }
    const scheduled = new Date(newScheduledLocal);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error("Invalid date and time.");
      return;
    }
    if (isDatetimeLocalInPast(newScheduledLocal)) {
      toast.error("Scheduled time cannot be in the past.", {
        description: "Choose a future date and time.",
      });
      return;
    }

    let customerNameStr = "";
    let customerPhoneStr = "";
    let vehicleMakeModelStr = "";
    let vehicleRegNumberStr = "";
    let regStored = "";

    if (hasExistingCustomer) {
      customerNameStr = selectedExistingCustomer!.name;
      customerPhoneStr = selectedExistingCustomer!.phone || "";
      const matchedVeh = vehicles.find((v) => v.id === selectedVehicleId);
      if (matchedVeh) {
        vehicleMakeModelStr = `${matchedVeh.make} ${matchedVeh.model}`.trim();
        vehicleRegNumberStr = matchedVeh.registrationNumber;
        regStored = normalizeRegistrationNumber(matchedVeh.registrationNumber);
      }
    } else {
      customerNameStr = newCustomerName.trim();
      customerPhoneStr = newCustomerPhone.trim();
      vehicleMakeModelStr = `${vehicleMake} ${vehicleModel}`.trim();
      vehicleRegNumberStr = vehicleReg.trim().toUpperCase();
      regStored = normalizeRegistrationNumber(vehicleReg);
    }

    // Lookup active job card for this vehicle!
    const activeJob = scopedJobCards.find(
      (j) =>
        !["DELIVERED", "CANCELLED"].includes(j.status) &&
        ((selectedVehicleId && j.vehicleId === selectedVehicleId) ||
          normalizeRegistrationNumber(j.vehicleRegNumber) === regStored)
    );

    const targetJobCardId = activeJob
      ? activeJob.id
      : `new-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`;
    const targetJobNumber = activeJob ? activeJob.jobNumber : "NEW";

    const phoneLine = customerPhoneStr
      ? `Phone: ${customerPhoneStr}`
      : "";
    const combinedNotes = [phoneLine, notes.trim()].filter(Boolean).join("\n\n");

    addRequest({
      jobCardId: targetJobCardId,
      jobNumber: targetJobNumber,
      branchId: newBranchId,
      customerName: customerNameStr,
      customerPhone: customerPhoneStr || undefined,
      address: addr,
      scheduledTime: scheduled.toISOString(),
      type: reqType,
      driverId: driver?.id,
      driverName: driver?.name,
      notes: combinedNotes || undefined,
      vehicleMakeModel: vehicleMakeModelStr || undefined,
      vehicleRegNumber: vehicleRegNumberStr || undefined,
    });

    setCreateOpen(false);
    resetForm();
  };

  const addressFieldLabel = pickupDropAddressFieldLabel(reqType);

  const canSubmitCreate = hasExistingCustomer
    ? !!(existingCustomerId && selectedVehicleId && requestAddress.trim() && newBranchId && newScheduledLocal)
    : !!(
        newCustomerName.trim() &&
        newCustomerPhone.trim() &&
        vehicleReg.trim() &&
        vehicleMake.trim() &&
        vehicleModel.trim() &&
        requestAddress.trim() &&
        newBranchId &&
        newScheduledLocal
      );

  const handlePickupDropWhatsApp = async (r: PickupDropRequest) => {
    const phone = customerPhoneFromPickupRequest(r);
    if (!phone) {
      toast.error("No customer phone", {
        description: "Add a phone when creating the request, or open the job card for this booking.",
      });
      return;
    }
    const branchName = branches.find((b) => b.id === r.branchId)?.name;
    const message = buildPickupDropWhatsAppMessage(r, { branchName });
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Pickup/Drop update via WhatsApp" : "Pickup/Drop — WhatsApp composer",
        message: `${r.jobNumber} → ${phone}`,
        href: "/pickup-drop",
        branchId: r.branchId,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("WhatsApp sent", { description: phone });
      notify("api");
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio on the server.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  };

  const handleAdvanceStatus = (r: PickupDropRequest) => {
    const block = validatePickupDropAdvance(r);
    if (block) {
      toast.error(block);
      return;
    }
    const next = advanceStatus(r.id);
    if (!next) {
      toast.message("Already at final status");
      return;
    }
    toast.success(PICKUP_DROP_STATUS_LABEL[next]);
  };

  const handleAssignDriver = (requestId: string, value: string, driverName?: string) => {
    if (value === "unassigned") {
      assignDriver(requestId, undefined, undefined);
      return;
    }
    assignDriver(requestId, value, driverName);
    if (driverName) {
      toast.success(`Driver: ${driverName}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pickup & Drop Management"
        description={`Manage vehicle pickup and delivery for ${viewingLabel}.`}
        actions={
          <>
            <Button
              className="gap-2"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Request
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {(
          [
            { label: "Total Requests", value: kpis.total, color: "text-foreground" },
            { label: "Pending", value: kpis.pending, color: "text-orange-500" },
            { label: "Driver Assigned", value: kpis.driverAssigned, color: "text-blue-600" },
            { label: "In Service", value: kpis.inService, color: "text-violet-600" },
            { label: "Delivered", value: kpis.delivered, color: "text-emerald-600" },
          ] as const
        ).map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className={cn("text-3xl font-bold tabular-nums mt-2", k.color)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-[220px]">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as PickupDropStatus | "ALL")}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="cursor-pointer data-[highlighted]:bg-[#1D61D1] data-[highlighted]:text-white"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:max-w-[220px]">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as PickupDropType | "ALL")}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="cursor-pointer data-[highlighted]:bg-[#1D61D1] data-[highlighted]:text-white"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredGroups.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 px-4">
            <p className="text-sm text-muted-foreground text-center">
              No pickup/drop requests found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const phone =
              customerPhoneFromPickupRequest(group.pickup ?? group.drop ?? group.orphan!) ??
              undefined;
            return (
              <PickupDropJobGroupCard
                key={group.jobCardId}
                group={group}
                allRequests={scopedRequests}
                branchScoped={!!selectedBranchId}
                customerPhone={phone}
                onAssignDriver={handleAssignDriver}
                onAdvance={handleAdvanceStatus}
                onWhatsApp={(req) => void handlePickupDropWhatsApp(req)}
              />
            );
          })}
        </div>
      )}
      <Dialog open={createOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className={cn("sm:max-w-lg", dialogSurfaceClass)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-foreground">
              Create Pickup/Drop Request
            </DialogTitle>
          </DialogHeader>

          {/* Stepper Progress Indicator */}
          <div className="space-y-2 border-b pb-4 mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Step {currentStep === "customer" ? 1 : currentStep === "vehicle" ? 2 : 3} of 3 —{" "}
                {currentStep === "customer"
                  ? "Customer details"
                  : currentStep === "vehicle"
                  ? "Vehicle details"
                  : "Request details"}
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
              <span className={cn("font-medium", currentStep === "details" && "text-primary font-semibold")}>Request details</span>
            </div>
          </div>

          <div className="grid gap-4 py-2 max-h-[min(70vh,28rem)] overflow-y-auto pr-1">
            {/* STEP 1: Customer Details */}
            {currentStep === "customer" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pd-customer-lookup" className="text-sm font-medium">Search Existing Customer</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="pd-customer-lookup"
                      className="pl-9 border-input"
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
                    <div className="rounded-md border border-border bg-background p-2 max-h-44 overflow-auto scrollbar-thin">
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
                          No customer found. Continue below to fill details for a new customer.
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
                        {selectedExistingCustomer?.address && (
                          <p className="text-xs text-muted-foreground truncate">{selectedExistingCustomer.address}</p>
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
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="pd-new-name" className="text-xs">Full Name *</Label>
                        <Input
                          id="pd-new-name"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="Customer name"
                          autoComplete="name"
                          className="h-9 border-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pd-new-phone" className="text-xs">Phone Number *</Label>
                        <Input
                          id="pd-new-phone"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, "").slice(-10))}
                          placeholder="Phone number"
                          maxLength={10}
                          className="h-9 border-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pd-new-email" className="text-xs">Email (Optional)</Label>
                        <Input
                          id="pd-new-email"
                          type="email"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          placeholder="Email address"
                          autoComplete="email"
                          className="h-9 border-input"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="pd-new-address" className="text-xs">Address (Optional)</Label>
                        <Input
                          id="pd-new-address"
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          placeholder="City / area"
                          className="h-9 border-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
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

                    {vehiclesForCustomer.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                        {vehiclesForCustomer.map((v) => {
                          const isSelected = selectedVehicleId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedVehicleId(v.id);
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
                        <Label htmlFor="pd-new-reg" className="text-xs">Registration Number *</Label>
                        <Input
                          id="pd-new-reg"
                          value={vehicleReg}
                          onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                          placeholder="e.g. KA01AB1234"
                          maxLength={16}
                          className="font-mono uppercase h-9 border-input"
                        />
                        <p className="text-[10px] text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pd-new-seg" className="text-xs">Type</Label>
                        <Select
                          value={vehicleSegment}
                          onValueChange={(v) => setVehicleSegment(v as VehicleSegment)}
                        >
                          <SelectTrigger id="pd-new-seg" className="h-9 border-input">
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
                          <Label htmlFor="pd-new-make" className="text-xs">Brand *</Label>
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
                          value={vehicleMake || undefined}
                          onValueChange={(value) => {
                            setVehicleMake(value);
                            setVehicleModel("");
                          }}
                        >
                          <SelectTrigger id="pd-new-make" className="h-9 border-input">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent className={selectContentClass}>
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
                          <Label htmlFor="pd-new-model" className="text-xs">Model *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!vehicleMake}
                            className="h-6 shrink-0 px-2 text-[10px] font-medium disabled:opacity-50"
                            onClick={() => {
                              if (!vehicleMake) return;
                              setNewModelOpen(true);
                              setNewModelDraft("");
                            }}
                          >
                            + New
                          </Button>
                        </div>
                        <Select
                          value={vehicleModel || undefined}
                          onValueChange={(value) => {
                            setVehicleModel(value);
                            const inferredSegment = getModelSegment(vehicleMake, value);
                            if (inferredSegment) {
                              setVehicleSegment(inferredSegment);
                            }
                          }}
                          disabled={!vehicleMake}
                        >
                          <SelectTrigger id="pd-new-model" className="h-9 border-input">
                            <SelectValue placeholder={vehicleMake ? "Select model" : "Select brand first"} />
                          </SelectTrigger>
                          <SelectContent className={selectContentClass}>
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
                )}

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

            {/* STEP 3: Request details */}
            {currentStep === "details" && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="pd-existing-address">{addressFieldLabel} *</Label>
                  <Textarea
                    id="pd-existing-address"
                    value={requestAddress}
                    onChange={(e) => setRequestAddress(e.target.value)}
                    rows={3}
                    className="resize-none border-input"
                    placeholder="Street, landmark, pincode…"
                  />
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pd-new-branch">Branch *</Label>
                    {scopedBranches.length === 0 ? (
                      <p className="text-sm text-destructive rounded-md border border-dashed px-3 py-2.5">
                        No active branch available for your scope.
                      </p>
                    ) : (
                      <Select value={newBranchId || undefined} onValueChange={setNewBranchId}>
                        <SelectTrigger id="pd-new-branch" className={selectTriggerClass}>
                          <SelectValue placeholder="Select branch…" />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {scopedBranches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pd-new-when">Scheduled date &amp; time *</Label>
                    <Input
                      id="pd-new-when"
                      type="datetime-local"
                      className="date-input-icon-end pr-9 border-input"
                      min={localDatetimeLocalInputMin()}
                      value={newScheduledLocal}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setNewScheduledLocal(v);
                          return;
                        }
                        if (!isDatetimeLocalInPast(v)) {
                          setNewScheduledLocal(v);
                        } else {
                          setNewScheduledLocal(localDatetimeLocalInputMin());
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Request Type</Label>
                  <Select value={reqType} onValueChange={(v) => setReqType(v as PickupDropType)}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="PICKUP">Pickup</SelectItem>
                      <SelectItem value="DROP">Drop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Assign Driver (Optional)</Label>
                  <PickupDriverSelect
                    branchId={newBranchId || selectedBranchId || ""}
                    value={driverId}
                    onValueChange={(id) => setDriverId(id)}
                    branchScoped={!!selectedBranchId}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pd-notes">Notes (Optional)</Label>
                  <Textarea
                    id="pd-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="resize-none border-input"
                    placeholder="Add any notes…"
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
                  <Button onClick={handleCreate} disabled={!canSubmitCreate}>
                    Create Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested Add Vehicle dialog for existing customer */}
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
              <Label htmlFor="pd-dialog-veh-reg" className="text-xs">Registration Number *</Label>
              <Input
                id="pd-dialog-veh-reg"
                value={newVehicleRegInput}
                onChange={(e) => setNewVehicleRegInput(e.target.value.toUpperCase())}
                placeholder="e.g. KA01AB1234"
                maxLength={16}
                className="font-mono uppercase h-9 border-input"
              />
              <p className="text-[10px] text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-dialog-veh-seg" className="text-xs">Type</Label>
              <Select
                value={newVehicleSegmentInput}
                onValueChange={(v) => setNewVehicleSegmentInput(v as VehicleSegment)}
              >
                <SelectTrigger id="pd-dialog-veh-seg" className="h-9 border-input">
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
                <Label htmlFor="pd-dialog-veh-make" className="text-xs">Brand *</Label>
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
                <SelectTrigger id="pd-dialog-veh-make" className="h-9 border-input">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
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
                <Label htmlFor="pd-dialog-veh-model" className="text-xs">Model *</Label>
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
                <SelectTrigger id="pd-dialog-veh-model" className="h-9 border-input">
                  <SelectValue placeholder={newVehicleMakeInput ? "Select model" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
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

      {/* Brand add nested dialog */}
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
                setVehicleMake(t);
                setVehicleModel("");
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
                setVehicleMake(t);
                setVehicleModel("");
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
      <Dialog open={newModelOpen} onOpenChange={setNewModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add model</DialogTitle>
            <DialogDescription>
              Add a model for <span className="font-medium text-foreground">{vehicleMake}</span> when it is not listed.
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
                if (!t || !vehicleMake.trim()) return;
                setExtraModelsByBrand((prev) => ({
                  ...prev,
                  [vehicleMake]: [...(prev[vehicleMake] ?? []), t],
                }));
                setVehicleModel(t);
                const seg = getModelSegment(vehicleMake, t);
                if (seg) setVehicleSegment(seg);
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
                if (!vehicleMake.trim()) return;
                setExtraModelsByBrand((prev) => ({
                  ...prev,
                  [vehicleMake]: [...(prev[vehicleMake] ?? []), t],
                }));
                setVehicleModel(t);
                const seg = getModelSegment(vehicleMake, t);
                if (seg) setVehicleSegment(seg);
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
    </div>
  );
}
