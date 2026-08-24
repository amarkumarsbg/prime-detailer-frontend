"use client";

import { useEffect, useRef, useState } from "react";
import { Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import { datetimeLocalValue } from "@/features/booking-wizard/lib/datetime-local";
import { isDatetimeLocalInPast, localDatetimeLocalInputMin } from "@/lib/booking-calendar-validation";

export const DELIVERY_CHECKLIST_ITEMS = [
  { id: "customerSatisfaction", label: "Customer Satisfaction Confirmed" },
  { id: "keysDelivered", label: "Keys Delivered" },
  { id: "finalWalkthrough", label: "Final Walkthrough Completed" },
] as const;

export type DeliveryChecklistId = (typeof DELIVERY_CHECKLIST_ITEMS)[number]["id"];

export type DeliverVehicleDropOff = {
  address: string;
  scheduledTime: string;
  driverId: string;
  driverName?: string;
};

export type DeliverVehicleResult = {
  deliveryNotes: string;
  deliveryChecklist: Record<DeliveryChecklistId, boolean>;
  dropOff?: DeliverVehicleDropOff;
};

export type DeliverVehicleDropOffPrefill = {
  branchId: string;
  branchScoped: boolean;
  address: string;
  driverId?: string;
  driverName?: string;
  scheduledTime?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobNumber: string;
  submitting?: boolean;
  dropOff?: DeliverVehicleDropOffPrefill | null;
  onConfirm: (result: DeliverVehicleResult) => void | Promise<void>;
};

export function DeliverVehicleDialog({
  open,
  onOpenChange,
  jobNumber,
  submitting = false,
  dropOff = null,
  onConfirm,
}: Props) {
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<DeliveryChecklistId, boolean>>({
    customerSatisfaction: false,
    keysDelivered: false,
    finalWalkthrough: false,
  });
  const [dropAddress, setDropAddress] = useState("");
  const [dropDriverId, setDropDriverId] = useState("unassigned");
  const [dropDriverName, setDropDriverName] = useState<string | undefined>();
  const [dropScheduledLocal, setDropScheduledLocal] = useState("");
  const wasOpenRef = useRef(false);

  // Sync drop-off fields whenever dropOff changes or dialog opens.
  // Only reset checklist/notes on the open transition (false → true).
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open) return;

    if (justOpened) {
      setNotes("");
      setChecks({
        customerSatisfaction: false,
        keysDelivered: false,
        finalWalkthrough: false,
      });
    }

    setDropAddress(dropOff?.address?.trim() ?? "");
    setDropDriverId(dropOff?.driverId || "unassigned");
    if (justOpened) setDropDriverName(undefined);
    const scheduled = dropOff?.scheduledTime ? new Date(dropOff.scheduledTime) : null;
    const local =
      scheduled && !Number.isNaN(scheduled.getTime())
        ? datetimeLocalValue(scheduled)
        : datetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000));
    setDropScheduledLocal(isDatetimeLocalInPast(local) ? localDatetimeLocalInputMin() : local);
  }, [open, dropOff]);

  const allChecked = DELIVERY_CHECKLIST_ITEMS.every((item) => checks[item.id]);
  const dropOffReady =
    !dropOff ||
    (dropAddress.trim().length > 0 &&
      dropDriverId !== "unassigned" &&
      dropScheduledLocal &&
      !isDatetimeLocalInPast(dropScheduledLocal) &&
      !Number.isNaN(new Date(dropScheduledLocal).getTime()));
  const canSubmit = allChecked && dropOffReady && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dropOff ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Deliver Vehicle
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {dropOff
              ? "Confirm drop-off details and complete the checklist. This marks drop-off complete and delivers the job at the workshop."
              : `Complete the checklist before marking ${jobNumber} as delivered.`}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {dropOff ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-sm font-semibold">Drop-off</p>
              <p className="text-xs text-muted-foreground">
                Return {jobNumber} to the customer. Confirming Deliver Vehicle marks this drop-off
                complete.
              </p>
              <div className="space-y-2">
                <Label htmlFor="drop-off-address">Drop-off address</Label>
                <Textarea
                  id="drop-off-address"
                  rows={2}
                  placeholder="Customer address for return"
                  value={dropAddress}
                  onChange={(e) => setDropAddress(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <PickupDriverSelect
                    branchId={dropOff.branchId}
                    branchScoped={dropOff.branchScoped}
                    value={dropDriverId}
                    onValueChange={(id, name) => {
                      setDropDriverId(id);
                      setDropDriverName(name);
                    }}
                    triggerClassName="w-full max-w-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drop-off-when">Scheduled time</Label>
                  <Input
                    id="drop-off-when"
                    type="datetime-local"
                    min={localDatetimeLocalInputMin()}
                    value={dropScheduledLocal}
                    onChange={(e) => setDropScheduledLocal(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="delivery-notes">Delivery Notes</Label>
            <Textarea
              id="delivery-notes"
              rows={3}
              placeholder="Any notes about the delivery process..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-800 dark:bg-sky-950/30">
            <p className="mb-3 text-sm font-semibold text-sky-900 dark:text-sky-100">
              Delivery Checklist
            </p>
            <ul className="space-y-3">
              {DELIVERY_CHECKLIST_ITEMS.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    id={`delivery-check-${item.id}`}
                    checked={checks[item.id]}
                    onCheckedChange={(v) =>
                      setChecks((prev) => ({ ...prev, [item.id]: v === true }))
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`delivery-check-${item.id}`}
                    className="cursor-pointer text-sm font-normal leading-snug"
                  >
                    {item.label}
                  </Label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            title={
              !allChecked
                ? "Complete all checklist items first"
                : dropOff && !dropOffReady
                  ? "Enter drop-off address, driver, and a future time"
                  : undefined
            }
            onClick={() =>
              void onConfirm({
                deliveryNotes: notes.trim(),
                deliveryChecklist: checks,
                dropOff: dropOff
                  ? {
                      address: dropAddress.trim(),
                      scheduledTime: new Date(dropScheduledLocal).toISOString(),
                      driverId: dropDriverId,
                      driverName: dropDriverName || dropOff.driverName,
                    }
                  : undefined,
              })
            }
          >
            <Truck className="mr-2 h-4 w-4" />
            {submitting ? "Delivering…" : "Deliver Vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
