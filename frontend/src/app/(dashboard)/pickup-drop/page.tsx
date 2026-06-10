"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJobCardStore } from "@/store/job-card-store";
import { usePickupDropStore } from "@/store/pickup-drop-store";
import { useBranchStore } from "@/store/branch-store";
import { useStaffStore } from "@/store/staff-store";
import { filterByBranchId, useBranchScope } from "@/lib/branch-scope";
import { cn } from "@/lib/utils";
import type { PickupDropRequest, PickupDropStatus, PickupDropType } from "@/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { buildPickupDropWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { useNotificationStore } from "@/store/notification-store";
import { ApiError } from "@/lib/api-client";
import {
  isDatetimeLocalInPast,
  localDatetimeLocalInputMin,
} from "@/lib/booking-calendar-validation";
import { PickupDropJobGroupCard } from "@/components/pickup-drop/pickup-drop-job-group-card";
import { PickupDriverSelect } from "@/components/pickup-drop/pickup-driver-select";
import {
  groupPickupDropByJob,
  pickupDropGroupMatchesFilters,
  PICKUP_DROP_STATUS_LABEL,
  validatePickupDropAdvance,
} from "@/lib/pickup-drop-flow";

function customerPhoneFromPickupRequest(r: PickupDropRequest): string | undefined {
  const direct = r.customerPhone?.trim();
  if (direct) return direct;
  const m = r.notes?.match(/Phone:\s*([^\n]+)/i);
  return m?.[1]?.trim() || undefined;
}

function formatDatetimeLocalInput(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function defaultScheduledDatetimeLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return formatDatetimeLocalInput(d);
}

const STATUS_OPTIONS: { value: PickupDropStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "DRIVER_ASSIGNED", label: "Driver Assigned" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_SERVICE", label: "In Service" },
  { value: "DELIVERED", label: "Delivered" },
];

const TYPE_OPTIONS: { value: PickupDropType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "PICKUP", label: "Pickup" },
  { value: "DROP", label: "Drop" },
];

const selectTriggerClass =
  "border-input transition-[border-color,box-shadow] duration-[1200ms] ease-[cubic-bezier(0.45,0,0.55,1)] data-[state=open]:border-emerald-600 data-[state=open]:shadow-[0_0_0_1px_rgba(16,133,88,0.25)]";

const selectContentClass =
  "data-[state=open]:!animate-in data-[state=closed]:!animate-out data-[state=open]:!fade-in-0 data-[state=closed]:!fade-out-0 data-[state=open]:!zoom-in-95 data-[state=closed]:!zoom-out-95 data-[state=open]:!duration-[1200ms] data-[state=closed]:duration-[1000ms]";

const dialogSurfaceClass =
  "!duration-[1200ms] data-[state=open]:!duration-[1200ms] data-[state=closed]:!duration-[1000ms]";

