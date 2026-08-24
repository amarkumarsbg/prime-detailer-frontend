"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useForm } from "react-hook-form";
import { AddVehicleFormFields } from "./add-vehicle-form-fields";
import {
  ADD_VEHICLE_FORM_DEFAULTS,
  type AddVehicleFormData,
} from "./add-vehicle-form-types";
import { resolveStoredVehicleIdentifier } from "./build-vehicle-from-form";

export type AddVehicleInlineFormHandle = {
  validate: () => Promise<boolean>;
  getValues: () => AddVehicleFormData & { registrationNumber: string; isVin: boolean };
};

export type AddVehicleInlineFormProps = {
  /** Pre-fill / lock customer id without showing the picker. */
  lockedCustomerId?: string;
  idPrefix?: string;
  className?: string;
  /** Called whenever form values change (for wizard state sync). */
  onChange?: (data: AddVehicleFormData & { registrationNumber: string; isVin: boolean }) => void;
  /** Expose validate+getValues for parent Next/submit handlers. */
  formRef?: MutableRefObject<AddVehicleInlineFormHandle | null>;
};

function withResolvedId(data: AddVehicleFormData) {
  const { isVin, regStored } = resolveStoredVehicleIdentifier(data);
  return { ...data, registrationNumber: regStored, isVin };
}

/**
 * Inline (non-dialog) Add Vehicle form — same fields as AddVehicleDialog.
 * Used on new-job-card / booking wizard when creating a vehicle with a new customer.
 */
export function AddVehicleInlineForm({
  lockedCustomerId = "",
  idPrefix = "add-veh-inline",
  className,
  onChange,
  formRef,
}: AddVehicleInlineFormProps) {
  const form = useForm<AddVehicleFormData>({
    defaultValues: {
      ...ADD_VEHICLE_FORM_DEFAULTS,
      customerId: lockedCustomerId,
    },
  });

  useEffect(() => {
    if (lockedCustomerId) {
      form.setValue("customerId", lockedCustomerId);
    }
  }, [lockedCustomerId, form]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const sub = form.watch((values) => {
      onChangeRef.current?.(withResolvedId(values as AddVehicleFormData));
    });
    return () => sub.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (!formRef) return;
    formRef.current = {
      validate: () => form.trigger(),
      getValues: () => withResolvedId(form.getValues()),
    };
    return () => {
      formRef.current = null;
    };
  }, [form, formRef]);

  return (
    <AddVehicleFormFields
      form={form}
      showCustomerSelect={false}
      idPrefix={idPrefix}
      className={className}
    />
  );
}
