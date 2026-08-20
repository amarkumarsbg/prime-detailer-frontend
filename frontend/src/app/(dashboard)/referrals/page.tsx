"use client";

import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useReferralSettingsStore,
  type ReferralRewardMode,
} from "@/store/referral-settings-store";
import { useCustomerStore } from "@/store/customer-store";
import { useWalletStore } from "@/store/wallet-store";
import {
  Gift,
  IndianRupee,
  BookOpen,
  Save,
  UserPlus,
  Users,
  Link2,
  SlidersHorizontal,
  Info,
  type LucideIcon,
} from "lucide-react";

/** Primary-tinted surfaces (aligned with theme) */
const ACCENT = {
  iconBg: "bg-primary/12 dark:bg-primary/20",
  icon: "text-primary",
  ring: "focus-visible:ring-primary",
  preview:
    "border-primary/20 bg-primary/[0.06] dark:bg-primary/10 dark:border-primary/30",
  previewText: "text-primary",
  bullet: "bg-primary",
};

const cardSurface = "rounded-xl border border-border/80 bg-card shadow-sm";
const guideHeader = "space-y-0 px-4 pb-3 pt-4 sm:px-6 sm:pb-5 sm:pt-7";
const guideBody = "space-y-3 px-4 pb-5 pt-0 sm:space-y-4 sm:px-6 sm:pb-6 sm:pt-2";

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-7 sm:w-12",
        enabled ? "bg-primary" : "bg-muted",
        ACCENT.ring
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-background sm:h-5 sm:w-5",
          enabled ? "translate-x-5 sm:translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function RuleSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border/70 px-4 py-3 first:border-t-0 sm:px-5 sm:py-4">
      <div className="mb-2.5 flex items-start gap-2 sm:mb-3 sm:gap-3">
        {Icon ? (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9",
              ACCENT.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", ACCENT.icon)} />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug sm:text-base">{title}</p>
          {description ? (
            <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ReferralsPage() {
  const programEnabled = useReferralSettingsStore((s) => s.programEnabled);
  const setProgramEnabled = useReferralSettingsStore((s) => s.setProgramEnabled);
  const advocateRewardMode = useReferralSettingsStore((s) => s.advocateRewardMode);
  const setAdvocateRewardMode = useReferralSettingsStore((s) => s.setAdvocateRewardMode);
  const advocateAmount = useReferralSettingsStore((s) => s.advocateAmount);
  const setAdvocateAmount = useReferralSettingsStore((s) => s.setAdvocateAmount);
  const newCustomerRewardMode = useReferralSettingsStore((s) => s.newCustomerRewardMode);
  const setNewCustomerRewardMode = useReferralSettingsStore((s) => s.setNewCustomerRewardMode);
  const newCustomerAmount = useReferralSettingsStore((s) => s.newCustomerAmount);
  const setNewCustomerAmount = useReferralSettingsStore((s) => s.setNewCustomerAmount);
  const minJobAmountInr = useReferralSettingsStore((s) => s.minJobAmountInr);
  const setMinJobAmountInr = useReferralSettingsStore((s) => s.setMinJobAmountInr);
  const resetToDefaults = useReferralSettingsStore((s) => s.resetToDefaults);

  const customers = useCustomerStore((s) => s.customers);
  const walletTransactions = useWalletStore((s) => s.transactions);

  const kpi = useMemo(() => {
    const referralsTracked = customers.filter((c) => Boolean(c.referredBy?.trim())).length;
    const activeCodes = customers.filter((c) => Boolean(c.referralCode?.trim())).length;
    const bonusesPaid = walletTransactions
      .filter((t) => t.source === "REFERRAL_REWARD" && t.type === "CREDIT")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return {
      referralsTracked,
      activeCodes,
      bonusesPaid: Math.round(bonusesPaid * 100) / 100,
    };
  }, [customers, walletTransactions]);

  const advocatePreview = useMemo(() => {
    if (advocateRewardMode === "fixed_inr") {
      const n = Number(advocateAmount);
      const safe = Number.isFinite(n) ? n : 0;
      return `Referrer receives ${formatCurrency(safe)}`;
    }
    return `Referrer receives ${advocateAmount || "0"}% of the qualifying job total`;
  }, [advocateRewardMode, advocateAmount]);

  const newCustomerPreview = useMemo(() => {
    if (newCustomerRewardMode === "fixed_inr") {
      const n = Number(newCustomerAmount);
      const safe = Number.isFinite(n) ? n : 0;
      return `New customer receives ${formatCurrency(safe)}`;
    }
    return `New customer receives ${newCustomerAmount || "0"}% of their first qualifying job`;
  }, [newCustomerRewardMode, newCustomerAmount]);

  const handleSave = () => {
    toast.success("Referral rules saved");
  };

  const handleReset = () => {
    resetToDefaults();
    toast.message("Restored defaults");
  };

  const rulesHelpText =
    "Changes save to the server as you edit. Use Save referral rules to confirm, or Reset to restore defaults.";

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Referrals" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <KPICard
          size="compact"
          title="Referrals tracked"
          value={kpi.referralsTracked}
          icon={Users}
          tone="violet"
          titleClassName="leading-tight"
        />
        <KPICard
          size="compact"
          title="Active codes"
          value={kpi.activeCodes}
          icon={Gift}
          tone="blue"
          titleClassName="leading-tight"
        />
        <KPICard
          size="compact"
          title="Bonuses paid out"
          value={formatCurrency(kpi.bonusesPaid)}
          icon={IndianRupee}
          tone="slate"
          className="col-span-2 lg:col-span-1"
          titleClassName="leading-tight"
        />
      </div>

      <Tabs defaultValue="rules" className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <TabsList className="h-auto min-w-0 flex-1 flex-wrap justify-start gap-1 bg-muted/60 p-1 sm:w-auto sm:flex-none">
            <TabsTrigger value="rules" className="gap-1.5 data-[state=active]:shadow-sm sm:gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              Referral rules
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-1.5 data-[state=active]:shadow-sm sm:gap-2">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              How it works
            </TabsTrigger>
          </TabsList>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 md:hidden"
                  aria-label="Referral rules help"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                {rulesHelpText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TabsContent
          value="rules"
          className="mt-0 space-y-3 pb-20 outline-none focus-visible:outline-none sm:space-y-4 md:pb-0"
        >
          <p className="hidden text-sm text-muted-foreground md:block">{rulesHelpText}</p>

          <Card className={cardSurface}>
            <section className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9",
                    ACCENT.iconBg
                  )}
                >
                  <Link2 className={cn("h-4 w-4", ACCENT.icon)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug sm:text-base">
                    Referral program visibility
                  </p>
                  <p className="text-[11px] text-muted-foreground md:hidden">
                    {programEnabled ? "Sharing enabled" : "Paused"}
                  </p>
                  <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                    {programEnabled
                      ? "Customers can share referral codes and earn rewards"
                      : "Referral sharing is paused"}
                  </p>
                </div>
              </div>
              <ToggleSwitch enabled={programEnabled} onToggle={() => setProgramEnabled(!programEnabled)} />
            </section>

            <RuleSection
              title="Referrer reward"
              description="Reward for the customer who shares their referral code"
              icon={Gift}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Reward type</Label>
                  <Select
                    value={advocateRewardMode}
                    onValueChange={(v) => setAdvocateRewardMode(v as ReferralRewardMode)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_inr">Flat amount (₹)</SelectItem>
                      <SelectItem value="percent_job">% of job value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">
                    {advocateRewardMode === "fixed_inr" ? "Amount (₹)" : "Percent (%)"}
                  </Label>
                  <Input
                    className="h-9"
                    type="number"
                    min="0"
                    step={advocateRewardMode === "fixed_inr" ? "0.01" : "0.1"}
                    value={advocateAmount}
                    onChange={(e) => setAdvocateAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className={cn("mt-2.5 rounded-lg border px-3 py-2 text-xs sm:mt-3 sm:px-4 sm:py-3 sm:text-sm", ACCENT.preview)}>
                <span className="text-muted-foreground">Preview: </span>
                <span className={cn("font-semibold", ACCENT.previewText)}>{advocatePreview}</span>
              </div>
            </RuleSection>

            <RuleSection
              title="New customer reward"
              description="For the new customer who uses a valid referral code"
              icon={UserPlus}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Reward type</Label>
                  <Select
                    value={newCustomerRewardMode}
                    onValueChange={(v) => setNewCustomerRewardMode(v as ReferralRewardMode)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_inr">Flat amount (₹)</SelectItem>
                      <SelectItem value="percent_job">% of job value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">
                    {newCustomerRewardMode === "fixed_inr" ? "Amount (₹)" : "Percent (%)"}
                  </Label>
                  <Input
                    className="h-9"
                    type="number"
                    min="0"
                    step={newCustomerRewardMode === "fixed_inr" ? "0.01" : "0.1"}
                    value={newCustomerAmount}
                    onChange={(e) => setNewCustomerAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className={cn("mt-2.5 rounded-lg border px-3 py-2 text-xs sm:mt-3 sm:px-4 sm:py-3 sm:text-sm", ACCENT.preview)}>
                <span className="text-muted-foreground">Preview: </span>
                <span className={cn("font-semibold", ACCENT.previewText)}>{newCustomerPreview}</span>
              </div>
            </RuleSection>

            <RuleSection title="Eligibility">
              <div className="max-w-md space-y-1.5">
                <Label htmlFor="min-job" className="text-xs sm:text-sm">
                  Minimum job total (₹) — optional
                </Label>
                <Input
                  id="min-job"
                  className="h-9"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minJobAmountInr}
                  onChange={(e) => setMinJobAmountInr(e.target.value)}
                />
                <p className="hidden text-xs text-muted-foreground md:block">
                  Job invoice must meet this threshold before referral rewards apply
                </p>
              </div>
            </RuleSection>
          </Card>

          <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm md:static md:inset-auto md:justify-end md:border-0 md:bg-transparent md:px-0 md:py-0 md:pt-2">
            <Button type="button" variant="outline" size="sm" className="h-9 flex-1 md:flex-none" onClick={handleReset}>
              Reset
            </Button>
            <Button type="button" size="sm" className="h-9 flex-1 gap-1.5 md:flex-none" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              <span className="sm:hidden">Save</span>
              <span className="hidden sm:inline">Save referral rules</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="guide" className="mt-0 outline-none focus-visible:outline-none">
          <Card className={cardSurface}>
            <CardHeader className={guideHeader}>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary sm:h-10 sm:w-10">
                  <Gift className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
                </div>
                <CardTitle className="pt-0.5 text-base leading-snug sm:text-lg">
                  How referral rewards work
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className={guideBody}>
              <ul className="space-y-2 text-xs text-muted-foreground sm:space-y-2.5 sm:text-sm">
                {[
                  "Referral codes are issued after a customer’s first completed visit",
                  "New customers can enter a referral code during signup or first booking",
                  "Wallet credits post when staff applies the referral on the first qualifying pre-invoice (or on full payment)",
                  "Flat or % rewards and minimum job total follow the rules on this page",
                  "Percentage rewards use the invoice subtotal before tax",
                  "Wallet balance can offset future services at checkout",
                  "Pausing the program blocks new referral applications until re-enabled",
                ].map((line) => (
                  <li key={line} className="flex gap-2 sm:gap-2.5">
                    <span
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", ACCENT.bullet)}
                      aria-hidden
                    />
                    <span className="text-foreground/90">{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
