"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVehicleStore } from "@/store/vehicle-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useCustomerStore } from "@/store/customer-store";
import { useStaffStore } from "@/store/staff-store";
import { useAppointmentStore } from "@/store/appointment-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { isAppointmentSlotElapsed } from "@/lib/appointment-status";
import { useSettingsStore } from "@/store/settings-store";
import { useBranchStore } from "@/store/branch-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedAppointments } from "@/hooks/use-scoped-data";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import { KPICard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from "date-fns";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar,
  Check,
  XCircle,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { Appointment, AppointmentStatus, Vehicle, VehicleSegment } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildReservationConfirmedMessage } from "@/lib/appointment-messages";
import { getBookingConfirmationBusiness } from "@/lib/booking-confirmation-message";
import { getNextAppointmentNumber, getAppointmentDisplayId } from "@/lib/appointment-ids";
import { convertAppointmentToJobCard } from "@/lib/convert-appointment-to-job";
import { findCatalogServiceForAppointment } from "@/lib/job-from-appointment";
import { useReservationReminders } from "@/hooks/use-reservation-reminders";
import { useAuthStore } from "@/store/auth-store";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { notifyReservationConfirmedWhatsApp } from "@/lib/whatsapp-automation-triggers";
import {
  isAppointmentSlotInPast,
  localTodayDateInputMin,
  localTimeInputMinNow,
} from "@/lib/booking-calendar-validation";
import {
  findVehicleByNormalizedReg,
  INDIAN_VEHICLE_REG_HINT,
  isValidIndianVehicleRegistration,
} from "@/lib/vehicle-registration";

const STATUS_COLORS: Record<AppointmentStatus, { bg: string; text: string; dot: string }> = {
  SCHEDULED: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  CONFIRMED: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  IN_PROGRESS: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  COMPLETED: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  CANCELLED: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  NOT_ATTENDED: {
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  },
};

const APPOINTMENT_VEHICLE_SEGMENTS: { value: VehicleSegment; label: string }[] = [
  { value: "HATCHBACK", label: "Hatchback" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "COMPACT_SUV", label: "Compact SUV" },
  { value: "MUV", label: "MUV" },
  { value: "LUXURY", label: "Luxury" },
  { value: "BIKE", label: "Bike" },
];

function AppointmentFromQueryEffect({ setDialogOpen }: { setDialogOpen: (open: boolean) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setDialogOpen(true);
      router.replace("/appointments");
    }
  }, [searchParams, router, setDialogOpen]);

  return null;
}

