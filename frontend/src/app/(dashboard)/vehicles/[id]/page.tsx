"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useVehicleStore } from "@/store/vehicle-store";
import { useReminderStore } from "@/store/reminder-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useCustomerStore } from "@/store/customer-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobCardStatusBadge } from "@/components/shared/status-badge";
import { cn, formatDate } from "@/lib/utils";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import { buildOwnershipTimeline } from "@/lib/ownership-transfers";
import type { OwnershipTimelineItem } from "@/lib/ownership-transfers";
import { toast } from "sonner";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { ArrowLeft, Bell, AlertTriangle, Clock, Calendar, Wrench, Droplets, Disc3, Snowflake, Battery, Shield, FileCheck, UserPlus, Edit, Trash2 } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import type { JobCard, Vehicle } from "@/types";
import { EditVehicleDialog } from "../page";

function normalizeJobCardStatus(status: string): JobCard["status"] {
  const map: Record<string, string> = {};
  return (map[status] ?? status) as JobCard["status"];
}

function getColorHex(colorName: string): string {
  const lower = colorName.toLowerCase();
  if (lower.includes("white") || lower.includes("arctic") || lower.includes("polar")) return "#f8fafc";
  if (lower.includes("black") || lower.includes("midnight") || lower.includes("oberon") || lower.includes("abyss")) return "#1e293b";
  if (lower.includes("grey") || lower.includes("gray") || lower.includes("silver") || lower.includes("steel")) return "#64748b";
  if (lower.includes("red") || lower.includes("fiery") || lower.includes("radiant")) return "#dc2626";
  if (lower.includes("blue") || lower.includes("nexa") || lower.includes("teal")) return "#2563eb";
  if (lower.includes("orange")) return "#ea580c";
  if (lower.includes("beige") || lower.includes("rocky")) return "#d4a574";
  if (lower.includes("green")) return "#16a34a";
  return "#6366f1";
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const vehicleList = useVehicleStore((s) => s.vehicles);
  const setVehicleList = useVehicleStore((s) => s.setVehicles);
  const storeJobCards = useJobCardStore((s) => s.jobCards);
  const customers = useCustomerStore((s) => s.customers);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModels, setExtraModels] = useState<Record<string, Array<{ name: string }>>>({});

  const vehicle = useMemo(
    () => vehicleList.find((v) => v.id === vehicleId) ?? null,
    [vehicleList, vehicleId]
  );
  const vehicleJobCards = useMemo(() => {
    if (!vehicle) return [];
    return storeJobCards
      .filter(
        (jc) =>
          jc.vehicleId === vehicleId ||
          jc.vehicleRegNumber?.toUpperCase() === vehicle.registrationNumber.toUpperCase()
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [storeJobCards, vehicleId, vehicle]);

  if (!vehicle) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Button variant="ghost" onClick={() => router.push("/vehicles")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vehicles
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Vehicle not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const hex = getColorHex(vehicle.color);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: "Vehicles", href: "/vehicles" },
        { label: vehicle.registrationNumber },
      ]} />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-3xl font-bold font-mono tracking-tight">{vehicle.registrationNumber}</p>
              <p className="text-lg text-muted-foreground mt-1">
                {vehicle.make} {vehicle.model}
                {vehicle.variant && ` ${vehicle.variant}`}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {vehicle.segment && (
                  <Badge variant="outline">{vehicle.segment.replace(/_/g, " ")}</Badge>
                )}
                <Badge variant="secondary">{vehicle.fuelType}</Badge>
                <span className="text-sm text-muted-foreground">{vehicle.year}</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <span
                    className="size-4 rounded-full shrink-0 border border-border"
                    style={{ backgroundColor: hex }}
                  />
                  {vehicle.color}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>
              Customer:{" "}
              <Link
                href={`/customers/${vehicle.customerId}`}
                className="font-medium text-primary hover:underline"
              >
                {vehicle.customerName}
              </Link>
            </span>
          </div>
          {vehicle.notes && (
            <p className="mt-3 text-sm text-muted-foreground">{vehicle.notes}</p>
          )}
        </CardHeader>
      </Card>

      <VehicleOwnershipSection vehicle={vehicle} vehicleId={vehicleId} vehicleList={vehicleList} setVehicleList={setVehicleList} />

      <VehicleReminders vehicleId={vehicleId} />

      <div>
        <h2 className="text-lg font-semibold mb-4">Service History</h2>
        {vehicleJobCards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No service history for this vehicle
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] sm:left-[72px] top-8 bottom-8 w-px bg-border" />
            <div className="space-y-0">
              {vehicleJobCards.map((jc, index) => (
                <div key={jc.id} className="relative flex gap-3 sm:gap-6 pb-8 last:pb-0">
                  <div className="hidden sm:block w-20 shrink-0 pt-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {formatDate(jc.createdAt)}
                    </p>
                  </div>
                  <div className="relative z-10 flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-background border-2 border-primary mt-0">
                    <span className="text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
                      <p className="text-xs text-muted-foreground mb-2 sm:hidden">
                        {formatDate(jc.createdAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-medium">{jc.jobNumber}</span>
                        <JobCardStatusBadge status={normalizeJobCardStatus(jc.status)} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {jc.services.map((s) => s.name).join(", ")}
                      </p>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-muted-foreground">
                        {jc.mechanicName && (
                          <span>Mechanic: {jc.mechanicName}</span>
                        )}
                        {jc.odometerReading != null && (
                          <span>Odometer: {jc.odometerReading.toLocaleString()} km</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <EditVehicleDialog
          vehicle={vehicle}
          open={editOpen}
          onOpenChange={setEditOpen}
          customers={customers}
          extraBrands={extraBrands}
          setExtraBrands={setExtraBrands}
          extraModels={extraModels}
          setExtraModels={setExtraModels}
          onSave={(updated) => {
            setVehicleList((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setEditOpen(false);
            toast.success("Vehicle updated", { description: `${updated.registrationNumber} has been updated.` });
          }}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete vehicle?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete vehicle{" "}
              <span className="font-semibold text-foreground">
                {vehicle.registrationNumber}
              </span>{" "}
              ({vehicle.make} {vehicle.model})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setVehicleList((prev) => prev.filter((v) => v.id !== vehicle.id));
                setDeleteOpen(false);
                toast.success("Vehicle deleted");
                router.push("/vehicles");
              }}
            >
              Delete vehicle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OwnershipTimeline({ items }: { items: OwnershipTimelineItem[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, index) => (
        <div key={index} className="relative flex gap-3">
          <div className="flex w-6 shrink-0 flex-col items-center">
            {item.kind === "owner" ? (
              <div
                className={cn(
                  "mt-1.5 size-2.5 shrink-0 rounded-full border-2 z-10 bg-background",
                  item.isCurrent
                    ? "border-blue-600 bg-blue-600"
                    : "border-muted-foreground/40"
                )}
              />
            ) : (
              <div className="mt-2.5 w-6 shrink-0" aria-hidden />
            )}
            {index < items.length - 1 && (
              <div
                className="min-h-11 w-px flex-1 border-l-2 border-dashed border-muted-foreground/25"
                aria-hidden
              />
            )}
          </div>
          <div className={cn("min-w-0 flex-1", index < items.length - 1 && "pb-6")}>
            {item.kind === "owner" ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/customers/${item.customerId}`}
                    className={cn(
                      "font-semibold",
                      item.isCurrent ? "text-[#1D4ED8]" : "text-foreground"
                    )}
                  >
                    {item.name}
                  </Link>
                  {item.isCurrent && (
                    <Badge
                      variant="outline"
                      className="border-[#BFDBFE] bg-[#DBEAFE] text-[#1E40AF] hover:bg-[#DBEAFE]"
                    >
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{item.detailLine}</p>
              </div>
            ) : (
              <div
                className="rounded-md border px-3 py-2 text-[13px] leading-snug"
                style={{
                  backgroundColor: "#EFF6FF",
                  borderColor: "#BFDBFE",
                  color: "#1E40AF",
                }}
              >
                Transferred on {formatDate(item.transferredOn)} · Reason:{" "}
                {item.reason?.trim() ? item.reason : "Not specified"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleOwnershipSection({
  vehicle,
  vehicleId,
  vehicleList,
  setVehicleList,
}: {
  vehicle: Vehicle;
  vehicleId: string;
  vehicleList: Vehicle[];
  setVehicleList: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const customers = useCustomerStore((s) => s.customers);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const currentVehicle = useMemo(
    () => vehicleList.find((v) => v.id === vehicleId) ?? vehicle,
    [vehicleList, vehicleId, vehicle]
  );

  const otherCustomers = useMemo(
    () => customers.filter((c) => c.id !== currentVehicle.customerId),
    [customers, currentVehicle.customerId]
  );

  const handleTransfer = () => {
    if (!newCustomerId.trim()) {
      toast.error("Please select a new customer");
      return;
    }
    const newCustomer = customers.find((c) => c.id === newCustomerId);
    if (!newCustomer) return;

    const previousOwners = [
      ...(currentVehicle.previousOwners ?? []),
      {
        customerId: currentVehicle.customerId,
        customerName: currentVehicle.customerName,
        transferDate: new Date().toISOString().split("T")[0],
        reason: transferReason.trim() || undefined,
      },
    ];

    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              customerId: newCustomerId,
              customerName: newCustomer.name,
              previousOwners,
            }
          : v
      )
    );
    setNewCustomerId("");
    setTransferReason("");
    setTransferDialogOpen(false);
    toast.success("Ownership transferred successfully");
    pushActivityLog({
      action: "OWNERSHIP_TRANSFERRED",
      entityType: "VEHICLE",
      entityId: vehicleId,
      entityLabel: currentVehicle.registrationNumber,
      details: `Ownership transferred from ${currentVehicle.customerName} to ${newCustomer.name}`,
    });
  };

  const timelineItems = useMemo(
    () => buildOwnershipTimeline(currentVehicle, customers),
    [currentVehicle, customers]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Ownership Transfer
        </h2>
        <Button onClick={() => setTransferDialogOpen(true)} className="shrink-0 w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Transfer Ownership
        </Button>
      </div>
      <Card>
        <CardContent className="p-4 sm:p-5">
          {timelineItems && timelineItems.length > 0 ? (
            <OwnershipTimeline items={timelineItems} />
          ) : (
            <p className="text-sm text-muted-foreground">No previous ownership transfers.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCustomer">New Customer</Label>
              <CustomerSearchSelect
                customers={otherCustomers}
                selectedCustomerId={newCustomerId}
                onSelectCustomer={setNewCustomerId}
                placeholder="Select customer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferReason">Transfer Reason (optional)</Label>
              <Textarea
                id="transferReason"
                placeholder="e.g. Vehicle sold, gifted..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer}>Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const REMINDER_ICONS: Record<string, React.ElementType> = {
  GENERAL_SERVICE: Wrench,
  OIL_CHANGE: Droplets,
  BRAKE_INSPECTION: Disc3,
  TIRE_ROTATION: Disc3,
  AC_SERVICE: Snowflake,
  BATTERY_CHECK: Battery,
  INSURANCE: Shield,
  PUC: FileCheck,
};

const REMINDER_LABELS: Record<string, string> = {
  GENERAL_SERVICE: "General Service",
  OIL_CHANGE: "Oil Change",
  BRAKE_INSPECTION: "Brake Inspection",
  TIRE_ROTATION: "Tire Rotation",
  AC_SERVICE: "AC Service",
  BATTERY_CHECK: "Battery Check",
  INSURANCE: "Insurance Renewal",
  PUC: "PUC Certificate",
};

function VehicleReminders({ vehicleId }: { vehicleId: string }) {
  const storeReminders = useReminderStore((s) => s.reminders);
  const reminders = storeReminders
    .filter((r) => r.vehicleId === vehicleId && r.status !== "COMPLETED" && r.status !== "DISMISSED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const [nowWallMs, setNowWallMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowWallMs(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (reminders.length === 0) return null;
  if (nowWallMs === null) return null;
  const clock = nowWallMs;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-500" />
        Service Reminders
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reminders.map((r) => {
          const days = Math.ceil(
            (new Date(r.dueDate).getTime() - clock) / (1000 * 60 * 60 * 24)
          );
          const isOverdue = days < 0;
          const isDue = days >= 0 && days <= 3;
          const Icon = REMINDER_ICONS[r.type] ?? Wrench;

          const borderColor = isOverdue
            ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
            : isDue
            ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-border";

          return (
            <Card key={r.id} className={`${borderColor} transition-all`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                  isOverdue ? "bg-red-100 dark:bg-red-900/30" : isDue ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isOverdue ? "text-red-600 dark:text-red-400" : isDue ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{REMINDER_LABELS[r.type] ?? r.type}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        {Math.abs(days)}d overdue
                      </span>
                    ) : isDue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        {days === 0 ? "Due today" : `${days}d left`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Due {formatDate(r.dueDate)}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.notes}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
