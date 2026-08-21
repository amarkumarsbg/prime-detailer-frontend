"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn, formatDate } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings-store";
import {
  CATEGORY_REMINDER_TYPES,
  CATEGORY_REMINDER_TYPE_LABELS,
  REMINDER_FREQUENCY_LABELS,
  SCHEDULABLE_REMINDER_FREQUENCIES,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";
import { useOrganizationStore } from "@/store/organization-store";
import { useHighEndServiceStore, buildHighEndSegmentPricing, highEndDefaultEstimate } from "@/store/high-end-service-store";
import {
  EMPTY_HIGH_END_PRICE_DRAFT,
  HighEndSegmentPricingFields,
} from "@/components/settings/high-end-segment-pricing-fields";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { BrandingThemePanel } from "@/components/settings/branding-theme-panel";
import type { VehicleSegment } from "@/types";
import {
  Building2,
  Receipt,
  Gift,
  Bell,
  Save,
  Percent,
  IndianRupee,
  Coins,
  Clock,
  Mail,
  Phone,
  MapPin,
  FileText,
  Scale,
  Award,
  CalendarClock,
  ShieldCheck,
  Check,
  X,
  MessageCircle,
  Sparkles,
  Plus,
  Trash2,
  Car,
  Pencil,
  CreditCard,
} from "lucide-react";
import {
  branchLimitLabel,
  resolveContactUsUrl,
  resolveSupportPhone,
} from "@/lib/plan-limits";
import {
  formatPaymentStatus,
  termLabelFromMonths,
} from "@/lib/subscription-export-lock";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";
import { SubscriptionBillsSection } from "@/components/billing/subscription-bills-section";
import { SubscriptionRenewDialog } from "@/components/billing/subscription-renew-banner";

const DEFAULT_TERMS = `1. Vehicle will be kept in secure parking during service.
2. Not responsible for valuables left in vehicle.
3. Warranty: 30 days on parts replaced, 7 days on labor.
4. Payment due upon delivery.
5. Estimated delivery time is subject to parts availability.`;

const STAFF_PERMISSIONS_MATRIX = [
  { permission: "Create Job Card", admin: true, staff: true },
  { permission: "Convert to Bill", admin: true, staff: true },
  { permission: "Create Estimate", admin: true, staff: true },
  { permission: "Add Expenses", admin: true, staff: true },
  { permission: "Modify Finalized Bill", admin: true, staff: false },
  { permission: "Delete Customers/Jobs", admin: true, staff: false },
  { permission: "Manage Services", admin: true, staff: false },
  { permission: "View Reports", admin: true, staff: true },
  { permission: "Manage Inventory", admin: true, staff: false },
  { permission: "Access Wallet/Referrals", admin: true, staff: false },
] as const;

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      enabled ? "bg-primary" : "bg-muted"
    )}>
      <span className={cn(
        "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        enabled ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore();
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const refreshEntitlement = useOrganizationStore((s) => s.refreshEntitlement);
  const [renewOpen, setRenewOpen] = useState(false);
  const highEndStore = useHighEndServiceStore();
  const vehicleCatalog = useVehicleCatalogStore();
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelSegment, setNewModelSegment] = useState<VehicleSegment>("HATCHBACK");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [businessPhone, setBusinessPhone] = useState(settings.businessPhone);
  const [businessEmail, setBusinessEmail] = useState(settings.businessEmail);
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress);
  const [gstRegistrationStatus, setGstRegistrationStatus] = useState(settings.gstRegistrationStatus);
  const [gstin, setGstin] = useState(settings.gstin);
  const [bankName, setBankName] = useState(settings.bankName);
  const [bankBranch, setBankBranch] = useState(settings.bankBranch);
  const [bankAccountNumber, setBankAccountNumber] = useState(settings.bankAccountNumber);
  const [bankIfsc, setBankIfsc] = useState(settings.bankIfsc);
  const [bankUpi, setBankUpi] = useState(settings.bankUpi);

  const [defaultTaxRate, setDefaultTaxRate] = useState("18");
  const [taxRates, setTaxRates] = useState([
    { id: "1", category: "General Service", rate: "18" },
    { id: "2", category: "Spare Parts", rate: "28" },
    { id: "3", category: "Labour", rate: "18" },
    { id: "4", category: "AC Service", rate: "18" },
    { id: "5", category: "Body Work", rate: "18" },
  ]);

  const [earningRate, setEarningRate] = useState("1");
  const [redemptionValue, setRedemptionValue] = useState("0.25");
  const [referralBonus, setReferralBonus] = useState("100");
  const [minRedeemPoints, setMinRedeemPoints] = useState("200");

  const [notifJobUpdate, setNotifJobUpdate] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifNewCustomer, setNotifNewCustomer] = useState(false);
  const [notifLowStock, setNotifLowStock] = useState(true);
  const [autoCleanupDays, setAutoCleanupDays] = useState("10");

  const [currency, setCurrency] = useState("INR");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");

  const [termsText, setTermsText] = useState(DEFAULT_TERMS);

  const [mechanicIncentivePercent, setMechanicIncentivePercent] = useState("5");
  const [highEndIncentivePercent, setHighEndIncentivePercent] = useState("10");
  const [incentiveCapPerJob, setIncentiveCapPerJob] = useState("5000");

  const reminderLeadDays = useSettingsStore((s) => s.reminderLeadDays);
  const reminderPaymentFrequency = useSettingsStore((s) => s.reminderPaymentFrequency);
  const reminderCategoryFrequencies = useSettingsStore((s) => s.reminderCategoryFrequencies);
  const setReminderLeadDays = useSettingsStore((s) => s.setReminderLeadDays);
  const setReminderPaymentFrequency = useSettingsStore((s) => s.setReminderPaymentFrequency);
  const setReminderCategoryFrequency = useSettingsStore((s) => s.setReminderCategoryFrequency);

  const [newHesName, setNewHesName] = useState("");
  const [newHesTotalYears, setNewHesTotalYears] = useState("5");
  const [newHesIntervalMonths, setNewHesIntervalMonths] = useState("6");
  const [newHesPrices, setNewHesPrices] = useState({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  const [addHesOpen, setAddHesOpen] = useState(false);
  const [editingHesId, setEditingHesId] = useState<string | null>(null);
  const [editHesName, setEditHesName] = useState("");
  const [editHesPrices, setEditHesPrices] = useState({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  const [editHesIntervalMonths, setEditHesIntervalMonths] = useState("6");
  const [editHesTotalYears, setEditHesTotalYears] = useState("5");

  const buildReminderIntervals = (intervalMonths: number, totalYears: number): number[] => {
    const intervals: number[] = [];
    for (let m = intervalMonths; m <= totalYears * 12; m += intervalMonths) {
      intervals.push(m);
    }
    return intervals;
  };

  /** Infer step from existing schedule (defaults to first interval or 6). */
  const inferredIntervalMonths = (intervals: number[]): number => {
    if (intervals.length === 0) return 6;
    if (intervals.length === 1) return intervals[0]!;
    const step = intervals[1]! - intervals[0]!;
    return step > 0 ? step : intervals[0]!;
  };

  const formatIntervalLabel = (months: number) => {
    if (months === 3) return "Every 3 months";
    if (months === 6) return "Every 6 months";
    if (months === 12) return "Every 1 year";
    return `Every ${months} months`;
  };

  const startEditHighEndService = (svc: (typeof highEndStore.services)[number]) => {
    setEditingHesId(svc.id);
    setEditHesName(svc.name);
    const sp = svc.segmentPricing;
    const fallback = String(svc.estimateAmountInr ?? "");
    setEditHesPrices({
      HATCHBACK: sp?.HATCHBACK ? String(sp.HATCHBACK) : fallback,
      SEDAN: sp?.SEDAN ? String(sp.SEDAN) : fallback,
      SUV: sp?.SUV ? String(sp.SUV) : fallback,
      BIKE: sp?.BIKE ? String(sp.BIKE) : fallback,
    });
    setEditHesIntervalMonths(String(inferredIntervalMonths(svc.reminderIntervals)));
    setEditHesTotalYears(String(svc.totalYears));
  };

  const cancelEditHighEndService = () => {
    setEditingHesId(null);
  };

  const saveEditHighEndService = () => {
    if (!editingHesId) return;
    const name = editHesName.trim();
    if (!name) {
      toast.error("Enter service name");
      return;
    }
    const totalYears = parseInt(editHesTotalYears, 10) || 5;
    const intervalMonths = parseInt(editHesIntervalMonths, 10) || 6;
    const parsed = {
      HATCHBACK: Math.max(0, parseFloat(editHesPrices.HATCHBACK) || 0),
      SEDAN: Math.max(0, parseFloat(editHesPrices.SEDAN) || 0),
      SUV: Math.max(0, parseFloat(editHesPrices.SUV) || 0),
      BIKE: Math.max(0, parseFloat(editHesPrices.BIKE) || 0),
    };
    if (parsed.HATCHBACK === 0 && parsed.SEDAN === 0 && parsed.SUV === 0 && parsed.BIKE === 0) {
      toast.error("Enter at least one vehicle type price");
      return;
    }
    const segmentPricing = buildHighEndSegmentPricing(parsed);
    highEndStore.updateService(editingHesId, {
      name,
      estimateAmountInr: highEndDefaultEstimate(segmentPricing),
      segmentPricing,
      totalYears,
      reminderIntervals: buildReminderIntervals(intervalMonths, totalYears),
    });
    setEditingHesId(null);
    toast.success(`"${name}" saved`);
  };

  const resetAddHighEndForm = () => {
    setNewHesName("");
    setNewHesTotalYears("5");
    setNewHesIntervalMonths("6");
    setNewHesPrices({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  };

  const openAddHighEndService = () => {
    resetAddHighEndForm();
    setAddHesOpen(true);
  };

  const handleAddHighEndService = () => {
    if (!newHesName.trim()) { toast.error("Enter service name"); return; }
    const totalYears = parseInt(newHesTotalYears, 10) || 5;
    const intervalMonths = parseInt(newHesIntervalMonths, 10) || 6;
    const intervals = buildReminderIntervals(intervalMonths, totalYears);
    const parsed = {
      HATCHBACK: Math.max(0, parseFloat(newHesPrices.HATCHBACK) || 0),
      SEDAN: Math.max(0, parseFloat(newHesPrices.SEDAN) || 0),
      SUV: Math.max(0, parseFloat(newHesPrices.SUV) || 0),
      BIKE: Math.max(0, parseFloat(newHesPrices.BIKE) || 0),
    };
    if (parsed.HATCHBACK === 0 && parsed.SEDAN === 0 && parsed.SUV === 0 && parsed.BIKE === 0) {
      toast.error("Enter at least one vehicle type price");
      return;
    }
    const segmentPricing = buildHighEndSegmentPricing(parsed);
    const name = newHesName.trim();
    highEndStore.addService({
      name,
      reminderIntervals: intervals,
      totalYears,
      estimateAmountInr: highEndDefaultEstimate(segmentPricing),
      segmentPricing,
    });
    resetAddHighEndForm();
    setAddHesOpen(false);
    toast.success(`"${name}" added as high-end service`);
  };

  const handleSave = (section: string) => {
    if (section === "Business profile") {
      settings.setBusinessProfile({
        gstRegistrationStatus,
        businessName,
        businessPhone,
        businessEmail,
        businessAddress,
        gstin,
        bankName,
        bankBranch,
        bankAccountNumber,
        bankIfsc,
        bankUpi,
      });
    }

    if (section === "Tax & Billing settings") {
      settings.setBusinessProfile({
        gstRegistrationStatus,
        gstin,
      });
    }

    toast.success(`${section} saved successfully`);
  };

  const handleTaxRateChange = (id: string, rate: string) => {
    setTaxRates((prev) => prev.map((t) => (t.id === id ? { ...t, rate } : t)));
  };

  const isGstRegistered = gstRegistrationStatus === "REGISTERED";

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Settings" />

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="branding">Branding & Theme</TabsTrigger>
          <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Catalog</TabsTrigger>
          <TabsTrigger value="high-end">High-End Services</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="staff-permissions">Staff Permissions</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="plan">Plan & billing</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <BrandingThemePanel />
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Plan & billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entitlement ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current plan</p>
                      <p className="font-medium">{entitlement.subscription.planName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Term</p>
                      <p className="font-medium">
                        {termLabelFromMonths(entitlement.subscription.termMonths ?? 12)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-medium">
                        {entitlement.subscription.expiresAt ||
                        entitlement.subscription.currentPeriodEnd
                          ? formatDate(
                              entitlement.subscription.expiresAt ??
                                entitlement.subscription.currentPeriodEnd!
                            )
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Branch usage</p>
                      <p className="font-medium">
                        {entitlement.usage.branchesUsed} /{" "}
                        {branchLimitLabel(entitlement.subscription.effectiveMaxBranches)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment status</p>
                      <p className="font-medium">
                        {formatPaymentStatus(entitlement.subscription.paymentStatus)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Exports</p>
                      <p className="font-medium">
                        {entitlement.canExportData === false ||
                        entitlement.subscription.exportLocked
                          ? "Locked"
                          : "Available"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your business data is never deleted when a subscription expires. Exports lock
                    when 30 days or fewer remain until expiry.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => setRenewOpen(true)}>
                      Renew subscription / Pay now
                    </Button>
                    <PlanCtaButton
                      href={resolveContactUsUrl(entitlement)}
                      phone={resolveSupportPhone(entitlement)}
                      dialogTitle="Contact support"
                    >
                      Contact support
                    </PlanCtaButton>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refreshEntitlement()}
                    >
                      Refresh status
                    </Button>
                  </div>
                  <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unable to load plan details. Refresh the page or contact support.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Business Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Phone</Label>
                        <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email</Label>
                        <Input value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Address</Label>
                      <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>GST Registration</Label>
                      <Select value={gstRegistrationStatus} onValueChange={(value) => setGstRegistrationStatus(value as "REGISTERED" | "NOT_REGISTERED")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGISTERED">GST Registered</SelectItem>
                          <SelectItem value="NOT_REGISTERED">GST Not Registered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />GSTIN</Label>
                      <Input
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        className="font-mono"
                        disabled={gstRegistrationStatus === "NOT_REGISTERED"}
                        placeholder={gstRegistrationStatus === "NOT_REGISTERED" ? "Not required for non-GST business" : undefined}
                      />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-lg border border-border/70 p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-muted-foreground">Bank & UPI Details (For Payment QR)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bank Name</Label>
                          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Branch Name</Label>
                          <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>IFSC Code</Label>
                          <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className="font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-primary font-medium">Merchant UPI ID (e.g. name@bank)</Label>
                        <Input value={bankUpi} onChange={(e) => setBankUpi(e.target.value)} placeholder="name@bank" className="font-semibold" />
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <SubscriptionBillsSection />
                <Separator />
                <Button onClick={() => handleSave("Business profile")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Tax Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">GST Registration</p>
                      <p className="text-xs text-muted-foreground">Choose whether invoices should be issued as tax invoices or plain invoices.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Status</Label>
                    <Select value={gstRegistrationStatus} onValueChange={(value) => setGstRegistrationStatus(value as "REGISTERED" | "NOT_REGISTERED")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REGISTERED">GST Registered</SelectItem>
                        <SelectItem value="NOT_REGISTERED">GST Not Registered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" />Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                    className={cn("max-w-32", !isGstRegistered && "opacity-60")}
                    disabled={!isGstRegistered}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Category-wise Tax Rates</p>
                  {taxRates.map((t) => (
                    <div key={t.id} className="flex items-center gap-4">
                      <span className="text-sm min-w-[140px]">{t.category}</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={t.rate}
                          onChange={(e) => handleTaxRateChange(t.id, e.target.value)}
                          className={cn("w-20 h-9", !isGstRegistered && "opacity-60")}
                          disabled={!isGstRegistered}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <Button onClick={() => handleSave("Tax & Billing settings")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Rewards & Referral Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" />Points Earning Rate</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={earningRate} onChange={(e) => setEarningRate(e.target.value)} className="w-24" />
                    <span className="text-sm text-muted-foreground">points per ₹100 spent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Redemption Value</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">1 point =</span>
                    <span className="text-sm text-muted-foreground">₹</span>
                    <Input type="number" step="0.01" value={redemptionValue} onChange={(e) => setRedemptionValue(e.target.value)} className="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" />Referral Bonus Points</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={referralBonus} onChange={(e) => setReferralBonus(e.target.value)} className="w-24" />
                    <span className="text-sm text-muted-foreground">points for both referrer and new customer</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Points to Redeem</Label>
                  <Input type="number" value={minRedeemPoints} onChange={(e) => setMinRedeemPoints(e.target.value)} className="w-24" />
                </div>
                <Separator />
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">Example Calculation</p>
                  <p className="text-xs text-muted-foreground">
                    Customer spends ₹5,000 → Earns {(5000 / 100 * Number(earningRate)).toFixed(0)} points →
                    Worth ₹{(5000 / 100 * Number(earningRate) * Number(redemptionValue)).toFixed(2)} discount
                  </p>
                </div>
                <Button onClick={() => handleSave("Rewards configuration")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-2xl">
                <div className="space-y-2">
                  <Label>Default Terms & Conditions</Label>
                  <Textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Enter your default terms and conditions..."
                  />
                </div>
                <Button onClick={() => handleSave("Terms & Conditions")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentives">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4" />
                Incentive Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" />Default Mechanic Incentive (%)</Label>
                    <Input
                      type="number"
                      value={mechanicIncentivePercent}
                      onChange={(e) => setMechanicIncentivePercent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" />High-end Service Incentive (%)</Label>
                    <Input
                      type="number"
                      value={highEndIncentivePercent}
                      onChange={(e) => setHighEndIncentivePercent(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Incentive Cap per Job (₹)</Label>
                  <Input
                    type="number"
                    value={incentiveCapPerJob}
                    onChange={(e) => setIncentiveCapPerJob(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3 space-y-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" />
                    Referral wallet rewards
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Referrer and new-customer wallet amounts, % of job, minimum job total, and
                    program on/off are configured on the{" "}
                    <Link href="/referrals" className="font-medium text-primary underline-offset-2 hover:underline">
                      Referrals
                    </Link>{" "}
                    page. Changes there apply immediately to pre-invoice and payment credits.
                  </p>
                </div>
                <Separator />
                <Button onClick={() => handleSave("Incentive settings")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Reminder Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Defaults for service-category and pending-payment reminders. PPF / Ceramic schedules
                stay under High-End Services (custom month intervals).
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Default intervals by service category</p>
                  <div className="grid gap-4">
                    {CATEGORY_REMINDER_TYPES.map((type) => (
                      <div key={type} className="flex items-center justify-between gap-4">
                        <Label className="min-w-[160px]">{CATEGORY_REMINDER_TYPE_LABELS[type]}</Label>
                        <Select
                          value={reminderCategoryFrequencies[type] ?? "MONTHLY"}
                          onValueChange={(v) =>
                            setReminderCategoryFrequency(type, v as SchedulableReminderFrequency)
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULABLE_REMINDER_FREQUENCIES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {REMINDER_FREQUENCY_LABELS[f]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Pending payment reminders</p>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="min-w-[160px]">Default frequency</Label>
                    <Select
                      value={reminderPaymentFrequency}
                      onValueChange={(v) =>
                        setReminderPaymentFrequency(v as SchedulableReminderFrequency)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULABLE_REMINDER_FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {REMINDER_FREQUENCY_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used when an invoice is unpaid or partially paid. Reminders stop when outstanding
                    is cleared.
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium">WhatsApp Reminders</p>
                      <p className="text-xs text-muted-foreground">
                        When enabled, due reminders may be sent automatically (manual send still
                        available on the Reminders page)
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.whatsappReminderEnabled}
                    onToggle={() => settings.setWhatsappReminderEnabled(!settings.whatsappReminderEnabled)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reminder Lead Days</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={String(reminderLeadDays)}
                      onChange={(e) => setReminderLeadDays(Number(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days before due date</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How many days before the due date a reminder becomes Due / eligible to send
                  </p>
                </div>
                <Separator />
                <Button
                  onClick={() => {
                    toast.success("Reminder settings saved");
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff-permissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Staff Permissions
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Read-only view of role-based permissions</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium">Permission</th>
                      <th className="text-center py-3 px-4 font-medium">Admin</th>
                      <th className="text-center py-3 px-4 font-medium">Staff / Mechanic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAFF_PERMISSIONS_MATRIX.map((row) => (
                      <tr key={row.permission} className="border-b border-border last:border-0">
                        <td className="py-3 px-4 text-sm">{row.permission}</td>
                        <td className="py-3 px-4 text-center">
                          {row.admin ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.staff ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-xl">
                {[
                  { label: "Job card status updates", desc: "Notify when job card status changes", enabled: notifJobUpdate, toggle: () => setNotifJobUpdate((v) => !v) },
                  { label: "Payment received", desc: "Notify when a payment is recorded", enabled: notifPayment, toggle: () => setNotifPayment((v) => !v) },
                  { label: "Service reminders", desc: "Notify when a service reminder is due", enabled: notifReminder, toggle: () => setNotifReminder((v) => !v) },
                  { label: "New customer registration", desc: "Notify when a new customer signs up", enabled: notifNewCustomer, toggle: () => setNotifNewCustomer((v) => !v) },
                  { label: "Low stock alerts", desc: "Notify when inventory items are below reorder level", enabled: notifLowStock, toggle: () => setNotifLowStock((v) => !v) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ToggleSwitch enabled={item.enabled} onToggle={item.toggle} />
                  </div>
                ))}
                <div className="pt-4">
                  <Button onClick={() => handleSave("Notification preferences")}>
                    <Save className="w-4 h-4 mr-2" />Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicle Brands & Models
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage the brands and models available in the system. When a new vehicle launches in the market, add it here.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Add New Brand</Label>
                  <Input
                    placeholder="e.g. BYD, Rivian"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!newBrandName.trim()) return;
                    if (vehicleCatalog.brands.some((b) => b.name.toLowerCase() === newBrandName.trim().toLowerCase())) {
                      toast.error("Brand already exists");
                      return;
                    }
                    vehicleCatalog.addBrand(newBrandName.trim());
                    setNewBrandName("");
                    toast.success(`${newBrandName.trim()} added`);
                  }}
                  disabled={!newBrandName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Brand
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                {vehicleCatalog.brands.map((brand) => (
                  <div key={brand.id} className="border rounded-lg">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedBrandId(selectedBrandId === brand.id ? null : brand.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{brand.name}</span>
                        <Badge variant="secondary" className="text-xs">{brand.models.length} models</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            vehicleCatalog.removeBrand(brand.id);
                            toast.success(`${brand.name} removed`);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {selectedBrandId === brand.id && (
                      <div className="border-t p-3 bg-muted/30 space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Model Name</Label>
                            <Input
                              placeholder="e.g. Swift, Creta"
                              value={newModelName}
                              onChange={(e) => setNewModelName(e.target.value)}
                            />
                          </div>
                          <div className="w-36 space-y-1">
                            <Label className="text-xs">Segment</Label>
                            <Select value={newModelSegment} onValueChange={(v) => setNewModelSegment(v as VehicleSegment)}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                                <SelectItem value="SEDAN">Sedan</SelectItem>
                                <SelectItem value="COMPACT_SUV">Compact SUV</SelectItem>
                                <SelectItem value="SUV">SUV</SelectItem>
                                <SelectItem value="MUV">MUV</SelectItem>
                                <SelectItem value="LUXURY">Luxury</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!newModelName.trim()) return;
                              vehicleCatalog.addModel(brand.id, newModelName.trim(), newModelSegment);
                              setNewModelName("");
                            }}
                            disabled={!newModelName.trim()}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {brand.models.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {brand.models.map((model) => (
                              <Badge key={model.name} variant="outline" className="gap-1 pr-1">
                                {model.name}
                                <span className="text-[10px] text-muted-foreground ml-0.5">
                                  ({model.segment === "COMPACT_SUV" ? "C-SUV" : model.segment === "HATCHBACK" ? "HB" : model.segment})
                                </span>
                                <button
                                  onClick={() => vehicleCatalog.removeModel(brand.id, model.name)}
                                  className="ml-0.5 rounded-full hover:bg-destructive/10 p-0.5"
                                >
                                  <X className="w-3 h-3 text-destructive" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No models added yet</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="high-end" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  High-End Services
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage premium programs: each can have an estimated amount (excl. GST) added on the job card when
                  selected, plus maintenance reminders after delivery.
                </p>
              </div>
              <Button
                type="button"
                className="shrink-0 w-full sm:w-auto"
                onClick={openAddHighEndService}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add new service
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {highEndStore.services.map((svc) => {
                  const intervalMonths = inferredIntervalMonths(svc.reminderIntervals);
                  const isEditing = editingHesId === svc.id;
                  const draftIntervals = isEditing
                    ? buildReminderIntervals(
                        parseInt(editHesIntervalMonths, 10) || 6,
                        parseInt(editHesTotalYears, 10) || 5
                      )
                    : svc.reminderIntervals;

                  return (
                    <div
                      key={svc.id}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5 sm:col-span-1">
                              <Label className="text-xs">Service name</Label>
                              <Input
                                value={editHesName}
                                onChange={(e) => setEditHesName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Reminder interval</Label>
                              <Select
                                value={editHesIntervalMonths}
                                onValueChange={setEditHesIntervalMonths}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">Every 3 months</SelectItem>
                                  <SelectItem value="6">Every 6 months</SelectItem>
                                  <SelectItem value="12">Every 1 year</SelectItem>
                                  {![3, 6, 12].includes(Number(editHesIntervalMonths)) && (
                                    <SelectItem value={editHesIntervalMonths}>
                                      {formatIntervalLabel(Number(editHesIntervalMonths))} (current)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Total duration</Label>
                              <Select
                                value={editHesTotalYears}
                                onValueChange={setEditHesTotalYears}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 year</SelectItem>
                                  <SelectItem value="2">2 years</SelectItem>
                                  <SelectItem value="3">3 years</SelectItem>
                                  <SelectItem value="5">5 years</SelectItem>
                                  {![1, 2, 3, 5].includes(Number(editHesTotalYears)) && (
                                    <SelectItem value={editHesTotalYears}>
                                      {editHesTotalYears} years (current)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <HighEndSegmentPricingFields
                            values={editHesPrices}
                            onChange={setEditHesPrices}
                          />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <p className="font-medium">{svc.name}</p>
                              <p className="text-sm text-muted-foreground tabular-nums">
                                {(() => {
                                  const sp = svc.segmentPricing;
                                  const priced = sp
                                    ? [sp.HATCHBACK, sp.SEDAN, sp.SUV, sp.BIKE].filter((n) => n > 0)
                                    : [];
                                  const min =
                                    priced.length > 0
                                      ? Math.min(...priced)
                                      : svc.estimateAmountInr ?? 0;
                                  return sp && priced.length > 1
                                    ? `from ₹${min.toLocaleString("en-IN")} excl. GST`
                                    : `₹${min.toLocaleString("en-IN")} excl. GST`;
                                })()}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatIntervalLabel(intervalMonths)} · {svc.totalYears} year
                              {svc.totalYears !== 1 ? "s" : ""}
                            </p>
                            {svc.segmentPricing && (
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/30">
                                <span>Hatchback: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.HATCHBACK ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>Sedan: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.SEDAN ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>SUV: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.SUV ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>Bike: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.BIKE ?? 0).toLocaleString("en-IN")}</strong></span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {draftIntervals.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
                            >
                              {m >= 12 && m % 12 === 0 ? `${m / 12}yr` : `${m}mo`}
                            </span>
                          ))}
                        </div>
                        {isEditing && (
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={saveEditHighEndService}>
                              <Save className="w-3.5 h-3.5 mr-1.5" />
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEditHighEndService}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {!isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => startEditHighEndService(svc)}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={isEditing}
                          onClick={() => {
                            if (editingHesId === svc.id) setEditingHesId(null);
                            highEndStore.removeService(svc.id);
                            toast.success(`"${svc.name}" removed`);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {highEndStore.services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No high-end services configured</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openAddHighEndService}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add new service
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={addHesOpen}
            onOpenChange={(open) => {
              setAddHesOpen(open);
              if (!open) resetAddHighEndForm();
            }}
          >
            <DialogContent
              className={cn(dialogMobileSheetContentClasses, "max-h-[min(90dvh,780px)] sm:max-w-2xl")}
            >
              <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pr-12")}>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </span>
                  Add high-end service
                </DialogTitle>
                <DialogDescription>
                  Set prices by vehicle type and the reminder schedule used on job cards.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hes-name">Service name</Label>
                  <Input
                    id="hes-name"
                    placeholder="e.g. PPF Coating, Ceramic"
                    value={newHesName}
                    onChange={(e) => setNewHesName(e.target.value)}
                    autoFocus
                  />
                </div>
                <HighEndSegmentPricingFields
                  values={newHesPrices}
                  onChange={setNewHesPrices}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Reminder interval</Label>
                    <Select value={newHesIntervalMonths} onValueChange={setNewHesIntervalMonths}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Every 3 months</SelectItem>
                        <SelectItem value="6">Every 6 months</SelectItem>
                        <SelectItem value="12">Every 1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total duration</Label>
                    <Select value={newHesTotalYears} onValueChange={setNewHesTotalYears}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 year</SelectItem>
                        <SelectItem value="2">2 years</SelectItem>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setAddHesOpen(false);
                    resetAddHighEndForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={handleAddHighEndService}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add service
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Time Zone</Label>
                    <Select value={timeZone} onValueChange={setTimeZone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Auto-delete Inspection Photos After</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={autoCleanupDays} onChange={(e) => setAutoCleanupDays(e.target.value)} className="w-20" />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Set to 0 to keep photos indefinitely</p>
                </div>
                <Separator />
                <Button onClick={() => handleSave("General preferences")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
