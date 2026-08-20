export type WhatsAppEventType =
  | "BOOKING_CONFIRMED"
  | "ESTIMATE_SENT"
  | "SERVICE_STARTED"
  | "SERVICE_COMPLETED"
  | "PAYMENT_RECEIVED"
  | "REMINDER_DUE";

export interface CustomerMessage {
  id: string;
  type: "whatsapp" | "email" | "sms";
  recipient: string;
  subject?: string | null;
  body: string;
  status: "sent" | "failed";
  error?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  createdAt: string;
}


export type ReminderStatus = "UPCOMING" | "DUE" | "OVERDUE" | "COMPLETED" | "DISMISSED";
export type ReminderType = "GENERAL_SERVICE" | "OIL_CHANGE" | "BRAKE_INSPECTION" | "TIRE_ROTATION" | "AC_SERVICE" | "BATTERY_CHECK" | "INSURANCE" | "PUC" | "PPF_MAINTENANCE" | "CERAMIC_MAINTENANCE";
export type ReminderFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "YEARLY" | "CUSTOM";

export interface ServiceReminder {
  id: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  type: ReminderType;
  frequency: ReminderFrequency;
  dueDate: string;
  lastServiceDate?: string;
  lastJobCardId?: string;
  odometerAtLastService?: number;
  nextDueOdometer?: number;
  status: ReminderStatus;
  isHighEndService: boolean;
  totalDurationMonths?: number;
  intervalMonths?: number;
  notes?: string;
  /** @deprecated use lastMessageSentAt; kept for persisted mock data */
  whatsappSent?: boolean;
  /** ISO timestamp when a customer reminder message was last sent (e.g. WhatsApp). */
  lastMessageSentAt?: string;
}


export interface WhatsAppLog {
  id: string;
  eventType: WhatsAppEventType;
  customerPhone: string;
  customerName: string;
  message: string;
  sentAt: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  relatedEntityId?: string;
  relatedEntityType?: string;
}

export type PickupDropStatus =
  | "PENDING"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "IN_SERVICE"
  | "DELIVERED";

export type PickupDropType = "PICKUP" | "DROP";

export interface PickupDropRequest {
  id: string;
  jobCardId: string;
  jobNumber: string;
  type: PickupDropType;
  customerName: string;
  /** Copied from job when known; used in customer WhatsApp. */
  vehicleMakeModel?: string;
  vehicleRegNumber?: string;
  /** Odometer at pickup/drop create time (km), optional. */
  odometerReading?: number;
  /** For WhatsApp; optional for legacy persisted rows (phone may appear in notes). */
  customerPhone?: string;
  address: string;
  scheduledTime: string;
  driverId?: string;
  driverName?: string;
  status: PickupDropStatus;
  notes?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}
