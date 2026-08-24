"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { useStaffStore } from "@/store/staff-store";
import { canCreateStaffAccounts } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const ADD_DRIVER_SELECT_VALUE = "__add_driver__";

function suggestStaffEmail(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "driver"}.${Date.now().toString(36)}@primecarwash.local`;
}

type PickupDriverSelectProps = {
  branchId: string;
  value: string;
  onValueChange: (driverId: string, driverName?: string) => void;
  triggerClassName?: string;
  placeholder?: string;
  /** When set, only list drivers for this branch. When empty, lists all active mechanics. */
  branchScoped?: boolean;
  size?: "default" | "compact";
  disabled?: boolean;
};

export function PickupDriverSelect({
  branchId,
  value,
  onValueChange,
  triggerClassName,
  placeholder = "Assign driver",
  branchScoped = true,
  size = "default",
  disabled = false,
}: PickupDriverSelectProps) {
  const staff = useStaffStore((s) => s.staff);
  const addStaff = useStaffStore((s) => s.addStaff);
  const authRole = useAuthStore((s) => s.user?.role);
  const canAdd = canCreateStaffAccounts(authRole);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const drivers = useMemo(
    () =>
      staff.filter(
        (u) =>
          u.isActive &&
          u.role === "MECHANIC" &&
          (!branchScoped || !branchId || u.branchId === branchId)
      ),
    [staff, branchId, branchScoped]
  );

  const handleSelect = (next: string) => {
    if (next === ADD_DRIVER_SELECT_VALUE) {
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setAddOpen(true);
      return;
    }
    if (next === "unassigned") {
      onValueChange("unassigned");
      return;
    }
    const driver = drivers.find((d) => d.id === next);
    onValueChange(next, driver?.name);
  };

  const handleQuickAdd = async () => {
    const name = addName.trim();
    const phone = addPhone.trim();
    if (!name || phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter name and a 10-digit mobile number.");
      return;
    }
    if (!branchId) {
      toast.error("Branch is required to add staff.");
      return;
    }
    const email = addEmail.trim() || suggestStaffEmail(name);
    setAdding(true);
    try {
      await addStaff({
        name,
        email,
        phone,
        role: "MECHANIC",
        branchId,
        isActive: true,
      });
      const created = useStaffStore.getState().staff.find(
        (s) => s.email.toLowerCase() === email.toLowerCase()
      );
      toast.success(`${name} added as mechanic`);
      setAddOpen(false);
      if (created) {
        onValueChange(created.id, created.name);
      }
    } catch {
      toast.error("Could not add staff. Check API server and try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Select value={value || "unassigned"} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger
          className={cn(
            "bg-background",
            size === "compact"
              ? "h-8 w-[168px] max-w-full text-xs px-2.5 [&>svg]:size-3.5"
              : "h-9 max-w-xs",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {drivers.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
          {canAdd && (
            <>
              <SelectSeparator />
              <SelectItem value={ADD_DRIVER_SELECT_VALUE} className="text-primary font-medium">
                + Add driver or mechanic
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add driver or mechanic</DialogTitle>
            <DialogDescription>
              Creates a mechanic account for this branch and selects them as pickup driver.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="quick-add-name">Full name</Label>
              <Input
                id="quick-add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-phone">Mobile</Label>
              <Input
                id="quick-add-phone"
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="10-digit number"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-add-email">Email (optional)</Label>
              <Input
                id="quick-add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Auto-generated if left blank"
                autoComplete="email"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={adding} onClick={() => void handleQuickAdd()}>
              {adding ? "Adding…" : "Add & assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
