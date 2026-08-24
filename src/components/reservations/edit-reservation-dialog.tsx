"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppointmentStore } from "@/store/appointment-store";
import { useStaffStore } from "@/store/staff-store";
import { useBranchStore } from "@/store/branch-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { appointmentIsEditable } from "@/lib/appointment-edit-policy";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { getAppointmentDisplayId } from "@/lib/appointment-ids";
import { SearchableServiceSelect } from "@/components/services/searchable-service-select";
import type { Appointment } from "@/types";

type EditReservationDialogProps = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditReservationDialog({
  appointment,
  open,
  onOpenChange,
}: EditReservationDialogProps) {
  const updateAppointment = useAppointmentStore((s) => s.updateAppointment);
  const staff = useStaffStore((s) => s.staff);
  const branches = useBranchStore((s) => s.branches);
  const catalog = useServiceCatalogStore((s) => s.catalog);

  const mechanics = useMemo(
    () => staff.filter((s) => s.role === "MECHANIC" && s.isActive !== false),
    [staff]
  );
  const activeBranches = useMemo(
    () => branches.filter((b) => b.isActive !== false),
    [branches]
  );

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vehicleRegNumber, setVehicleRegNumber] = useState("");
  const [vehicleMakeModel, setVehicleMakeModel] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [notes, setNotes] = useState("");
  const [mechanicId, setMechanicId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointment || !open) return;
    setDate(appointment.date);
    setTime(appointment.time);
    setCustomerName(appointment.customerName);
    setCustomerPhone(appointment.customerPhone);
    setVehicleRegNumber(appointment.vehicleRegNumber);
    setVehicleMakeModel(appointment.vehicleMakeModel);
    setServiceType(appointment.serviceType);
    setNotes(appointment.notes ?? "");
    setMechanicId(appointment.mechanicId ?? "");
    setBranchId(appointment.branchId ?? "");
    setExpectedDeliveryDate(appointment.expectedDeliveryDate ?? "");
    setAdvancePaid(
      appointment.advancePaid != null && appointment.advancePaid > 0
        ? String(appointment.advancePaid)
        : ""
    );
  }, [appointment, open]);

  const handleSave = async () => {
    if (!appointment) return;
    if (!appointmentIsEditable(appointment)) {
      toast.error("This booking can no longer be edited");
      onOpenChange(false);
      return;
    }
    if (!date.trim() || !time.trim()) {
      toast.error("Date and time are required");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (!serviceType.trim()) {
      toast.error("Service type is required");
      return;
    }

    const mechanic = mechanics.find((m) => m.id === mechanicId);
    const slotChanged = date !== appointment.date || time !== appointment.time;
    const advanceRaw = advancePaid.trim();
    let advanceValue: number | undefined;
    if (advanceRaw !== "") {
      const n = Number.parseFloat(advanceRaw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Enter a valid advance amount");
        return;
      }
      advanceValue = Math.round(n * 100) / 100;
    }

    const patch: Partial<Appointment> = {
      date: date.trim(),
      time: time.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      vehicleRegNumber: vehicleRegNumber.trim(),
      vehicleMakeModel: vehicleMakeModel.trim(),
      serviceType: serviceType.trim(),
      notes: notes.trim() || undefined,
      mechanicId: mechanic?.id,
      mechanicName: mechanic?.name,
      branchId: branchId || undefined,
      expectedDeliveryDate: expectedDeliveryDate.trim() || undefined,
      advancePaid: advanceValue,
    };
    if (slotChanged) {
      patch.whatsappSent = false;
      patch.reminderSent = false;
      patch.reminderSentAt = undefined;
    }

    setSaving(true);
    try {
      await updateAppointment(appointment.id, patch);
      pushActivityLog({
        action: "UPDATED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        entityLabel: getAppointmentDisplayId(appointment),
        details: `${getAppointmentDisplayId(appointment)} reservation updated`,
      });
      toast.success("Reservation updated", {
        description: slotChanged
          ? "Date/time changed — you can re-send WhatsApp confirmation."
          : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not save reservation", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!appointment) return;
    if (!appointmentIsEditable(appointment)) {
      toast.error("This booking can no longer be cancelled");
      return;
    }
    setSaving(true);
    try {
      await updateAppointment(appointment.id, { status: "CANCELLED" });
      pushActivityLog({
        action: "STATUS_CHANGED",
        entityType: "APPOINTMENT",
        entityId: appointment.id,
        entityLabel: getAppointmentDisplayId(appointment),
        details: `${getAppointmentDisplayId(appointment)} cancelled`,
      });
      toast.success("Reservation cancelled");
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not cancel reservation", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const label = appointment ? getAppointmentDisplayId(appointment) : "Reservation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {label}</DialogTitle>
          <DialogDescription>
            Update schedule or customer details. Locked after a job card is created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-date">Date</Label>
              <Input
                id="res-date"
                type="date"
                className="date-input-icon-end pr-9"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-time">Time</Label>
              <Input
                id="res-time"
                type="time"
                className="date-input-icon-end pr-9"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-name">Customer name</Label>
              <Input
                id="res-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-phone">Phone</Label>
              <Input
                id="res-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-reg">Registration</Label>
              <Input
                id="res-reg"
                value={vehicleRegNumber}
                onChange={(e) => setVehicleRegNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-vehicle">Vehicle</Label>
              <Input
                id="res-vehicle"
                value={vehicleMakeModel}
                onChange={(e) => setVehicleMakeModel(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-service">Service</Label>
            {(() => {
              const matched = catalog.find(
                (s) => s.isActive && !s.isAddon && s.name === serviceType
              );
              return (
                <SearchableServiceSelect
                  id="res-service"
                  value={matched?.id ?? (serviceType.trim() ? "__unmatched__" : "")}
                  unmatchedLabel={matched ? undefined : serviceType.trim() || undefined}
                  onChange={(id) => {
                    if (id === "__unmatched__") return;
                    const svc = catalog.find((s) => s.id === id);
                    if (svc) setServiceType(svc.name);
                  }}
                  services={catalog}
                />
              );
            })()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeBranches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select
                  value={branchId || "__none__"}
                  onValueChange={(v) => setBranchId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No branch</SelectItem>
                    {activeBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Mechanic</Label>
              <Select
                value={mechanicId || "__none__"}
                onValueChange={(v) => setMechanicId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {mechanics.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-delivery">Expected delivery</Label>
              <Input
                id="res-delivery"
                type="date"
                className="date-input-icon-end pr-9"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-advance">Advance (₹)</Label>
              <Input
                id="res-advance"
                inputMode="decimal"
                placeholder="Optional"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Notes</Label>
            <Textarea
              id="res-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={saving}
            onClick={() => void handleCancelReservation()}
          >
            Cancel reservation
          </Button>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-initial"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-initial"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
