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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { useJobCardStore } from "@/store/job-card-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useHighEndServiceStore, highEndPriceForSegment } from "@/store/high-end-service-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { jobCardIsEditable, canEditJobCardPricing } from "@/lib/job-card-edit-policy";
import { jobCardPartsSubtotal } from "@/components/job-cards/job-card-parts-picker";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency } from "@/lib/utils";
import { AddServicePackageDialog } from "@/components/services/add-service-package-dialog";
import {
  ServiceSearchInput,
  filterCatalogServices,
} from "@/components/services/searchable-service-select";
import { ServiceCustomPriceControl } from "@/components/services/service-custom-price-control";
import { withCatalogPrice, withCustomPrice } from "@/lib/service-line-price";
import { useAuthStore } from "@/store/auth-store";
import type { JobCard, ServiceCatalogItem, ServiceItem, VehicleSegment } from "@/types";

function catalogPrice(item: ServiceCatalogItem, segment: VehicleSegment): number {
  const key = segment as keyof ServiceCatalogItem["segmentPricing"];
  return item.segmentPricing[key] ?? item.defaultPrice;
}

type EditJobCardDetailsDialogProps = {
  jobCard: JobCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (next: JobCard) => void;
};

export function EditJobCardDetailsDialog({
  jobCard,
  open,
  onOpenChange,
  onSaved,
}: EditJobCardDetailsDialogProps) {
  const updateJobCard = useJobCardStore((s) => s.updateJobCard);
  const catalog = useServiceCatalogStore((s) => s.catalog);
  const highEndServices = useHighEndServiceStore((s) => s.services);
  const invoices = useInvoiceStore((s) => s.invoices);
  const user = useAuthStore((s) => s.user);
  const hasInvoice = Boolean(
    jobCard && invoices.some((inv) => inv.jobCardId === jobCard.id)
  );
  const pricingEditable = jobCard
    ? canEditJobCardPricing(user, jobCard, hasInvoice)
    : false;

  const [reportedIssues, setReportedIssues] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [customPriceByServiceId, setCustomPriceByServiceId] = useState<Record<string, number>>({});
  const [serviceSearch, setServiceSearch] = useState("");
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [odometerReading, setOdometerReading] = useState("");

  useEffect(() => {
    if (!jobCard || !open) return;
    setReportedIssues(jobCard.reportedIssues ?? "");
    setExpectedDelivery(jobCard.expectedDelivery?.slice(0, 10) ?? "");
    setOdometerReading(jobCard.odometerReading ? String(jobCard.odometerReading) : "");
    setNotes(jobCard.notes ?? "");
    setTerms(jobCard.termsAndConditions ?? "");
    setSelectedServiceIds(new Set(jobCard.services.map((s) => s.serviceCatalogId)));
    const customs: Record<string, number> = {};
    for (const s of jobCard.services) {
      if (s.priceSource === "MEMBERSHIP") continue;
      if (s.isCustomPrice || s.priceSource === "CUSTOM") {
        customs[s.serviceCatalogId] = s.price;
      }
    }
    setCustomPriceByServiceId(customs);
    setServiceSearch("");
  }, [jobCard, open]);

  const filteredCatalog = useMemo(
    () => filterCatalogServices(catalog, serviceSearch),
    [catalog, serviceSearch]
  );

  const servicesPreview = useMemo(() => {
    if (!jobCard) return [] as ServiceItem[];
    const prevByCatalog = new Map(jobCard.services.map((s) => [s.serviceCatalogId, s]));
    return Array.from(selectedServiceIds).flatMap((sid) => {
      const cat = catalog.find((c) => c.id === sid);
      if (!cat) return [];
      const prev = prevByCatalog.get(sid);
      const listPrice = catalogPrice(cat, jobCard.vehicleSegment);
      const catalogPriceSnap = prev?.catalogPrice ?? listPrice;

      if (prev?.priceSource === "MEMBERSHIP") {
        return [
          {
            id: prev.id,
            jobCardId: jobCard.id,
            serviceCatalogId: sid,
            name: cat.name,
            ...withCatalogPrice(catalogPriceSnap, { membership: true }),
            isCompleted: prev.isCompleted,
            durationMinutes: cat.durationMinutes,
            completedAt: prev.completedAt,
            completedBy: prev.completedBy,
          } satisfies ServiceItem,
        ];
      }

      const custom = customPriceByServiceId[sid];
      let effective;
      if (custom != null) {
        effective = withCustomPrice(catalogPriceSnap, custom);
      } else if (prev) {
        effective = {
          price: prev.price,
          catalogPrice: catalogPriceSnap,
          isCustomPrice: Boolean(prev.isCustomPrice),
          priceSource: (prev.priceSource ??
            (prev.isCustomPrice ? "CUSTOM" : "CATALOG")) as ServiceItem["priceSource"],
        };
      } else {
        effective = withCatalogPrice(listPrice);
      }

      return [
        {
          id: prev?.id ?? `si-${jobCard.id}-${sid}`,
          jobCardId: jobCard.id,
          serviceCatalogId: sid,
          name: cat.name,
          ...effective,
          isCompleted: prev?.isCompleted ?? false,
          durationMinutes: cat.durationMinutes,
          completedAt: prev?.completedAt,
          completedBy: prev?.completedBy,
        } satisfies ServiceItem,
      ];
    });
  }, [jobCard, selectedServiceIds, catalog, customPriceByServiceId]);

  const estimatePreview = useMemo(() => {
    if (!jobCard) return 0;
    const servicesTotal = servicesPreview.reduce((s, x) => s + x.price, 0);
    const partsTotal = jobCardPartsSubtotal(jobCard.parts ?? []);
    let hesTotal = 0;
    for (const hesId of jobCard.highEndServiceIds ?? []) {
      const cfg = highEndServices.find((h) => h.id === hesId);
      hesTotal += cfg ? highEndPriceForSegment(cfg, jobCard.vehicleSegment) : 0;
    }
    return Math.round((servicesTotal + partsTotal + hesTotal) * 100) / 100;
  }, [jobCard, servicesPreview, highEndServices]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setCustomPriceByServiceId((prices) => {
          if (!(id in prices)) return prices;
          const { [id]: _, ...rest } = prices;
          return rest;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!jobCard) return;
    if (!jobCardIsEditable(jobCard)) {
      toast.error("This job card can no longer be edited");
      onOpenChange(false);
      return;
    }
    if (selectedServiceIds.size === 0 && (jobCard.parts?.length ?? 0) === 0) {
      toast.error("Select at least one service (or keep parts on the job)");
      return;
    }

    const servicesTotal = servicesPreview.reduce((s, x) => s + x.price, 0);
    const partsTotal = jobCardPartsSubtotal(jobCard.parts ?? []);
    let hesTotal = 0;
    for (const hesId of jobCard.highEndServiceIds ?? []) {
      const cfg = highEndServices.find((h) => h.id === hesId);
      hesTotal += cfg ? highEndPriceForSegment(cfg, jobCard.vehicleSegment) : 0;
    }
    const estimatedAmount = Math.round((servicesTotal + partsTotal + hesTotal) * 100) / 100;
    const incentiveAmount =
      Math.round(((estimatedAmount * (jobCard.incentivePercent ?? 0)) / 100) * 100) / 100;

    const nowIso = new Date().toISOString();
    const patch: Partial<JobCard> = {
      reportedIssues: reportedIssues.trim() || undefined,
      expectedDelivery: expectedDelivery.trim()
        ? new Date(`${expectedDelivery.trim()}T12:00:00`).toISOString()
        : jobCard.expectedDelivery,
      odometerReading: odometerReading.trim() ? parseInt(odometerReading.trim(), 10) : undefined,
      notes: notes.trim() || undefined,
      termsAndConditions: terms.trim() || undefined,
      services: servicesPreview,
      estimatedAmount,
      incentiveAmount,
      updatedAt: nowIso,
    };

    setSaving(true);
    try {
      await updateJobCard(jobCard.id, patch);
      const next = { ...jobCard, ...patch };
      pushActivityLog({
        action: "UPDATED",
        entityType: "JOB_CARD",
        entityId: jobCard.id,
        entityLabel: jobCard.jobNumber,
        details: `${jobCard.jobNumber} details updated`,
      });
      toast.success("Job card updated");
      onSaved?.(next);
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not save job card", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {jobCard?.jobNumber ?? "job card"}
          </DialogTitle>
          <DialogDescription>
            Update issues, schedule, notes, and services. Locked after delivery or cancel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jc-issues">Reported issues</Label>
            <Textarea
              id="jc-issues"
              rows={2}
              value={reportedIssues}
              onChange={(e) => setReportedIssues(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-delivery">Expected delivery</Label>
            <Input
              id="jc-delivery"
              type="date"
              className="date-input-icon-end pr-9"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-odometer">Odometer (km)</Label>
            <Input
              id="jc-odometer"
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              placeholder="e.g. 25000"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Services</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setAddServiceOpen(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add services
              </Button>
            </div>
            <ServiceSearchInput
              value={serviceSearch}
              onChange={setServiceSearch}
            />
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {filteredCatalog.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No services match.</p>
              ) : (
                filteredCatalog.map((svc) => {
                  const listPrice = jobCard
                    ? catalogPrice(svc, jobCard.vehicleSegment)
                    : svc.defaultPrice;
                  const selected = selectedServiceIds.has(svc.id);
                  const preview = servicesPreview.find((s) => s.serviceCatalogId === svc.id);
                  const isMembership = preview?.priceSource === "MEMBERSHIP";
                  const custom = customPriceByServiceId[svc.id];
                  const displayPrice = preview?.price ?? listPrice;
                  const catalogSnap = preview?.catalogPrice ?? listPrice;
                  return (
                    <div
                      key={svc.id}
                      className="rounded-md px-2 py-1.5 hover:bg-muted/50 space-y-1"
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleService(svc.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1 text-sm leading-snug">{svc.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(displayPrice)}
                        </span>
                      </label>
                      {selected && !isMembership && (
                        <div className="pl-6">
                          <ServiceCustomPriceControl
                            dense
                            disabled={!pricingEditable}
                            catalogPrice={catalogSnap}
                            customPrice={
                              custom ??
                              (preview?.isCustomPrice ? preview.price : null)
                            }
                            onChange={(next) => {
                              setCustomPriceByServiceId((prev) => {
                                if (next == null) {
                                  const { [svc.id]: _, ...rest } = prev;
                                  return rest;
                                }
                                return { ...prev, [svc.id]: next };
                              });
                            }}
                          />
                        </div>
                      )}
                      {selected && isMembership && (
                        <p className="pl-6 text-[11px] text-muted-foreground">
                          Membership benefit — billed at ₹0
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <AddServicePackageDialog
              open={addServiceOpen}
              onOpenChange={setAddServiceOpen}
              onCreated={(item) => {
                setSelectedServiceIds((prev) => new Set(prev).add(item.id));
                setServiceSearch("");
              }}
            />
            <p className="text-xs text-muted-foreground">
              New estimate:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(estimatePreview)}
              </span>{" "}
              (services + parts + high-end)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-notes">Notes</Label>
            <Textarea
              id="jc-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jc-terms">Terms &amp; conditions</Label>
            <Textarea
              id="jc-terms"
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
