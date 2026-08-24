"use client";

import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INDIAN_VEHICLE_REG_HINT,
  isValidIndianVehicleRegistration,
  sanitizeVehicleRegistrationInput,
} from "@/lib/vehicle-registration";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import type { FuelType, VehicleSegment } from "@/types";
import {
  ADD_VEHICLE_FUEL_TYPES,
  ADD_VEHICLE_SEGMENTS,
  type AddVehicleFormData,
} from "./add-vehicle-form-types";

export type AddVehicleFormFieldsProps = {
  form: UseFormReturn<AddVehicleFormData>;
  /** When false, customer picker is hidden (customerId expected via locked value). */
  showCustomerSelect?: boolean;
  /** Prefix for input ids when multiple forms can mount. */
  idPrefix?: string;
  className?: string;
};

export function AddVehicleFormFields({
  form,
  showCustomerSelect = true,
  idPrefix = "add-veh",
  className,
}: AddVehicleFormFieldsProps) {
  const customers = useCustomerStore((s) => s.customers);
  const { getBrandNames, getModels, getModelSegment } = useVehicleCatalogStore();

  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form;

  /* eslint-disable react-hooks/incompatible-library -- react-hook-form watch() */
  const watchCustomerId = watch("customerId");
  const watchFuelType = watch("fuelType");
  const watchSegment = watch("segment");
  const watchMake = watch("make");
  const watchModel = watch("model");
  const watchIdentifierType = watch("identifierType") || "REG";
  /* eslint-enable react-hooks/incompatible-library */

  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [extraModels, setExtraModels] = useState<Record<string, Array<{ name: string }>>>({});
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [newBrandDraft, setNewBrandDraft] = useState("");
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelDraft, setNewModelDraft] = useState("");

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

  const id = (name: string) => `${idPrefix}-${name}`;

  const commitNewBrand = () => {
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
  };

  const commitNewModel = () => {
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
    const seg = getModelSegment(makeKey, t);
    if (seg) {
      setValue("segment", seg, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }
    setNewModelOpen(false);
    setNewModelDraft("");
    toast.success("Model added", { description: t });
  };

  return (
    <>
      <div className={cn("space-y-3", className)}>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("identifierType")}>Identifier Type</Label>
              <input type="hidden" {...register("identifierType", { required: "Required" })} />
              <Select
                value={watchIdentifierType}
                onValueChange={(val) => {
                  setValue("identifierType", val as "REG" | "VIN");
                  setValue("identifierValue", "");
                }}
              >
                <SelectTrigger id={id("identifierType")}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REG">Registration Number</SelectItem>
                  <SelectItem value="VIN">VIN Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={id("identifierValue")}>
                {watchIdentifierType === "REG" ? "Registration Number" : "VIN Number"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id={id("identifierValue")}
                placeholder={
                  watchIdentifierType === "REG" ? "e.g. KA-01-AB-1234" : "e.g. VIN1234567890"
                }
                {...register("identifierValue", {
                  required: "Required",
                  onChange: (e) => {
                    if (watchIdentifierType === "REG") {
                      e.target.value = sanitizeVehicleRegistrationInput(e.target.value);
                    }
                  },
                  validate: (v) => {
                    if (watchIdentifierType === "REG") {
                      return (
                        isValidIndianVehicleRegistration(String(v)) || INDIAN_VEHICLE_REG_HINT
                      );
                    }
                    return String(v).trim().length >= 5 || "Must be at least 5 characters";
                  },
                })}
                autoCapitalize="characters"
              />
              {watchIdentifierType === "REG" && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {INDIAN_VEHICLE_REG_HINT}
                </p>
              )}
              {errors.identifierValue && (
                <p className="text-xs text-destructive">{errors.identifierValue.message}</p>
              )}
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-2",
              showCustomerSelect ? "sm:grid-cols-2" : "sm:grid-cols-1 sm:max-w-xs"
            )}
          >
            {showCustomerSelect && (
              <div className="space-y-1.5">
                <Label htmlFor={id("customerId")}>
                  Customer <span className="text-destructive">*</span>
                </Label>
                <input
                  type="hidden"
                  {...register("customerId", { required: showCustomerSelect ? "Required" : false })}
                />
                <CustomerSearchSelect
                  customers={customers}
                  selectedCustomerId={watchCustomerId}
                  onSelectCustomer={(v) =>
                    setValue("customerId", v, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                  className={cn(errors.customerId && "border-destructive")}
                />
                {errors.customerId && (
                  <p className="text-xs text-destructive">{errors.customerId.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={id("odometer")}>Odometer (km)</Label>
              <Input
                id={id("odometer")}
                type="number"
                placeholder="e.g. 25000"
                {...register("odometer")}
              />
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
                <Label htmlFor={id("make")}>
                  Make <span className="text-destructive">*</span>
                </Label>
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
                <SelectTrigger id={id("make")} className={cn(errors.make && "border-destructive")}>
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
              {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id("model")}>
                  Model <span className="text-destructive">*</span>
                </Label>
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
                  const seg = getModelSegment(watchMake, value);
                  if (seg) {
                    setValue("segment", seg, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }
                }}
                disabled={!watchMake}
              >
                <SelectTrigger id={id("model")} className={cn(errors.model && "border-destructive")}>
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
              {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("variant")}>Variant (optional)</Label>
            <Input id={id("variant")} placeholder="VXI" {...register("variant")} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Specifications
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("fuelType")}>Fuel Type</Label>
              <Select
                value={watchFuelType}
                onValueChange={(v) => setValue("fuelType", v as FuelType)}
              >
                <SelectTrigger
                  id={id("fuelType")}
                  className={cn(errors.fuelType && "border-destructive")}
                >
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_VEHICLE_FUEL_TYPES.map((ft) => (
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
              <Label htmlFor={id("segment")}>Segment</Label>
              <Select
                value={watchSegment}
                onValueChange={(v) => setValue("segment", v as VehicleSegment)}
              >
                <SelectTrigger
                  id={id("segment")}
                  className={cn(errors.segment && "border-destructive")}
                >
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  {ADD_VEHICLE_SEGMENTS.map((seg) => (
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
              <Label htmlFor={id("color")}>Color</Label>
              <Input id={id("color")} placeholder="Pearl Arctic White" {...register("color")} />
              {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("year")}>Year</Label>
              <Input id={id("year")} type="number" placeholder="2024" {...register("year")} />
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Insurance details
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("insuranceProvider")}>Insurance Provider</Label>
              <Input
                id={id("insuranceProvider")}
                placeholder="e.g. HDFC Ergo"
                {...register("insuranceProvider")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("insurancePolicyNumber")}>Policy Number</Label>
              <Input
                id={id("insurancePolicyNumber")}
                placeholder="e.g. POL123456"
                {...register("insurancePolicyNumber")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 sm:max-w-[calc(50%-0.25rem)]">
              <Label htmlFor={id("insuranceDueDate")}>Insurance Due Date</Label>
              <Input
                id={id("insuranceDueDate")}
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
            <Label htmlFor={id("notes")}>Notes (optional)</Label>
            <Textarea
              id={id("notes")}
              placeholder="Additional notes..."
              rows={2}
              className="min-h-0 resize-none"
              {...register("notes")}
            />
          </div>
        </div>
      </div>

      <Dialog open={newBrandOpen} onOpenChange={setNewBrandOpen}>
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
                commitNewBrand();
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewBrandOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={commitNewBrand}>
              Add brand
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newModelOpen} onOpenChange={setNewModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add model</DialogTitle>
            <DialogDescription>
              Add a model for{" "}
              <span className="font-medium text-foreground">{watchMake || "this brand"}</span>{" "}
              when it is not listed.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Model name"
            value={newModelDraft}
            onChange={(e) => setNewModelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNewModel();
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewModelOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={commitNewModel}>
              Add model
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
