export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NOT_ATTENDED";

/** Pre-service reservation channel — booking (BK-*) vs appointment (AP-*). */
export type AppointmentKind = "BOOKING" | "APPOINTMENT";

export interface Appointment {
  id: string;
  /** Booking reference for customer bookings (BK-2026-00125). */
  bookingId: string;
  /** Appointment reference when kind is APPOINTMENT (AP-2026-00045). */
  appointmentNumber?: string;
  kind?: AppointmentKind;
  branchId?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  /** Odometer at appointment create time (km), optional. */
  odometerReading?: number;
  serviceType: string;
  mechanicId?: string;
  mechanicName?: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  /** Set when staff creates a job card from this confirmed booking */
  jobCardId?: string;
  notes?: string;
  whatsappSent: boolean;
  /** Day-of reminder sent (booking / appointment date). */
  reminderSent?: boolean;
  reminderSentAt?: string;
  createdAt: string;
  /** First name for "Hi *Name*" in confirmation WhatsApp */
  customerFirstName?: string;
  vehicleColor?: string;
  /** Alternate WhatsApp; defaults to customerPhone */
  whatsappPhone?: string;
  customerAddress?: string;
  /** e.g. list − discount = net (−additional disc) *One Time Only* */
  bookingPricingLine?: string;
  /** GST-exclusive subtotal for PRICE DETAILS */
  priceSubtotalExGst?: number;
  priceGstAmount?: number;
  priceGrandTotal?: number;
  advancePaid?: number;
  /** Shown under advance (e.g. 30% advance policy) */
  advancePolicyNote?: string;
  /** yyyy-MM-dd */
  expectedDeliveryDate?: string;
  /** e.g. Saturday evening delivery note */
  deliveryExpectationNote?: string;
}
