import type { JobCard } from "@/types";

export function mechanicAvailabilityLabel(
  mechanicId: string,
  staffActive: boolean | undefined,
  jobCards: JobCard[]
): { label: string; className: string } {
  if (staffActive === false) {
    return { label: "On Leave", className: "bg-muted text-muted-foreground" };
  }
  const busy = jobCards.some(
    (j) =>
      j.mechanicId === mechanicId &&
      ["AWAITING_SERVICE", "INSPECTION", "QUALITY_CHECK", "RECEIVED"].includes(j.status)
  );
  if (busy) {
    return { label: "Busy", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  }
  return { label: "Available", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" };
}
