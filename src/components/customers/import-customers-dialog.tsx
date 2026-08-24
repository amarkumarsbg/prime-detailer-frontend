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
import { normalizeImportPhone } from "@/lib/customer-import/normalize";
import { parseCustomerImportFile } from "@/lib/customer-import/parse-tabular";
import { downloadCustomerImportTemplate } from "@/lib/customer-import/template";
import {
  applyColumnMapping,
  summarizeImportRows,
  validateImportRows,
} from "@/lib/customer-import/validate-rows";
import type {
  CustomerImportParseResult,
  CustomerImportRowStatus,
  ValidatedCustomerImportRow,
} from "@/lib/customer-import/types";
import { cn } from "@/lib/utils";

type Step = "upload" | "preview";
type StatusFilter = "all" | CustomerImportRowStatus;

const STATUS_LABEL: Record<CustomerImportRowStatus, string> = {
  ready: "Ready",
  invalid: "Invalid",
  already_exists: "Already Exists",
  duplicate_in_file: "Duplicate in File",
};

const STATUS_VARIANT: Record<
  CustomerImportRowStatus,
  "success" | "destructive" | "warning" | "secondary"
> = {
  ready: "success",
  invalid: "destructive",
  already_exists: "warning",
  duplicate_in_file: "secondary",
};

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCustomersDialog({ open, onOpenChange }: ImportCustomersDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const importCustomers = useCustomerStore((s) => s.importCustomers);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<CustomerImportParseResult | null>(null);
  const [validated, setValidated] = useState<ValidatedCustomerImportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const existingPhoneKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      const key = normalizeImportPhone(c.phone);
      if (key.length === 10) set.add(key);
    }
    return set;
  }, [customers]);

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
      const result = await parseCustomerImportFile(file);
      const hasName = result.mapping.some((m) => m.mappedTo === "name");
      const hasPhone = result.mapping.some((m) => m.mappedTo === "phone");
      if (!hasName || !hasPhone) {
        toast.error("Could not find Name and Phone columns", {
          description:
            'Use headers like "Name" / "Customer Name" and "Phone" / "Mobile" / "Phone Number".',
        });
        return;
      }
      const parsed = applyColumnMapping(result.headers, result.rows, result.mapping);
      if (parsed.length === 0) {
        toast.error("No customer rows found in this file");
        return;
      }
      setParseResult(result);
      setValidated(validateImportRows(parsed, existingPhoneKeys));
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
      const result = await importCustomers(
        ready.map((r) => ({
          name: r.name,
          phone: r.phone,
          email: r.email,
          address: r.address,
        }))
      );
      toast.success(
        `Imported ${result.createdCount} customer${result.createdCount === 1 ? "" : "s"}`,
        result.skippedCount > 0
          ? { description: `${result.skippedCount} row(s) skipped by the server.` }
          : undefined
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error("Could not import customers", {
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
        className={cn(
          dialogMobileSheetContentClasses,
          "max-h-[92vh] sm:max-w-3xl"
        )}
      >
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Import Customers</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload CSV, Excel (.xlsx), or PDF. Only Name and Phone are required.
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
                  accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCustomerImportTemplate}
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
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          No rows in this filter
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => (
                        <tr key={`${row.rowNumber}-${row.phoneKey}`} className="border-t">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 font-medium">{row.name || "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.phone || "—"}</td>
                          <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">
                            {row.email?.endsWith("@customers.placeholder")
                              ? "—"
                              : row.email || "—"}
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
                  `Import ${summary.ready} customer${summary.ready === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
