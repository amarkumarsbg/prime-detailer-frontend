"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const DELIVERY_CHECKLIST_ITEMS = [
  { id: "customerSatisfaction", label: "Customer Satisfaction Confirmed" },
  { id: "keysDelivered", label: "Keys Delivered" },
  { id: "finalWalkthrough", label: "Final Walkthrough Completed" },
] as const;

export type DeliveryChecklistId = (typeof DELIVERY_CHECKLIST_ITEMS)[number]["id"];

export type DeliverVehicleResult = {
  deliveryNotes: string;
  deliveryChecklist: Record<DeliveryChecklistId, boolean>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobNumber: string;
  submitting?: boolean;
  onConfirm: (result: DeliverVehicleResult) => void | Promise<void>;
};

export function DeliverVehicleDialog({
  open,
  onOpenChange,
  jobNumber,
  submitting = false,
  onConfirm,
}: Props) {
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<DeliveryChecklistId, boolean>>({
    customerSatisfaction: false,
    keysDelivered: false,
    finalWalkthrough: false,
  });

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setChecks({
      customerSatisfaction: false,
      keysDelivered: false,
      finalWalkthrough: false,
    });
  }, [open]);

  const allChecked = DELIVERY_CHECKLIST_ITEMS.every((item) => checks[item.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Deliver Vehicle
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Complete the checklist before marking {jobNumber} as delivered.
          </p>
        </DialogHeader>

        <div className="space-y-4">
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
            disabled={!allChecked || submitting}
            title={!allChecked ? "Complete all checklist items first" : undefined}
            onClick={() =>
              void onConfirm({
                deliveryNotes: notes.trim(),
                deliveryChecklist: checks,
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
