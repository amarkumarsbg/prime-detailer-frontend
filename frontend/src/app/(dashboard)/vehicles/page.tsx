"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useVehicleStore } from "@/store/vehicle-store";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
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
import type { Vehicle, FuelType, VehicleSegment } from "@/types";
import { Plus, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  findVehicleByNormalizedReg,
  INDIAN_VEHICLE_REG_ERROR_SHORT,
  isValidIndianVehicleRegistration,
} from "@/lib/vehicle-registration";

const fuelTypes: FuelType[] = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"];

const vehicleSegments: VehicleSegment[] = ["HATCHBACK", "SEDAN", "SUV", "LUXURY", "MUV", "COMPACT_SUV"];

interface AddVehicleFormData {
  registrationNumber: string;
  make: string;
  model: string;
  variant?: string;
  fuelType: "PETROL" | "DIESEL" | "CNG" | "ELECTRIC" | "HYBRID";
  segment: VehicleSegment;
  color: string;
  year: number;
  customerId: string;
  notes?: string;
}

function formatFuelLabel(fuel: FuelType): string {
  if (fuel === "CNG") return "CNG";
  return fuel.charAt(0) + fuel.slice(1).toLowerCase();
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

export default function VehiclesPage() {
  const router = useRouter();
  const customers = useCustomerStore((s) => s.customers);
  const vehicleList = useVehicleStore((s) => s.vehicles);
  const setVehicles = useVehicleStore((s) => s.setVehicles);
  const { getBrandNames, getModels } = useVehicleCatalogStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AddVehicleFormData>({
    defaultValues: {
      fuelType: "PETROL",
      segment: "HATCHBACK",
      year: new Date().getFullYear(),
    },
  });

  /* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() */
  const watchCustomerId = watch("customerId");
  const watchFuelType = watch("fuelType");
  const watchSegment = watch("segment");
  const watchMake = watch("make");
  const watchModel = watch("model");
  /* eslint-enable react-hooks/incompatible-library */

  const makeOptions = useMemo(() => getBrandNames(), [getBrandNames]);
  const modelOptions = useMemo(
    () => (watchMake ? getModels(watchMake) : []),
    [getModels, watchMake]
  );

  const onSubmit = (data: AddVehicleFormData) => {
    const dup = findVehicleByNormalizedReg(vehicleList, data.registrationNumber);
    if (dup) {
      if (dup.customerId === data.customerId) {
        toast.error("This registration is already listed for this customer", {
          description: `${dup.registrationNumber} — ${dup.make} ${dup.model}`,
        });
      } else {
        toast.error("Registration already assigned to another customer", {
          description: `${dup.registrationNumber} belongs to ${dup.customerName}. Transfer ownership first if the vehicle changed hands.`,
        });
      }
      return;
    }
    const customer = customers.find((c) => c.id === data.customerId);
    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      customerId: data.customerId,
      customerName: customer?.name ?? "Unknown",
      registrationNumber: data.registrationNumber.toUpperCase(),
      make: data.make,
      model: data.model,
      variant: data.variant || undefined,
      fuelType: data.fuelType,
      segment: data.segment,
      color: data.color,
      year: data.year,
      notes: data.notes || undefined,
    };
    setVehicles((prev) => [newVehicle, ...prev]);
    reset();
    setAddDialogOpen(false);
    toast.success("Vehicle added", { description: `${data.registrationNumber.toUpperCase()} has been registered.` });
  };

  const tableData = vehicleList as (Vehicle & Record<string, unknown>)[];
  const columns = [
    {
      key: "registrationNumber",
      label: "Registration",
      sortable: true,
      className: "font-mono font-bold",
      render: (item: Vehicle & Record<string, unknown>) => (
        <span className="font-mono font-bold">{(item as Vehicle).registrationNumber}</span>
      ),
    },
    {
      key: "makeModel",
      label: "Make & Model",
      sortable: false,
      render: (item: Vehicle & Record<string, unknown>) => {
        const v = item as Vehicle;
        return (
          <span>
            {v.make} {v.model}
            {v.variant && ` - ${v.variant}`}
          </span>
        );
      },
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
    },
    {
      key: "fuelType",
      label: "Fuel Type",
      sortable: true,
      render: (item: Vehicle & Record<string, unknown>) => (
        <Badge variant="secondary">{(item as Vehicle).fuelType}</Badge>
      ),
    },
    {
      key: "segment",
      label: "Segment",
      sortable: true,
      render: (item: Vehicle & Record<string, unknown>) => (
        <Badge variant="outline">{(item as Vehicle).segment?.replace(/_/g, " ") ?? "—"}</Badge>
      ),
    },
    {
      key: "year",
      label: "Year",
      sortable: true,
    },
    {
      key: "color",
      label: "Color",
      render: (item: Vehicle & Record<string, unknown>) => {
        const v = item as Vehicle;
        const hex = getColorHex(v.color);
        return (
          <span className="flex items-center gap-2">
            <span
              className="size-3 rounded-full shrink-0 border border-border"
              style={{ backgroundColor: hex }}
            />
            <span className="text-sm">{v.color}</span>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Vehicles"
        inlineActionsOnMobile
        actions={
          <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vehicle
          </Button>
        }
      />

      <DataTable<Vehicle & Record<string, unknown>>
        data={tableData}
        columns={columns}
        searchPlaceholder="Search by registration, make, model, customer..."
        searchKeys={["registrationNumber", "make", "model", "customerName"]}
        pageSize={10}
        onRowClick={(item) => router.push(`/vehicles/${(item as Vehicle).id}`)}
        renderMobileCard={(item) => {
          const v = item as Vehicle;
          const hex = getColorHex(v.color);
          const segmentLabel = v.segment?.replace(/_/g, " ") ?? "—";
          return (
            <>
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="default"
                  className="h-6 max-w-[70%] truncate font-mono text-xs font-bold tracking-wide"
                >
                  {v.registrationNumber}
                </Badge>
                <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-medium uppercase">
                  {segmentLabel}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm font-medium leading-tight">
                {v.make} {v.model}
                {v.variant ? ` ${v.variant}` : ""}
              </p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{v.customerName}</span>
              </p>
              <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <span className="truncate">
                  {v.color} · {v.year} · {formatFuelLabel(v.fuelType)}
                </span>
              </p>
            </>
          );
        }}
      />

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,100%)] sm:max-w-[500px]")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Add Vehicle</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-3 sm:space-y-4 sm:py-4">
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    placeholder="KA-01-AB-1234"
                    maxLength={16}
                    {...register("registrationNumber", {
                      required: "Required",
                      validate: (v) =>
                        isValidIndianVehicleRegistration(String(v)) || INDIAN_VEHICLE_REG_ERROR_SHORT,
                    })}
                  />
                  {errors.registrationNumber && (
                    <p className="text-xs text-destructive">{errors.registrationNumber.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customerId">Customer</Label>
                  <CustomerSearchSelect
                    customers={customers}
                    selectedCustomerId={watchCustomerId}
                    onSelectCustomer={(v) => setValue("customerId", v)}
                    className={cn(errors.customerId && "border-destructive")}
                  />
                  {errors.customerId && (
                    <p className="text-xs text-destructive">{errors.customerId.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vehicle details
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="make">Make</Label>
                    <Select
                      value={watchMake || undefined}
                      onValueChange={(value) => {
                        setValue("make", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        setValue("model", "", {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      <SelectTrigger id="make" className={cn(errors.make && "border-destructive")}>
                        <SelectValue placeholder="Select make" />
                      </SelectTrigger>
                      <SelectContent>
                        {makeOptions.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.make && (
                      <p className="text-xs text-destructive">{errors.make.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model">Model</Label>
                    <Select
                      value={watchModel || undefined}
                      onValueChange={(value) => {
                        setValue("model", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                      disabled={!watchMake}
                    >
                      <SelectTrigger id="model" className={cn(errors.model && "border-destructive")}>
                        <SelectValue placeholder={watchMake ? "Select model" : "Select make first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((model) => (
                          <SelectItem key={model.name} value={model.name}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.model && (
                      <p className="text-xs text-destructive">{errors.model.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variant">Variant (optional)</Label>
                  <Input id="variant" placeholder="VXI" {...register("variant")} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Specifications
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <Select
                      value={watchFuelType}
                      onValueChange={(v) => setValue("fuelType", v as FuelType)}
                    >
                      <SelectTrigger className={cn(errors.fuelType && "border-destructive")}>
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        {fuelTypes.map((ft) => (
                          <SelectItem key={ft} value={ft}>
                            {ft}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.fuelType && (
                      <p className="text-xs text-destructive">{errors.fuelType.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="segment">Segment</Label>
                    <Select
                      value={watchSegment}
                      onValueChange={(v) => setValue("segment", v as VehicleSegment)}
                    >
                      <SelectTrigger className={cn(errors.segment && "border-destructive")}>
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleSegments.map((seg) => (
                          <SelectItem key={seg} value={seg}>
                            {seg.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.segment && (
                      <p className="text-xs text-destructive">{errors.segment.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="color">Color</Label>
                    <Input id="color" placeholder="Pearl Arctic White" {...register("color")} />
                    {errors.color && (
                      <p className="text-xs text-destructive">{errors.color.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" type="number" placeholder="2024" {...register("year")} />
                    {errors.year && (
                      <p className="text-xs text-destructive">{errors.year.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Additional
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    rows={2}
                    className="min-h-0 resize-none"
                    {...register("notes")}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-sm sm:justify-end sm:py-4">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Vehicle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
