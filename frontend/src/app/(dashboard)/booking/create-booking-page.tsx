"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { buildJobCardCustomerWhatsAppMessage, appendAdvanceAckToJobMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import { uploadJobInspectionPhoto, INSPECTION_PHOTO_MAX_BYTES } from "@/lib/job-card-inspection-photo-upload";
import { notifyMembershipWelcomeWhatsApp } from "@/lib/whatsapp-automation-triggers";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Car,
  Search,
  Sparkles,
  Crown,
  Ticket,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  TrendingUp,
  Info,
  Plus,
  Check,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  X,
  Calendar,
  Banknote,
  Percent,
  Wrench,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerCreditCheckDialog } from "@/components/job-cards/customer-credit-check-dialog";
import { AddAddonDialog } from "@/components/services/add-addon-dialog";
import { AddServicePackageDialog } from "@/components/services/add-service-package-dialog";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { useAuthStore } from "@/store/auth-store";
import { useBranchStore } from "@/store/branch-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useStaffStore } from "@/store/staff-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { useHighEndServiceStore } from "@/store/high-end-service-store";
import { useWalletStore } from "@/store/wallet-store";
import { useSettingsStore } from "@/store/settings-store";
import { useMembershipStore, MEMBERSHIP_TIER_DAYS } from "@/store/membership-store";
import { isAllBranchesScope } from "@/lib/all-branches";
import { formatCurrency, cn } from "@/lib/utils";
import {
  INDIAN_VEHICLE_REG_HINT,
  findVehicleByNormalizedReg,
  isValidIndianVehicleRegistration,
  normalizeRegistrationNumber,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import {
  isDatetimeLocalInPast,
  localDatetimeLocalInputMin,
  localTodayDateInputMin,
  localTimeInputMinNow,
} from "@/lib/booking-calendar-validation";
import { pushActivityLog } from "@/lib/activity-log-helper";
import {
  defaultManualFirstFollowUpMonths,
  HIGH_END_COMPLETION_PRESETS,
  highEndCompletionSelectValue,
} from "@/lib/high-end-follow-up";
import { formatServiceDurationLabel } from "@/lib/service-duration";
import type {
  Customer,
  Vehicle,
  VehicleSegment,
  ServiceCatalogItem,
  InspectionPhoto,
  MembershipTier,
  MembershipServiceUsage,
  JobCard,
} from "@/types";

const GST_RATE = 0.18;

/** When booking opts into pickup, mirror into Pickup & Drop operations list. */
function queuePickupDropFromBooking(params: {
  job: Pick<
    JobCard,
    | "id"
    | "jobNumber"
    | "branchId"
    | "customerName"
    | "customerPhone"
    | "vehicleMakeModel"
    | "vehicleRegNumber"
    | "expectedDelivery"
  >;
  customerAddress: string;
  branches: { id: string; name: string; address: string }[];
}) {
  const { job, customerAddress, branches } = params;
  const br = branches.find((b) => b.id === job.branchId);
  const workshop = br ? `${br.name} — ${br.address}` : job.branchId;
  const address =
    customerAddress.trim() ||
    `Pickup address pending — confirm with customer · Workshop: ${workshop}`;
  usePickupDropStore.getState().addRequest({
    jobCardId: job.id,
    jobNumber: job.jobNumber,
    branchId: job.branchId,
    customerName: job.customerName,
    vehicleMakeModel: job.vehicleMakeModel,
    vehicleRegNumber: job.vehicleRegNumber,
    customerPhone: job.customerPhone,
    address,
    scheduledTime: job.expectedDelivery,
    type: "PICKUP",
    notes: "Created from booking wizard",
  });
}
/** Must match seeded `serviceCatalog` main rows (`srv-001` … `srv-005` in prisma/seed). */
const TRENDING_IDS = ["srv-001", "srv-002", "srv-003", "srv-004", "srv-005"];
/** Quick-pick add-ons in the optional section (`srv-a01` … `srv-a05` in seed). */
const ADDON_IDS_PREFERRED = ["srv-a01", "srv-a02", "srv-a03", "srv-a04", "srv-a05"];

function segmentBannerLabel(seg: VehicleSegment | ""): string {
  if (!seg) return "vehicle";
  if (seg === "BIKE") return "bike";
  return seg.replace(/_/g, " ").toLowerCase();
}

function priceForService(s: ServiceCatalogItem, seg: VehicleSegment | ""): number {
  if (!seg) return s.defaultPrice;
  const key = seg as keyof ServiceCatalogItem["segmentPricing"];
  return s.segmentPricing[key] ?? s.defaultPrice;
}

const SERVICE_TYPE_PRIMARY: {
  segment: VehicleSegment;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { segment: "HATCHBACK", label: "Hatchback", hint: "Small cars", icon: "🚗" },
  { segment: "SEDAN", label: "Sedan", hint: "Mid-size", icon: "🚙" },
  { segment: "SUV", label: "SUV", hint: "Large", icon: "🚐" },
  { segment: "BIKE", label: "Bike", hint: "Two-wheeler", icon: "🏍️" },
];

const OTHER_PRICING_SEGMENTS: { segment: VehicleSegment; label: string; hint: string }[] = [
  { segment: "COMPACT_SUV", label: "Compact SUV", hint: "Crossover" },
  { segment: "LUXURY", label: "Luxury", hint: "Premium" },
  { segment: "MUV", label: "MUV", hint: "People carrier" },
];

function datetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatHighEndIntervalMonths(m: number): string {
  return m >= 12 ? `${m / 12}yr` : `${m}mo`;
}

/** Split `YYYY-MM-DDTHH:mm` for narrow layouts (native datetime-local popover is often too wide on mobile). */
function splitDatetimeLocal(value: string): { date: string; time: string } {
  const t = value.trim();
  if (!t) return { date: "", time: "12:00" };
  const [d, rest] = t.split("T");
  const timeSeg = rest?.slice(0, 5) ?? "12:00";
  return {
    date: d ?? "",
    time: /^\d{2}:\d{2}$/.test(timeSeg) ? timeSeg : "12:00",
  };
}

function joinDatetimeLocal(date: string, time: string): string {
  const d = date.trim();
  if (!d) return "";
  const tm = time.trim() && /^\d{2}:\d{2}$/.test(time.trim()) ? time.trim() : "12:00";
  return `${d}T${tm}`;
}

function membershipTierLabel(tier: MembershipTier): string {
  switch (tier) {
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "HALF_YEARLY":
      return "Half-yearly";
    case "YEARLY":
      return "Yearly";
    default:
      return tier;
  }
}

/** Pin native date/time picker icons to the trailing edge on mobile WebKit/Chromium. */
const MOBILE_DATE_TIME_INPUT_ICON_END =
  "relative pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100";

type JobWizardStepId =
  | "customer"
  | "vehicle"
  | "schedule"
  | "smartSuggestions"
  | "membership"
  | "serviceSelection"
  | "highEndServices"
  | "addons"
  | "pickupDrop"
  | "mechanic"
  | "notes"
  | "notesAndJobDetails"
  | "jobDetails"
  | "jobSummary";

const JOB_WIZARD_LABEL: Record<JobWizardStepId, string> = {
  customer: "Customer",
  vehicle: "Vehicle details",
  schedule: "Schedule",
  smartSuggestions: "Smart suggestions",
  membership: "Membership",
  serviceSelection: "Service selection",
  highEndServices: "High-end services",
  addons: "Add-ons",
  pickupDrop: "Pickup & drop",
  mechanic: "Mechanic",
  notes: "Notes",
  notesAndJobDetails: "Notes & job details",
  jobDetails: "Job details",
  jobSummary: "Review & create",
};

export type CreateBookingVariant = "walk-in" | "job-card";

export function CreateBookingPage({ variant }: { variant: CreateBookingVariant }) {
  const isWalkIn = variant === "walk-in";
  const isJobCard = variant === "job-card";
  /** Shared stepped flow, summary panel, dialog on smaller viewports */
  const useBookingWizard = isJobCard || isWalkIn;
  const router = useRouter();
  /** Prevents create flow dialog `onOpenChange` from navigating away when we already route to `/job-cards/[id]`. */
  const skipJobCardListRedirectRef = useRef(false);
  const navigateToCreatedJobCard = useCallback((jobId: string) => {
    skipJobCardListRedirectRef.current = true;
    router.replace(`/job-cards/${jobId}`);
  }, [router]);

  const sendJobCardCreatedWhatsApp = useCallback(async (job: JobCard) => {
    const phone = job.customerPhone?.trim();
    if (!phone) return;
    const message = appendAdvanceAckToJobMessage(buildJobCardCustomerWhatsAppMessage(job), job);
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title:
          channel === "api" ? "Job created — WhatsApp sent" : "Job created — WhatsApp composer",
        message: `${job.jobNumber} → ${phone}`,
        href: `/job-cards/${job.id}`,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("WhatsApp sent to customer", { description: phone });
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
  }, []);

  const jobCards = useJobCardStore((s) => s.jobCards);
  const { addJobCard, getNextJobNumber, updateJobCard } = useJobCardStore();
  const { services: highEndServices } = useHighEndServiceStore();
  const { addTransaction } = useWalletStore();
  const { referralRewardAmount, newCustomerDiscount, businessName } = useSettingsStore();
  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const {
    addCustomer,
    updateCustomer,
    findByPhone,
    findByEmail,
    findByReferralCode,
    creditWallet,
    customers,
  } = useCustomerStore();
  const membershipPackagesAll = useMembershipStore((s) => s.packages);
  const membershipSubscriptions = useMembershipStore((s) => s.subscriptions);
  const getActiveMembership = useMembershipStore((s) => s.getActiveMembership);
  const subscriptionEffectiveStatus = useMembershipStore((s) => s.subscriptionEffectiveStatus);
  const getUsedIncludedServiceIds = useMembershipStore((s) => s.getUsedIncludedServiceIds);
  const recordMembershipUsages = useMembershipStore((s) => s.recordMembershipUsages);
  const assignMembership = useMembershipStore((s) => s.assignMembership);
  const activeMembershipPackages = useMemo(
    () =>
      [...membershipPackagesAll.filter((p) => p.isActive)].sort((a, b) => a.price - b.price),
    [membershipPackagesAll]
  );
  const user = useAuthStore((s) => s.user);
  const currentBranch = useAuthStore((s) => s.currentBranch);
  const branches = useBranchStore((s) => s.branches);
  const activeBranches = useMemo(() => branches.filter((b) => b.isActive), [branches]);
  const staff = useStaffStore((s) => s.staff);
  const mechanics = useMemo(() => staff.filter((s) => s.role === "MECHANIC"), [staff]);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();
  const brandNames = useMemo(() => getBrandNames(), [getBrandNames]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [customerCreditDialogOpen, setCustomerCreditDialogOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleSegment, setVehicleSegment] = useState<VehicleSegment | "">("");
  const [bookingWhen, setBookingWhen] = useState(() => datetimeLocalValue(new Date()));
  const bookingScheduleDateMin = localTodayDateInputMin();
  const bookingScheduleSplit = splitDatetimeLocal(bookingWhen);
  const bookingScheduleTimeMin =
    bookingScheduleSplit.date === bookingScheduleDateMin
      ? localTimeInputMinNow()
      : undefined;
  const [selectedMainIds, setSelectedMainIds] = useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [mechanicId, setMechanicId] = useState("");
  /** Empty = use catalog average; otherwise custom % of job estimate for incentive on this card. */
  const [mechanicIncentivePercentOverride, setMechanicIncentivePercentOverride] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [pickupRequired, setPickupRequired] = useState(false);
  const [showPickup, setShowPickup] = useState(true);
  const [showAddons, setShowAddons] = useState(true);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addServicePackageOpen, setAddServicePackageOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [lookupPanelCustomers, setLookupPanelCustomers] = useState<Customer[] | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [addingNewVehicle, setAddingNewVehicle] = useState(false);
  /** When adding a vehicle for an existing customer with a garage, form opens in a dialog */
  const [addVehiclePopupOpen, setAddVehiclePopupOpen] = useState(false);
  const skipAddVehicleCancelOnCloseRef = useRef(false);
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModelsByBrand, setExtraModelsByBrand] = useState<Record<string, string[]>>({});
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");
  const [pricingService, setPricingService] = useState<ServiceCatalogItem | null>(null);
  const serviceSearchInputRef = useRef<HTMLInputElement>(null);
  const addonsCardRef = useRef<HTMLDivElement>(null);
  const scheduleDateInputRef = useRef<HTMLInputElement>(null);
  const prevMatchRef = useRef<string | null>(null);

  const [reportedIssues, setReportedIssues] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "Vehicle will be kept in secure parking. Not responsible for valuables left in vehicle. Warranty: 30 days on parts replaced."
  );
  const [selectedHighEndIds, setSelectedHighEndIds] = useState<string[]>([]);
  const [highEndFirstFollowUpById, setHighEndFirstFollowUpById] = useState<Record<string, number>>({});
  /** Planned completion time (minutes) per selected high-end program. */
  const [highEndCompletionMinutesById, setHighEndCompletionMinutesById] = useState<
    Record<string, number>
  >({});
  /** Optional advance amount (₹, incl. GST cap) saved on the job card when creating. */
  const [advanceAmountInput, setAdvanceAmountInput] = useState("");
  const [referrerInfo, setReferrerInfo] = useState<{ id: string; name: string } | null>(null);
  const [referralError, setReferralError] = useState(false);
  /** When set, membership is activated for the customer when the booking / job card is submitted. */
  const [wizardMembershipPackageId, setWizardMembershipPackageId] = useState<string | null>(null);
  /** For an existing vehicle-scoped pass: whether this visit uses included services (Yes) or normal booking (No). */
  const [membershipVisitChoice, setMembershipVisitChoice] = useState<null | "yes" | "no">(null);
  /** Included catalog service ids redeemed on this job at ₹0 (subset of package; must match selectedMainIds when Yes). */
  const [membershipRedeemServiceIds, setMembershipRedeemServiceIds] = useState<string[]>([]);
  const [membershipServicesDialogOpen, setMembershipServicesDialogOpen] = useState(false);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInJob, setCheckInJob] = useState<{
    id: string;
    jobNumber: string;
    customerName: string;
    vehicleRegLabel: string;
  } | null>(null);
  const [checkInReportedIssuesBase, setCheckInReportedIssuesBase] = useState("");
  const [checkInNotesBase, setCheckInNotesBase] = useState("");
  const [checkInDamages, setCheckInDamages] = useState("");
  const [checkInNotesExtra, setCheckInNotesExtra] = useState("");
  const [checkInPhotos, setCheckInPhotos] = useState<
    { id: string; file: File; previewUrl: string; label: string }[]
  >([]);
  const [checkInPhotoError, setCheckInPhotoError] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const checkInFileRef = useRef<HTMLInputElement>(null);
  const checkInCameraRef = useRef<HTMLInputElement>(null);
  const checkInJobIdRef = useRef<string | null>(null);

  const [jobCreateStep, setJobCreateStep] = useState(0);
  const [isDesktopWide, setIsDesktopWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktopWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Desktop wizard: fit dashboard main without page scroll; compact density */
  const compactJobCardDesktop = useBookingWizard && isDesktopWide;
  /** Wizard: denser customer step on all breakpoints to reduce scroll */
  const compactCustomerStep = useBookingWizard;

  useEffect(() => {
    if (branchId) return;
    if (currentBranch && !isAllBranchesScope(currentBranch)) {
      setBranchId(currentBranch.id);
      return;
    }
    if (user?.branchId) setBranchId(user.branchId);
    else if (activeBranches[0]) setBranchId(activeBranches[0].id);
  }, [branchId, currentBranch, user?.branchId, activeBranches]);

  useEffect(() => {
    if (!isJobCard) return;
    const code = referralCode.trim();
    if (!code) {
      setReferrerInfo(null);
      setReferralError(false);
      return;
    }
    const referrer = findByReferralCode(code);
    if (referrer) {
      setReferrerInfo({ id: referrer.id, name: referrer.name });
      setReferralError(false);
    } else {
      setReferrerInfo(null);
      setReferralError(true);
    }
  }, [referralCode, isJobCard, findByReferralCode]);

  useEffect(() => {
    setWizardMembershipPackageId(null);
  }, [existingCustomerId]);

  useEffect(() => {
    setHighEndCompletionMinutesById((prev) => {
      const allowed = new Set(selectedHighEndIds);
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (!allowed.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedHighEndIds]);

  const brandModels = useMemo(
    () => (vehicleBrand ? getModels(vehicleBrand) : []),
    [vehicleBrand, getModels]
  );

  const allBrandsSorted = useMemo(
    () => [...new Set([...brandNames, ...extraBrands])].sort((a, b) => a.localeCompare(b)),
    [brandNames, extraBrands]
  );

  const allModelsSorted = useMemo(() => {
    const catalog = brandModels.map((m) => m.name);
    const extra = vehicleBrand ? extraModelsByBrand[vehicleBrand] ?? [] : [];
    return [...new Set([...catalog, ...extra])].sort((a, b) => a.localeCompare(b));
  }, [brandModels, vehicleBrand, extraModelsByBrand]);

  const emailLooks =
    (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "").slice(-10);
    const emailTrim = customerEmail.trim();
    let found = digits.length === 10 ? findByPhone(customerPhone) : undefined;
    if (!found && emailLooks(emailTrim)) found = findByEmail(emailTrim);
    if (!found) {
      prevMatchRef.current = null;
      setExistingCustomerId(null);
      setSelectedVehicleId(null);
      if (isJobCard) setCustomerCreditDialogOpen(false);
      return;
    }
    if (prevMatchRef.current === found.id) {
      setExistingCustomerId(found.id);
      return;
    }
    prevMatchRef.current = found.id;
    setExistingCustomerId(found.id);
    setCustomerName(found.name);
    const p10 = found.phone.replace(/\D/g, "").slice(-10);
    if (p10.length === 10) setCustomerPhone(p10);
    setCustomerEmail(found.email || "");
    setCustomerAddress(found.address || "");
    const owned = vehicles.filter((v) => v.customerId === found.id);
    if (owned.length > 0) {
      const v = [...owned].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))[0];
      setSelectedVehicleId(v.id);
      setAddingNewVehicle(false);
      setVehicleNumber(v.registrationNumber);
      const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
      setVehicleBrand(rb);
      setVehicleModel(v.model);
      setVehicleSegment(v.segment);
    } else {
      setSelectedVehicleId(null);
    }
    if (isJobCard) setCustomerCreditDialogOpen(true);
  }, [customerPhone, customerEmail, findByPhone, findByEmail, brandNames, vehicles, isJobCard]);

  const applySelectedCustomer = (c: Customer) => {
    prevMatchRef.current = c.id;
    setExistingCustomerId(c.id);
    setCustomerName(c.name);
    const p10 = c.phone.replace(/\D/g, "").slice(-10);
    if (p10.length === 10) setCustomerPhone(p10);
    setCustomerEmail(c.email || "");
    setCustomerAddress(c.address || "");
    const owned = vehicles.filter((v) => v.customerId === c.id);
    if (owned.length > 0) {
      const v = [...owned].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))[0];
      setSelectedVehicleId(v.id);
      setAddingNewVehicle(false);
      setVehicleNumber(v.registrationNumber);
      const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
      setVehicleBrand(rb);
      setVehicleModel(v.model);
      setVehicleSegment(v.segment);
    } else {
      setSelectedVehicleId(null);
      setAddingNewVehicle(true);
    }
    setLookupPanelCustomers(null);
    setLookupQuery("");
    toast.success("Customer selected", { description: c.name });
    if (isJobCard) setCustomerCreditDialogOpen(true);
  };

  const cancelLookup = () => {
    setLookupPanelCustomers(null);
  };

  const computeLookupMatches = useCallback(
    (qRaw: string): Customer[] => {
      const q = qRaw.trim();
      if (!q) return [];
      const ql = q.toLowerCase();
      const digits = q.replace(/\D/g, "");
      const compactDigitOnly = /^\d+$/.test(q.replace(/\s/g, ""));
      const matches: Customer[] = [];
      const seen = new Set<string>();
      const push = (cust: Customer | undefined) => {
        if (!cust || seen.has(cust.id)) return;
        seen.add(cust.id);
        matches.push(cust);
      };

      if (digits.length >= 10) {
        push(findByPhone(digits.slice(-10)));
      } else if (compactDigitOnly && digits.length >= 4 && digits.length < 10) {
        for (const c of customers) {
          if (c.phone.replace(/\D/g, "").includes(digits)) push(c);
        }
      }

      const hasLetters = /[a-zA-Z]/.test(q);
      if (hasLetters && ql.length >= 2) {
        for (const c of customers) {
          if (c.name.toLowerCase().includes(ql)) push(c);
        }
      }

      const regSan = sanitizeVehicleRegistrationInput(q);
      const regNorm = normalizeRegistrationNumber(regSan);
      const regSearch =
        regNorm.length >= 3 || (hasLetters && regSan.replace(/\s/g, "").length >= 2);
      if (regSearch) {
        for (const v of vehicles) {
          const vn = normalizeRegistrationNumber(v.registrationNumber);
          const hitReg =
            (regNorm.length >= 3 && vn.includes(regNorm)) ||
            v.registrationNumber.toLowerCase().includes(ql);
          if (hitReg) push(customers.find((x) => x.id === v.customerId));
        }
      }

      return matches.slice(0, 15);
    },
    [customers, vehicles, findByPhone]
  );

  useEffect(() => {
    const trimmed = lookupQuery.trim();
    if (!trimmed) {
      setLookupPanelCustomers(null);
      return;
    }
    const id = window.setTimeout(() => {
      const limited = computeLookupMatches(lookupQuery);
      setLookupPanelCustomers(limited.length > 0 ? limited : null);
    }, 280);
    return () => clearTimeout(id);
  }, [lookupQuery, computeLookupMatches]);

  /** Copy search into phone/reg for new customers; clear selection when search no longer matches selected customer. */
  useEffect(() => {
    const q = lookupQuery.trim();
    const digits = q.replace(/\D/g, "");
    const hasLetter = /[a-zA-Z]/i.test(q);
    const ql = q.toLowerCase();

    let canSyncFromLookup = !existingCustomerId;

    if (existingCustomerId && q.length > 0) {
      const cust = customers.find((c) => c.id === existingCustomerId);
      if (cust) {
        const owned = vehicles.filter((v) => v.customerId === existingCustomerId);
        const p10 = cust.phone.replace(/\D/g, "").slice(-10);

        let stillMatches = false;
        if (!hasLetter) {
          if (digits.length === 0) stillMatches = true;
          else if (digits.length < 10) stillMatches = true;
          else stillMatches = digits.slice(-10) === p10;
        } else {
          if (ql.length >= 2 && cust.name.toLowerCase().includes(ql)) stillMatches = true;
          else {
            const regSan = sanitizeVehicleRegistrationInput(q);
            const regCompact = normalizeRegistrationNumber(regSan).replace(/-/g, "");
            if (hasLetter && /\d/.test(q) && regCompact.length >= 6) {
              stillMatches = owned.some((v) =>
                normalizeRegistrationNumber(v.registrationNumber).includes(regCompact)
              );
            } else if (ql.length < 2) stillMatches = true;
          }
        }

        if (!stillMatches) {
          prevMatchRef.current = null;
          setExistingCustomerId(null);
          setCustomerName("");
          setCustomerEmail("");
          setCustomerAddress("");
          setSelectedVehicleId(null);
          setAddingNewVehicle(false);
          setVehicleNumber("");
          setVehicleBrand("");
          setVehicleModel("");
          setVehicleSegment("");
          canSyncFromLookup = true;
        }
      }
    }

    if (!canSyncFromLookup) return;
    if (!q) return;

    const regSan = sanitizeVehicleRegistrationInput(q);
    const regCompact = normalizeRegistrationNumber(regSan).replace(/-/g, "");
    const looksLikePlate =
      hasLetter && /\d/.test(q) && regCompact.length >= 6;

    if (looksLikePlate) {
      setVehicleNumber((prev) => (prev === regSan ? prev : regSan));
      return;
    }

    if (!hasLetter && digits.length >= 10) {
      const p10 = digits.slice(-10);
      setCustomerPhone((prev) => (prev === p10 ? prev : p10));
    } else if (!hasLetter && digits.length > 0 && digits.length < 10) {
      setCustomerPhone((prev) => (prev === "" ? digits : prev));
    }
  }, [lookupQuery, existingCustomerId, customers, vehicles]);

  const selectVehicleFromGarage = (v: Vehicle) => {
    setSelectedVehicleId(v.id);
    setAddingNewVehicle(false);
    setAddVehiclePopupOpen(false);
    setVehicleNumber(v.registrationNumber);
    const rb = brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
    setVehicleBrand(rb);
    setVehicleModel(v.model);
    setVehicleSegment(v.segment);
  };

  const startAddNewVehicle = () => {
    setAddingNewVehicle(true);
    setSelectedVehicleId(null);
    setVehicleNumber("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleSegment("");
    setAddVehiclePopupOpen(true);
  };

  const cancelAddVehicleFromPopup = () => {
    setAddVehiclePopupOpen(false);
    setAddingNewVehicle(false);
    setVehicleNumber("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleSegment("");
  };

  const doneAddVehiclePopup = () => {
    if (!existingCustomerId) {
      toast.error("Select a customer first.");
      return;
    }
    const brandTrim = vehicleBrand.trim();
    const modelTrim = vehicleModel.trim();
    if (!vehicleNumber.trim() || !brandTrim || !modelTrim) {
      toast.error("Registration, brand, and model are required.");
      return;
    }
    if (!isValidIndianVehicleRegistration(vehicleNumber)) {
      toast.error("Invalid registration", { description: INDIAN_VEHICLE_REG_HINT });
      return;
    }
    const regStored = normalizeRegistrationNumber(vehicleNumber);
    const dup = findVehicleByNormalizedReg(vehicles, vehicleNumber);
    if (dup) {
      if (dup.customerId === existingCustomerId) {
        skipAddVehicleCancelOnCloseRef.current = true;
        selectVehicleFromGarage(dup);
        return;
      }
      toast.error("Registration belongs to another customer", {
        description: `${dup.registrationNumber} — ${dup.customerName}`,
      });
      return;
    }
    const cust = customers.find((c) => c.id === existingCustomerId);
    const inferredSeg = getModelSegment(vehicleBrand, vehicleModel);
    const seg: VehicleSegment = inferredSeg ?? "HATCHBACK";
    const rb = brandNames.find((b) => b.toLowerCase() === brandTrim.toLowerCase()) ?? brandTrim;
    const newId = `veh-${Date.now()}`;
    const newVehicle: Vehicle = {
      id: newId,
      customerId: existingCustomerId,
      customerName: (cust?.name ?? customerName).trim(),
      registrationNumber: regStored,
      make: rb,
      model: modelTrim,
      segment: seg,
      fuelType: "PETROL",
      color: "—",
      year: new Date().getFullYear(),
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    setVehicleBrand(rb);
    setVehicleModel(modelTrim);
    setVehicleNumber(regStored);
    setVehicleSegment(seg);
    setSelectedVehicleId(newId);
    setAddingNewVehicle(false);
    skipAddVehicleCancelOnCloseRef.current = true;
    setAddVehiclePopupOpen(false);
    toast.success("Vehicle saved", { description: "It appears in your garage above." });
  };

  const categories = useMemo(() => {
    const s = new Set<string>();
    serviceCatalog.filter((x) => x.isActive).forEach((x) => s.add(x.category));
    return ["ALL", ...Array.from(s).sort()];
  }, [serviceCatalog]);

  const filteredMainServices = useMemo(() => {
    return serviceCatalog.filter((s) => {
      if (!s.isActive) return false;
      if (s.isAddon) return false;
      if (categoryFilter !== "ALL" && s.category !== categoryFilter) return false;
      if (serviceSearch.trim()) {
        const q = serviceSearch.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [serviceCatalog, categoryFilter, serviceSearch]);

  const addonServices = useMemo(
    () =>
      serviceCatalog.filter(
        (s) =>
          s.isActive &&
          (ADDON_IDS_PREFERRED.includes(s.id) || s.isAddon === true)
      ),
    [serviceCatalog]
  );

  const trendingServices = useMemo(
    () =>
      TRENDING_IDS.map((id) => serviceCatalog.find((s) => s.id === id)).filter(
        Boolean
      ) as ServiceCatalogItem[],
    [serviceCatalog]
  );

  const ownedVehicles = useMemo(() => {
    if (!existingCustomerId) return [];
    return vehicles.filter((v) => v.customerId === existingCustomerId);
  }, [existingCustomerId, vehicles]);

  const vehiclesWithActiveMembership = useMemo(() => {
    if (!existingCustomerId) return [];
    return ownedVehicles.filter((v) => getActiveMembership(existingCustomerId, v.id) != null);
  }, [existingCustomerId, ownedVehicles, getActiveMembership]);

  /**
   * Garage vehicle for membership: explicit garage selection, or the owned vehicle whose plate matches
   * the registration field (so the Membership step works after the inline vehicle step without clicking garage).
   */
  const membershipLookupVehicleId = useMemo(() => {
    if (!existingCustomerId) return null;
    if (selectedVehicleId) return selectedVehicleId;
    const reg = normalizeRegistrationNumber(sanitizeVehicleRegistrationInput(vehicleNumber));
    if (!reg) return null;
    const match = ownedVehicles.find(
      (v) => normalizeRegistrationNumber(v.registrationNumber) === reg
    );
    return match?.id ?? null;
  }, [existingCustomerId, selectedVehicleId, vehicleNumber, ownedVehicles]);

  const activeMembershipForSelectedVehicle = useMemo(() => {
    if (!existingCustomerId) return undefined;
    if (membershipLookupVehicleId) {
      return getActiveMembership(existingCustomerId, membershipLookupVehicleId);
    }
    return membershipSubscriptions.find(
      (s) =>
        s.customerId === existingCustomerId &&
        !s.vehicleId &&
        subscriptionEffectiveStatus(s) === "ACTIVE"
    );
  }, [
    existingCustomerId,
    membershipLookupVehicleId,
    getActiveMembership,
    membershipSubscriptions,
    subscriptionEffectiveStatus,
  ]);

  useEffect(() => {
    if (activeMembershipForSelectedVehicle) setWizardMembershipPackageId(null);
  }, [activeMembershipForSelectedVehicle]);

  useEffect(() => {
    setMembershipVisitChoice(null);
    setMembershipRedeemServiceIds([]);
  }, [existingCustomerId, selectedVehicleId, membershipLookupVehicleId, activeMembershipForSelectedVehicle?.id]);

  useEffect(() => {
    if (membershipVisitChoice !== "yes") return;
    setSelectedMainIds(membershipRedeemServiceIds);
  }, [membershipVisitChoice, membershipRedeemServiceIds]);

  const activeMembershipPackageRow = useMemo(
    () =>
      activeMembershipForSelectedVehicle
        ? membershipPackagesAll.find((p) => p.id === activeMembershipForSelectedVehicle.packageId)
        : undefined,
    [activeMembershipForSelectedVehicle, membershipPackagesAll]
  );

  const redeemingMembershipVisit = Boolean(
    activeMembershipForSelectedVehicle && membershipVisitChoice === "yes"
  );

  const summaryMembershipLabel = useMemo(() => {
    if (activeMembershipForSelectedVehicle && activeMembershipPackageRow) {
      let base = `${activeMembershipPackageRow.name} (active)`;
      if (membershipVisitChoice === "yes") {
        base +=
          membershipRedeemServiceIds.length > 0
            ? ` · redeeming ${membershipRedeemServiceIds.length} included service(s)`
            : " · add-ons only (included services not used)";
      } else if (membershipVisitChoice === "no") {
        base += " · not used this visit";
      }
      return base;
    }
    if (wizardMembershipPackageId) {
      const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
      return pkg ? `${pkg.name} (with this job)` : "—";
    }
    return "None";
  }, [
    activeMembershipForSelectedVehicle,
    activeMembershipPackageRow,
    wizardMembershipPackageId,
    membershipVisitChoice,
    membershipRedeemServiceIds.length,
    membershipPackagesAll,
  ]);

  const showVehicleDetailsForm =
    !existingCustomerId || addingNewVehicle || ownedVehicles.length === 0;

  /** Garage + "Add New Vehicle" uses a popup; other cases keep the form inline in the card */
  const showInlineVehicleDetailsForm =
    showVehicleDetailsForm &&
    !(existingCustomerId && ownedVehicles.length > 0 && addingNewVehicle);

  const previousBooked = useMemo(() => {
    if (!existingCustomerId) return [];
    const map = new Map<string, { id: string; name: string; tag: string; count: number }>();
    for (const jc of jobCards) {
      if (jc.customerId !== existingCustomerId) continue;
      for (const si of jc.services) {
        const cat = serviceCatalog.find((c) => c.id === si.serviceCatalogId);
        const tag =
          cat?.category?.split(/[\s/&]/)[0]?.slice(0, 14) ?? si.name.split(" ")[0] ?? "Service";
        const cur = map.get(si.serviceCatalogId);
        if (cur) cur.count += 1;
        else map.set(si.serviceCatalogId, { id: si.serviceCatalogId, name: si.name, tag, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [existingCustomerId, jobCards, serviceCatalog]);

  const serviceBookingCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const jc of jobCards) {
      for (const si of jc.services) {
        m.set(si.serviceCatalogId, (m.get(si.serviceCatalogId) ?? 0) + 1);
      }
    }
    return m;
  }, [jobCards]);

  const activeCatalogTotal = useMemo(
    () => serviceCatalog.filter((s) => s.isActive).length,
    [serviceCatalog]
  );

  const selectedCatalogItems = useMemo(() => {
    const ids = new Set([...selectedMainIds, ...selectedAddonIds]);
    return serviceCatalog.filter((s) => ids.has(s.id));
  }, [serviceCatalog, selectedMainIds, selectedAddonIds]);

  const catalogAvgIncentivePercent = useMemo(() => {
    if (selectedCatalogItems.length === 0) return 0;
    return (
      selectedCatalogItems.reduce((sum, s) => sum + s.incentivePercent, 0) /
      selectedCatalogItems.length
    );
  }, [selectedCatalogItems]);

  useEffect(() => {
    setMechanicIncentivePercentOverride("");
  }, [mechanicId]);

  const membershipMainServiceZeroIds = useMemo(() => {
    if (membershipVisitChoice !== "yes") return new Set<string>();
    return new Set(membershipRedeemServiceIds);
  }, [membershipVisitChoice, membershipRedeemServiceIds]);

  const catalogSubtotalExclGst = useMemo(() => {
    if (!vehicleSegment) return 0;
    return selectedCatalogItems.reduce((sum, s) => {
      const isMain = selectedMainIds.includes(s.id);
      if (isMain && membershipMainServiceZeroIds.has(s.id)) return sum;
      return sum + priceForService(s, vehicleSegment);
    }, 0);
  }, [selectedCatalogItems, vehicleSegment, selectedMainIds, membershipMainServiceZeroIds]);

  const highEndSubtotalExclGst = useMemo(() => {
    return selectedHighEndIds.reduce((sum, hid) => {
      const h = highEndServices.find((x) => x.id === hid);
      return sum + (h?.estimateAmountInr ?? 0);
    }, 0);
  }, [selectedHighEndIds, highEndServices]);

  const highEndSummaryLines = useMemo(
    () =>
      selectedHighEndIds
        .map((hid) => {
          const h = highEndServices.find((x) => x.id === hid);
          if (!h) return null;
          return { id: hid, name: h.name, amount: h.estimateAmountInr ?? 0 };
        })
        .filter((x): x is { id: string; name: string; amount: number } => x != null),
    [selectedHighEndIds, highEndServices]
  );

  const discountAmount = useMemo(() => {
    if (!couponApplied) return 0;
    return Math.round(catalogSubtotalExclGst * 0.1 * 100) / 100;
  }, [couponApplied, catalogSubtotalExclGst]);

  /** Catalog after coupon + high-end program amounts (all excl. GST). */
  const afterDiscount =
    Math.max(0, catalogSubtotalExclGst - discountAmount) + highEndSubtotalExclGst;
  const gstAmount = Math.round(afterDiscount * GST_RATE * 100) / 100;
  const totalPayable = Math.round((afterDiscount + gstAmount) * 100) / 100;

  /** Parsed advance for summary & cap (matches submit logic). */
  const summaryAdvanceAmount = useMemo(() => {
    const t = advanceAmountInput.trim();
    if (t === "") return 0;
    const n = Number.parseFloat(t.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    const rounded = Math.round(n * 100) / 100;
    return Math.min(rounded, totalPayable);
  }, [advanceAmountInput, totalPayable]);

  const balanceAfterAdvance = useMemo(
    () => Math.max(0, Math.round((totalPayable - summaryAdvanceAmount) * 100) / 100),
    [totalPayable, summaryAdvanceAmount]
  );

  const toggleMain = (id: string) => {
    setSelectedMainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTrending = (id: string) => {
    setSelectedMainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyCoupon = () => {
    if (couponCode.trim().toUpperCase() === "WELCOME10") {
      setCouponApplied(true);
      toast.success("10% off applied to services (before tax)");
    } else if (couponCode.trim()) {
      toast.error("Invalid code — try WELCOME10");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      useBookingWizard &&
      wizardSteps.length > 0 &&
      jobCreateStep < wizardSteps.length - 1
    ) {
      toast.error(
        isJobCard
          ? "Complete all wizard steps before creating the job card."
          : "Complete all wizard steps before creating the booking."
      );
      return;
    }
    if (!branchId) {
      toast.error("Please select a branch to create the booking.");
      return;
    }
    if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 10) {
      toast.error("Customer name and a valid 10-digit phone are required.");
      return;
    }
    if (!vehicleNumber.trim() || !vehicleBrand.trim() || !vehicleModel.trim() || !vehicleSegment) {
      toast.error("Vehicle registration, brand, model, and type are required.");
      return;
    }
    if (!isValidIndianVehicleRegistration(vehicleNumber)) {
      toast.error("Invalid registration", { description: INDIAN_VEHICLE_REG_HINT });
      return;
    }
    if (
      selectedMainIds.length + selectedAddonIds.length === 0 &&
      selectedHighEndIds.length === 0
    ) {
      toast.error("Select at least one service, add-on, or high-end program.");
      return;
    }
    if (isWalkIn && isDatetimeLocalInPast(bookingWhen)) {
      toast.error("Booking cannot be in the past", {
        description: "Choose today with a future time, or a later date.",
      });
      return;
    }

    const now = new Date().toISOString();
    const jobNumber = getNextJobNumber();
    const id = `jc-local-${Date.now()}`;
    const mechanic = mechanics.find((m) => m.id === mechanicId);

    let custId = existingCustomerId ?? `cust-local-${Date.now()}`;
    const regStored = normalizeRegistrationNumber(vehicleNumber);
    const formDigits = customerPhone.replace(/\D/g, "").slice(-10);

    const vehiclesNow = useVehicleStore.getState().vehicles;
    const sameReg = vehiclesNow.filter(
      (v) => normalizeRegistrationNumber(v.registrationNumber) === regStored
    );
    const forThisCustomer = sameReg.filter((v) => v.customerId === custId);
    const forOthers = sameReg.filter((v) => v.customerId !== custId);
    let matchedVehicle: Vehicle | undefined = forThisCustomer[0];

    if (!matchedVehicle && forOthers.length > 0) {
      const otherV = forOthers[0];
      const owner = customers.find((c) => c.id === otherV.customerId);
      const ownerDigits = owner ? owner.phone.replace(/\D/g, "").slice(-10) : "";
      const samePerson = formDigits.length === 10 && (!owner || ownerDigits === formDigits);
      if (!existingCustomerId || !samePerson) {
        toast.error("Registration belongs to another customer", {
          description: "Use that customer record or transfer the vehicle first.",
        });
        return;
      }
      matchedVehicle = otherV;
    }

    if (!existingCustomerId) {
      const newReferralCode = `REF-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const referredByWalkIn = referralCode.trim() || undefined;
      const referredByJobCard =
        isJobCard && referrerInfo ? referralCode.trim().toUpperCase() : undefined;
      let createdWalkIn;
      try {
        createdWalkIn = await addCustomer({
          name: customerName.trim(),
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
          referralCode: newReferralCode,
          referredBy: isJobCard ? referredByJobCard : referredByWalkIn,
          totalVisits: 1,
          lastVisitDate: now,
          rewardPoints: 0,
          walletBalance: 0,
        });
      } catch {
        toast.error("Could not create customer", {
          description: "Check that the API server is running.",
        });
        return;
      }
      if (!createdWalkIn) {
        toast.error("Phone already registered — search again to load customer.");
        return;
      }
      custId = createdWalkIn.id;
      if (isJobCard && referrerInfo) {
        try {
          await creditWallet(referrerInfo.id, referralRewardAmount);
        } catch {
          toast.error("Customer saved but referral wallet credit failed.");
          return;
        }
        addTransaction({
          id: `wt-ref-${Date.now()}`,
          customerId: referrerInfo.id,
          customerName: referrerInfo.name,
          type: "CREDIT",
          amount: referralRewardAmount,
          source: "REFERRAL_REWARD",
          referenceId: custId,
          description: `Referral reward — ${customerName.trim()} used your code`,
          balanceAfter: 0,
          createdAt: now,
        });
        toast.success("Referral applied!", {
          description: `${referrerInfo.name} earned ${formatCurrency(referralRewardAmount)} wallet credit`,
        });
      }
    } else {
      const existing = customers.find((c) => c.id === existingCustomerId);
      try {
        await updateCustomer(existingCustomerId, {
          totalVisits: (existing?.totalVisits ?? 0) + 1,
          lastVisitDate: now,
        });
      } catch {
        toast.error("Could not update customer visit stats.", {
          description: "Check that the API server is running.",
        });
        return;
      }
    }

    const seg = vehicleSegment as VehicleSegment;
    let resolvedVehicleId: string;
    if (matchedVehicle) {
      resolvedVehicleId = matchedVehicle.id;
    } else {
      resolvedVehicleId = `veh-local-${Date.now()}`;
    }

    if (wizardMembershipPackageId) {
      const memRes = assignMembership({
        customerId: custId,
        packageId: wizardMembershipPackageId,
        vehicleId: resolvedVehicleId,
        notes: `${isJobCard ? "New job card" : "Booking"} ${jobNumber}`,
      });
      if (!memRes.ok) {
        toast.error("Could not activate membership", { description: memRes.error });
        return;
      }
      const pkg = membershipPackagesAll.find((p) => p.id === wizardMembershipPackageId);
      toast.success("Membership activated", { description: pkg?.name ?? "Membership" });

      const subRow = useMembershipStore.getState().subscriptions.find((s) => s.id === memRes.id);
      if (pkg && subRow) {
        const names = pkg.includedServiceIds
          .map((sid) => serviceCatalog.find((c) => c.id === sid)?.name)
          .filter((n): n is string => Boolean(n));
        notifyMembershipWelcomeWhatsApp({
          customerPhone,
          customerName: customerName.trim(),
          customerId: custId,
          businessName,
          packageName: pkg.name,
          tier: pkg.tier,
          validUntilIso: subRow.endDate,
          vehicleReg: regStored,
          includedServiceNames: names,
        });
      }
    }

    const serviceItems = selectedCatalogItems.map((s) => {
      const isFreeMain =
        membershipVisitChoice === "yes" &&
        membershipRedeemServiceIds.includes(s.id) &&
        selectedMainIds.includes(s.id);
      if (isFreeMain) {
        return {
          id: `si-${id}-${s.id}`,
          jobCardId: id,
          serviceCatalogId: s.id,
          name: s.name,
          price: 0,
          isCompleted: false,
          durationMinutes: s.durationMinutes,
        };
      }
      const base = priceForService(s, seg);
      const share =
        catalogSubtotalExclGst > 0 ? base / catalogSubtotalExclGst : 1 / selectedCatalogItems.length;
      const discounted =
        Math.round(base - discountAmount * share + Number.EPSILON * 100) / 100;
      return {
        id: `si-${id}-${s.id}`,
        jobCardId: id,
        serviceCatalogId: s.id,
        name: s.name,
        price: Math.max(0, discounted),
        isCompleted: false,
        durationMinutes: s.durationMinutes,
      };
    });

    const estimatedAmount =
      serviceItems.reduce((s, x) => s + x.price, 0) + highEndSubtotalExclGst;
    const customIncRaw = mechanicIncentivePercentOverride.trim();
    let incentivePercentFinal = catalogAvgIncentivePercent;
    if (customIncRaw !== "") {
      const n = Number.parseFloat(customIncRaw.replace(",", "."));
      if (Number.isFinite(n)) {
        incentivePercentFinal = Math.min(100, Math.max(0, Math.round(n * 100) / 100));
      }
    }

    if (matchedVehicle) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === matchedVehicle!.id
            ? {
                ...v,
                customerId: custId,
                customerName: customerName.trim(),
                registrationNumber: regStored,
                make: vehicleBrand.trim(),
                model: vehicleModel.trim() || "—",
                segment: seg,
              }
            : v
        )
      );
    } else {
      setVehicles((prev) => [
        {
          id: resolvedVehicleId,
          customerId: custId,
          customerName: customerName.trim(),
          registrationNumber: regStored,
          make: vehicleBrand.trim(),
          model: vehicleModel.trim() || "—",
          segment: seg,
          fuelType: "PETROL",
          color: "—",
          year: new Date().getFullYear(),
        },
        ...prev,
      ]);
    }

    const bookingNote =
      [
        customerNotes && `Customer: ${customerNotes}`,
        internalNotes && `Internal: ${internalNotes}`,
        pickupRequired && "Pickup required: Yes",
        couponApplied && "Coupon: WELCOME10",
      ]
        .filter(Boolean)
        .join("\n") || undefined;

    const expectedDeliveryIso = isWalkIn
      ? new Date(bookingWhen).toISOString()
      : now;

    const advanceAmountPatch = (() => {
      const t = advanceAmountInput.trim();
      if (t === "") return {};
      const n = Number.parseFloat(t.replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) return {};
      const rounded = Math.round(n * 100) / 100;
      const capped = Math.min(rounded, totalPayable);
      return { highEndAdvanceAmountInr: capped } as const;
    })();

    if (isWalkIn) {
      const walkInJob: JobCard = {
        id,
        jobNumber,
        branchId,
        customerId: custId,
        customerName: customerName.trim(),
        customerPhone,
        vehicleId: resolvedVehicleId,
        vehicleRegNumber: regStored,
        vehicleMakeModel: `${vehicleBrand} ${vehicleModel}`.trim(),
        vehicleSegment: seg,
        mechanicId: mechanicId || undefined,
        mechanicName: mechanic?.name,
        status: "RECEIVED",
        reportedIssues: pickupRequired ? "Walk-in — pickup requested" : "Walk-in booking",
        expectedDelivery: expectedDeliveryIso,
        services: serviceItems,
        estimatedAmount,
        incentivePercent: Math.round(incentivePercentFinal * 100) / 100,
        incentiveAmount: Math.round((estimatedAmount * incentivePercentFinal) / 100 * 100) / 100,
        termsAndConditions:
          "Walk-in: vehicle stored securely. Prices subject to inspection. GST as applicable.",
        notes: bookingNote,
        ...advanceAmountPatch,
        createdBy: user?.id ?? "USR-WALKIN",
        createdAt: now,
        updatedAt: now,
      };
      addJobCard(walkInJob);

      if (pickupRequired) {
        queuePickupDropFromBooking({
          job: walkInJob,
          customerAddress,
          branches,
        });
      }

      if (membershipVisitChoice === "yes" && membershipRedeemServiceIds.length > 0) {
        const sub = getActiveMembership(custId, resolvedVehicleId);
        if (sub) {
          recordMembershipUsages(
            sub.id,
            membershipRedeemServiceIds.map((sid) => ({
              serviceCatalogId: sid,
              serviceName: serviceCatalog.find((c) => c.id === sid)?.name,
              jobCardId: id,
            }))
          );
        }
      }

      pushActivityLog({
        action: "CREATED",
        entityType: "JOB_CARD",
        entityId: id,
        entityLabel: jobNumber,
        details: `Walk-in booking ${jobNumber} — ${customerName} (${totalPayable} incl. GST)`,
      });

      toast.success("Booking created", {
        description: pickupRequired ? `${jobNumber} · Pickup queued under Pickup & Drop` : jobNumber,
      });
      void sendJobCardCreatedWhatsApp(walkInJob);
      navigateToCreatedJobCard(id);
      return;
    }

    const termsWithAdvanceNote = `${termsAndConditions.trim()}\n\nOptional: a partial advance may be collected toward this job; record the amount on the job card when agreed.`;

    const newJobCard: JobCard = {
      id,
      jobNumber,
      branchId,
      customerId: custId,
      customerName: customerName.trim(),
      customerPhone,
      vehicleId: resolvedVehicleId,
      vehicleRegNumber: regStored,
      vehicleMakeModel: `${vehicleBrand} ${vehicleModel}`.trim(),
      vehicleSegment: seg,
      mechanicId: mechanicId || undefined,
      mechanicName: mechanic?.name,
      status: "RECEIVED",
      reportedIssues: reportedIssues.trim() || "—",
      odometerReading: odometerReading ? parseInt(odometerReading, 10) : undefined,
      expectedDelivery: expectedDeliveryIso,
      services: serviceItems,
      estimatedAmount,
      incentivePercent: Math.round(incentivePercentFinal * 100) / 100,
      incentiveAmount: Math.round((estimatedAmount * incentivePercentFinal) / 100 * 100) / 100,
      termsAndConditions: termsWithAdvanceNote,
      notes: bookingNote,
      highEndServiceIds: selectedHighEndIds.length > 0 ? selectedHighEndIds : undefined,
      highEndFirstFollowUpMonthsByServiceId:
        selectedHighEndIds.length > 0
          ? Object.fromEntries(
              selectedHighEndIds.map((hesId) => {
                const cfg = highEndServices.find((h) => h.id === hesId);
                const months =
                  highEndFirstFollowUpById[hesId] ?? cfg?.reminderIntervals[0] ?? 0;
                return [hesId, months] as const;
              })
            )
          : undefined,
      highEndCompletionMinutesByServiceId:
        selectedHighEndIds.length > 0
          ? (() => {
              const o: Record<string, number> = {};
              for (const hesId of selectedHighEndIds) {
                const m = highEndCompletionMinutesById[hesId];
                if (m != null && Number.isFinite(m) && m > 0) o[hesId] = Math.round(m);
              }
              return Object.keys(o).length > 0 ? o : undefined;
            })()
          : undefined,
      ...advanceAmountPatch,
      createdBy: user?.id ?? "USR-001",
      createdAt: now,
      updatedAt: now,
    };
    addJobCard(newJobCard);

    if (pickupRequired) {
      queuePickupDropFromBooking({
        job: newJobCard,
        customerAddress,
        branches,
      });
    }

    if (membershipVisitChoice === "yes" && membershipRedeemServiceIds.length > 0) {
      const sub = getActiveMembership(custId, resolvedVehicleId);
      if (sub) {
        recordMembershipUsages(
          sub.id,
          membershipRedeemServiceIds.map((sid) => ({
            serviceCatalogId: sid,
            serviceName: serviceCatalog.find((c) => c.id === sid)?.name,
            jobCardId: id,
          }))
        );
      }
    }

    pushActivityLog({
      action: "CREATED",
      entityType: "JOB_CARD",
      entityId: id,
      entityLabel: jobNumber,
      details: `Job ${jobNumber} created for ${customerName.trim()} — ${vehicleNumber}`,
    });

    void sendJobCardCreatedWhatsApp(newJobCard);

    setCheckInJob({
      id,
      jobNumber,
      customerName: customerName.trim(),
      vehicleRegLabel: vehicleNumber.trim() || regStored,
    });
    setCheckInReportedIssuesBase(reportedIssues.trim() || "—");
    setCheckInNotesBase(bookingNote?.trim() ?? "");
    setCheckInDamages("");
    setCheckInNotesExtra("");
    setCheckInPhotos([]);
    setCheckInPhotoError(false);
    checkInJobIdRef.current = id;
    setCheckInOpen(true);
    toast.message("Job card created", {
      description: pickupRequired
        ? "Complete vehicle check-in with before photos to open the job. Pickup request is on Pickup & Drop."
        : "Complete vehicle check-in with before photos to open the job.",
    });
  };

  const dismissCheckIn = () => {
    setCheckInPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    const jid = checkInJobIdRef.current;
    checkInJobIdRef.current = null;
    setCheckInOpen(false);
    setCheckInJob(null);
    if (jid) navigateToCreatedJobCard(jid);
  };

  const handleCheckInFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error("Choose image files only.");
        continue;
      }
      if (file.size > INSPECTION_PHOTO_MAX_BYTES) {
        toast.error("Each photo must be 10 MB or smaller.");
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const label = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Photo";
      setCheckInPhotos((prev) => [
        ...prev,
        {
          id: `ph-ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl,
          label,
        },
      ]);
    }
    setCheckInPhotoError(false);
    if (checkInFileRef.current) checkInFileRef.current.value = "";
    if (checkInCameraRef.current) checkInCameraRef.current.value = "";
  };

  const removeCheckInPhoto = (photoId: string) => {
    setCheckInPhotos((prev) => {
      const hit = prev.find((p) => p.id === photoId);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleCheckInSubmit = async () => {
    if (!checkInJob) return;
    if (checkInPhotos.length === 0) {
      setCheckInPhotoError(true);
      return;
    }
    const damages = checkInDamages.trim();
    const extra = checkInNotesExtra.trim();
    let reported = checkInReportedIssuesBase;
    if (damages) {
      reported =
        reported === "—"
          ? `Check-in — observed damages: ${damages}`
          : `${reported}\n\nCheck-in — observed damages: ${damages}`;
    }
    let mergedNotes = checkInNotesBase;
    if (extra) {
      mergedNotes = mergedNotes ? `${mergedNotes}\n\nCheck-in notes: ${extra}` : `Check-in notes: ${extra}`;
    }
    const nowIso = new Date().toISOString();
    const uploadUserId = user?.id ?? "USR-001";
    const jcExisting = useJobCardStore.getState().jobCards.find((j) => j.id === checkInJob.id);
    const existingPhotos = [...(jcExisting?.inspectionPhotos ?? [])];
    const uploaded: InspectionPhoto[] = [];

    setCheckInSubmitting(true);
    try {
      for (const p of checkInPhotos) {
        const url = await uploadJobInspectionPhoto(checkInJob.id, "BEFORE", p.file, p.id);
        uploaded.push({
          id: p.id,
          type: "BEFORE",
          url,
          caption: p.label.trim() ? `Check-in · ${p.label.trim()}` : "Check-in",
          uploadedAt: nowIso,
          uploadedBy: uploadUserId,
        });
      }
      await updateJobCard(checkInJob.id, {
        inspectionPhotos: [...existingPhotos, ...uploaded],
        reportedIssues: reported,
        notes: mergedNotes || undefined,
        updatedAt: nowIso,
      });
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not upload photos";
      toast.error(msg);
      setCheckInSubmitting(false);
      return;
    }

    checkInPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setCheckInPhotos([]);
    setCheckInSubmitting(false);

    pushActivityLog({
      action: "UPDATED",
      entityType: "JOB_CARD",
      entityId: checkInJob.id,
      entityLabel: checkInJob.jobNumber,
      details: `Vehicle check-in — ${uploaded.length} before photo(s)`,
    });
    toast.success("Vehicle checked in", { description: `${checkInJob.jobNumber} is ready for the workshop.` });
    const jid = checkInJob.id;
    checkInJobIdRef.current = null;
    setCheckInOpen(false);
    setCheckInJob(null);
    navigateToCreatedJobCard(jid);
  };

  const mainLabels = selectedCatalogItems
    .filter((s) => selectedMainIds.includes(s.id))
    .map((s) => s.name);
  const addonLabels = selectedCatalogItems
    .filter((s) => selectedAddonIds.includes(s.id))
    .map((s) => s.name);

  const wizardSteps = useMemo((): JobWizardStepId[] => {
    const s: JobWizardStepId[] = [
      "customer",
      "vehicle",
      ...(isJobCard ? [] : (["schedule"] as const)),
      "smartSuggestions",
      "membership",
      "serviceSelection",
    ];
    if (highEndServices.length > 0) s.push("highEndServices");
    s.push("addons");
    s.push("pickupDrop");
    s.push("mechanic");
    if (isJobCard) {
      s.push("notesAndJobDetails", "jobSummary");
    } else {
      s.push("notes", "jobSummary");
    }
    return s;
  }, [isJobCard, highEndServices.length]);

  useEffect(() => {
    if (!useBookingWizard) return;
    setJobCreateStep((prev) => Math.min(prev, Math.max(0, wizardSteps.length - 1)));
  }, [useBookingWizard, wizardSteps.length]);

  const jobWizardStepId = wizardSteps[jobCreateStep] ?? "customer";
  const jobWizardStepCount = wizardSteps.length;
  const bookingWizardIncomplete =
    useBookingWizard && jobWizardStepCount > 0 && jobCreateStep < jobWizardStepCount - 1;

  const jobWizardStepSkipped = useCallback(
    (stepId: JobWizardStepId) => {
      if (!useBookingWizard) return false;
      if (!redeemingMembershipVisit) return false;
      return stepId === "serviceSelection" || stepId === "highEndServices";
    },
    [useBookingWizard, redeemingMembershipVisit]
  );

  /** Membership "Yes" hides service + high-end steps; keep step index from pointing at a hidden step (e.g. after Back). */
  useEffect(() => {
    if (!useBookingWizard || !redeemingMembershipVisit) return;
    setJobCreateStep((prev) => {
      let n = prev;
      while (
        n < wizardSteps.length &&
        wizardSteps[n] != null &&
        jobWizardStepSkipped(wizardSteps[n]!)
      ) {
        n++;
      }
      return Math.min(wizardSteps.length - 1, Math.max(0, n));
    });
  }, [useBookingWizard, redeemingMembershipVisit, wizardSteps, jobWizardStepSkipped]);

  const showJobWizardStep = (id: JobWizardStepId) => {
    if (!useBookingWizard) return true;
    if (jobWizardStepSkipped(id)) return false;
    if (isJobCard) {
      if (id === "notes" || id === "jobDetails") {
        return jobWizardStepId === "notesAndJobDetails";
      }
      return jobWizardStepId === id;
    }
    if (id === "notesAndJobDetails" || id === "jobDetails") return false;
    if (id === "notes") return jobWizardStepId === "notes";
    return jobWizardStepId === id;
  };

  const goNextJobWizard = () => {
    if (!useBookingWizard) return;
    if (jobCreateStep >= jobWizardStepCount - 1) return;
    if (jobWizardStepId === "customer") {
      if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 10) {
        toast.error("Enter customer name and a 10-digit phone to continue.");
        return;
      }
    }
    if (jobWizardStepId === "vehicle") {
      if (!vehicleNumber.trim() || !vehicleBrand.trim() || !vehicleModel.trim() || !vehicleSegment) {
        toast.error("Complete vehicle details to continue.");
        return;
      }
      if (!isValidIndianVehicleRegistration(vehicleNumber)) {
        toast.error("Invalid registration", { description: INDIAN_VEHICLE_REG_HINT });
        return;
      }
    }
    if (jobWizardStepId === "serviceSelection") {
      if (!vehicleSegment) {
        toast.error("Select a vehicle type for pricing.");
        return;
      }
      const hasHighEndStep = highEndServices.length > 0;
      if (
        !redeemingMembershipVisit &&
        !hasHighEndStep &&
        selectedMainIds.length === 0
      ) {
        toast.error("Select at least one service to continue.");
        return;
      }
    }
    if (jobWizardStepId === "membership") {
      if (activeMembershipForSelectedVehicle && activeMembershipPackageRow) {
        if (membershipVisitChoice === null) {
          toast.error("Choose whether to use membership on this visit (Yes or No).");
          return;
        }
        if (membershipVisitChoice === "yes") {
          const used = getUsedIncludedServiceIds(activeMembershipForSelectedVehicle);
          const remaining = activeMembershipPackageRow.includedServiceIds.filter((sid) => !used.has(sid));
          if (remaining.length > 0 && membershipRedeemServiceIds.length === 0) {
            toast.error(
              "Open included services and pick at least one remaining service, or choose No for a normal booking."
            );
            return;
          }
          setSelectedMainIds(membershipRedeemServiceIds);
          setSelectedHighEndIds([]);
        }
      }
    }
    setJobCreateStep((i) => {
      let n = i + 1;
      while (
        n < jobWizardStepCount &&
        wizardSteps[n] != null &&
        jobWizardStepSkipped(wizardSteps[n]!)
      ) {
        n++;
      }
      return Math.min(jobWizardStepCount - 1, n);
    });
  };

  const goBackJobWizard = () => {
    setJobCreateStep((s) => {
      let n = s - 1;
      while (n >= 0 && wizardSteps[n] != null && jobWizardStepSkipped(wizardSteps[n]!)) {
        n--;
      }
      return Math.max(0, n);
    });
  };

  const renderSummaryCard = (branchBlockId: string) => (
    <Card
      className={cn(
        "border-border/80 shadow-sm",
        compactJobCardDesktop && "flex h-full min-h-0 flex-col overflow-hidden"
      )}
    >
      <CardHeader
        className={cn(
          "pb-2",
          compactJobCardDesktop ? "px-4 pt-3 sm:px-4" : "px-4 pt-3 sm:px-6 sm:pt-5"
        )}
      >
        <CardTitle className={cn(compactJobCardDesktop ? "text-sm" : "text-base")}>
          {isJobCard ? "Job summary" : "Booking summary"}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "pb-2 text-sm",
          compactJobCardDesktop
            ? "min-h-0 flex-1 space-y-2.5 overflow-y-auto text-xs sm:px-4"
            : "space-y-2 px-4 sm:space-y-3 sm:px-6 sm:pb-4"
        )}
      >
        <dl className={cn("space-y-1", compactJobCardDesktop && "space-y-0.5")}>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-medium text-right truncate max-w-[55%]">
              {customerName.trim() || "Not selected"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">{customerPhone.length >= 10 ? customerPhone : "N/A"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-right truncate max-w-[55%]">
              {vehicleBrand || "Not selected"} {vehicleModel}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{vehicleSegment || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Registration</dt>
            <dd className="font-mono text-xs">{vehicleNumber || "Not selected"}</dd>
          </div>
          <div className="flex justify-between gap-2 align-start">
            <dt className="text-muted-foreground shrink-0">Membership</dt>
            <dd className="text-right text-xs leading-snug max-w-[58%]">{summaryMembershipLabel}</dd>
          </div>
          <div className="flex justify-between gap-2 align-start">
            <dt className="text-muted-foreground shrink-0">Service(s)</dt>
            <dd className="text-right text-xs">
              {mainLabels.length ? mainLabels.join(", ") : "Not selected"}
            </dd>
          </div>
          {addonLabels.length > 0 && (
            <div className="flex justify-between gap-2 align-start">
              <dt className="text-muted-foreground shrink-0">Add-ons</dt>
              <dd className="text-right text-xs">{addonLabels.join(", ")}</dd>
            </div>
          )}
          {highEndSummaryLines.length > 0 && (
            <div className="flex justify-between gap-2 align-start border-t border-border/60 pt-2 mt-1">
              <dt className="text-muted-foreground shrink-0">High-end (est.)</dt>
              <dd className="text-right text-xs space-y-1 min-w-0">
                {highEndSummaryLines.map((line) => (
                  <div key={line.id} className="flex justify-end gap-2 flex-wrap">
                    <span className="truncate max-w-[140px]">{line.name}</span>
                    <span className="tabular-nums shrink-0">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              {isJobCard ? "Expected delivery" : "Date & time"}
            </dt>
            <dd className="text-right text-xs">
              {isWalkIn
                ? bookingWhen
                  ? new Date(bookingWhen).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"
                : "Current date & time when you create"}
            </dd>
          </div>
        </dl>
        <Separator />
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-violet-500" />
          <span className="font-medium text-sm">Discount coupon</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="ENTER CODE"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="uppercase text-xs"
          />
          <Button type="button" variant="secondary" size="sm" onClick={applyCoupon}>
            Apply
          </Button>
        </div>
        {!compactJobCardDesktop && (
          <p className="text-[10px] text-muted-foreground">
            Demo code: WELCOME10 (10% off services before tax)
          </p>
        )}
        <Separator />
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-sm">Advance (₹)</span>
        </div>
        <div className="flex gap-2">
          <Input
            id="advance-amount-summary"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            placeholder="Optional amount"
            className="text-xs tabular-nums"
            value={advanceAmountInput}
            onChange={(e) => setAdvanceAmountInput(e.target.value)}
          />
        </div>
        {!compactJobCardDesktop && (
          <p className="text-[10px] text-muted-foreground">
            In rupees (incl. GST), capped at gross total below ({formatCurrency(totalPayable)}). Deducted in the summary
            total. Saved on the job card for billing. Leave empty if none.
          </p>
        )}
        <Separator />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (excl. GST)</span>
            <span className="tabular-nums">{formatCurrency(afterDiscount)}</span>
          </div>
          <div className="flex justify-between text-amber-700 dark:text-amber-400">
            <span>GST (18%)</span>
            <span className="tabular-nums">+{formatCurrency(gstAmount)}</span>
          </div>
          {summaryAdvanceAmount > 0 ? (
            <>
              <div className="flex justify-between text-muted-foreground text-xs pt-0.5">
                <span>Total (incl. GST)</span>
                <span className="tabular-nums">{formatCurrency(totalPayable)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Advance</span>
                <span className="tabular-nums">−{formatCurrency(summaryAdvanceAmount)}</span>
              </div>
            </>
          ) : null}
          <div
            className={cn(
              "flex justify-between font-bold text-primary pt-0.5",
              compactJobCardDesktop ? "text-sm" : "text-base pt-1",
              summaryAdvanceAmount > 0 && "border-t border-border/60 mt-1 pt-1.5"
            )}
          >
            <span>{summaryAdvanceAmount > 0 ? "Balance due" : "Total payable"}</span>
            <span className="tabular-nums">{formatCurrency(balanceAfterAdvance)}</span>
          </div>
        </div>
        <Separator />
        <div id={branchBlockId} className="space-y-2 scroll-mt-24">
          <Label className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Select branch *
          </Label>
          <Select value={branchId} onValueChange={setBranchId} required>
            <SelectTrigger>
              <SelectValue placeholder="Please select a branch" />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!branchId && (
            <p className="text-xs text-destructive">
              Please select a branch to create the {isJobCard ? "job card" : "booking"}.
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter
        className={cn(
          "hidden shrink-0 border-t border-border px-4 py-3 sm:px-6 md:flex md:flex-col md:gap-2",
          compactJobCardDesktop && "py-2.5"
        )}
      >
        <Button
          type="submit"
          className="w-full"
          disabled={bookingWizardIncomplete}
          title={
            bookingWizardIncomplete ? "Complete all wizard steps first" : undefined
          }
        >
          {isJobCard ? "Create job card" : "Create booking"}
        </Button>
        <Button type="button" variant="outline" className="w-full" asChild>
          <Link href={isJobCard ? "/job-cards" : "/bookings"}>Cancel</Link>
        </Button>
      </CardFooter>
    </Card>
  );

  const bookingForm = (
      <form
        onSubmit={handleSubmit}
        className={cn(
          useBookingWizard
            ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden lg:flex-row lg:items-stretch lg:gap-3 lg:overflow-hidden"
            : "lg:flex lg:flex-row lg:items-start lg:gap-8",
          useBookingWizard &&
            !isDesktopWide &&
            "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        )}
      >
        <div
          className={cn(
            "min-w-0 flex-1 space-y-6 lg:min-w-0",
            useBookingWizard &&
              "flex flex-col overflow-x-hidden px-3 py-2 sm:px-6 sm:py-3",
            useBookingWizard &&
              isDesktopWide &&
              "min-h-0 flex-1 gap-2 overflow-hidden py-2 sm:px-4 max-lg:overflow-y-auto max-lg:overflow-x-hidden lg:min-w-0",
            useBookingWizard && !isDesktopWide && "min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          )}
        >
          {useBookingWizard && (
            <>
              <div
                className={cn(
                  "hidden sm:block overflow-x-auto overflow-y-visible pb-1.5 -mx-1 px-1 [scrollbar-width:thin] shrink-0",
                  compactJobCardDesktop && "pb-1"
                )}
              >
                <div className="flex items-center justify-start min-w-0 w-full gap-x-1 sm:gap-x-2">
                  {wizardSteps.map((stepId, index) => {
                    const label = JOB_WIZARD_LABEL[stepId];
                    const isLast = index === jobWizardStepCount - 1;
                    const isCompleted = index < jobCreateStep;
                    const isCurrent = index === jobCreateStep;
                    return (
                      <div key={stepId} className="flex items-center shrink-0">
                        <div
                          className={cn(
                            "flex flex-col items-center px-0.5",
                            compactJobCardDesktop ? "w-[4rem] sm:w-[4.25rem]" : "w-[4.5rem] sm:w-[5.25rem]"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-full flex items-center justify-center border-2 transition-colors",
                              compactJobCardDesktop
                                ? "w-7 h-7 sm:w-8 sm:h-8"
                                : "w-9 h-9 sm:w-10 sm:h-10",
                              isCompleted
                                ? "bg-primary border-primary text-primary-foreground"
                                : isCurrent
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                            )}
                          >
                            {isCompleted ? (
                              <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                              <span className="text-[10px] sm:text-xs font-medium">{index + 1}</span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-center leading-tight line-clamp-2",
                              compactJobCardDesktop
                                ? "text-[9px] sm:text-[10px] mt-1"
                                : "text-[10px] sm:text-xs mt-1.5",
                              isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {label}
                          </span>
                        </div>
                        {!isLast && (
                          <div
                            className={cn(
                              "h-0.5 w-3 sm:w-4 sm:flex-1 sm:min-w-2 sm:max-w-16 shrink-0",
                              compactJobCardDesktop ? "-mt-4 sm:-mt-5" : "-mt-5 sm:-mt-6",
                              isCompleted ? "bg-primary" : "bg-muted"
                            )}
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div
            className={cn(
              useBookingWizard ? "space-y-4" : "space-y-6",
              useBookingWizard &&
                isDesktopWide &&
                "lg:flex lg:min-h-0 lg:flex-1 lg:basis-0 lg:flex-col lg:space-y-0 lg:gap-2.5 lg:overflow-y-auto lg:overflow-x-auto lg:overscroll-y-contain lg:pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5",
              useBookingWizard && "max-lg:shrink-0 max-lg:overflow-visible"
            )}
          >
          {showJobWizardStep("customer") && (
          <Card
            className={cn(compactCustomerStep && "border-border/80 shadow-sm")}
          >
            <CardHeader
              className={cn(
                compactCustomerStep && "space-y-0 py-2 pb-1.5 pt-2.5 sm:py-2 sm:pb-1.5 sm:pt-3"
              )}
            >
              <CardTitle className={cn(compactCustomerStep ? "text-base" : "text-lg")}>
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent
              className={cn(
                compactCustomerStep
                  ? "space-y-2.5 pt-0 pb-3 sm:space-y-2.5 sm:pb-4 sm:pt-0"
                  : "space-y-6"
              )}
            >
              <div>
                <Label className={cn("text-muted-foreground", compactCustomerStep && "text-xs")}>
                  Search Existing Customer
                </Label>
                <div
                  className={cn(
                    "mt-2 w-full max-w-md",
                    compactCustomerStep && "mt-1 max-w-full"
                  )}
                >
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className={cn("pl-9", compactCustomerStep && "h-9")}
                      placeholder="Enter Mobile or Vehicle number"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      autoComplete="off"
                    />
                  </div>
                  {!compactCustomerStep && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Matches update as you type (phone, name, or registration).
                    </p>
                  )}
                </div>
                {lookupPanelCustomers && lookupPanelCustomers.length > 0 && (
                  <div
                    className={cn(
                      "space-y-2 rounded-lg border bg-muted/30 p-3 mt-3",
                      compactCustomerStep && "space-y-1.5 p-2.5 mt-2"
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">Matching customers</p>
                    <ul className={cn("space-y-2", compactCustomerStep && "space-y-1.5")}>
                      {lookupPanelCustomers.map((c) => (
                        <li
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-md border bg-background px-3",
                            compactCustomerStep ? "py-1.5" : "py-2"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-sm text-muted-foreground tabular-nums">{c.phone}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="shrink-0"
                            onClick={() => applySelectedCustomer(c)}
                          >
                            Select
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="text-sm text-primary hover:underline pt-1" onClick={cancelLookup}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p
                  className={cn(
                    "font-medium",
                    compactCustomerStep ? "mb-1.5 text-sm" : "mb-3 text-sm"
                  )}
                >
                  Customer Details
                </p>
                <div
                  className={cn(
                    "grid grid-cols-1 sm:grid-cols-2",
                    compactCustomerStep ? "gap-2 sm:gap-3" : "gap-4"
                  )}
                >
                  <div className={cn(compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Full Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                      required
                    />
                    {existingCustomerId && (
                      <p className="text-xs text-muted-foreground">Existing customer — name locked</p>
                    )}
                  </div>
                  <div className={cn(compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Phone Number</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(-10))}
                      placeholder="Phone number"
                      maxLength={10}
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                      required
                    />
                  </div>
                  <div className={cn("sm:col-span-2", compactCustomerStep ? "space-y-1" : "space-y-2")}>
                    <Label className={cn(compactCustomerStep && "text-xs")}>Email (Optional)</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Email address"
                      readOnly={!!existingCustomerId}
                      className={cn(existingCustomerId ? "bg-muted/80" : "", compactCustomerStep && "h-9")}
                    />
                    {existingCustomerId && (
                      <p className="text-xs text-muted-foreground">Existing customer — email locked</p>
                    )}
                  </div>
                  {!existingCustomerId && isWalkIn && (
                    <div className={cn("sm:col-span-2", compactCustomerStep ? "space-y-1" : "space-y-2")}>
                      <Label className={cn(compactCustomerStep && "text-xs")}>Referral code (optional)</Label>
                      <Input
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Referral code"
                        className={cn(compactCustomerStep && "h-9")}
                      />
                      <p className="text-xs text-muted-foreground">If referred by another customer</p>
                    </div>
                  )}
                  {!existingCustomerId && isJobCard && (
                    <>
                      <Separator className={cn("sm:col-span-2", compactCustomerStep && "my-0.5")} />
                      <div className={cn("sm:col-span-2", compactCustomerStep ? "space-y-1" : "space-y-2")}>
                        <Label
                          htmlFor="jobcard-referral"
                          className={cn("flex items-center gap-1.5", compactCustomerStep && "text-xs")}
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          Have a referral code?
                        </Label>
                        <div className="flex items-center gap-2 max-w-sm">
                          <Input
                            id="jobcard-referral"
                            placeholder="e.g. REF-A001"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                            className={cn("uppercase", compactCustomerStep && "h-9")}
                          />
                        </div>
                        {referrerInfo && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Referred by <span className="font-medium">{referrerInfo.name}</span> —{" "}
                            {formatCurrency(newCustomerDiscount)} discount will be applied
                          </p>
                        )}
                        {referralError && referralCode.trim() && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Invalid referral code
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("vehicle") && (
          <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-4">
              <CardTitle className="text-lg font-semibold tracking-tight">Vehicle Details</CardTitle>
              {existingCustomerId && ownedVehicles.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={startAddNewVehicle}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add New Vehicle
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {ownedVehicles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ownedVehicles.map((v) => {
                    const sel = selectedVehicleId === v.id && !addingNewVehicle;
                    const rb =
                      brandNames.find((b) => b.toLowerCase() === v.make.toLowerCase()) ?? v.make;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVehicleFromGarage(v)}
                        className={cn(
                          "rounded-xl border-2 p-4 text-left transition-all",
                          sel ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Car className="w-8 h-8 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {rb} {v.model}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                Reg: {v.registrationNumber}
                              </p>
                            </div>
                          </div>
                          {sel && (
                            <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary">Selected</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {v.segment.replace("_", " ")}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              {showInlineVehicleDetailsForm && (
                <div className="space-y-5">
                  <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3.5 dark:border-sky-800 dark:bg-sky-950/40">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500 text-white shadow-sm"
                      aria-hidden
                    >
                      <Plus className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-semibold text-sky-950 dark:text-sky-50">Adding New Vehicle</p>
                      <p className="text-sm text-sky-800/90 dark:text-sky-200/90">
                        Fill in the vehicle details below
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicle-reg" className="text-foreground">
                      Registration Number
                    </Label>
                    <Input
                      id="vehicle-reg"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(sanitizeVehicleRegistrationInput(e.target.value))}
                      placeholder="e.g. KA01AB1234"
                      maxLength={16}
                      className="h-10 rounded-md"
                      required
                      autoCapitalize="characters"
                    />
                    <p className="text-xs text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="vehicle-brand" className="text-foreground">
                          Brand <span className="text-destructive">*</span>
                        </Label>
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
                        value={vehicleBrand || undefined}
                        onValueChange={(v) => {
                          setVehicleBrand(v);
                          setVehicleModel("");
                          setVehicleSegment("");
                        }}
                        required
                      >
                        <SelectTrigger id="vehicle-brand" className="h-10 w-full">
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {allBrandsSorted.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="vehicle-model"
                          className={cn(
                            "text-foreground",
                            !vehicleBrand.trim() && "text-muted-foreground"
                          )}
                        >
                          Model <span className="text-destructive">*</span>
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!vehicleBrand.trim()}
                          className="h-7 shrink-0 px-2.5 text-xs font-medium disabled:opacity-50"
                          onClick={() => {
                            if (!vehicleBrand.trim()) return;
                            setNewModelDraft("");
                            setNewModelOpen(true);
                          }}
                        >
                          + New
                        </Button>
                      </div>
                      <Select
                        value={vehicleModel || undefined}
                        onValueChange={(v) => {
                          setVehicleModel(v);
                          const seg = getModelSegment(vehicleBrand, v);
                          if (seg) setVehicleSegment(seg);
                        }}
                        disabled={!vehicleBrand.trim()}
                        required={!!vehicleBrand.trim()}
                      >
                        <SelectTrigger
                          id="vehicle-model"
                          className={cn(
                            "h-10 w-full",
                            !vehicleBrand.trim() && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <SelectValue
                            placeholder={vehicleBrand.trim() ? "Select model" : "Select brand first"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {allModelsSorted.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {ownedVehicles.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-100">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {addingNewVehicle && addVehiclePopupOpen
                      ? "Complete the popup to register the new vehicle, or cancel it to pick a saved vehicle."
                      : "Select a saved vehicle above, or use Add New Vehicle to enter details in a popup."}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={addVehiclePopupOpen}
            onOpenChange={(open) => {
              if (open) {
                setAddVehiclePopupOpen(true);
                return;
              }
              if (skipAddVehicleCancelOnCloseRef.current) {
                skipAddVehicleCancelOnCloseRef.current = false;
                return;
              }
              cancelAddVehicleFromPopup();
            }}
          >
            <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
              <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
                <DialogTitle>Add New Vehicle</DialogTitle>
                <DialogDescription>
                  Enter registration, brand, and model. Use + New if a brand or model is not in the list.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-reg-popup" className="text-foreground">
                      Registration Number
                    </Label>
                    <Input
                      id="vehicle-reg-popup"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(sanitizeVehicleRegistrationInput(e.target.value))}
                      placeholder="e.g. KA01AB1234"
                      maxLength={16}
                      className="h-10 rounded-md"
                      required
                      autoCapitalize="characters"
                    />
                    <p className="text-xs text-muted-foreground">{INDIAN_VEHICLE_REG_HINT}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="vehicle-brand-popup" className="text-foreground">
                          Brand <span className="text-destructive">*</span>
                        </Label>
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
                        value={vehicleBrand || undefined}
                        onValueChange={(v) => {
                          setVehicleBrand(v);
                          setVehicleModel("");
                          setVehicleSegment("");
                        }}
                        required
                      >
                        <SelectTrigger id="vehicle-brand-popup" className="h-10 w-full">
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {allBrandsSorted.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="vehicle-model-popup"
                          className={cn(
                            "text-foreground",
                            !vehicleBrand.trim() && "text-muted-foreground"
                          )}
                        >
                          Model <span className="text-destructive">*</span>
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!vehicleBrand.trim()}
                          className="h-7 shrink-0 px-2.5 text-xs font-medium disabled:opacity-50"
                          onClick={() => {
                            if (!vehicleBrand.trim()) return;
                            setNewModelDraft("");
                            setNewModelOpen(true);
                          }}
                        >
                          + New
                        </Button>
                      </div>
                      <Select
                        value={vehicleModel || undefined}
                        onValueChange={(v) => {
                          setVehicleModel(v);
                          const seg = getModelSegment(vehicleBrand, v);
                          if (seg) setVehicleSegment(seg);
                        }}
                        disabled={!vehicleBrand.trim()}
                        required={!!vehicleBrand.trim()}
                      >
                        <SelectTrigger
                          id="vehicle-model-popup"
                          className={cn(
                            "h-10 w-full",
                            !vehicleBrand.trim() && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <SelectValue
                            placeholder={vehicleBrand.trim() ? "Select model" : "Select brand first"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {allModelsSorted.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={cancelAddVehicleFromPopup}>
                  Cancel
                </Button>
                <Button type="button" onClick={doneAddVehiclePopup}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                    setVehicleBrand(t);
                    setVehicleModel("");
                    setVehicleSegment("");
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
                      toast.message("Brand already in list — select it from Search brand");
                      return;
                    }
                    setExtraBrands((prev) => [...prev, t]);
                    setVehicleBrand(t);
                    setVehicleModel("");
                    setVehicleSegment("");
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

          <Dialog open={newModelOpen} onOpenChange={setNewModelOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add model</DialogTitle>
                <DialogDescription>
                  Add a model for <span className="font-medium text-foreground">{vehicleBrand}</span> when it is
                  not listed.
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
                    if (!t || !vehicleBrand.trim()) return;
                    setExtraModelsByBrand((prev) => ({
                      ...prev,
                      [vehicleBrand]: [...(prev[vehicleBrand] ?? []), t],
                    }));
                    setVehicleModel(t);
                    const seg = getModelSegment(vehicleBrand, t);
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
                    if (!vehicleBrand.trim()) return;
                    setExtraModelsByBrand((prev) => ({
                      ...prev,
                      [vehicleBrand]: [...(prev[vehicleBrand] ?? []), t],
                    }));
                    setVehicleModel(t);
                    const seg = getModelSegment(vehicleBrand, t);
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
          </>
          )}

          {showJobWizardStep("schedule") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-w-0 max-w-md space-y-2">
                <Label className="md:hidden">Booking Date & Time</Label>
                <Label htmlFor="schedule-booking-when" className="hidden md:inline-flex">
                  Booking Date & Time
                </Label>
                <div className="min-w-0 space-y-3 md:hidden">
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule-booking-date" className="text-xs text-muted-foreground">
                      Date
                    </Label>
                    <Input
                      id="schedule-booking-date"
                      type="date"
                      min={bookingScheduleDateMin}
                      value={splitDatetimeLocal(bookingWhen).date}
                      onChange={(e) => {
                        const { time } = splitDatetimeLocal(bookingWhen);
                        let next = joinDatetimeLocal(e.target.value, time);
                        if (
                          e.target.value === bookingScheduleDateMin &&
                          next &&
                          isDatetimeLocalInPast(next)
                        ) {
                          next = joinDatetimeLocal(e.target.value, localTimeInputMinNow());
                        }
                        setBookingWhen(next);
                      }}
                      required
                      className={cn("h-10 w-full min-w-0 max-w-full", MOBILE_DATE_TIME_INPUT_ICON_END)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule-booking-time" className="text-xs text-muted-foreground">
                      Time
                    </Label>
                    <Input
                      id="schedule-booking-time"
                      type="time"
                      min={bookingScheduleTimeMin}
                      value={splitDatetimeLocal(bookingWhen).time}
                      onChange={(e) => {
                        let { date } = splitDatetimeLocal(bookingWhen);
                        if (!date) date = datetimeLocalValue(new Date()).slice(0, 10);
                        if (date < bookingScheduleDateMin) {
                          date = bookingScheduleDateMin;
                        }
                        let next = joinDatetimeLocal(date, e.target.value);
                        if (date === bookingScheduleDateMin && next && isDatetimeLocalInPast(next)) {
                          next = joinDatetimeLocal(date, localTimeInputMinNow());
                        }
                        setBookingWhen(next);
                      }}
                      required
                      className={cn("h-10 w-full min-w-0 max-w-full", MOBILE_DATE_TIME_INPUT_ICON_END)}
                    />
                  </div>
                </div>
                <div className="relative hidden md:block">
                  <Input
                    id="schedule-booking-when"
                    ref={scheduleDateInputRef}
                    type="datetime-local"
                    min={localDatetimeLocalInputMin()}
                    value={bookingWhen}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setBookingWhen(v);
                        return;
                      }
                      if (!isDatetimeLocalInPast(v)) {
                        setBookingWhen(v);
                      } else {
                        setBookingWhen(localDatetimeLocalInputMin());
                      }
                    }}
                    required
                    className="h-10 pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:bottom-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Open date and time picker"
                    onClick={() => scheduleDateInputRef.current?.showPicker?.()}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("smartSuggestions") && (
          <Card className="border-amber-200/80 dark:border-amber-900/40 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-amber-100/80 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-lg text-amber-950 dark:text-amber-100">Smart Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {previousBooked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Previously Booked
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {previousBooked.map((p) => {
                      const on = selectedMainIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleTrending(p.id)}
                          className={cn(
                            "rounded-xl border-2 px-3 py-2 text-left transition-all max-w-[220px]",
                            on
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/30"
                          )}
                        >
                          <p className="text-sm font-semibold line-clamp-2">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {p.tag} · {p.count}×
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trending at This Branch
                </p>
                <div className="flex flex-wrap gap-2">
                  {trendingServices.map((s) => {
                    const on = selectedMainIds.includes(s.id);
                    const pr = vehicleSegment ? priceForService(s, vehicleSegment) : s.defaultPrice;
                    const bookings = serviceBookingCounts.get(s.id) ?? 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleTrending(s.id)}
                        className={cn(
                          "rounded-xl border-2 p-3 text-left transition-all w-full sm:w-[calc(50%-0.25rem)] lg:w-[220px]",
                          on
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/30"
                        )}
                      >
                        <p className="text-sm font-semibold line-clamp-2">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{s.category.split(/[\s/]/)[0]}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {formatServiceDurationLabel(s)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{bookings || 1} bookings</p>
                        <p className="text-xs font-medium text-primary mt-2">{formatCurrency(pr)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("membership") && (
          <>
          <Card className="min-w-0 border-violet-200/60 dark:border-violet-900/40">
            <div className="flex items-center gap-2 rounded-t-xl bg-primary px-4 py-3 text-primary-foreground">
              <Ticket className="w-4 h-4 shrink-0 opacity-90" />
              <p className="text-sm font-bold tracking-wide">MEMBERSHIP STATUS</p>
            </div>
            <CardContent className="min-w-0 py-6 space-y-4">
              {existingCustomerId && ownedVehicles.length > 1 && vehiclesWithActiveMembership.length > 0 ? (
                <div className="rounded-lg border border-violet-200/70 bg-violet-50/40 px-3 py-2 text-xs dark:border-violet-900/45 dark:bg-violet-950/25">
                  <p className="font-medium text-foreground mb-1">Vehicles with an active pass</p>
                  <ul className="list-inside list-disc text-muted-foreground space-y-0.5">
                    {vehiclesWithActiveMembership.map((v) => (
                      <li key={v.id}>
                        <span className="font-mono">{v.registrationNumber}</span>
                        <span className="text-muted-foreground/90">
                          {" "}
                          — {v.make} {v.model}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeMembershipForSelectedVehicle && activeMembershipPackageRow ? (
                <>
                  <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                    <div className="flex items-start gap-2">
                      <Crown className="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-foreground">{activeMembershipPackageRow.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {membershipTierLabel(activeMembershipPackageRow.tier)} · valid until{" "}
                          {new Date(activeMembershipForSelectedVehicle.endDate).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {membershipLookupVehicleId || selectedVehicleId ? (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Pass applies to this vehicle (
                            {ownedVehicles.find(
                              (v) => v.id === (membershipLookupVehicleId ?? selectedVehicleId)
                            )?.registrationNumber ?? vehicleNumber}
                            ).
                          </p>
                        ) : !activeMembershipForSelectedVehicle.vehicleId ? (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Customer-wide pass — included services bill at ₹0 when you choose Yes.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Use membership on this visit?</p>
                    <p className="text-xs text-muted-foreground">
                      Yes — included services bill at ₹0; you can add paid add-ons next. No — continue with normal
                      service selection and pricing.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={membershipVisitChoice === "yes" ? "default" : "outline"}
                        className={membershipVisitChoice === "yes" ? "bg-violet-600 hover:bg-violet-700" : ""}
                        onClick={() => {
                          setMembershipVisitChoice("yes");
                          setSelectedHighEndIds([]);
                          setMembershipRedeemServiceIds([]);
                          setMembershipServicesDialogOpen(true);
                        }}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={membershipVisitChoice === "no" ? "default" : "outline"}
                        onClick={() => {
                          const redeem = membershipRedeemServiceIds;
                          setMembershipVisitChoice("no");
                          setMembershipRedeemServiceIds([]);
                          setSelectedMainIds((mains) => {
                            const r = new Set(redeem);
                            const onlyRedeem =
                              redeem.length > 0 &&
                              mains.length === redeem.length &&
                              mains.every((id) => r.has(id));
                            return onlyRedeem ? [] : mains;
                          });
                        }}
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {membershipVisitChoice === "yes" ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 border-violet-200/80"
                        onClick={() => setMembershipServicesDialogOpen(true)}
                      >
                        <ListChecks className="h-4 w-4" />
                        Included services ({membershipRedeemServiceIds.length} selected)
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Already-used included services cannot be selected again this period.
                      </p>
                    </div>
                  ) : null}

                  {(activeMembershipForSelectedVehicle.usageHistory?.length ?? 0) > 0 ? (
                    <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                      <p className="text-xs font-semibold text-foreground mb-2">Membership usage history</p>
                      <ul className="max-h-36 space-y-1.5 overflow-y-auto text-[11px] text-muted-foreground">
                        {[...(activeMembershipForSelectedVehicle.usageHistory ?? [])]
                          .sort(
                            (a: MembershipServiceUsage, b: MembershipServiceUsage) =>
                              new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
                          )
                          .map((u: MembershipServiceUsage, idx: number) => (
                            <li key={`${u.usedAt}-${u.serviceCatalogId}-${idx}`} className="flex justify-between gap-2">
                              <span className="min-w-0 truncate">
                                {u.serviceName ??
                                  serviceCatalog.find((c) => c.id === u.serviceCatalogId)?.name ??
                                  u.serviceCatalogId}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {new Date(u.usedAt).toLocaleString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : existingCustomerId &&
                !membershipLookupVehicleId &&
                ownedVehicles.length > 0 &&
                !activeMembershipForSelectedVehicle ? (
                <p className="text-sm text-muted-foreground">
                  Pick this customer&apos;s vehicle from the garage in the previous step, or enter a registration
                  that matches a saved vehicle, to see an existing pass. You can still activate a new plan below.
                </p>
              ) : activeMembershipPackages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  No active packages in the catalog.{" "}
                  <Link href="/membership" className="text-primary font-medium hover:underline">
                    Add packages in Membership
                  </Link>
                </p>
              ) : (
                <>
                  <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 px-3 py-2.5 text-xs text-muted-foreground dark:border-violet-900/45 dark:bg-violet-950/25">
                    <span className="font-medium text-foreground">No active pass for this vehicle.</span> When a pass
                    exists, you&apos;ll see <strong className="text-foreground">Yes / No</strong> here, included
                    services in a popup, and history. Otherwise activate a new plan below (linked to this job&apos;s
                    vehicle).
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional: activate a plan when the job is created, or handle it later in{" "}
                    <Link href="/membership" className="text-primary font-medium hover:underline">
                      Membership
                    </Link>
                    . Tap a selected plan again to clear.
                  </p>
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {activeMembershipPackages.map((pkg) => {
                      const selected = wizardMembershipPackageId === pkg.id;
                      const durationDays = MEMBERSHIP_TIER_DAYS[pkg.tier];
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setWizardMembershipPackageId(selected ? null : pkg.id)}
                          className={cn(
                            "flex min-h-[148px] min-w-0 flex-col rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-all",
                            selected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/25 shadow-md"
                              : "border-border hover:border-primary/40 hover:shadow-md"
                          )}
                        >
                          <p className="text-sm font-semibold leading-snug line-clamp-3">{pkg.name}</p>
                          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                            <span className="font-medium text-foreground/80">
                              {membershipTierLabel(pkg.tier)}
                            </span>
                            <span className="text-muted-foreground/80"> · {durationDays} days</span>
                          </p>
                          <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Plan price
                            </span>
                            <span className="text-base font-bold tabular-nums text-primary">
                              {formatCurrency(pkg.price)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Dialog open={membershipServicesDialogOpen} onOpenChange={setMembershipServicesDialogOpen}>
            <DialogContent className="max-h-[min(90vh,520px)] flex flex-col sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Included services</DialogTitle>
                <DialogDescription>
                  Select which included services to redeem on this visit. Used services are disabled. Bill amount for
                  these lines will be ₹0; add-ons are charged separately.
                </DialogDescription>
              </DialogHeader>
              {activeMembershipForSelectedVehicle && activeMembershipPackageRow ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
                  {activeMembershipPackageRow.includedServiceIds.map((sid) => {
                    const cat = serviceCatalog.find((c) => c.id === sid);
                    const used = getUsedIncludedServiceIds(activeMembershipForSelectedVehicle).has(sid);
                    const checked = membershipRedeemServiceIds.includes(sid);
                    return (
                      <label
                        key={sid}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
                          used ? "border-border/50 bg-muted/40 opacity-60 cursor-not-allowed" : "border-border bg-card"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={used}
                          onCheckedChange={(v) => {
                            if (used) return;
                            const on = v === true;
                            setMembershipRedeemServiceIds((prev) =>
                              on ? [...prev, sid] : prev.filter((x) => x !== sid)
                            );
                          }}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="font-medium block">{cat?.name ?? sid}</span>
                          {used ? (
                            <span className="text-[11px] text-amber-700 dark:text-amber-300">Already used</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">{cat?.category}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setMembershipServicesDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
          )}

          {showJobWizardStep("serviceSelection") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border-2 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/25">
                <div className="flex items-start gap-2">
                  <Car className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Vehicle Type (for pricing)</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Select the vehicle type to see applicable prices
                    </p>
                  </div>
                </div>
                {vehicleBrand.trim() && vehicleSegment && (
                  <p className="mt-3 text-xs text-muted-foreground rounded-md border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <span className="font-medium text-emerald-900 dark:text-emerald-100">From vehicle: </span>
                    {vehicleBrand} {vehicleModel || ""} —{" "}
                    <span className="capitalize">{segmentBannerLabel(vehicleSegment)}</span>
                    {OTHER_PRICING_SEGMENTS.some((o) => o.segment === vehicleSegment) ? (
                      <span className="text-muted-foreground"> (use buttons below to match)</span>
                    ) : null}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SERVICE_TYPE_PRIMARY.map(({ segment, label, hint, icon }) => {
                    const selected = vehicleSegment === segment;
                    return (
                      <button
                        key={segment}
                        type="button"
                        onClick={() => setVehicleSegment(segment)}
                        className={cn(
                          "rounded-xl border-2 bg-card p-3 text-left transition-all",
                          selected
                            ? "border-sky-600 bg-white shadow-md ring-1 ring-sky-600/20 dark:bg-card"
                            : "border-border hover:border-sky-300/80 hover:bg-sky-50/50 dark:hover:bg-sky-950/40"
                        )}
                      >
                        <span className="text-2xl leading-none" aria-hidden>
                          {icon}
                        </span>
                        <p className="mt-2 text-sm font-semibold">{label}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
                      </button>
                    );
                  })}
                </div>
                <details className="mt-4 group">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    More vehicle types (Luxury, MUV, Compact SUV)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 border-t border-sky-200/80 pt-3 dark:border-sky-800">
                    {OTHER_PRICING_SEGMENTS.map(({ segment, label, hint }) => (
                      <button
                        key={segment}
                        type="button"
                        onClick={() => setVehicleSegment(segment)}
                        className={cn(
                          "rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
                          vehicleSegment === segment
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/60"
                        )}
                      >
                        <span className="font-medium">{label}</span>
                        <span className="block text-[10px] text-muted-foreground">{hint}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Select Service(s)</p>
                  <p className="text-sm text-muted-foreground">
                    You can select multiple services for a single booking
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-border bg-background"
                  onClick={() => setAddServicePackageOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Service
                </Button>
                <AddServicePackageDialog
                  open={addServicePackageOpen}
                  onOpenChange={setAddServicePackageOpen}
                  onCreated={(item) => {
                    setSelectedMainIds((prev) =>
                      prev.includes(item.id) ? prev : [...prev, item.id]
                    );
                    setCategoryFilter("ALL");
                    setServiceSearch("");
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={serviceSearchInputRef}
                    id="create-booking-service-search"
                    className="pl-9 h-10"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="sm:w-[200px] h-10">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "ALL" ? "All Categories" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!branchId ? (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/20">
                    <Car className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                    <p className="text-muted-foreground">
                      Showing <strong className="text-foreground">services</strong> for{" "}
                      <strong className="text-foreground">
                        {vehicleSegment ? segmentBannerLabel(vehicleSegment) : "—"}
                      </strong>
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-sky-400/70 bg-sky-50/40 px-4 py-10 text-center dark:border-sky-600 dark:bg-sky-950/20">
                    <p className="text-base font-semibold text-sky-800 dark:text-sky-100">
                      Please FIRST SELECT A BRANCH to see available services
                    </p>
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-sky-700 underline underline-offset-4 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                      onClick={() => {
                        for (const id of [
                          "booking-branch-select-block-mobile",
                          "booking-branch-select-block",
                        ] as const) {
                          const el = document.getElementById(id);
                          if (el && el.offsetParent !== null) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            return;
                          }
                        }
                      }}
                    >
                      Select branch from the summary panel or global header
                    </button>
                  </div>
                </>
              ) : !vehicleSegment ? (
                <p className="text-sm text-amber-600 py-4 text-center rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
                  Select a vehicle type above to see priced services.
                </p>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/20">
                    <Car className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                    <p>
                      Showing <strong>services</strong> for{" "}
                      <strong className="capitalize">{segmentBannerLabel(vehicleSegment)}</strong> (
                      {filteredMainServices.length} of {activeCatalogTotal})
                    </p>
                  </div>
                  {filteredMainServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No services match filters.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredMainServices.map((s) => {
                        const pr = priceForService(s, vehicleSegment);
                        const on = selectedMainIds.includes(s.id);
                        const hasParts = Boolean(s.consumptionProfile?.length);
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleMain(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleMain(s.id);
                              }
                            }}
                            className={cn(
                              "rounded-xl border-2 p-4 text-left transition-all flex flex-col cursor-pointer min-h-0",
                              on
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border bg-card hover:border-primary/25"
                            )}
                          >
                            <Badge variant="secondary" className="w-fit mb-2 text-[10px] font-normal">
                              {s.category}
                            </Badge>
                            <p className="font-semibold text-base leading-tight">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                              {s.description}
                            </p>
                            <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                              <div>
                                <p className="text-lg font-bold text-emerald-600 tabular-nums">
                                  {formatCurrency(pr)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">+ 18.00% GST</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                {formatServiceDurationLabel(s)}
                              </div>
                            </div>
                            {!hasParts && (
                              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                <Info className="w-3 h-3 shrink-0" />
                                No parts configured
                              </p>
                            )}
                            <span
                              role="link"
                              className="text-xs text-primary mt-2 text-left hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPricingService(s);
                              }}
                            >
                              View pricing for other vehicle types
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          )}

          {highEndServices.length > 0 && showJobWizardStep("highEndServices") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  High-End Services
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Optional.</span> Tag premium programs for maintenance
                  reminders. Configured amounts (excl. GST) add to the job estimate on the right; you can skip this step
                  and continue with main services and/or add-ons only.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {highEndServices.map((hes) => {
                    const isSelected = selectedHighEndIds.includes(hes.id);
                    return (
                      <div
                        key={hes.id}
                        className={cn(
                          "rounded-lg border text-left transition-all",
                          isSelected
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-500"
                            : "border-border hover:border-amber-300 hover:bg-muted/50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedHighEndIds((prev) =>
                              isSelected ? prev.filter((id) => id !== hes.id) : [...prev, hes.id]
                            )
                          }
                          className="flex items-start gap-2.5 p-3 w-full text-left"
                        >
                          <Sparkles
                            className={cn(
                              "w-4 h-4 mt-0.5 shrink-0",
                              isSelected ? "text-amber-500" : "text-muted-foreground"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isSelected ? "text-amber-700 dark:text-amber-400" : ""
                              )}
                            >
                              {hes.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Schedule:{" "}
                              {hes.reminderIntervals.map((m) => formatHighEndIntervalMonths(m)).join(", ")}
                            </p>
                            <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">
                              +{formatCurrency(hes.estimateAmountInr ?? 0)} est. (excl. GST)
                            </p>
                          </div>
                        </button>
                        {isSelected && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-amber-200/60 dark:border-amber-900/40">
                            {hes.reminderIntervals.length > 0 && (
                              <div className="space-y-1.5">
                                <Label htmlFor={`hes-next-${hes.id}`} className="text-xs text-muted-foreground">
                                  Next follow-up
                                </Label>
                                {(() => {
                                  const monthsVal =
                                    highEndFirstFollowUpById[hes.id] ?? hes.reminderIntervals[0];
                                  const followSelectValue = hes.reminderIntervals.includes(monthsVal)
                                    ? String(monthsVal)
                                    : "__custom__";
                                  return (
                                    <>
                                      <Select
                                        value={followSelectValue}
                                        onValueChange={(v) => {
                                          if (v === "__custom__") {
                                            const next =
                                              hes.reminderIntervals.includes(monthsVal)
                                                ? defaultManualFirstFollowUpMonths(hes.reminderIntervals)
                                                : monthsVal;
                                            setHighEndFirstFollowUpById((prev) => ({
                                              ...prev,
                                              [hes.id]: next,
                                            }));
                                          } else {
                                            const months = Number.parseInt(v, 10);
                                            setHighEndFirstFollowUpById((prev) => ({
                                              ...prev,
                                              [hes.id]: months,
                                            }));
                                          }
                                        }}
                                      >
                                        <SelectTrigger
                                          id={`hes-next-${hes.id}`}
                                          className="h-9 text-xs bg-background"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {hes.reminderIntervals.map((m) => (
                                            <SelectItem key={m} value={String(m)}>
                                              {formatHighEndIntervalMonths(m)} ({m} mo)
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="__custom__">Custom (enter months)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {followSelectValue === "__custom__" && (
                                        <div className="space-y-1">
                                          <Label
                                            htmlFor={`hes-next-custom-${hes.id}`}
                                            className="text-[10px] text-muted-foreground"
                                          >
                                            Months until first reminder
                                          </Label>
                                          <Input
                                            id={`hes-next-custom-${hes.id}`}
                                            type="number"
                                            min={1}
                                            max={120}
                                            className="h-9 text-xs"
                                            value={monthsVal === 0 ? "" : String(monthsVal)}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              if (raw === "") return;
                                              const n = Math.min(
                                                120,
                                                Math.max(1, Number.parseInt(raw, 10) || 0)
                                              );
                                              if (n < 1) return;
                                              setHighEndFirstFollowUpById((prev) => ({
                                                ...prev,
                                                [hes.id]: n,
                                              }));
                                            }}
                                          />
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor={`hes-compl-${hes.id}`}
                                className="text-xs text-muted-foreground flex items-center gap-1"
                              >
                                <Clock className="w-3 h-3 shrink-0" />
                                Time to complete (planned)
                              </Label>
                              {(() => {
                                const mins = highEndCompletionMinutesById[hes.id];
                                const completionSelectValue =
                                  mins != null && mins > 0
                                    ? highEndCompletionSelectValue(mins)
                                    : "__unset__";
                                return (
                                  <>
                                    <Select
                                      value={completionSelectValue}
                                      onValueChange={(v) => {
                                        if (v === "__unset__") {
                                          setHighEndCompletionMinutesById((p) => {
                                            const next = { ...p };
                                            delete next[hes.id];
                                            return next;
                                          });
                                          return;
                                        }
                                        if (v === "__custom__") {
                                          const cur = highEndCompletionMinutesById[hes.id];
                                          const nonPreset =
                                            cur != null &&
                                            cur > 0 &&
                                            !HIGH_END_COMPLETION_PRESETS.some(
                                              (x) => x.minutes === Math.round(cur)
                                            );
                                          setHighEndCompletionMinutesById((p) => ({
                                            ...p,
                                            [hes.id]: nonPreset ? Math.round(cur!) : 480,
                                          }));
                                          return;
                                        }
                                        const minutes = Number.parseInt(v, 10);
                                        setHighEndCompletionMinutesById((p) => ({
                                          ...p,
                                          [hes.id]: minutes,
                                        }));
                                      }}
                                    >
                                      <SelectTrigger
                                        id={`hes-compl-${hes.id}`}
                                        className="h-9 text-xs bg-background"
                                      >
                                        <SelectValue placeholder="Not set" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__unset__">Not set</SelectItem>
                                        {HIGH_END_COMPLETION_PRESETS.map((p) => (
                                          <SelectItem key={p.minutes} value={String(p.minutes)}>
                                            {p.label}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="__custom__">Custom hours…</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {completionSelectValue === "__custom__" && (
                                      <div className="space-y-1">
                                        <Label
                                          htmlFor={`hes-compl-hr-${hes.id}`}
                                          className="text-[10px] text-muted-foreground"
                                        >
                                          Hours (custom)
                                        </Label>
                                        <Input
                                          id={`hes-compl-hr-${hes.id}`}
                                          type="number"
                                          min={0.5}
                                          max={720}
                                          step={0.5}
                                          inputMode="decimal"
                                          className="h-9 text-xs"
                                          value={
                                            mins != null && mins > 0
                                              ? String(Math.round((mins / 60) * 100) / 100)
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                              setHighEndCompletionMinutesById((p) => {
                                                const next = { ...p };
                                                delete next[hes.id];
                                                return next;
                                              });
                                              return;
                                            }
                                            const h = Number.parseFloat(raw.replace(",", "."));
                                            if (!Number.isFinite(h) || h <= 0) return;
                                            const capMin = Math.min(43200, Math.round(h * 60));
                                            setHighEndCompletionMinutesById((p) => ({
                                              ...p,
                                              [hes.id]: capMin,
                                            }));
                                          }}
                                        />
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedHighEndIds.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {selectedHighEndIds.length} high-end service{selectedHighEndIds.length !== 1 ? "s" : ""}{" "}
                    selected — reminders are created when the job is delivered.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {showJobWizardStep("addons") && (
          <Card ref={addonsCardRef}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">Select Add-ons (Optional)</CardTitle>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={() => setShowAddons(!showAddons)}
                >
                  {showAddons ? "Hide" : "Show"}
                  {showAddons ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-background"
                onClick={() => {
                  setShowAddons(true);
                  setAddonDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Add-on
              </Button>
              <AddAddonDialog
                open={addonDialogOpen}
                onOpenChange={setAddonDialogOpen}
                onCreated={(item) => {
                  setSelectedAddonIds((prev) =>
                    prev.includes(item.id) ? prev : [...prev, item.id]
                  );
                  window.setTimeout(() => {
                    addonsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
              />
            </CardHeader>
            {showAddons && (
              <CardContent className="space-y-2">
                {addonServices.map((s) => {
                  const pr = vehicleSegment ? priceForService(s, vehicleSegment) : s.defaultPrice;
                  const on = selectedAddonIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer"
                    >
                      <Checkbox checked={on} onCheckedChange={() => toggleAddon(s.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {formatServiceDurationLabel(s)} · + {formatCurrency(pr)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </CardContent>
            )}
          </Card>
          )}

          {showJobWizardStep("pickupDrop") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">Pickup &amp; Drop</CardTitle>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={() => setShowPickup(!showPickup)}
                >
                  {showPickup ? "Hide" : "Show"}
                </Button>
                <Badge variant="secondary" className="font-normal">
                  {pickupRequired ? "Pickup requested" : "Not Required"}
                </Badge>
              </div>
            </CardHeader>
            {showPickup && (
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Is pickup required?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pickupRequired ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPickupRequired(true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={!pickupRequired ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPickupRequired(false)}
                  >
                    No
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
          )}

          {showJobWizardStep("mechanic") && (
          <Card className="min-w-0 border-border/90">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-lg">Assign mechanic (optional)</CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Tap a mechanic to assign. Custom incentive % is optional — empty uses the catalog average from selected
                services ({catalogAvgIncentivePercent.toFixed(1)}%). Leave unassigned if you prefer to set this on the
                job card later.
                {mechanics.length > 4 ? (
                  <span className="mt-1 block text-xs">Scroll the list below if there are many mechanics.</span>
                ) : null}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 min-w-0">
              {mechanics.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center">
                  No mechanics in staff. Add staff with role Mechanic in Settings.
                </p>
              ) : (
                <div
                  className={cn(
                    "min-h-0 max-h-[min(72vh,780px)] space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y rounded-lg border border-border/40 bg-muted/10 py-2 pl-1 pr-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
                    compactJobCardDesktop && "max-h-[min(65vh,640px)]"
                  )}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
                    {mechanics.map((m) => {
                      const selected = mechanicId === m.id;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-2xl border-2 bg-card p-4 shadow-sm transition-all min-w-0",
                            selected
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/35"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setMechanicId(m.id)}
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Wrench className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold leading-snug">{m.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Mechanic</p>
                            </div>
                            {selected ? (
                              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                            ) : null}
                          </button>
                          {selected ? (
                            <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
                              <Label
                                htmlFor={`mechanic-incentive-${m.id}`}
                                className="flex items-center gap-1.5 text-xs font-medium"
                              >
                                <Percent className="h-3.5 w-3.5" />
                                Custom incentive (% of estimate)
                              </Label>
                              <Input
                                id={`mechanic-incentive-${m.id}`}
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                inputMode="decimal"
                                placeholder={catalogAvgIncentivePercent.toFixed(1)}
                                className="h-9 text-sm"
                                value={mechanicIncentivePercentOverride}
                                onChange={(e) => setMechanicIncentivePercentOverride(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <p className="text-[10px] text-muted-foreground leading-snug">
                                Empty = use catalog average ({catalogAvgIncentivePercent.toFixed(1)}% from selected
                                services).
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {mechanicId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setMechanicId("")}
                    >
                      Clear mechanic selection
                    </Button>
                  ) : null}
                </div>
              )}
              {isJobCard && (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2">
                  <Label htmlFor="odometerReading" className="text-sm font-medium">
                    Odometer reading (optional)
                  </Label>
                  <Input
                    id="odometerReading"
                    type="number"
                    placeholder="e.g. 25000"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {showJobWizardStep("notes") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Internal Notes (Not visible to customer)</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Add any internal notes for staff..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Notes (Visible to customer)</Label>
                <Textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Add any notes for the customer..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
          )}

          {isJobCard && showJobWizardStep("jobDetails") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reportedIssues">Reported issues</Label>
                  <Textarea
                    id="reportedIssues"
                    placeholder="Describe issues reported by the customer"
                    value={reportedIssues}
                    onChange={(e) => setReportedIssues(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
                  <Textarea
                    id="termsAndConditions"
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {useBookingWizard && showJobWizardStep("jobSummary") && (
            <Card className="hidden lg:block border-dashed border-primary/25 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Review &amp; create</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {isJobCard
                  ? "Use the job summary on the right to apply a coupon, select a branch, then create the job card."
                  : "Use the booking summary on the right to apply a coupon, select a branch, then create the booking."}
              </CardContent>
            </Card>
          )}
        </div>

        {useBookingWizard && (
          <div
            className={cn(
              "hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border md:flex",
              compactJobCardDesktop ? "pt-2 pb-0.5" : "pt-2.5 pb-0.5"
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={jobCreateStep === 0}
              onClick={goBackJobWizard}
            >
              Back
            </Button>
            {jobCreateStep < jobWizardStepCount - 1 ? (
              <Button type="button" size="sm" onClick={goNextJobWizard}>
                Next
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground text-right max-w-[14rem]">
                Review the summary, select branch, then create the {isJobCard ? "job card" : "booking"}.
              </span>
            )}
          </div>
        )}

        {useBookingWizard && jobWizardStepId === "jobSummary" && (
          <div className="mt-4 w-full shrink-0 pb-2 lg:hidden">
            {renderSummaryCard("booking-branch-select-block-mobile")}
          </div>
        )}

        </div>

        <aside
          className={cn(
            "mt-4 w-full shrink-0 sm:mt-6 lg:mt-0 lg:min-h-0 lg:w-[min(100%,340px)]",
            useBookingWizard &&
              cn(
                "hidden lg:flex lg:flex-col",
                compactJobCardDesktop
                  ? "lg:h-full lg:self-stretch"
                  : "lg:sticky lg:top-4 lg:z-20 lg:self-start"
              )
          )}
        >
          {renderSummaryCard("booking-branch-select-block")}
        </aside>

        {/* Mobile sticky actions */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-background px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {summaryAdvanceAmount > 0 ? "Balance due" : "Total"}
                  </p>
                  <p className="text-base font-bold text-primary tabular-nums leading-tight sm:text-lg">
                    {formatCurrency(balanceAfterAdvance)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {jobCreateStep > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={goBackJobWizard}
                    >
                      Back
                    </Button>
                  )}
                  {jobCreateStep < jobWizardStepCount - 1 ? (
                    <Button type="button" className="min-w-[5rem] font-semibold shadow-sm" onClick={goNextJobWizard}>
                      Next
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                        <Link href={isJobCard ? "/job-cards" : "/bookings"}>Cancel</Link>
                      </Button>
                      <Button
                        type="submit"
                        className="min-w-[5rem] font-semibold shadow-sm"
                        disabled={bookingWizardIncomplete}
                        title={
                          bookingWizardIncomplete ? "Complete all wizard steps first" : undefined
                        }
                      >
                        Create
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {jobCreateStep >= jobWizardStepCount - 1 && (
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Select branch in the summary above, then tap Create.
                </p>
              )}
            </div>
        </div>
      </form>
  );

  const bookingListHref = isJobCard ? "/job-cards" : "/bookings";
  const desktopTitle = isJobCard ? "New Job Card" : "Create Walk-In Booking";
  const desktopBackLabel = isJobCard ? "Back to Job Cards" : "Back to Bookings";

  return (
    <>
      {isDesktopWide ? (
        <div className="flex h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] flex-col gap-2 overflow-hidden md:gap-3">
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" className="w-fit -ml-2 h-8" asChild>
              <Link href={bookingListHref}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {desktopBackLabel}
              </Link>
            </Button>
          </div>
          <div className="shrink-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">{desktopTitle}</h1>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">
              Use Next for each step — summary and Create stay on the right.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{bookingForm}</div>
        </div>
      ) : (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              if (skipJobCardListRedirectRef.current) {
                skipJobCardListRedirectRef.current = false;
                return;
              }
              router.push(bookingListHref);
            }
          }}
        >
          <DialogContent
            className={cn(
              "flex h-[min(92vh,880px)] w-[min(100vw-1rem,1200px)] max-w-[min(100vw-1rem,1200px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl",
              "max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
            )}
          >
            <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 pb-2.5 pt-3 text-left sm:space-y-1.5 sm:px-6 sm:pb-3 sm:pt-4">
              <DialogTitle className="pr-10 text-base leading-tight sm:pr-8 sm:text-xl">
                {desktopTitle}
              </DialogTitle>
              <p className="text-xs font-medium text-foreground sm:hidden">
                Step {jobCreateStep + 1} of {jobWizardStepCount} — {JOB_WIZARD_LABEL[jobWizardStepId]}
              </p>
              <DialogDescription className="max-md:sr-only md:block md:text-sm text-muted-foreground">
                Tap Next to move through each section — one screen at a time on mobile.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {bookingForm}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={pricingService !== null} onOpenChange={(open) => !open && setPricingService(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{pricingService?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Pricing for other vehicle types (base, excl. GST)</p>
          <div className="rounded-md border divide-y">
            {pricingService &&
              (Object.entries(pricingService.segmentPricing) as [VehicleSegment, number][]).map(([seg, price]) => (
                <div key={seg} className="flex justify-between px-3 py-2 text-sm">
                  <span className="capitalize">{seg.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(price)}</span>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">+ 18.00% GST applies on the booked segment price.</p>
        </DialogContent>
      </Dialog>

      {isJobCard && (
        <Dialog
          open={checkInOpen}
          onOpenChange={(open) => {
            if (!open) dismissCheckIn();
          }}
        >
          <DialogContent
            className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0"
            showClose={false}
          >
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl">Vehicle Check-In</DialogTitle>
                  <DialogDescription className="mt-2 text-left">
                    Capture before photos to document the vehicle condition. You need at least one photo to
                    finish check-in and open the job card.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 -mr-1"
                  aria-label="Close"
                  disabled={checkInSubmitting}
                  onClick={() => dismissCheckIn()}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {checkInJob && (
                <div className="mt-4 grid gap-1.5 text-sm rounded-lg bg-muted/50 p-3 border border-border/80">
                  <p>
                    <span className="text-muted-foreground">Job </span>
                    <span className="font-mono font-semibold">{checkInJob.jobNumber}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Customer </span>
                    <span className="font-medium">{checkInJob.customerName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reg. number </span>
                    <span className="font-mono font-semibold tracking-wide">{checkInJob.vehicleRegLabel}</span>
                  </p>
                </div>
              )}
            </DialogHeader>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-2">
                <Label className="text-base">
                  Before Photos <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={checkInCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleCheckInFiles}
                  />
                  <input
                    ref={checkInFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handleCheckInFiles}
                  />
                  <Button type="button" onClick={() => checkInCameraRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button type="button" variant="outline" onClick={() => checkInFileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photos
                  </Button>
                </div>
                {checkInPhotoError && (
                  <p className="text-sm text-destructive rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                    Required: Please upload at least one before photo of the vehicle
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Upload photos of the vehicle from all sides as needed.</p>
                {checkInPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {checkInPhotos.map((p) => (
                      <div key={p.id} className="relative group w-20 h-20 rounded-md overflow-hidden border bg-muted">
                        {/* Preview uses blob/object URLs — next/image unsupported without config */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow border opacity-90 hover:opacity-100"
                          onClick={() => removeCheckInPhoto(p.id)}
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-in-damages">Initial damages (optional)</Label>
                <Textarea
                  id="check-in-damages"
                  placeholder="Note any minor damages observed…"
                  value={checkInDamages}
                  onChange={(e) => setCheckInDamages(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-in-notes">Check-in notes (optional)</Label>
                <Textarea
                  id="check-in-notes"
                  placeholder="Additional notes from check-in process…"
                  value={checkInNotesExtra}
                  onChange={(e) => setCheckInNotesExtra(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
              <Button type="button" variant="outline" disabled={checkInSubmitting} onClick={() => dismissCheckIn()}>
                Cancel
              </Button>
              <Button type="button" disabled={checkInSubmitting} onClick={() => void handleCheckInSubmit()}>
                Check In Vehicle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CustomerCreditCheckDialog
        open={customerCreditDialogOpen && isJobCard}
        onOpenChange={setCustomerCreditDialogOpen}
        customerId={existingCustomerId}
        customerName={customerName}
      />
    </>
  );
}