export default function AppointmentsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const { getBrandNames, getModels } = useVehicleCatalogStore();
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const staff = useStaffStore((s) => s.staff);
  const appointments = useScopedAppointments();
  const jobCards = useJobCardStore((s) => s.jobCards);
  const addAppointment = useAppointmentStore((s) => s.addAppointment);
  const updateAppointment = useAppointmentStore((s) => s.updateAppointment);
  const reconcileStaleAppointments = useAppointmentStore((s) => s.reconcileStaleAppointments);

  useEffect(() => {
    void reconcileStaleAppointments(jobCards);
  }, [reconcileStaleAppointments, jobCards]);
  const { viewingLabel } = useBranchScope();
  const businessPhone = useSettingsStore((s) => s.businessPhone);
  const businessEmail = useSettingsStore((s) => s.businessEmail);
  const businessAddress = useSettingsStore((s) => s.businessAddress);
  const businessWebsite = useSettingsStore((s) => s.businessWebsite);
  const businessName = useSettingsStore((s) => s.businessName);
  const branches = useBranchStore((s) => s.branches);
  const [creatingJobForId, setCreatingJobForId] = useState<string | null>(null);

  useReservationReminders();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newVehicleReg, setNewVehicleReg] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleSegment, setNewVehicleSegment] = useState<VehicleSegment>("HATCHBACK");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formVehicleId, setFormVehicleId] = useState("");
  const [addVehicleForExistingCustomerDialogOpen, setAddVehicleForExistingCustomerDialogOpen] = useState(false);
  const [newVehicleRegInput, setNewVehicleRegInput] = useState("");
  const [newVehicleMakeInput, setNewVehicleMakeInput] = useState("");
  const [newVehicleModelInput, setNewVehicleModelInput] = useState("");
  const [newVehicleSegmentInput, setNewVehicleSegmentInput] = useState<VehicleSegment>("HATCHBACK");
  const [formServiceId, setFormServiceId] = useState("");
  const [formMechanicId, setFormMechanicId] = useState("");
  const [formDate, setFormDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [formTime, setFormTime] = useState("09:00");
  const [formNotes, setFormNotes] = useState("");

  const minCalendarDate = localTodayDateInputMin();
  const timeInputMin = formDate === minCalendarDate ? localTimeInputMinNow() : undefined;

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  const vehiclesForCustomer = useMemo(() => {
    if (!formCustomerId) return [];
    return vehicles.filter((v) => v.customerId === formCustomerId);
  }, [formCustomerId, vehicles]);

  const makeOptions = useMemo(() => getBrandNames(), [getBrandNames]);
  const modelOptions = useMemo(
    () => (newVehicleMake ? getModels(newVehicleMake) : []),
    [getModels, newVehicleMake]
  );
  const modelOptionsForExistingCustomer = useMemo(
    () => (newVehicleMakeInput ? getModels(newVehicleMakeInput) : []),
    [getModels, newVehicleMakeInput]
  );

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === formCustomerId) ?? null,
    [customers, formCustomerId]
  );

  const handleExistingCustomerVehicleSelection = (value: string) => {
    if (value === "__add_new_vehicle__") {
      if (!formCustomerId) return;
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

    const customer = customers.find((c) => c.id === formCustomerId);
    if (!customer) {
      toast.error("Could not find selected customer");
      return;
    }

    const newVehicle: Vehicle = {
      id: `veh-apt-${Date.now()}`,
      customerId: formCustomerId,
      customerName: customer.name,
      registrationNumber: reg,
      make,
      model,
      segment: newVehicleSegmentInput,
      fuelType: "PETROL",
      color: "—",
      year: new Date().getFullYear(),
    };

    setVehicles((prev) => [...prev, newVehicle]);
    setFormVehicleId(newVehicle.id);
    setAddVehicleForExistingCustomerDialogOpen(false);
    setNewVehicleRegInput("");
    setNewVehicleMakeInput("");
    setNewVehicleModelInput("");
    setNewVehicleSegmentInput("HATCHBACK");
    toast.success("Vehicle added", {
      description: `${reg} has been linked to ${customer.name} and selected for this appointment.`,
    });
  };

  const resetAppointmentForm = () => {
    setCustomerMode("existing");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setNewVehicleReg("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setNewVehicleSegment("HATCHBACK");
    setFormCustomerId("");
    setFormVehicleId("");
    setAddVehicleForExistingCustomerDialogOpen(false);
    setNewVehicleRegInput("");
    setNewVehicleMakeInput("");
    setNewVehicleModelInput("");
    setNewVehicleSegmentInput("HATCHBACK");
    setFormServiceId("");
    setFormMechanicId("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormTime("09:00");
    setFormNotes("");
  };

  const handleAppointmentDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      const today = startOfDay(new Date());
      const raw = selectedDate ?? new Date();
      const pickedDay = startOfDay(raw);
      const isPastDay = pickedDay < today;
      const effectiveDate = isPastDay ? new Date() : raw;
      setFormDate(format(effectiveDate, "yyyy-MM-dd"));
      if (isPastDay || isToday(effectiveDate)) {
        setFormTime(localTimeInputMinNow());
      } else {
        setFormTime("09:00");
      }
    } else {
      resetAppointmentForm();
    }
  };

  const handleNewAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = catalog.find((s) => s.id === formServiceId);
    if (!service) {
      toast.error("Please select a service");
      return;
    }
    if (!formDate || !formTime) {
      toast.error("Please set date and time");
      return;
    }
    if (isAppointmentSlotInPast(formDate, formTime)) {
      toast.error("Cannot schedule in the past", {
        description: "Choose today with a future time, or a later date.",
      });
      return;
    }

    let customerId: string;
    let customerName: string;
    let customerPhone: string;
    let vehicleId: string;
    let vehicleRegNumber: string;
    let vehicleMakeModel: string;
    let customerFirstName: string | undefined;

    if (customerMode === "existing") {
      const customer = customers.find((c) => c.id === formCustomerId);
      const vehicle = vehicles.find((v) => v.id === formVehicleId);
      if (!customer || !vehicle) {
        toast.error("Please select customer and vehicle");
        return;
      }
      customerId = customer.id;
      customerName = customer.name;
      customerPhone = customer.phone;
      vehicleId = vehicle.id;
      vehicleRegNumber = vehicle.registrationNumber;
      vehicleMakeModel = `${vehicle.make} ${vehicle.model}`;
      customerFirstName = customer.name.trim().split(/\s+/)[0];
    } else {
      const name = newCustomerName.trim();
      const phoneDigits = newCustomerPhone.replace(/\D/g, "").slice(-10);
      const reg = newVehicleReg.trim().toUpperCase();
      const make = newVehicleMake.trim();
      const model = newVehicleModel.trim();
      if (!name) {
        toast.error("Enter customer name");
        return;
      }
      if (phoneDigits.length !== 10) {
        toast.error("Enter a valid 10-digit mobile number");
        return;
      }
      if (!reg || !make || !model) {
        toast.error("Enter vehicle registration, make, and model");
        return;
      }
      const referralCode = `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      let createdCustomer;
      try {
        createdCustomer = await addCustomer({
          name,
          phone: newCustomerPhone,
          email:
            newCustomerEmail.trim() ||
            `noemail+${phoneDigits}@customers.placeholder`,
          address: newCustomerAddress.trim(),
          referralCode,
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
          description: "Choose Existing customer and pick that customer, or use another number.",
        });
        return;
      }
      const custId = createdCustomer.id;
      const vehId = `veh-apt-${Date.now()}`;
      const newVehicle: Vehicle = {
        id: vehId,
        customerId: custId,
        customerName: name,
        registrationNumber: reg,
        make,
        model,
        segment: newVehicleSegment,
        fuelType: "PETROL",
        color: "—",
        year: new Date().getFullYear(),
      };
      setVehicles((prev) => [newVehicle, ...prev]);
      customerId = custId;
      customerName = name;
      customerPhone = newCustomerPhone;
      vehicleId = vehId;
      vehicleRegNumber = reg;
      vehicleMakeModel = `${make} ${model}`;
      customerFirstName = name.split(/\s+/)[0];
    }

    const mechanic = formMechanicId ? staff.find((s) => s.id === formMechanicId) : undefined;
    const now = new Date().toISOString();
    const allAppointments = useAppointmentStore.getState().appointments;
    const appointmentNumber = getNextAppointmentNumber(allAppointments);
    const branchId =
      viewingLabel !== "All branches"
        ? branches.find((b) => b.name === viewingLabel)?.id
        : branches.find((b) => b.isActive)?.id;

    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      bookingId: appointmentNumber,
      appointmentNumber,
      kind: "APPOINTMENT",
      branchId,
      customerId,
      customerName,
      customerPhone,
      vehicleId,
      vehicleRegNumber,
      vehicleMakeModel,
      serviceType: service.name,
      mechanicId: mechanic?.id,
      mechanicName: mechanic?.name,
      date: formDate,
      time: formTime,
      status: "CONFIRMED",
      whatsappSent: true,
      createdAt: now,
      notes: formNotes.trim() || undefined,
      customerFirstName,
    };

    await addAppointment(newApt);
    notifyReservationConfirmedWhatsApp(newApt, businessPayload);

    const [yy, mm, dd] = formDate.split("-").map(Number);
    const scheduledDay = new Date(yy, mm - 1, dd);

    toast.success("Appointment created", {
      description: `${appointmentNumber} · ${format(scheduledDay, "d MMM yyyy")} ${formTime}`,
    });
    setDialogOpen(false);
    resetAppointmentForm();

    setSelectedDate(scheduledDay);
    setCurrentMonth(scheduledDay);
  };

  const branchLabel = useMemo(() => {
    if (viewingLabel !== "All branches") return viewingLabel;
    return branches[0]?.name ?? "Main workshop";
  }, [viewingLabel, branches]);

  const businessPayload = useMemo(
    () =>
      getBookingConfirmationBusiness({
        businessName,
        businessAddress,
        businessPhone,
        businessEmail,
        businessWebsite,
        branchLabel,
        acceptanceOutlet: "Visit Outlet",
      }),
    [branchLabel, businessName, businessAddress, businessPhone, businessEmail, businessWebsite]
  );

  const sendBookingConfirmationWhatsApp = async (apt: Appointment, messageText: string) => {
    const phone = (apt.whatsappPhone ?? apt.customerPhone)?.trim();
    if (!phone) {
      toast.error("WhatsApp not sent", { description: "Customer has no phone number on file." });
      return;
    }
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Booking confirmation sent" : "Booking — WhatsApp composer",
        message: `${getAppointmentDisplayId(apt)} → ${phone}`,
        href: "/appointments",
      });
    };
    const finishSent = async () => {
      await updateAppointment(apt.id, { whatsappSent: true });
    };
    try {
      await sendCustomerWhatsApp(phone, messageText);
      await finishSent();
      toast.success("WhatsApp sent", { description: phone });
      notify("api");
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, messageText);
        await finishSent();
        toast.info("WhatsApp opened", {
          description: "Twilio WhatsApp not configured — finish sending in the WhatsApp app.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  };

  const handleConfirmBooking = async (apt: Appointment) => {
    if (apt.status !== "SCHEDULED") return;
    const next: Appointment = { ...apt, status: "CONFIRMED" };
    await updateAppointment(apt.id, { status: "CONFIRMED" });
    toast.success("Appointment confirmed");
    const messageText = buildReservationConfirmedMessage(next, businessPayload);
    await sendBookingConfirmationWhatsApp(next, messageText);
  };

  const createJobFromAppointment = async (apt: Appointment) => {
    if (apt.jobCardId || (apt.status !== "CONFIRMED" && apt.status !== "SCHEDULED")) return;
    setCreatingJobForId(apt.id);
    try {
      const job = await convertAppointmentToJobCard({
        apt,
        vehicles,
        catalog,
        branches,
        currentBranch,
        createdBy: authUser?.id ?? "usr-004",
      });
      if (!findCatalogServiceForAppointment(catalog, apt.serviceType)) {
        toast.info("Custom service line", {
          description: `No catalog match for "${apt.serviceType}" — check prices on the job card.`,
        });
      }
      toast.success("Job card created", {
        description: `${getAppointmentDisplayId(apt)} → ${job.jobNumber}`,
      });
      router.push(`/job-cards/${job.id}`);
    } catch {
      toast.error("Could not create job card");
    } finally {
      setCreatingJobForId(null);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((apt) => {
      const key = apt.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    });
    return map;
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return appointmentsByDate.get(key) ?? [];
  }, [selectedDate, appointmentsByDate]);

  const upcomingAppointments = useMemo(() => {
    return [...appointments]
      .filter(
        (a) =>
          a.status !== "COMPLETED" &&
          a.status !== "CANCELLED" &&
          a.status !== "NOT_ATTENDED" &&
          !isAppointmentSlotElapsed(a.date, a.time)
      )
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [appointments]);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayCount = appointmentsByDate.get(todayKey)?.length ?? 0;
  const scheduledCount = appointments.filter(
    (a) => a.status === "SCHEDULED" && !isAppointmentSlotElapsed(a.date, a.time)
  ).length;
  const confirmedCount = appointments.filter(
    (a) => a.status === "CONFIRMED" && !isAppointmentSlotElapsed(a.date, a.time)
  ).length;
  const cancelledCount = appointments.filter(
    (a) => a.status === "CANCELLED" || a.status === "NOT_ATTENDED"
  ).length;
  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <Suspense fallback={null}>
        <AppointmentFromQueryEffect setDialogOpen={setDialogOpen} />
      </Suspense>
      <PageHeader
        title="Appointments"
        inlineActionsOnMobile
        className="mb-3 sm:mb-6"
        actions={
          <Dialog open={dialogOpen} onOpenChange={handleAppointmentDialogChange}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" className="shrink-0 whitespace-nowrap">
                <Plus className="w-4 h-4 mr-1.5" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[min(90vh,720px)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <DialogDescription className="sr-only">
                  Form to schedule a new service appointment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleNewAppointmentSubmit} className="space-y-4 mt-2">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Customer</Label>
                  <div className="flex rounded-lg border border-input bg-muted/30 p-1 gap-1">
                    <Button
                      type="button"
                      variant={customerMode === "existing" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCustomerMode("existing")}
                    >
                      Existing customer
                    </Button>
                    <Button
                      type="button"
                      variant={customerMode === "new" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCustomerMode("new")}
                    >
                      New customer
                    </Button>
                  </div>
                </div>

                {customerMode === "existing" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apt-customer">Customer</Label>
                      <CustomerSearchSelect
                        customers={customers}
                        selectedCustomerId={formCustomerId}
                        onSelectCustomer={(v) => {
                          setFormCustomerId(v);
                          setFormVehicleId("");
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apt-vehicle">Vehicle</Label>
                      <Select
                        value={formVehicleId}
                        onValueChange={handleExistingCustomerVehicleSelection}
                        disabled={!formCustomerId}
                      >
                        <SelectTrigger id="apt-vehicle">
                          <SelectValue placeholder={formCustomerId ? "Select vehicle" : "Select customer first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {vehiclesForCustomer.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              No vehicles for this customer
                            </SelectItem>
                          ) : (
                            vehiclesForCustomer.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.registrationNumber} — {v.make} {v.model}
                              </SelectItem>
                            ))
                          )}
                          <SelectItem value="__add_new_vehicle__">+ Add New Vehicle</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0 text-xs"
                        disabled={!formCustomerId}
                        onClick={() => handleExistingCustomerVehicleSelection("__add_new_vehicle__")}
                      >
                        + Add New Vehicle
                      </Button>
                      {formCustomerId && vehiclesForCustomer.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No vehicles yet for this customer. Click + Add New Vehicle.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                    <p className="text-sm font-medium text-foreground">New customer &amp; vehicle</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="apt-new-name">
                          Full name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="apt-new-name"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="Customer name"
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apt-new-phone">
                          Mobile <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="apt-new-phone"
                          type="tel"
                          inputMode="numeric"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          placeholder="10-digit number"
                          autoComplete="tel"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apt-new-email">Email (optional)</Label>
                        <Input
                          id="apt-new-email"
                          type="email"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          placeholder="email@example.com"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="apt-new-address">Address (optional)</Label>
                        <Input
                          id="apt-new-address"
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          placeholder="City / area"
                        />
                      </div>
                    </div>
                    <div className="border-t border-border pt-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vehicle
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="apt-new-reg">
                            Registration <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="apt-new-reg"
                            value={newVehicleReg}
                            onChange={(e) => setNewVehicleReg(e.target.value.toUpperCase())}
                            placeholder="e.g. KA01AB1234"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apt-new-seg">Type</Label>
                          <Select
                            value={newVehicleSegment}
                            onValueChange={(v) => setNewVehicleSegment(v as VehicleSegment)}
                          >
                            <SelectTrigger id="apt-new-seg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {APPOINTMENT_VEHICLE_SEGMENTS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apt-new-make">
                            Make <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={newVehicleMake || undefined}
                            onValueChange={(value) => {
                              setNewVehicleMake(value);
                              setNewVehicleModel("");
                            }}
                          >
                            <SelectTrigger id="apt-new-make">
                              <SelectValue placeholder="Select make" />
                            </SelectTrigger>
                            <SelectContent>
                              {makeOptions.map((make) => (
                                <SelectItem key={make} value={make}>
                                  {make}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="apt-new-model">
                            Model <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={newVehicleModel || undefined}
                            onValueChange={setNewVehicleModel}
                            disabled={!newVehicleMake}
                          >
                            <SelectTrigger id="apt-new-model">
                              <SelectValue placeholder={newVehicleMake ? "Select model" : "Select make first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {modelOptions.map((model) => (
                                <SelectItem key={model.name} value={model.name}>
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apt-service">Service</Label>
                    <Select required value={formServiceId} onValueChange={setFormServiceId}>
                      <SelectTrigger id="apt-service">
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog
                          .filter((s) => s.isActive)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-mechanic">Mechanic (optional)</Label>
                    <Select value={formMechanicId || "__none__"} onValueChange={(v) => setFormMechanicId(v === "__none__" ? "" : v)}>
                      <SelectTrigger id="apt-mechanic">
                        <SelectValue placeholder="Assign mechanic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {staff
                          .filter((s) => s.role === "MECHANIC")
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-date">Date</Label>
                    <Input
                      id="apt-date"
                      type="date"
                      required
                      min={minCalendarDate}
                      value={formDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v < minCalendarDate) {
                          setFormDate(minCalendarDate);
                          setFormTime(localTimeInputMinNow());
                          return;
                        }
                        setFormDate(v);
                        if (v === minCalendarDate) {
                          const nowT = localTimeInputMinNow();
                          setFormTime((prev) => (prev < nowT ? nowT : prev));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-time">Time</Label>
                    <Input
                      id="apt-time"
                      type="time"
                      required
                      min={timeInputMin}
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="apt-notes">Notes (optional)</Label>
                    <Input
                      id="apt-notes"
                      placeholder="Any special instructions..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => handleAppointmentDialogChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Schedule</Button>
                </div>
              </form>

              <Dialog
                open={addVehicleForExistingCustomerDialogOpen}
                onOpenChange={setAddVehicleForExistingCustomerDialogOpen}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add New Vehicle</DialogTitle>
                    <DialogDescription>
                      Link a new vehicle to {selectedExistingCustomer?.name ?? "the selected customer"} and continue scheduling.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Customer</Label>
                      <Input value={selectedExistingCustomer?.name ?? ""} readOnly disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apt-existing-vehicle-reg">Registration *</Label>
                      <Input
                        id="apt-existing-vehicle-reg"
                        value={newVehicleRegInput}
                        onChange={(e) => setNewVehicleRegInput(e.target.value.toUpperCase())}
                        placeholder="e.g. KA01AB1234"
                        maxLength={16}
                        className="font-mono uppercase"
                      />
                      <p className="text-xs text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="apt-existing-vehicle-segment">Type</Label>
                        <Select
                          value={newVehicleSegmentInput}
                          onValueChange={(value) => setNewVehicleSegmentInput(value as VehicleSegment)}
                        >
                          <SelectTrigger id="apt-existing-vehicle-segment">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPOINTMENT_VEHICLE_SEGMENTS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apt-existing-vehicle-make">Make *</Label>
                        <Select
                          value={newVehicleMakeInput || undefined}
                          onValueChange={(value) => {
                            setNewVehicleMakeInput(value);
                            setNewVehicleModelInput("");
                          }}
                        >
                          <SelectTrigger id="apt-existing-vehicle-make">
                            <SelectValue placeholder="Select make" />
                          </SelectTrigger>
                          <SelectContent>
                            {makeOptions.map((make) => (
                              <SelectItem key={make} value={make}>
                                {make}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="apt-existing-vehicle-model">Model *</Label>
                        <Select
                          value={newVehicleModelInput || undefined}
                          onValueChange={setNewVehicleModelInput}
                          disabled={!newVehicleMakeInput}
                        >
                          <SelectTrigger id="apt-existing-vehicle-model">
                            <SelectValue placeholder={newVehicleMakeInput ? "Select model" : "Select make first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {modelOptionsForExistingCustomer.map((model) => (
                              <SelectItem key={model.name} value={model.name}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAddVehicleForExistingCustomerDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSaveVehicleForExistingCustomer}>
                      Save vehicle
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KPICard
          size="compact"
          title="Today"
          value={todayCount}
          icon={Calendar}
          tone="blue"
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Scheduled"
          value={scheduledCount}
          icon={Clock}
          tone="violet"
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Confirmed"
          value={confirmedCount}
          icon={User}
          tone="emerald"
          titleClassName="whitespace-nowrap"
        />
        <KPICard
          size="compact"
          title="Cancelled"
          value={cancelledCount}
          icon={XCircle}
          tone="rose"
          titleClassName="whitespace-nowrap"
        />
      </div>

      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-6 sm:pb-4 sm:pt-4">
          <CardTitle className="text-base">Booking workspace</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-3 sm:px-6 sm:pt-5">
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start rounded-none border-0 border-b border-border/70 bg-transparent p-0 h-auto gap-0 mb-1">
          <TabsTrigger
            value="calendar"
            className={cn(
              "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-4 py-2.5 gap-2 text-muted-foreground",
              "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
              "dark:data-[state=active]:text-emerald-400"
            )}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            Calendar
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className={cn(
              "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-4 py-2.5 gap-2 text-muted-foreground",
              "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
              "dark:data-[state=active]:text-emerald-400"
            )}
          >
            <Clock className="w-4 h-4 shrink-0" />
            List view
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-5 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Today: {format(new Date(), "EEEE, d MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const t = new Date();
                        setCurrentMonth(t);
                        setSelectedDate(t);
                      }}
                    >
                      Today
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                  {calendarDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayAppts = appointmentsByDate.get(key) ?? [];
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrent = isToday(day);
                    const inMonth = isSameMonth(day, currentMonth);

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDate(day)}
                        className={`relative flex flex-col items-center justify-start p-1 sm:p-2 min-h-[48px] sm:min-h-[64px] rounded-lg transition-colors text-sm
                          ${!inMonth ? "text-muted-foreground/40" : ""}
                          ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}
                          ${isCurrent && !isSelected ? "bg-accent" : ""}
                        `}
                      >
                        <span className={`text-xs sm:text-sm font-medium ${isCurrent ? "text-primary font-bold" : ""}`}>
                          {format(day, "d")}
                        </span>
                        {dayAppts.length > 0 && (
                          <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                            {dayAppts.slice(0, 3).map((a) => (
                              <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[a.status].dot}`} />
                            ))}
                            {dayAppts.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">+{dayAppts.length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {selectedDate
                    ? isToday(selectedDate)
                      ? `Today · ${format(selectedDate, "EEE, d MMM yyyy")}`
                      : format(selectedDate, "EEE, d MMM yyyy")
                    : "Select a day"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No appointments for this day</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDayAppointments.map((apt) => {
                      const sc = STATUS_COLORS[apt.status];
                      return (
                        <div key={apt.id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">{apt.time}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                              {apt.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{apt.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {getAppointmentDisplayId(apt)} &middot; {apt.vehicleRegNumber} &middot; {apt.serviceType}
                          </p>
                          <div className="flex flex-col gap-2 mt-3">
                            {apt.mechanicName && (
                              <p className="text-xs text-muted-foreground">Mechanic: {apt.mechanicName}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {apt.status === "SCHEDULED" && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => void handleConfirmBooking(apt)}
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Confirm booking
                                </Button>
                              )}
                              {(apt.status === "CONFIRMED" || apt.status === "SCHEDULED") && !apt.jobCardId && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  disabled={creatingJobForId === apt.id}
                                  onClick={() => void createJobFromAppointment(apt)}
                                >
                                  {creatingJobForId === apt.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <ClipboardList className="w-3 h-3 mr-1" />
                                  )}
                                  Create job card
                                </Button>
                              )}
                              {(apt.status === "CONFIRMED" || apt.status === "IN_PROGRESS") && !apt.whatsappSent && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() =>
                                    void sendBookingConfirmationWhatsApp(
                                      apt,
                                      buildReservationConfirmedMessage(apt, businessPayload)
                                    )
                                  }
                                >
                                  <WhatsAppIcon className="w-3.5 h-3.5 mr-1 text-[#25D366]" />
                                  Send WhatsApp
                                </Button>
                              )}
                              {apt.whatsappSent && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3 h-3" /> WhatsApp sent
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-5 outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2 border-b border-border/60 bg-muted/10">
              <CardTitle className="text-base">Upcoming bookings</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Chronological list with status and quick actions.</p>
            </CardHeader>
            <CardContent className="!p-0 divide-y divide-border">
              {upcomingAppointments.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No upcoming appointments</p>
              ) : (
                upcomingAppointments.map((apt) => {
                  const sc = STATUS_COLORS[apt.status];
                  return (
                    <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${sc.bg}`}>
                        <Calendar className={`w-5 h-5 ${sc.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{apt.customerName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                            {apt.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{getAppointmentDisplayId(apt)}</span>
                          {apt.whatsappSent && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> WhatsApp sent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {apt.vehicleRegNumber} &middot; {apt.serviceType}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {apt.status === "SCHEDULED" && (
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => void handleConfirmBooking(apt)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Confirm booking
                          </Button>
                        )}
                        {(apt.status === "CONFIRMED" || apt.status === "SCHEDULED") && !apt.jobCardId && (
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={creatingJobForId === apt.id}
                            onClick={() => void createJobFromAppointment(apt)}
                          >
                            {creatingJobForId === apt.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Create job card
                          </Button>
                        )}
                        {(apt.status === "CONFIRMED" || apt.status === "IN_PROGRESS") && !apt.whatsappSent && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() =>
                              void sendBookingConfirmationWhatsApp(
                                apt,
                                buildReservationConfirmedMessage(apt, businessPayload)
                              )
                            }
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5 text-[#25D366]" />
                            Send WhatsApp
                          </Button>
                        )}
                        <div className="text-right hidden sm:block min-w-[72px]">
                          <p className="text-sm font-medium">{format(parseISO(apt.date), "d MMM")}</p>
                          <p className="text-xs text-muted-foreground">{apt.time}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
