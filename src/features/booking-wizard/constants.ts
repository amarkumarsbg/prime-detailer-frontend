import type { VehicleSegment } from "@/types";
import { DEFAULT_GST_RATE } from "@/lib/gst-tax";
import type { JobWizardStepId } from "./types";

/** @deprecated Prefer `effectiveGstRate` / `DEFAULT_GST_RATE` from `@/lib/gst-tax`. */
export const GST_RATE = DEFAULT_GST_RATE;

export const QUICK_INTERNAL_NOTES = [
  "Scratch on bumper",
  "Customer waiting",
  "Urgent delivery",
  "Low fuel",
] as const;

/** Must match seeded `serviceCatalog` main rows (`srv-001` … `srv-005` in prisma/seed). */
export const TRENDING_IDS = ["srv-001", "srv-002", "srv-003", "srv-004", "srv-005"];

/** Quick-pick add-ons in the optional section (`srv-a01` … `srv-a05` in seed). */
export const ADDON_IDS_PREFERRED = ["srv-a01", "srv-a02", "srv-a03", "srv-a04", "srv-a05"];

export const SERVICE_TYPE_PRIMARY: {
  segment: VehicleSegment;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { segment: "HATCHBACK", label: "Hatchback", hint: "Small cars", icon: "🚗" },
  { segment: "SEDAN", label: "Sedan", hint: "Mid-size", icon: "🚙" },
  { segment: "SUV", label: "SUV", hint: "Large", icon: "🚐" },
  { segment: "BIKE", label: "Bike", hint: "Two-wheeler", icon: "🏍️" },
];

export const OTHER_PRICING_SEGMENTS: { segment: VehicleSegment; label: string; hint: string }[] = [
  { segment: "COMPACT_SUV", label: "Compact SUV", hint: "Crossover" },
  { segment: "LUXURY", label: "Luxury", hint: "Premium" },
  { segment: "MUV", label: "MUV", hint: "People carrier" },
];

/** Pin native date/time picker icons to the trailing edge on mobile WebKit/Chromium. */
export const MOBILE_DATE_TIME_INPUT_ICON_END =
  "relative pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100";

export const JOB_WIZARD_LABEL: Record<JobWizardStepId, string> = {
  customer: "Customer",
  vehicle: "Vehicle details",
  schedule: "Schedule",
  smartSuggestions: "Smart suggestions",
  membership: "Membership",
  serviceSelection: "Service selection",
  partsSelection: "Parts selection",
  highEndServices: "High-end services",
  addons: "Add-ons",
  pickupDrop: "Pickup & drop",
  mechanic: "Mechanic",
  notes: "Notes",
  notesAndJobDetails: "Notes & job details",
  jobDetails: "Job details",
  jobSummary: "Review & create",
};
