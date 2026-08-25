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
import { referredByFromOptionalInput } from "@/lib/referral-eligibility";
import { NewCustomerReferralCodeField } from "@/components/customers/new-customer-referral-code-field";
import { AddVehicleDialog } from "@/components/vehicles/add-vehicle-dialog";
import { useSettingsStore } from "@/store/settings-store";
import { useBranchStore } from "@/store/branch-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedAppointments } from "@/hooks/use-scoped-data";
import { PageHeader } from "@/components/shared/page-header";
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
  addDays,
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
  Car,
  Search,
  ArrowLeft,
  Info,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { Appointment, AppointmentStatus, Customer, Vehicle, VehicleSegment } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildReservationConfirmedMessage } from "@/lib/appointment-messages";
import { getBookingConfirmationBusiness } from "@/lib/booking-confirmation-message";
import { getNextAppointmentNumber, getAppointmentDisplayId, resolveAppointmentKind } from "@/lib/appointment-ids";
import { convertAppointmentToJobCard } from "@/lib/convert-appointment-to-job";
import { findCatalogServiceForAppointment } from "@/lib/job-from-appointment";
import { useReservationReminders } from "@/hooks/use-reservation-reminders";
import { appointmentIsEditable } from "@/lib/appointment-edit-policy";
import { EditReservationDialog } from "@/components/reservations/edit-reservation-dialog";
import { SearchableServiceSelect } from "@/components/services/searchable-service-select";
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
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import {
  computeCustomerLookupMatches,
  queryLooksLikeVehicleReg,
} from "@/lib/customer-vehicle-lookup";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import { PageSkeleton, RefreshingBar } from "@/components/shared/skeleton-loader";

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
  const storesReady = useDashboardStoresReady();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const addVehicle = useVehicleStore((s) => s.addVehicle);
  const updateVehicle = useVehicleStore((s) => s.updateVehicle);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const findByReferralCode = useCustomerStore((s) => s.findByReferralCode);
  const staff = useStaffStore((s) => s.staff);
  const allScopedAppointments = useScopedAppointments();
  const appointments = allScopedAppointments.filter((a) => resolveAppointmentKind(a) === "APPOINTMENT");
  const jobCards = useJobCardStore((s) => s.jobCards);
  const jobNumberById = useMemo(() => {
    const map = new Map<string, string>();
    for (const jc of jobCards) {
      map.set(jc.id, jc.jobNumber);
    }
    return map;
  }, [jobCards]);
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
  const [editingReservation, setEditingReservation] = useState<Appointment | null>(null);
  const [editReservationOpen, setEditReservationOpen] = useState(false);

  useReservationReminders();

  const [currentStep, setCurrentStep] = useState<"customer" | "vehicle" | "details">("customer");

  const validateCustomerStep = () => {
    if (formCustomerId) return true;
    const name = newCustomerName.trim();
    const phoneDigits = newCustomerPhone.replace(/\D/g, "").slice(-10);
    if (!name) {
      toast.error("Enter customer name");
      return false;
    }
    if (phoneDigits.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return false;
    }
    return true;
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
    if (!reg || !make || !model) {
      toast.error("Enter vehicle registration, make, and model");
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Customer[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerReferralCode, setNewCustomerReferralCode] = useState("");
  const [newVehicleReg, setNewVehicleReg] = useState("");
  const [newVehicleMake, setNewVehicleMake] = useState("");
  const [newVehicleModel, setNewVehicleModel] = useState("");
  const [newVehicleSegment, setNewVehicleSegment] = useState<VehicleSegment>("HATCHBACK");
  const [odometerReading, setOdometerReading] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formVehicleId, setFormVehicleId] = useState("");
  const [addVehicleForExistingCustomerDialogOpen, setAddVehicleForExistingCustomerDialogOpen] = useState(false);
  const [formServiceId, setFormServiceId] = useState("");
  const [formMechanicId, setFormMechanicId] = useState("");
  const [formDate, setFormDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [formTime, setFormTime] = useState("09:00");
  const [formNotes, setFormNotes] = useState("");

  const minCalendarDate = localTodayDateInputMin();
  const timeInputMin = formDate === minCalendarDate ? localTimeInputMinNow() : undefined;

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  // Auto-select tomorrow if today has no appointments but tomorrow does
  useEffect(() => {
    const todayK = format(new Date(), "yyyy-MM-dd");
    const tomorrowDate = addDays(new Date(), 1);
    const tomorrowK = format(tomorrowDate, "yyyy-MM-dd");
    const hasTodayApts = appointments.some((a) => a.date === todayK);
    const hasTomorrowApts = appointments.some((a) => a.date === tomorrowK);
    if (!hasTodayApts && hasTomorrowApts) {
      setSelectedDate(tomorrowDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.length]);

  const vehiclesForCustomer = useMemo(() => {
    if (!formCustomerId) return [];
    return vehicles.filter((v) => v.customerId === formCustomerId);
  }, [formCustomerId, vehicles]);

  const makeOptions = useMemo(() => getBrandNames(), [getBrandNames]);
  const modelOptions = useMemo(
    () => (newVehicleMake ? getModels(newVehicleMake) : []),
    [getModels, newVehicleMake]
  );

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === formCustomerId) ?? null,
    [customers, formCustomerId]
  );

  const hasExistingCustomer = Boolean(selectedExistingCustomer);

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
    setOdometerReading("");
    setLookupPanelCustomers([]);
    setNewCustomerReferralCode("");
  };

  const clearSelectedCustomer = () => {
    setFormCustomerId("");
    setFormVehicleId("");
    setOdometerReading("");
  };

  const resetAppointmentForm = () => {
    setCurrentStep("customer");
    setLookupQuery("");
    setLookupPanelCustomers([]);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setNewCustomerReferralCode("");
    setNewVehicleReg("");
    setNewVehicleMake("");
    setNewVehicleModel("");
    setNewVehicleSegment("HATCHBACK");
    setOdometerReading("");
    setFormCustomerId("");
    setFormVehicleId("");
    setAddVehicleForExistingCustomerDialogOpen(false);
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

    if (hasExistingCustomer) {
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
      const referred = referredByFromOptionalInput(newCustomerReferralCode, findByReferralCode);
      if (referred.error) {
        toast.error(referred.error);
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
          referredBy: referred.referredBy,
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
      const odoParsed = odometerReading.trim()
        ? Number.parseInt(odometerReading, 10)
        : NaN;
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
        ...(Number.isFinite(odoParsed) && odoParsed > 0 ? { odometer: odoParsed } : {}),
      };
      await addVehicle(newVehicle);
      customerId = custId;
      customerName = name;
      customerPhone = newCustomerPhone;
      vehicleId = vehId;
      vehicleRegNumber = reg;
      vehicleMakeModel = `${make} ${model}`;
      customerFirstName = name.split(/\s+/)[0];
    }

    const odoParsedVisit = odometerReading.trim()
      ? Number.parseInt(odometerReading, 10)
      : NaN;
    if (
      hasExistingCustomer &&
      Number.isFinite(odoParsedVisit) &&
      odoParsedVisit > 0 &&
      formVehicleId
    ) {
      await updateVehicle(formVehicleId, { odometer: odoParsedVisit });
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
      odometerReading: odometerReading.trim()
        ? Number.parseInt(odometerReading, 10) || undefined
        : undefined,
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
      router.push(`/job-cards/${job.id}?checkIn=1`);
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
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const todayCount = appointmentsByDate.get(todayKey)?.length ?? 0;
  const scheduledCount = appointments.filter(
    (a) => a.status === "SCHEDULED" && !isAppointmentSlotElapsed(a.date, a.time)
  ).length;
  const tomorrowScheduledCount = appointments.filter(
    (a) => a.status === "SCHEDULED" && a.date === tomorrowKey
  ).length;
  const confirmedCount = appointments.filter(
    (a) => a.status === "CONFIRMED" && !isAppointmentSlotElapsed(a.date, a.time)
  ).length;
  const cancelledCount = appointments.filter(
    (a) => a.status === "CANCELLED" || a.status === "NOT_ATTENDED"
  ).length;

  if (!storesReady && appointments.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-2 sm:space-y-3">
      <RefreshingBar show={!storesReady} />
      <Suspense fallback={null}>
        <AppointmentFromQueryEffect setDialogOpen={setDialogOpen} />
      </Suspense>
      <PageHeader
        title="Appointments"
        inlineActionsOnMobile
        className="mb-1"
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
                {/* Stepper Progress Indicator */}
                <div className="space-y-2 border-b pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Step {currentStep === "customer" ? 1 : currentStep === "vehicle" ? 2 : 3} of 3 —{" "}
                      {currentStep === "customer"
                        ? "Customer Information"
                        : currentStep === "vehicle"
                        ? "Vehicle Details"
                        : "Appointment Details"}
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
                      <Label htmlFor="apt-customer-lookup" className="text-sm font-medium">Search Existing Customer</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="apt-customer-lookup"
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
                            <Label htmlFor="apt-new-name" className="text-xs">Full Name *</Label>
                            <Input
                              id="apt-new-name"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              placeholder="Customer name"
                              autoComplete="name"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="apt-new-phone" className="text-xs">Phone Number *</Label>
                            <Input
                              id="apt-new-phone"
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, "").slice(-10))}
                              placeholder="Phone number"
                              maxLength={10}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="apt-new-email" className="text-xs">Email (Optional)</Label>
                            <Input
                              id="apt-new-email"
                              type="email"
                              value={newCustomerEmail}
                              onChange={(e) => setNewCustomerEmail(e.target.value)}
                              placeholder="Email address"
                              autoComplete="email"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="apt-new-address" className="text-xs">Address (Optional)</Label>
                            <Input
                              id="apt-new-address"
                              value={newCustomerAddress}
                              onChange={(e) => setNewCustomerAddress(e.target.value)}
                              placeholder="City / area"
                              className="h-9"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <NewCustomerReferralCodeField
                              id="apt-new-referral"
                              value={newCustomerReferralCode}
                              onChange={setNewCustomerReferralCode}
                              compact
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAppointmentDialogChange(false)}
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
                            onClick={() => setAddVehicleForExistingCustomerDialogOpen(true)}
                          >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Add New Vehicle
                          </Button>
                        </div>

                        {vehiclesForCustomer.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {vehiclesForCustomer.map((v) => {
                              const isSelected = formVehicleId === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    setFormVehicleId(v.id);
                                    setOdometerReading("");
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
                                          {v.vinNumber ? "VIN" : "Reg"}: {v.registrationNumber}
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

                        {formVehicleId && vehiclesForCustomer.length > 0 && (
                          <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 space-y-1.5">
                            <Label htmlFor="apt-garage-odometer" className="text-sm font-medium">
                              Odometer for this visit (km)
                            </Label>
                            <Input
                              id="apt-garage-odometer"
                              type="number"
                              inputMode="numeric"
                              placeholder="e.g. 45200"
                              value={odometerReading}
                              onChange={(e) => setOdometerReading(e.target.value)}
                              className="h-9 max-w-xs border-input"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                        <p className="text-sm font-semibold">New Vehicle Details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="apt-new-reg" className="text-xs">Registration Number *</Label>
                            <Input
                              id="apt-new-reg"
                              value={newVehicleReg}
                              onChange={(e) => setNewVehicleReg(e.target.value.toUpperCase())}
                              placeholder="e.g. KA01AB1234"
                              maxLength={16}
                              className="font-mono uppercase h-9"
                            />
                            <p className="text-[10px] text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="apt-new-odometer" className="text-xs">
                              Odometer (km)
                            </Label>
                            <Input
                              id="apt-new-odometer"
                              type="number"
                              inputMode="numeric"
                              placeholder="e.g. 45200"
                              value={odometerReading}
                              onChange={(e) => setOdometerReading(e.target.value)}
                              className="h-9 max-w-xs border-input"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="apt-new-seg" className="text-xs">Type</Label>
                            <Select
                              value={newVehicleSegment}
                              onValueChange={(v) => setNewVehicleSegment(v as VehicleSegment)}
                            >
                              <SelectTrigger id="apt-new-seg" className="h-9">
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
                          <div className="space-y-1.5">
                            <Label htmlFor="apt-new-make" className="text-xs">Make *</Label>
                            <Select
                              value={newVehicleMake || undefined}
                              onValueChange={(value) => {
                                setNewVehicleMake(value);
                                setNewVehicleModel("");
                              }}
                            >
                              <SelectTrigger id="apt-new-make" className="h-9">
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
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="apt-new-model" className="text-xs">Model *</Label>
                            <Select
                              value={newVehicleModel || undefined}
                              onValueChange={(value) => {
                                setNewVehicleModel(value);
                                const inferredSegment = getModelSegment(newVehicleMake, value);
                                if (inferredSegment) {
                                  setNewVehicleSegment(inferredSegment);
                                }
                              }}
                              disabled={!newVehicleMake}
                            >
                              <SelectTrigger id="apt-new-model" className="h-9">
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
                    )}

                    <AddVehicleDialog
                      open={addVehicleForExistingCustomerDialogOpen}
                      onOpenChange={setAddVehicleForExistingCustomerDialogOpen}
                      lockedCustomerId={formCustomerId}
                      title="Add New Vehicle"
                      onCreated={(vehicle) => {
                        setFormVehicleId(vehicle.id);
                        setOdometerReading("");
                      }}
                    />

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

                {/* STEP 3: Appointment Details */}
                {currentStep === "details" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="apt-service">Service</Label>
                        <SearchableServiceSelect
                          id="apt-service"
                          required
                          value={formServiceId}
                          onChange={setFormServiceId}
                          services={catalog}
                        />
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
                          className="date-input-icon-end pr-9"
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
                          className="date-input-icon-end pr-9"
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

                    <div className="flex justify-between pt-3 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep("vehicle")}
                      >
                        Back
                      </Button>
                      <Button type="submit">Schedule</Button>
                    </div>
                  </div>
                )}
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-4 gap-2">
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
          subtitle={tomorrowScheduledCount > 0 ? `${tomorrowScheduledCount} tomorrow` : undefined}
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
        <CardHeader className="border-b border-border/70 bg-muted/20 px-4 py-2 sm:px-6">
          <CardTitle className="text-sm">Booking workspace</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-2 sm:px-4">
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start rounded-none border-0 border-b border-border/70 bg-transparent p-0 h-auto gap-0 mb-1">
          <TabsTrigger
            value="calendar"
            className={cn(
              "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2 gap-2 text-muted-foreground text-xs",
              "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
              "dark:data-[state=active]:text-emerald-400"
            )}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            Calendar
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className={cn(
              "rounded-none border-b-2 border-transparent bg-transparent shadow-none px-3 py-2 gap-2 text-muted-foreground text-xs",
              "data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 data-[state=active]:bg-transparent",
              "dark:data-[state=active]:text-emerald-400"
            )}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            List view
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-2 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <Card className="lg:col-span-2 shadow-none border-border/60">
              <CardHeader className="pb-1 pt-2 px-3">
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
              <CardContent className="px-2 pb-2 pt-1">
                <div className="grid grid-cols-7 gap-px">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{d}</div>
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
                        className={`relative flex flex-col items-center justify-start p-0.5 min-h-[30px] sm:min-h-[36px] rounded-md transition-colors
                          ${!inMonth ? "text-muted-foreground/40" : ""}
                          ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}
                          ${isCurrent && !isSelected ? "bg-accent" : ""}
                        `}
                      >
                        <span className={`text-[11px] font-medium leading-tight ${isCurrent ? "text-primary font-bold" : ""}`}>
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
                          {apt.jobCardId ? (
                            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                              Job Card: {jobNumberById.get(apt.jobCardId) ?? apt.jobCardId}
                            </p>
                          ) : null}
                          <div className="flex flex-col gap-2 mt-3">
                            {apt.mechanicName && (
                              <p className="text-xs text-muted-foreground">Mechanic: {apt.mechanicName}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {appointmentIsEditable(apt) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    setEditingReservation(apt);
                                    setEditReservationOpen(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              )}
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
                          {apt.jobCardId ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              Job Card: {jobNumberById.get(apt.jobCardId) ?? apt.jobCardId}
                            </span>
                          ) : null}
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
                        {appointmentIsEditable(apt) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                              setEditingReservation(apt);
                              setEditReservationOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                        )}
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
      <EditReservationDialog
        appointment={editingReservation}
        open={editReservationOpen}
        onOpenChange={(open) => {
          setEditReservationOpen(open);
          if (!open) setEditingReservation(null);
        }}
      />
    </div>
  );
}
