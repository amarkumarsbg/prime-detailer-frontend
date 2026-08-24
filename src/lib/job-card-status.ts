import type { JobCardStatus } from "@/types";

const WORKFLOW_STATUSES: JobCardStatus[] = [
  "RECEIVED",
  "INSPECTION",
  "AWAITING_SERVICE",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

/** Map legacy / demo seed values to the current workflow enum. */
const LEGACY_STATUS_MAP: Record<string, JobCardStatus> = {
  COMPLETED: "DELIVERED",
  IN_PROGRESS: "AWAITING_SERVICE",
};

export function normalizeJobCardStatus(raw: string | undefined): JobCardStatus {
  if (!raw) return "RECEIVED";
  const upper = String(raw).toUpperCase();
  if (WORKFLOW_STATUSES.includes(upper as JobCardStatus)) return upper as JobCardStatus;
  if (LEGACY_STATUS_MAP[upper]) return LEGACY_STATUS_MAP[upper];
  return "RECEIVED";
}
