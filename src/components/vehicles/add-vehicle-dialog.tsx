"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import type { Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { AddVehicleFormFields } from "./add-vehicle-form-fields";
import {
  ADD_VEHICLE_FORM_DEFAULTS,
  type AddVehicleFormData,
} from "./add-vehicle-form-types";
import { buildVehicleFromForm } from "./build-vehicle-from-form";

export type AddVehicleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, customer picker is hidden and this customer is used. */
  lockedCustomerId?: string;
  title?: string;
  submitLabel?: string;
  onCreated?: (vehicle: Vehicle) => void;
};

export function AddVehicleDialog({
  open,
  onOpenChange,
  lockedCustomerId,
  title = "Add Vehicle",
  submitLabel = "Add Vehicle",
  onCreated,
}: AddVehicleDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const addVehicle = useVehicleStore((s) => s.addVehicle);

  const form = useForm<AddVehicleFormData>({
    defaultValues: {
      ...ADD_VEHICLE_FORM_DEFAULTS,
      customerId: lockedCustomerId ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      ...ADD_VEHICLE_FORM_DEFAULTS,
      year: new Date().getFullYear(),
      customerId: lockedCustomerId ?? "",
    });
  }, [open, lockedCustomerId, form]);

  const onSubmit = async (data: AddVehicleFormData) => {
    const payload: AddVehicleFormData = {
      ...data,
      customerId: lockedCustomerId || data.customerId,
    };
    const result = buildVehicleFromForm(payload, { customers, vehicles });
    if (!result.ok) {
      toast.error(result.error, result.description ? { description: result.description } : undefined);
      return;
    }
    const added = await addVehicle(result.vehicle);
    if (!added) {
      toast.error("Failed to add vehicle in the database");
      return;
    }
    toast.success("Vehicle added", {
      description: `${result.vehicle.registrationNumber} has been registered.`,
    });
    onCreated?.(added);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,100%)] sm:max-w-[640px]")}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-3 sm:py-4">
            <AddVehicleFormFields
              form={form}
              showCustomerSelect={!lockedCustomerId}
              idPrefix="add-veh-dialog"
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-sm sm:justify-end sm:py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
