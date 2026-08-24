import type { JobWizardStepId } from "../types";

export function wizardTrackerMilestone(stepId: JobWizardStepId, forJobCard: boolean): number {
  if (stepId === "customer") return 0;
  if (stepId === "vehicle" || stepId === "schedule" || stepId === "smartSuggestions" || stepId === "membership") {
    return 1;
  }
  if (stepId === "serviceSelection" || stepId === "highEndServices" || stepId === "addons") return 2;
  if (forJobCard && stepId === "partsSelection") return 3;
  if (
    stepId === "pickupDrop" ||
    stepId === "mechanic" ||
    stepId === "notes" ||
    stepId === "notesAndJobDetails" ||
    stepId === "jobDetails"
  ) {
    return forJobCard ? 4 : 3;
  }
  if (stepId === "jobSummary") return forJobCard ? 5 : 4;
  return 0;
}

export function wizardTrackerLabels(forJobCard: boolean): string[] {
  return forJobCard
    ? ["Customer", "Vehicle", "Services", "Parts", "Details", "Review"]
    : ["Customer", "Vehicle", "Services", "Details", "Review"];
}
