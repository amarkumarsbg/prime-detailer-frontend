"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings-store";
import { useHighEndServiceStore } from "@/store/high-end-service-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
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
} from "lucide-react";

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
  const [referralRewardAmount, setReferralRewardAmountLocal] = useState(String(settings.referralRewardAmount));
  const [newCustomerDiscount, setNewCustomerDiscountLocal] = useState(String(settings.newCustomerDiscount));

  const [reminderGeneralService, setReminderGeneralService] = useState("monthly");
  const [reminderOilChange, setReminderOilChange] = useState("3months");
  const [reminderPpfMaintenance, setReminderPpfMaintenance] = useState("6months");
  const [reminderCeramicMaintenance, setReminderCeramicMaintenance] = useState("6months");
  const [reminderLeadDays, setReminderLeadDays] = useState("7");

  const [newHesName, setNewHesName] = useState("");
  const [newHesTotalYears, setNewHesTotalYears] = useState("5");
  const [newHesIntervalMonths, setNewHesIntervalMonths] = useState("6");
  const [newHesEstimate, setNewHesEstimate] = useState("0");

  const handleAddHighEndService = () => {
    if (!newHesName.trim()) { toast.error("Enter service name"); return; }
    const totalYears = parseInt(newHesTotalYears, 10) || 5;
    const intervalMonths = parseInt(newHesIntervalMonths, 10) || 6;
    const intervals: number[] = [];
    for (let m = intervalMonths; m <= totalYears * 12; m += intervalMonths) {
      intervals.push(m);
    }
    const estimateAmountInr = Math.max(0, parseInt(newHesEstimate, 10) || 0);
    highEndStore.addService({
      name: newHesName.trim(),
      reminderIntervals: intervals,
      totalYears,
      estimateAmountInr,
    });
    setNewHesName("");
    setNewHesTotalYears("5");
    setNewHesIntervalMonths("6");
    setNewHesEstimate("0");
    toast.success(`"${newHesName.trim()}" added as high-end service`);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Settings" />

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="tax">Tax & Billing</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="incentives">Incentives</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Catalog</TabsTrigger>
          <TabsTrigger value="high-end">High-End Services</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="staff-permissions">Staff Permissions</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Business Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <Label>Business Name</Label>
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
                <div className="border-t border-border pt-4 mt-4 space-y-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-primary font-medium">Merchant UPI ID (e.g. name@bank)</Label>
                      <Input value={bankUpi} onChange={(e) => setBankUpi(e.target.value)} placeholder="name@bank" className="font-semibold" />
                    </div>
                  </div>
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" />Referral Reward Amount (₹)</Label>
                    <Input
                      type="number"
                      value={referralRewardAmount}
                      onChange={(e) => {
                        setReferralRewardAmountLocal(e.target.value);
                        const num = Number(e.target.value);
                        if (!isNaN(num) && num >= 0) settings.setReferralRewardAmount(num);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />New Customer Discount (₹)</Label>
                    <Input
                      type="number"
                      value={newCustomerDiscount}
                      onChange={(e) => {
                        setNewCustomerDiscountLocal(e.target.value);
                        const num = Number(e.target.value);
                        if (!isNaN(num) && num >= 0) settings.setNewCustomerDiscount(num);
                      }}
                    />
                  </div>
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
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Default Reminder Intervals by Service Type</p>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[160px]">General Service</Label>
                      <Select value={reminderGeneralService} onValueChange={setReminderGeneralService}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="3months">Every 3 months</SelectItem>
                          <SelectItem value="6months">Every 6 months</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[160px]">Oil Change</Label>
                      <Select value={reminderOilChange} onValueChange={setReminderOilChange}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="3months">Every 3 months</SelectItem>
                          <SelectItem value="6months">Every 6 months</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[160px]">PPF Maintenance</Label>
                      <Select value={reminderPpfMaintenance} onValueChange={setReminderPpfMaintenance}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="3months">Every 3 months</SelectItem>
                          <SelectItem value="6months">Every 6 months</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[160px]">Ceramic Maintenance</Label>
                      <Select value={reminderCeramicMaintenance} onValueChange={setReminderCeramicMaintenance}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="3months">Every 3 months</SelectItem>
                          <SelectItem value="6months">Every 6 months</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium">WhatsApp Reminders</p>
                      <p className="text-xs text-muted-foreground">Send service reminders via WhatsApp</p>
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
                      value={reminderLeadDays}
                      onChange={(e) => setReminderLeadDays(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days before due date</span>
                  </div>
                  <p className="text-xs text-muted-foreground">How many days before the due date to send reminders</p>
                </div>
                <Separator />
                <Button onClick={() => handleSave("Reminder settings")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                High-End Services
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage premium programs: each can have an estimated amount (excl. GST) added on the job card when
                selected, plus maintenance reminders after delivery.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing high-end services */}
              <div className="space-y-3">
                {highEndStore.services.map((svc) => (
                  <div key={svc.id} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <p className="font-medium">{svc.name}</p>
                        <span className="text-[10px] text-muted-foreground">Est. (₹ excl. GST)</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24 text-xs"
                          value={String(svc.estimateAmountInr ?? 0)}
                          onChange={(e) => {
                            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                            highEndStore.updateService(svc.id, { estimateAmountInr: v });
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reminders for {svc.totalYears} year{svc.totalYears !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {svc.reminderIntervals.map((m) => (
                          <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                            {m >= 12 ? `${m / 12}yr` : `${m}mo`}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => {
                        highEndStore.removeService(svc.id);
                        toast.success(`"${svc.name}" removed`);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {highEndStore.services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No high-end services configured</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Add new */}
              <div className="space-y-4">
                <p className="text-sm font-medium">Add New High-End Service</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Service Name *</Label>
                    <Input
                      placeholder="e.g. PPF Coating, Ceramic"
                      value={newHesName}
                      onChange={(e) => setNewHesName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Est. amount (₹ excl. GST)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newHesEstimate}
                      onChange={(e) => setNewHesEstimate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reminder Interval (months)</Label>
                    <Select value={newHesIntervalMonths} onValueChange={setNewHesIntervalMonths}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Every 3 months</SelectItem>
                        <SelectItem value="6">Every 6 months</SelectItem>
                        <SelectItem value="12">Every 1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Duration (years)</Label>
                    <Select value={newHesTotalYears} onValueChange={setNewHesTotalYears}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 year</SelectItem>
                        <SelectItem value="2">2 years</SelectItem>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddHighEndService}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Service
                </Button>
              </div>
            </CardContent>
          </Card>
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
