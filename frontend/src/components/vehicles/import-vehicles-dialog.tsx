"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileUp, Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { useCustomerStore } from "@/store/customer-store";
import { useVehicleStore } from "@/store/vehicle-store";
import { parseVehicleImportFile } from "@/lib/vehicle-import/parse-tabular";
import { downloadVehicleImportTemplate } from "@/lib/vehicle-import/template";
import { mappingHasRequiredFields, mappingHasCustomerField } from "@/lib/vehicle-import/normalize";
import {
  applyColumnMapping,
  summarizeImportRows,
  validateImportRows,
} from "@/lib/vehicle-import/validate-rows";
import { registrationDuplicateKey } from "@/lib/vehicle-registration";
import type {
  VehicleImportParseResult,
  VehicleImportRowStatus,
  ValidatedVehicleImportRow,
} from "@/lib/vehicle-import/types";
import { cn } from "@/lib/utils";

type Step = "upload" | "preview";
type StatusFilter = "all" | VehicleImportRowStatus;

const STATUS_LABEL: Record<VehicleImportRowStatus, string> = {
  ready: "Ready",
  invalid: "Invalid",
  unmatched_customer: "Unmatched Customer",
  already_exists: "Already Exists",
  duplicate_in_file: "Dup in File",
};

const STATUS_VARIANT: Record<
  VehicleImportRowStatus,
  "success" | "destructive" | "warning" | "secondary"
> = {
  ready: "success",
  invalid: "destructive",
  unmatched_customer: "warning",
  already_exists: "warning",
  duplicate_in_file: "secondary",
};

interface ImportVehiclesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportVehiclesDialog({ open, onOpenChange }: ImportVehiclesDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const importVehicles = useVehicleStore((s) => s.importVehicles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<VehicleImportParseResult | null>(null);
  const [validated, setValidated] = useState<ValidatedVehicleImportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const existingRegKeys = useMemo(() => {
    const set = new Set<string>();
    for (const v of vehicles) {
      const key = registrationDuplicateKey(v.registrationNumber);
      if (key) set.add(key);
    }
    return set;
  }, [vehicles]);

  const reset = useCallback(() => {
    setStep("upload");
    setParsing(false);
    setImporting(false);
    setDragOver(false);
    setParseResult(null);
    setValidated([]);
    setStatusFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseVehicleImportFile(file);
      if (!mappingHasRequiredFields(result.mapping)) {
        const found = result.headers.filter(Boolean).join(", ") || "(none)";
        toast.error("Could not find required columns", {
          description: `Need Registration, Make, and Model. Found headers: ${found}`,
        });
        return;
      }
      if (!mappingHasCustomerField(result.mapping)) {
        toast.error("Missing Customer column", {
          description:
            'Add "Customer Phone" (or Customer Name / Customer ID) — vehicles must link to an existing customer. Example: Registration Number,Customer Phone,Make,Model',
        });
        return;
      }

      const parsed = applyColumnMapping(result.headers, result.rows, result.mapping);
      if (parsed.length === 0) {
        toast.error("No vehicle rows found in this file");
        return;
      }

      setParseResult(result);
      setValidated(validateImportRows(parsed, customers, existingRegKeys));
      setStatusFilter("all");
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file");
    } finally {
      setParsing(false);
    }
  };

  const summary = useMemo(() => summarizeImportRows(validated), [validated]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return validated;
    return validated.filter((r) => r.status === statusFilter);
  }, [validated, statusFilter]);

  const confirmImport = async () => {
    const ready = validated.filter((r) => r.status === "ready");
    if (ready.length === 0) {
      toast.error("No ready rows to import");
      return;
    }
    setImporting(true);
    try {
      const result = await importVehicles(
        ready.map((r) => ({
          registrationNumber: r.registrationNumber,
          customerId: r.resolvedCustomerId!,
          customerName: r.resolvedCustomerName!,
          make: r.make.trim(),
          model: r.model.trim(),
          fuelType: r.resolvedFuelType!,
          segment: r.resolvedSegment!,
          year: r.resolvedYear!,
          color: r.resolvedColor!,
          variant: r.variant.trim() || undefined,
          notes: r.notes.trim() || undefined,
        }))
      );
      toast.success(
        `Imported ${result.createdCount} vehicle${result.createdCount === 1 ? "" : "s"}`,
        result.skippedCount > 0
          ? { description: `${result.skippedCount} row(s) skipped by the server.` }
          : undefined
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error("Could not import vehicles", {
        description:
          e instanceof Error
            ? e.message
            : "Check that the API server is running (npm run dev in /backend).",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        mobileVariant="fullscreen"
        className={cn(dialogMobileSheetContentClasses, "max-h-[92vh] sm:max-w-4xl")}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Import Vehicles</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload CSV, Excel (.xlsx), or PDF. Registration, Customer, Make, and Model are
            required. PDF must be text-based — unclear rows are marked invalid.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
              >
                {parsing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {parsing ? "Reading file…" : "Drop a file here, or choose one"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    .csv, .xlsx, .pdf · max 5 MB · up to 5,000 rows
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={parsing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="mr-1.5 h-4 w-4" />
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadVehicleImportTemplate}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download CSV template
              </Button>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {parseResult && (
                <p className="text-sm text-muted-foreground">
                  Source:{" "}
                  <span className="font-medium text-foreground">{parseResult.sourceLabel}</span>
                  {" · "}
                  {summary.total} row{summary.total === 1 ? "" : "s"}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", `All (${summary.total})`],
                    ["ready", `Ready (${summary.ready})`],
                    ["invalid", `Invalid (${summary.invalid})`],
                    ["unmatched_customer", `Unmatched (${summary.unmatchedCustomer})`],
                    ["already_exists", `Already Exists (${summary.alreadyExists})`],
                    ["duplicate_in_file", `Dup in File (${summary.duplicateInFile})`],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={statusFilter === key ? "default" : "outline"}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Registration</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Make</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Fuel</th>
                      <th className="px-3 py-2 font-medium">Segment</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                          No rows in this filter
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => (
                        <tr key={`${row.rowNumber}-${row.regKey}`} className="border-t">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {row.registrationNumber || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.resolvedCustomerName ||
                              row.customerName ||
                              row.customerPhone ||
                              row.customerId ||
                              "—"}
                          </td>
                          <td className="px-3 py-2">{row.make || "—"}</td>
                          <td className="px-3 py-2">{row.model || "—"}</td>
                          <td className="px-3 py-2">
                            {row.resolvedFuelType || row.fuelType || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.resolvedSegment || row.segment || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={STATUS_VARIANT[row.status]}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.message}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={reset} disabled={importing}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void confirmImport()}
                disabled={importing || summary.ready === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${summary.ready} vehicle${summary.ready === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
