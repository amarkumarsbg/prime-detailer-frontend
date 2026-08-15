"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrganizationEntitlement } from "@/types";
import {
  branchLimitLabel,
  resolveContactUsUrl,
  resolveSupportPhone,
} from "@/lib/plan-limits";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entitlement: OrganizationEntitlement | null;
};

export function BranchLimitReachedDialog({ open, onOpenChange, entitlement }: Props) {
  const max = entitlement?.subscription.effectiveMaxBranches ?? 1;
  const used = entitlement?.usage.branchesUsed ?? 0;
  const planName = entitlement?.subscription.planName ?? "your plan";
  const limitText = branchLimitLabel(max);
  const contactUrl = resolveContactUsUrl(entitlement);
  const supportPhone = resolveSupportPhone(entitlement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch limit reached</DialogTitle>
          <DialogDescription>
            Your current plan includes {limitText} branch
            {max === 1 ? "" : "es"}. Contact support to add another branch or upgrade your plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Current Plan: {planName}</p>
          <p>Branch Limit: {limitText}</p>
          <p>Current Branches: {used}</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <PlanCtaButton
            href={contactUrl}
            phone={supportPhone}
            dialogTitle="Contact support"
          >
            Contact support
          </PlanCtaButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