export default function PickupDropPage() {
  const { jobCards } = useJobCardStore();
  const { requests, addRequest, assignDriver, advanceStatus } = usePickupDropStore();
  const branches = useBranchStore((s) => s.branches);
  const staff = useStaffStore((s) => s.staff);
  const { selectedBranchId, viewingLabel } = useBranchScope();

  const [statusFilter, setStatusFilter] = useState<PickupDropStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<PickupDropType | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const [createMode, setCreateMode] = useState<"existing" | "new">("existing");
  const [bookingId, setBookingId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [newScheduledLocal, setNewScheduledLocal] = useState("");
  const [reqType, setReqType] = useState<PickupDropType>("PICKUP");
  const [driverId, setDriverId] = useState<string>("unassigned");
  const [notes, setNotes] = useState("");

  const scopedJobCards = useMemo(
    () => filterByBranchId(jobCards, (jc) => jc.branchId, selectedBranchId),
    [jobCards, selectedBranchId]
  );

  const scopedRequests = useMemo(
    () => filterByBranchId(requests, (r) => r.branchId, selectedBranchId),
    [requests, selectedBranchId]
  );

  const scopedBranches = useMemo(() => {
    const active = branches.filter((b) => b.isActive);
    if (!selectedBranchId) return active;
    return active.filter((b) => b.id === selectedBranchId);
  }, [branches, selectedBranchId]);

  const filteredGroups = useMemo(() => {
    return groupPickupDropByJob(scopedRequests).filter((group) =>
      pickupDropGroupMatchesFilters(group, statusFilter, typeFilter)
    );
  }, [scopedRequests, statusFilter, typeFilter]);

  const kpis = useMemo(() => {
    const all = scopedRequests;
    return {
      total: all.length,
      pending: all.filter((r) => r.status === "PENDING").length,
      driverAssigned: all.filter((r) => r.status === "DRIVER_ASSIGNED").length,
      inService: all.filter((r) => r.status === "IN_SERVICE").length,
      delivered: all.filter((r) => r.status === "DELIVERED").length,
    };
  }, [scopedRequests]);

  const resetForm = () => {
    setCreateMode("existing");
    setBookingId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewAddress("");
    setNewBranchId("");
    setNewScheduledLocal("");
    setReqType("PICKUP");
    setDriverId("unassigned");
    setNotes("");
  };

  const handleCreate = () => {
    const driver =
      driverId !== "unassigned"
        ? staff.find((d) => d.id === driverId)
        : undefined;

    if (createMode === "existing") {
      const jc = scopedJobCards.find((j) => j.id === bookingId);
      if (!jc) return;
      const br = branches.find((b) => b.id === jc.branchId);
      const address = br ? `${br.name} — ${br.address}` : "—";
      addRequest({
        jobCardId: jc.id,
        jobNumber: jc.jobNumber,
        branchId: jc.branchId,
        customerName: jc.customerName,
        vehicleMakeModel: jc.vehicleMakeModel,
        vehicleRegNumber: jc.vehicleRegNumber,
        customerPhone: jc.customerPhone,
        address,
        scheduledTime: jc.expectedDelivery,
        type: reqType,
        driverId: driver?.id,
        driverName: driver?.name,
        notes: notes.trim() || undefined,
      });
      setCreateOpen(false);
      resetForm();
      return;
    }

    const name = newCustomerName.trim();
    const addr = newAddress.trim();
    if (!name) {
      toast.error("Enter the customer name.");
      return;
    }
    if (!addr) {
      toast.error("Enter the pickup or drop address.");
      return;
    }
    if (!newBranchId) {
      toast.error("Select a branch.");
      return;
    }
    if (!newScheduledLocal) {
      toast.error("Select a scheduled date and time.");
      return;
    }
    const scheduled = new Date(newScheduledLocal);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error("Invalid date and time.");
      return;
    }
    if (isDatetimeLocalInPast(newScheduledLocal)) {
      toast.error("Scheduled time cannot be in the past.", {
        description: "Choose a future date and time.",
      });
      return;
    }

    const phoneLine = newCustomerPhone.trim()
      ? `Phone: ${newCustomerPhone.trim()}`
      : "";
    const combinedNotes = [phoneLine, notes.trim()].filter(Boolean).join("\n\n");

    addRequest({
      jobCardId: `new-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`,
      jobNumber: "NEW",
      branchId: newBranchId,
      customerName: name,
      customerPhone: newCustomerPhone.trim() || undefined,
      address: addr,
      scheduledTime: scheduled.toISOString(),
      type: reqType,
      driverId: driver?.id,
      driverName: driver?.name,
      notes: combinedNotes || undefined,
    });
    setCreateOpen(false);
    resetForm();
  };

  const canSubmitCreate =
    createMode === "existing"
      ? !!bookingId
      : !!(
          newCustomerName.trim() &&
          newAddress.trim() &&
          newBranchId &&
          newScheduledLocal
        );

  const handlePickupDropWhatsApp = async (r: PickupDropRequest) => {
    const phone = customerPhoneFromPickupRequest(r);
    if (!phone) {
      toast.error("No customer phone", {
        description: "Add a phone when creating the request, or open the job card for this booking.",
      });
      return;
    }
    const branchName = branches.find((b) => b.id === r.branchId)?.name;
    const message = buildPickupDropWhatsAppMessage(r, { branchName });
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Pickup/Drop update via WhatsApp" : "Pickup/Drop — WhatsApp composer",
        message: `${r.jobNumber} → ${phone}`,
        href: "/pickup-drop",
        branchId: r.branchId,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("WhatsApp sent", { description: phone });
      notify("api");
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio on the server.",
        });
        notify("composer");
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send",
      });
    }
  };

  const handleAdvanceStatus = (r: PickupDropRequest) => {
    const block = validatePickupDropAdvance(r);
    if (block) {
      toast.error(block);
      return;
    }
    const next = advanceStatus(r.id);
    if (!next) {
      toast.message("Already at final status");
      return;
    }
    toast.success(PICKUP_DROP_STATUS_LABEL[next]);
  };

  const handleAssignDriver = (requestId: string, value: string, driverName?: string) => {
    if (value === "unassigned") {
      assignDriver(requestId, undefined, undefined);
      return;
    }
    assignDriver(requestId, value, driverName);
    if (driverName) {
      toast.success(`Driver: ${driverName}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pickup & Drop Management"
        description={`Manage vehicle pickup and delivery for ${viewingLabel}.`}
        actions={
          <>
            <Button
              className="gap-2"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Request
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {(
          [
            { label: "Total Requests", value: kpis.total, color: "text-foreground" },
            { label: "Pending", value: kpis.pending, color: "text-orange-500" },
            { label: "Driver Assigned", value: kpis.driverAssigned, color: "text-blue-600" },
            { label: "In Service", value: kpis.inService, color: "text-violet-600" },
            { label: "Delivered", value: kpis.delivered, color: "text-emerald-600" },
          ] as const
        ).map((k) => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className={cn("text-3xl font-bold tabular-nums mt-2", k.color)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-[220px]">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as PickupDropStatus | "ALL")}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="cursor-pointer data-[highlighted]:bg-[#1D61D1] data-[highlighted]:text-white"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:max-w-[220px]">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as PickupDropType | "ALL")}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="cursor-pointer data-[highlighted]:bg-[#1D61D1] data-[highlighted]:text-white"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredGroups.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 px-4">
            <p className="text-sm text-muted-foreground text-center">
              No pickup/drop requests found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const phone =
              customerPhoneFromPickupRequest(group.pickup ?? group.drop ?? group.orphan!) ??
              undefined;
            return (
              <PickupDropJobGroupCard
                key={group.jobCardId}
                group={group}
                allRequests={scopedRequests}
                branchScoped={!!selectedBranchId}
                customerPhone={phone}
                onAssignDriver={handleAssignDriver}
                onAdvance={handleAdvanceStatus}
                onWhatsApp={(req) => void handlePickupDropWhatsApp(req)}
              />
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className={cn("sm:max-w-lg", dialogSurfaceClass)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-foreground">
              Create Pickup/Drop Request
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[min(70vh,28rem)] overflow-y-auto pr-1">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Customer</Label>
              <div className="flex rounded-lg border border-input bg-muted/30 p-1 gap-1">
                <Button
                  type="button"
                  variant={createMode === "existing" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setCreateMode("existing")}
                >
                  Existing booking
                </Button>
                <Button
                  type="button"
                  variant={createMode === "new" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setCreateMode("new");
                    setNewBranchId((prev) => prev || scopedBranches[0]?.id || "");
                    setNewScheduledLocal((prev) => prev || defaultScheduledDatetimeLocal());
                  }}
                >
                  New customer
                </Button>
              </div>
            </div>

            {createMode === "existing" ? (
              <div className="grid gap-2">
                <Label htmlFor="pd-booking">Select booking</Label>
                {scopedJobCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border px-3 py-2.5">
                    No job cards in this branch. Switch to <strong className="font-medium text-foreground">New customer</strong> to create a request without a job card.
                  </p>
                ) : (
                  <Select value={bookingId} onValueChange={setBookingId}>
                    <SelectTrigger id="pd-booking" className={selectTriggerClass}>
                      <SelectValue placeholder="Select a job card…" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {scopedJobCards.map((jc) => (
                        <SelectItem
                          key={jc.id}
                          value={jc.id}
                          className="cursor-pointer data-[highlighted]:bg-[#1D61D1] data-[highlighted]:text-white"
                        >
                          {jc.jobNumber} · {jc.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="pd-new-name">Customer name</Label>
                  <Input
                    id="pd-new-name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Full name"
                    className="border-input"
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pd-new-phone">Phone (optional)</Label>
                  <Input
                    id="pd-new-phone"
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="border-input"
                    autoComplete="tel"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pd-new-address">Pickup / drop address</Label>
                  <Textarea
                    id="pd-new-address"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    rows={3}
                    className="resize-none border-input"
                    placeholder="Street, landmark, pincode…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pd-new-branch">Branch</Label>
                  {scopedBranches.length === 0 ? (
                    <p className="text-sm text-destructive rounded-md border border-dashed px-3 py-2.5">
                      No active branch available for your scope.
                    </p>
                  ) : (
                    <Select value={newBranchId || undefined} onValueChange={setNewBranchId}>
                      <SelectTrigger id="pd-new-branch" className={selectTriggerClass}>
                        <SelectValue placeholder="Select branch…" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {scopedBranches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pd-new-when">Scheduled date &amp; time</Label>
                  <Input
                    id="pd-new-when"
                    type="datetime-local"
                    min={localDatetimeLocalInputMin()}
                    value={newScheduledLocal}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setNewScheduledLocal(v);
                        return;
                      }
                      if (!isDatetimeLocalInPast(v)) {
                        setNewScheduledLocal(v);
                      } else {
                        setNewScheduledLocal(localDatetimeLocalInputMin());
                      }
                    }}
                    className="border-input"
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>Request Type</Label>
              <Select value={reqType} onValueChange={(v) => setReqType(v as PickupDropType)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="PICKUP">Pickup</SelectItem>
                  <SelectItem value="DROP">Drop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign Driver (Optional)</Label>
              <PickupDriverSelect
                branchId={
                  createMode === "existing"
                    ? scopedJobCards.find((j) => j.id === bookingId)?.branchId ?? selectedBranchId ?? ""
                    : newBranchId
                }
                value={driverId}
                onValueChange={(id) => setDriverId(id)}
                branchScoped={!!selectedBranchId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pd-notes">Notes (Optional)</Label>
              <Textarea
                id="pd-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none border-input"
                placeholder="Add any notes…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSubmitCreate} onClick={handleCreate}>
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
