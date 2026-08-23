import type { PaymentMethod } from "./billing";
import type { WhatsAppLog } from "./ops";
import type { VehicleSegment } from "./vehicle";

export type JobCardStatus =
  | "RECEIVED"
  | "INSPECTION"
  | "AWAITING_SERVICE"
  | "QUALITY_CHECK"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type InspectionPhotoType = "BEFORE" | "AFTER" | "before" | "after";

export interface TimerAdjustment {
  adjustedBy: string;
  adjustedAt: string;
  deltaMinutes: number;
  reason?: string;
}

/** Frozen metrics when the job is marked delivered (service timer). */
export interface ServiceTimerDeliverySnapshot {
  closedAt: string;
  allocatedMinutes: number;
  activeElapsedMs: number;
  overdueMs: number;
  totalPauseMs: number;
  bufferTotalMinutes: number;
  bufferRemainingMinutes: number;
}

export interface ServiceItem {
  id: string;
  jobCardId: string;
  serviceCatalogId: string;
  name: string;
  /** Effective billable amount (ex-GST) for this job line. */
  price: number;
  /** Catalog/list price at selection time (for display + reset). */
  catalogPrice?: number;
  /** True when the user overrode the catalog price for this document only. */
  isCustomPrice?: boolean;
  /** How `price` was derived; membership lines stay 0 without looking like a custom ₹0. */
  priceSource?: "CATALOG" | "CUSTOM" | "MEMBERSHIP";
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  /** Copied from catalog at job creation for service timer allocation */
  durationMinutes?: number;
}

/** Parts / materials added manually on a job card (inventory deducted at Ready). */
export interface JobCardPartItem {
  id: string;
  jobCardId: string;
  partId: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Line total excl. GST */
  lineTotal: number;
}

export interface InspectionPhoto {
  id: string;
  type: InspectionPhotoType;
  url: string;
  caption?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface MechanicSwitchLog {
  fromMechanicId: string;
  fromMechanicName: string;
  toMechanicId: string;
  toMechanicName: string;
  reason: string;
  switchedAt: string;
  switchedBy: string;
}

export interface JobCard {
  id: string;
  jobNumber: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  vehicleSegment: VehicleSegment;
  mechanicId?: string;
  mechanicName?: string;
  status: JobCardStatus;
  reportedIssues: string;
  odometerReading?: number;
  expectedDelivery: string;
  actualDelivery?: string;
  services: ServiceItem[];
  /** Optional parts selected at job creation (in addition to service consumption profiles). */
  parts?: JobCardPartItem[];
  estimatedAmount: number;
  incentivePercent: number;
  incentiveAmount: number;
  termsAndConditions?: string;
  notes?: string;
  inspectionPhotos?: InspectionPhoto[];
  /** Set when QC checklist is marked complete on the job card (unlocks After photos). */
  qualityCheckCompleted?: boolean;
  mechanicSwitchLog?: MechanicSwitchLog[];
  quotationId?: string;
  /** When the job was created from a calendar appointment */
  appointmentId?: string;
  /** Human booking ref (e.g. BK-2026-0001) — copy of Appointment.bookingId */
  appointmentBookingRef?: string;
  highEndServiceIds?: string[];
  /** Tasks tab: checklist completion per high-end program id (catalog lines use `services[].isCompleted`). */
  highEndServiceCompletedById?: Record<string, boolean>;
  /** For each high-end service id, months until the first maintenance reminder (preset from reminderIntervals or a custom value). */
  highEndFirstFollowUpMonthsByServiceId?: Record<string, number>;
  /** Planned time to complete (minutes) per high-end program on this job. */
  highEndCompletionMinutesByServiceId?: Record<string, number>;
  /** Optional override (0–100): suggested advance as % of estimate on job card; falls back to Settings when unset. */
  highEndAdvanceHintPercent?: number;
  /** When true, staff chose not to offer optional advance on this job (set at job creation). */
  waiveHighEndAdvance?: boolean;
  /** Optional partial advance when high-end programs are on the job (staff-entered). */
  highEndAdvanceAmountInr?: number;
  highEndAdvanceCollectedAt?: string;
  highEndAdvanceMethod?: PaymentMethod;
  highEndAdvanceReference?: string;
  whatsappLog?: WhatsAppLog[];
  /** Set when materials were deducted from stock at Ready (billing no longer deducts). */
  inventoryConsumedAt?: string;
  /** ISO — service timer starts first time job enters In Service with a mechanic */
  serviceTimerStartedAt?: string;
  /** Main allocated minutes (sum of service durations + optional future main adjustments) */
  serviceAllocatedMinutes?: number;
  bufferTotalMinutes?: number;
  bufferRemainingMinutes?: number;
  timerIsPaused?: boolean;
  /** Start of current pause segment (when timerIsPaused) */
  timerPausedAt?: string;
  /** Completed pause segments only (ms); current pause computed live */
  totalPausedMs?: number;
  bufferAdjustments?: TimerAdjustment[];
  /** Set when status becomes DELIVERED; read-only summary for the service timer */
  serviceTimerDeliverySnapshot?: ServiceTimerDeliverySnapshot;
  /** Optional notes captured in the Deliver Vehicle checklist dialog */
  deliveryNotes?: string;
  /** Checklist completion when marking delivered */
  deliveryChecklist?: {
    customerSatisfaction: boolean;
    keysDelivered: boolean;
    finalWalkthrough: boolean;
  };
  payments?: {
    id: string;
    amount: number;
    method: "Cash" | "UPI" | "Card" | "Bank Transfer";
    date: string;
    notes?: string;
  }[];
  paidAmount?: number;
  secureToken?: string;
  /** ISO timestamp set when Vehicle Check-In completes with ≥1 before photo. Used as
   * the authoritative signal that before photos exist, bypassing store/server lookup races. */
  checkInCompletedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
