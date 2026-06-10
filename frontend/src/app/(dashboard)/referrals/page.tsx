"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  useReferralSettingsStore,
  type ReferralRewardMode,
} from "@/store/referral-settings-store";
import {
  Gift,
  IndianRupee,
  BookOpen,
  Save,
  UserPlus,
  Users,
  Link2,
  SlidersHorizontal,
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
/** Extra top/bottom air so content never sits flush on card edges */
const kpiContent = "flex items-center gap-4 px-5 py-6 sm:px-6 sm:py-7";
const headerBlock = "space-y-0 px-5 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-7";
const bodyBelowHeader = "space-y-4 px-5 pb-6 pt-5 sm:px-6 sm:pt-6";

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        enabled ? "bg-primary" : "bg-muted",
        ACCENT.ring
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-background",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
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

  return (
    <div className="space-y-6">
      <PageHeader title="Referrals" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cardSurface}>
          <CardContent className={kpiContent}>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                ACCENT.iconBg
              )}
            >
              <Users className={cn("h-6 w-6", ACCENT.icon)} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Referrals tracked
              </p>
              <p className="text-2xl font-bold tabular-nums">0</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(cardSurface, "bg-primary/[0.04] dark:bg-primary/[0.08]")}>
          <CardContent className={kpiContent}>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                ACCENT.iconBg
              )}
            >
              <Gift className={cn("h-6 w-6", ACCENT.icon)} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active codes
              </p>
              <p className="text-2xl font-bold tabular-nums">0</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cardSurface}>
          <CardContent className={kpiContent}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <IndianRupee className="h-6 w-6 text-foreground/80" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bonuses paid out
              </p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1 sm:w-auto">
          <TabsTrigger value="rules" className="gap-2 data-[state=active]:shadow-sm">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            Referral rules
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2 data-[state=active]:shadow-sm">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            How it works
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4 mt-0 outline-none focus-visible:outline-none">
          <p className="text-sm text-muted-foreground -mt-1">
            Changes save to the server as you edit. Use <strong>Save referral rules</strong> to confirm,
            or <strong>Reset</strong> to restore defaults.
          </p>

      <Card className={cardSurface}>
        <CardContent className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-7">
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                ACCENT.iconBg
              )}
            >
              <Link2 className={cn("h-5 w-5", ACCENT.icon)} />
            </div>
            <div>
              <p className="font-semibold">Referral program visibility</p>
              <p className="text-sm text-muted-foreground">
                {programEnabled
                  ? "Customers can share referral codes and earn rewards"
                  : "Referral sharing is paused"}
              </p>
            </div>
          </div>
          <ToggleSwitch enabled={programEnabled} onToggle={() => setProgramEnabled(!programEnabled)} />
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader className={headerBlock}>
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                ACCENT.iconBg
              )}
            >
              <Gift className={cn("h-5 w-5", ACCENT.icon)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg leading-snug">Referrer reward</CardTitle>
              <CardDescription>
                Reward for the customer who shares their referral code
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={bodyBelowHeader}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Reward type</Label>
              <Select
                value={advocateRewardMode}
                onValueChange={(v) => setAdvocateRewardMode(v as ReferralRewardMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_inr">Flat amount (₹)</SelectItem>
                  <SelectItem value="percent_job">% of job value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {advocateRewardMode === "fixed_inr" ? "Amount (₹)" : "Percent (%)"}
              </Label>
              <Input
                type="number"
                min="0"
                step={advocateRewardMode === "fixed_inr" ? "0.01" : "0.1"}
                value={advocateAmount}
                onChange={(e) => setAdvocateAmount(e.target.value)}
              />
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              ACCENT.preview
            )}
          >
            <span className="text-muted-foreground">Preview: </span>
            <span className={cn("font-semibold", ACCENT.previewText)}>{advocatePreview}</span>
          </div>
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader className={headerBlock}>
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                ACCENT.iconBg
              )}
            >
              <UserPlus className={cn("h-5 w-5", ACCENT.icon)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg leading-snug">New customer reward</CardTitle>
              <CardDescription>For the new customer who uses a valid referral code</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={bodyBelowHeader}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Reward type</Label>
              <Select
                value={newCustomerRewardMode}
                onValueChange={(v) => setNewCustomerRewardMode(v as ReferralRewardMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_inr">Flat amount (₹)</SelectItem>
                  <SelectItem value="percent_job">% of job value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {newCustomerRewardMode === "fixed_inr" ? "Amount (₹)" : "Percent (%)"}
              </Label>
              <Input
                type="number"
                min="0"
                step={newCustomerRewardMode === "fixed_inr" ? "0.01" : "0.1"}
                value={newCustomerAmount}
                onChange={(e) => setNewCustomerAmount(e.target.value)}
              />
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              ACCENT.preview
            )}
          >
            <span className="text-muted-foreground">Preview: </span>
            <span className={cn("font-semibold", ACCENT.previewText)}>{newCustomerPreview}</span>
          </div>
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader className={headerBlock}>
          <CardTitle className="text-lg leading-snug">Eligibility</CardTitle>
        </CardHeader>
        <CardContent className={bodyBelowHeader}>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="min-job">Minimum job total (₹) — optional</Label>
            <Input
              id="min-job"
              type="number"
              min="0"
              step="0.01"
              value={minJobAmountInr}
              onChange={(e) => setMinJobAmountInr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Job invoice must meet this threshold before referral rewards apply
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="button" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save referral rules
        </Button>
      </div>
        </TabsContent>

        <TabsContent value="guide" className="mt-0 outline-none focus-visible:outline-none">
      <Card className={cardSurface}>
        <CardHeader className={headerBlock}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Gift className="h-5 w-5 text-primary-foreground" />
            </div>
            <CardTitle className="text-lg leading-snug pt-0.5">How referral rewards work</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={bodyBelowHeader}>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Referral codes are issued after a customer’s first completed visit",
              "New customers can enter a referral code during signup or first booking",
              "Wallet credits post when the referred customer’s first qualifying job completes",
              "Percentage rewards use the qualifying invoice subtotal before tax",
              "Wallet balance can offset future services at checkout",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
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
