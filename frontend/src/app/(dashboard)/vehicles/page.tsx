"use client";

import type { Vehicle, FuelType, VehicleSegment } from "@/types";
import { Plus, User, Upload, Download, ChevronDown, Loader2, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  findVehicleByNormalizedReg,
  INDIAN_VEHICLE_REG_ERROR_SHORT,
  isValidIndianVehicleRegistration,
  normalizeRegistrationNumber,
  INDIAN_VEHICLE_REG_HINT,
} from "@/lib/vehicle-registration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImportVehiclesDialog } from "@/components/vehicles/import-vehicles-dialog";
import { AddVehicleDialog } from "@/components/vehicles/add-vehicle-dialog";
import {
  buildVehicleExportRows,
  downloadVehiclesCsv,
  downloadVehiclesExcel,
  downloadVehiclesPdf,
} from "@/lib/vehicle-export";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
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
  DialogDescription,
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
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

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
  odometer?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceDueDate?: string;
  vinNumber?: string;
  identifierType: "REG" | "VIN";
  identifierValue: string;
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
  const updateVehicle = useVehicleStore((s) => s.updateVehicle);
  const deleteVehicle = useVehicleStore((s) => s.deleteVehicle);
  const fetchVehicles = useVehicleStore((s) => s.fetchVehicles);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModels, setExtraModels] = useState<Record<string, Array<{ name: string }>>>({});
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

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
      key: "odometer",
      label: "Odometer",
      sortable: true,
      render: (item: Vehicle & Record<string, unknown>) => {
        const v = item as Vehicle;
        return (
          <span className="tabular-nums text-muted-foreground">
            {v.odometer != null ? `${v.odometer.toLocaleString("en-IN")} km` : "—"}
          </span>
        );
      },
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
    {
      key: "actions",
      label: "Actions",
      className: "w-20 text-right",
      render: (item: Vehicle & Record<string, unknown>) => {
        const v = item as Vehicle;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingVehicle(v);
              }}
              title="Edit vehicle"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setDeletingVehicle(v);
              }}
              title="Delete vehicle"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    setExporting(true);
    try {
      await fetchVehicles();
      const latestVehicles = useVehicleStore.getState().vehicles;
      const latestCustomers = useCustomerStore.getState().customers;
      const rows = buildVehicleExportRows(latestVehicles, latestCustomers);
      if (rows.length === 0) {
        toast.error("No vehicles to export");
        return;
      }
      if (format === "excel") {
        await downloadVehiclesExcel(rows);
        toast.success(`Exported ${rows.length} vehicle${rows.length === 1 ? "" : "s"} to Excel`);
      } else if (format === "csv") {
        downloadVehiclesCsv(rows);
        toast.success(`Exported ${rows.length} vehicle${rows.length === 1 ? "" : "s"} to CSV`);
      } else {
        await downloadVehiclesPdf(rows);
        toast.success(`Exported ${rows.length} vehicle${rows.length === 1 ? "" : "s"} to PDF`);
      }
    } catch (e) {
      toast.error("Could not export vehicles", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Vehicles"
        actions={
          <TooltipProvider delayDuration={300}>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={exporting}
                        aria-label="Export vehicles"
                      >
                        {exporting ? (
                          <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                        ) : (
                          <Download className="h-4 w-4 sm:mr-1.5" />
                        )}
                        <span className="hidden sm:inline">Export</span>
                        <ChevronDown className="ml-0.5 hidden h-3.5 w-3.5 opacity-60 sm:inline" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="sm:hidden">
                    Export
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="min-w-0 w-[var(--radix-popper-anchor-width)]"
                >
                  <DropdownMenuItem disabled={exporting} onClick={() => void handleExport("excel")}>
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={exporting} onClick={() => void handleExport("csv")}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={exporting} onClick={() => void handleExport("pdf")}>
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setImportDialogOpen(true)}
                    aria-label="Import vehicles"
                  >
                    <Upload className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="sm:hidden">
                  Import
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                className="min-w-0 flex-1 whitespace-nowrap sm:flex-none"
                onClick={() => setAddDialogOpen(true)}
                aria-label="Add vehicle"
              >
                <Plus className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Vehicle</span>
              </Button>
            </div>
          </TooltipProvider>
        }
      />

      <ImportVehiclesDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <DataTable<Vehicle & Record<string, unknown>>
        data={tableData}
        columns={columns}
        searchPlaceholder="Search by registration, VIN, make, model, customer..."
        searchKeys={["registrationNumber", "vinNumber", "make", "model", "customerName"]}
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

      <AddVehicleDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {editingVehicle && (
        <EditVehicleDialog
          vehicle={editingVehicle}
          open={!!editingVehicle}
          onOpenChange={(open) => !open && setEditingVehicle(null)}
          customers={customers}
          extraBrands={extraBrands}
          setExtraBrands={setExtraBrands}
          extraModels={extraModels}
          setExtraModels={setExtraModels}
          onSave={async (updated) => {
            await updateVehicle(updated.id, updated);
            setEditingVehicle(null);
            toast.success("Vehicle updated", { description: `${updated.registrationNumber} has been updated.` });
          }}
        />
      )}

      <Dialog
        open={!!deletingVehicle}
        onOpenChange={(open) => !open && setDeletingVehicle(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete vehicle?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete vehicle{" "}
              <span className="font-semibold text-foreground">
                {deletingVehicle?.registrationNumber}
              </span>{" "}
              ({deletingVehicle?.make} {deletingVehicle?.model})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingVehicle(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (deletingVehicle) {
                  await deleteVehicle(deletingVehicle.id);
                  setDeletingVehicle(null);
                  toast.success("Vehicle deleted");
                }
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

export interface EditVehicleDialogProps {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: any[];
  extraBrands: string[];
  setExtraBrands: React.Dispatch<React.SetStateAction<string[]>>;
  extraModels: Record<string, Array<{ name: string }>>;
  setExtraModels: React.Dispatch<React.SetStateAction<Record<string, Array<{ name: string }>>>>;
  onSave: (updated: Vehicle) => void;
}

export function EditVehicleDialog({
  vehicle,
  open,
  onOpenChange,
  customers,
  extraBrands,
  setExtraBrands,
  extraModels,
  setExtraModels,
  onSave,
}: EditVehicleDialogProps) {
  const { getBrandNames, getModels } = useVehicleCatalogStore();
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");

  const isVinInitial = vehicle.vinNumber ? "VIN" : "REG";
  const initialValue = vehicle.vinNumber || vehicle.registrationNumber;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddVehicleFormData>({
    defaultValues: {
      fuelType: vehicle.fuelType,
      segment: vehicle.segment || "HATCHBACK",
      year: vehicle.year || new Date().getFullYear(),
      identifierType: isVinInitial as "REG" | "VIN",
      identifierValue: initialValue,
      customerId: vehicle.customerId,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant || "",
      color: vehicle.color || "",
      odometer: vehicle.odometer,
      notes: vehicle.notes || "",
      insuranceProvider: vehicle.insuranceProvider || "",
      insurancePolicyNumber: vehicle.insurancePolicyNumber || "",
      insuranceDueDate: vehicle.insuranceDueDate || "",
    },
  });

  /* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() */
  const watchCustomerId = watch("customerId");
  const watchFuelType = watch("fuelType");
  const watchSegment = watch("segment");
  const watchMake = watch("make");
  const watchModel = watch("model");
  const watchIdentifierType = watch("identifierType") || "REG";
  /* eslint-enable react-hooks/incompatible-library */

  const makeOptions = useMemo(() => {
    return [...new Set([...getBrandNames(), ...extraBrands])].sort((a, b) => a.localeCompare(b));
  }, [getBrandNames, extraBrands]);

  const modelOptions = useMemo(() => {
    if (!watchMake) return [];
    const defaultModels = getModels(watchMake);
    const added = extraModels[watchMake] || [];
    const combined = [...defaultModels, ...added];
    const unique = Array.from(new Map(combined.map((m) => [m.name.toLowerCase(), m])).values());
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [getModels, watchMake, extraModels]);

  const onSubmit = (data: AddVehicleFormData) => {
    const isVin = data.identifierType === "VIN";
    const regStored = isVin
      ? data.identifierValue.trim().toUpperCase()
      : normalizeRegistrationNumber(data.identifierValue);

    const customer = customers.find((c) => c.id === data.customerId);
    const updatedVehicle: Vehicle = {
      ...vehicle,
      customerId: data.customerId,
      customerName: customer?.name ?? "Unknown",
      registrationNumber: regStored,
      make: data.make,
      model: data.model,
      variant: data.variant || undefined,
      fuelType: data.fuelType,
      segment: data.segment,
      color: data.color,
      year: data.year,
      notes: data.notes || undefined,
      odometer: data.odometer ? Number(data.odometer) : undefined,
      insuranceProvider: data.insuranceProvider?.trim() || undefined,
      insurancePolicyNumber: data.insurancePolicyNumber?.trim() || undefined,
      insuranceDueDate: data.insuranceDueDate || undefined,
      vinNumber: isVin ? regStored : undefined,
    };
    onSave(updatedVehicle);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogMobileSheetContentClasses, "max-h-[min(92dvh,100%)] sm:max-w-[640px]")}>
          <DialogHeader className={dialogMobileSheetHeaderClasses}>
            <DialogTitle>Edit Vehicle</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-3 sm:space-y-4 sm:py-4">
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-identifierType">Identifier Type</Label>
                    <input type="hidden" {...register("identifierType", { required: "Required" })} />
                    <Select
                      value={watchIdentifierType}
                      onValueChange={(val) => {
                        setValue("identifierType", val as "REG" | "VIN");
                        setValue("identifierValue", "");
                      }}
                    >
                      <SelectTrigger id="edit-identifierType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REG">Registration Number</SelectItem>
                        <SelectItem value="VIN">VIN Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-identifierValue">
                      {watchIdentifierType === "REG" ? "Registration Number" : "VIN Number"}
                    </Label>
                    <Input
                      id="edit-identifierValue"
                      placeholder={watchIdentifierType === "REG" ? "e.g. KA-01-AB-1234" : "e.g. VIN1234567890"}
                      {...register("identifierValue", {
                        required: "Required",
                        validate: (v) => {
                          if (watchIdentifierType === "REG") {
                            return isValidIndianVehicleRegistration(String(v)) || INDIAN_VEHICLE_REG_HINT;
                          }
                          return String(v).trim().length >= 5 || "Must be at least 5 characters";
                        }
                      })}
                    />
                    {errors.identifierValue && (
                      <p className="text-xs text-destructive">{errors.identifierValue.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-customerId">Customer</Label>
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

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-odometer">Odometer (km)</Label>
                    <Input id="edit-odometer" type="number" placeholder="e.g. 25000" {...register("odometer")} />
                    {errors.odometer && (
                      <p className="text-xs text-destructive">{errors.odometer.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vehicle details
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="edit-make">Make</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 border-sky-300 bg-white px-2.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                        onClick={() => {
                          setNewBrandDraft("");
                          setNewBrandOpen(true);
                        }}
                      >
                        + New
                      </Button>
                    </div>
                    <input type="hidden" {...register("make", { required: "Required" })} />
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
                      <SelectTrigger id="edit-make" className={cn(errors.make && "border-destructive")}>
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
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="edit-model">Model</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 border-sky-300 bg-white px-2.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                        onClick={() => {
                          setNewModelDraft("");
                          setNewModelOpen(true);
                        }}
                        disabled={!watchMake}
                      >
                        + New
                      </Button>
                    </div>
                    <input type="hidden" {...register("model", { required: "Required" })} />
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
                      <SelectTrigger id="edit-model" className={cn(errors.model && "border-destructive")}>
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
                  <Label htmlFor="edit-variant">Variant (optional)</Label>
                  <Input id="edit-variant" placeholder="VXI" {...register("variant")} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Specifications
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-fuelType">Fuel Type</Label>
                    <Select
                      value={watchFuelType}
                      onValueChange={(value) =>
                        setValue("fuelType", value as FuelType, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="edit-fuelType">
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PETROL">Petrol</SelectItem>
                        <SelectItem value="DIESEL">Diesel</SelectItem>
                        <SelectItem value="CNG">CNG</SelectItem>
                        <SelectItem value="ELECTRIC">Electric</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-segment">Segment</Label>
                    <Select
                      value={watchSegment}
                      onValueChange={(value) =>
                        setValue("segment", value as VehicleSegment, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger id="edit-segment">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                        <SelectItem value="SEDAN">Sedan</SelectItem>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="LUXURY">Luxury</SelectItem>
                        <SelectItem value="MUV_MPV">MUV / MPV</SelectItem>
                        <SelectItem value="COMPACT_SUV">Compact SUV</SelectItem>
                        <SelectItem value="BIKE">Bike</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.segment && (
                      <p className="text-xs text-destructive">{errors.segment.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-color">Color</Label>
                    <Input id="edit-color" placeholder="Pearl Arctic White" {...register("color")} />
                    {errors.color && (
                      <p className="text-xs text-destructive">{errors.color.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-year">Year</Label>
                    <Input id="edit-year" type="number" placeholder="2024" {...register("year")} />
                    {errors.year && (
                      <p className="text-xs text-destructive">{errors.year.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Insurance details
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-insuranceProvider">Insurance Provider</Label>
                    <Input
                      id="edit-insuranceProvider"
                      placeholder="e.g. HDFC Ergo"
                      {...register("insuranceProvider")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-insurancePolicyNumber">Policy Number</Label>
                    <Input
                      id="edit-insurancePolicyNumber"
                      placeholder="e.g. POL123456"
                      {...register("insurancePolicyNumber")}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="edit-insuranceDueDate">Insurance Due Date</Label>
                    <Input
                      id="edit-insuranceDueDate"
                      type="date"
                      className="date-input-icon-end pr-9"
                      {...register("insuranceDueDate")}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Additional
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-notes">Notes (optional)</Label>
                  <Textarea
                    id="edit-notes"
                    placeholder="Additional notes..."
                    rows={2}
                    className="min-h-0 resize-none"
                    {...register("notes")}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-sm sm:justify-end sm:py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newBrandOpen}
        onOpenChange={(open) => {
          setNewBrandOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>
              Add a brand name when it is not in the catalog list.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Brand name"
            value={newBrandDraft}
            onChange={(e) => setNewBrandDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = newBrandDraft.trim();
                if (!t) return;
                if (makeOptions.some((b) => b.toLowerCase() === t.toLowerCase())) {
                  toast.error("Brand already in list");
                  return;
                }
                setExtraBrands((prev) => [...prev, t]);
                setValue("make", t, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setValue("model", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setNewBrandOpen(false);
                setNewBrandDraft("");
                toast.success("Brand added", { description: t });
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewBrandOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const t = newBrandDraft.trim();
                if (!t) {
                  toast.error("Enter a brand name");
                  return;
                }
                if (makeOptions.some((b) => b.toLowerCase() === t.toLowerCase())) {
                  toast.error("Brand already in list");
                  return;
                }
                setExtraBrands((prev) => [...prev, t]);
                setValue("make", t, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setValue("model", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setNewBrandOpen(false);
                setNewBrandDraft("");
                toast.success("Brand added", { description: t });
              }}
            >
              Add brand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newModelOpen}
        onOpenChange={(open) => {
          setNewModelOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add model</DialogTitle>
            <DialogDescription>
              Add a model for <span className="font-medium text-foreground">{watchMake}</span> when it is not listed.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Model name"
            value={newModelDraft}
            onChange={(e) => setNewModelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = newModelDraft.trim();
                if (!t) return;
                if (modelOptions.some((m) => m.name.toLowerCase() === t.toLowerCase())) {
                  toast.error("Model already in list");
                  return;
                }
                const makeKey = watchMake || "";
                setExtraModels((prev) => ({
                  ...prev,
                  [makeKey]: [...(prev[makeKey] || []), { name: t }],
                }));
                setValue("model", t, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setNewModelOpen(false);
                setNewModelDraft("");
                toast.success("Model added", { description: t });
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewModelOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const t = newModelDraft.trim();
                if (!t) {
                  toast.error("Enter a model name");
                  return;
                }
                if (modelOptions.some((m) => m.name.toLowerCase() === t.toLowerCase())) {
                  toast.error("Model already in list");
                  return;
                }
                const makeKey = watchMake || "";
                setExtraModels((prev) => ({
                  ...prev,
                  [makeKey]: [...(prev[makeKey] || []), { name: t }],
                }));
                setValue("model", t, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                setNewModelOpen(false);
                setNewModelDraft("");
                toast.success("Model added", { description: t });
              }}
            >
              Add model
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
