/** Org-level super user: full access including branch CRUD. */
export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "MANAGER"
  | "SUPERVISOR"
  | "RECEPTIONIST"
  | "MECHANIC";

export type VehicleSegment =
  | "HATCHBACK"
  | "SEDAN"
  | "SUV"
  | "LUXURY"
  | "MUV"
  | "COMPACT_SUV"
  | "BIKE";

export type JobCardStatus =
  | "RECEIVED"
  | "INSPECTION"
  | "AWAITING_SERVICE"
  | "QUALITY_CHECK"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID";

export type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "WALLET";

export type FuelType = "PETROL" | "DIESEL" | "CNG" | "ELECTRIC" | "HYBRID";

export type InspectionPhotoType = "BEFORE" | "AFTER";

export type ExpenseCategory = "RENT" | "SALARY" | "UTILITIES" | "SUPPLIES" | "MAINTENANCE" | "MARKETING" | "INSURANCE" | "MISCELLANEOUS";

/** Recorded payment state for an expense row. */
export type ExpensePaymentStatus = "PAID" | "PENDING" | "PARTIAL" | "OVERDUE";

export type ExpensePaymentMethod =
  | "CASH"
  | "CARD"
  | "UPI"
  | "BANK_TRANSFER"
  | "OTHER";

export type WhatsAppEventType =
  | "BOOKING_CONFIRMED"
  | "ESTIMATE_SENT"
  | "SERVICE_STARTED"
  | "SERVICE_COMPLETED"
  | "PAYMENT_RECEIVED"
  | "REMINDER_DUE";

export interface Branch {
  id: string;
  name: string;
  /** Street / building line */
  address: string;
  phone: string;
  isActive: boolean;
  qrCodeId?: string;
  /** Short reference label (invoices, badges) */
  code?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  avatar?: string;
  isActive: boolean;
  /** Demo flag for directory / “verified email” stats */
  emailVerified?: boolean;
  /** Demo-only attendance PIN; production should store hashes and verify via API */
  attendancePin?: string;
  totalJobsCompleted?: number;
  totalIncentiveEarned?: number;
  /** ISO date yyyy-mm-dd (demo / HR fields) */
  birthday?: string;
  /** Employment start or work anniversary, ISO yyyy-mm-dd */
  anniversary?: string;
  /** Server sets true until the user completes an authenticated password change (onboarding). */
  mustChangePassword?: boolean;
  /** ISO timestamp when login password was last changed (server audit). */
  passwordUpdatedAt?: string;
  /** Staff user id who provisioned this account password (server audit). */
  passwordCreatedBy?: string;
  permissions?: string[];
}

export type PayrollRecordStatus = "PENDING" | "PROCESSING" | "PAID";

/** Experience band for salary structure tiers (role + band = pay rules). */
export type ExperienceBand = "ENTRY" | "MID" | "SENIOR" | "LEAD";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  periodMonth: number;
  periodYear: number;
  attendanceDays: number;
  presencePayment: number;
  baseSalary: number;
  absenceDeduction: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: PayrollRecordStatus;
  salaryStructureId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructure {
  id: string;
  role: UserRole;
  experienceBand: ExperienceBand;
  label: string;
  baseSalary: number;
  attendanceBonusPerDay: number;
  absenceDeductionPerDay: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  referralCode: string;
  referredBy?: string;
  totalVisits: number;
  rewardPoints: number;
  walletBalance: number;
  lastVisitDate?: string;
  isInactive?: boolean;
  /** Demo: counts toward “verified email” on users overview */
  emailVerified?: boolean;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  customerName: string;
  registrationNumber: string;
  make: string;
  model: string;
  segment: VehicleSegment;
  variant?: string;
  fuelType: FuelType;
  color: string;
  year: number;
  notes?: string;
  /** Outgoing owners in chronological order (matches ownership_transfers from_customer chain). */
  previousOwners?: {
    customerId: string;
    customerName: string;
    transferDate: string;
    reason?: string;
  }[];
}

export interface SegmentPricing {
  HATCHBACK: number;
  SEDAN: number;
  SUV: number;
  LUXURY: number;
  MUV: number;
  COMPACT_SUV: number;
  BIKE: number;
}

export interface ServiceConsumption {
  partId: string;
  partName: string;
  quantityPerCar: number;
  unit: string;
  /** When false, omitted from automatic inventory deduction for a job (optional add-on part). Default true when omitted. */
  requiredPart?: boolean;
  /** Per vehicle segment overrides; falls back to quantityPerCar when not set. */
  segmentQuantities?: Partial<Record<VehicleSegment, number>>;
}

/** Service category row (Service Management → Categories tab). */
export interface ServiceCategoryRecord {
  id: string;
  name: string;
  slug: string;
  order: number;
  bikeOnly: boolean;
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  segmentPricing: SegmentPricing;
  category: string;
  /** When true, listed in booking “Select Add-ons” and omitted from the main service grid */
  isAddon?: boolean;
  /** Add-on / package visibility: all branches vs current branch only */
  scope?: "GLOBAL" | "BRANCH";
  isActive: boolean;
  isHighEnd: boolean;
  incentivePercent: number;
  reminderInterval?: string;
  reminderDurationMonths?: number;
  consumptionProfile?: ServiceConsumption[];
  /** Estimated service duration (minutes) */
  durationMinutes?: number;
  /** Upper bound for duration range (e.g. 40–50 min) */
  maxDurationMinutes?: number;
  gstApplicable?: boolean;
  gstPercent?: number;
}

export type MembershipTier = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export type CustomerMembershipStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface MembershipPackage {
  id: string;
  name: string;
  tier: MembershipTier;
  /** Demo list price (no payment processing). */
  price: number;
  includedServiceIds: string[];
  isActive: boolean;
  createdAt: string;
}

/** One redemption of an included membership service (demo; persisted on the subscription). */
export interface MembershipServiceUsage {
  usedAt: string;
  serviceCatalogId: string;
  serviceName?: string;
  jobCardId?: string;
}

export interface CustomerMembership {
  id: string;
  customerId: string;
  packageId: string;
  startDate: string;
  endDate: string;
  status: CustomerMembershipStatus;
  notes?: string;
  /** When set, this pass applies to that vehicle; omit for legacy customer-wide rows. */
  vehicleId?: string;
  /** Redemptions of included services during this subscription window. */
  usageHistory?: MembershipServiceUsage[];
}

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
  price: number;
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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  vehicleSegment: VehicleSegment;
  services: { serviceCatalogId: string; name: string; price: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  status: QuotationStatus;
  sentViaWhatsApp: boolean;
  customerApproved?: boolean;
  convertedToJobCardId?: string;
  convertedToInvoiceId?: string;
  termsAndConditions?: string;
  notes?: string;
  validUntil: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  type: "SERVICE" | "PARTS" | "LABOR" | "OTHER";
  quantity: number;
  unitPrice: number;
  total: number;
  /** SAC/HSN for GST line (e.g. 998714). Defaults in UI when omitted. */
  hsnSac?: string;
  /** Line-level discount in ₹ (before tax). */
  lineDiscount?: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  paidAt: string;
}

/** Print-quality PDF cached on the invoice row (AppJsonRow) for fast email attachment. */
export interface InvoiceStoredPdf {
  filename: string;
  contentBase64: string;
  /** Matches invoice totals/line items; regenerated when invoice changes. */
  cacheKey: string;
  generatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobCardId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegNumber: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  rewardDiscount: number;
  walletAmountUsed: number;
  grandTotal: number;
  status: InvoiceStatus;
  payments: Payment[];
  termsAndConditions?: string;
  mechanicName?: string;
  notes?: string;
  createdAt: string;
  /** When set, inventory was already deducted for this invoice (idempotency). */
  inventoryDeductedAt?: string;
  /** Saved tax-invoice PDF (base64) — avoids regenerating Chrome PDF on every email. */
  storedPdf?: InvoiceStoredPdf;
  referralDiscount?: number;
  referralAdvocateId?: string;
  referralCodeUsed?: string;
}

export interface DashboardStats {
  /** Demo aggregate customer satisfaction (0–5). */
  averageRating: number;
  carsReceivedToday: number;
  carsDeliveredToday: number;
  inProgressServices: number;
  dailyRevenue: number;
  totalExpensesToday: number;
  netProfitToday: number;
  newCustomersToday: number;
  inactiveCustomers: number;
  activeJobCards: number;
  pendingPayments: number;
  monthlyRevenue: { month: string; revenue: number; expenses: number; profit: number }[];
  serviceBreakdown: { name: string; count: number }[];
  todaysBookings: JobCard[];
  readyForDelivery: JobCard[];
}

export type PartCategory =
  | "Engine"
  | "Brakes"
  | "Electrical"
  | "Filters"
  | "Suspension"
  | "AC"
  | "Body"
  | "Lubricants"
  | "Tires"
  | "Detailing"
  | "Other";

export interface Part {
  id: string;
  name: string;
  /** Manufacturer or product brand (optional). */
  brand?: string;
  sku: string;
  /** Optional barcode for search / scanning. */
  barcode?: string;
  category: PartCategory;
  /** Primary-unit stock count (e.g. BOX). Synced from stockQuantitySecondary for dual-unit parts. */
  quantity: number;
  primaryUnit: string;
  secondaryUnit: string;
  /** 1 primaryUnit = conversionFactor secondaryUnit (e.g. 1 BOX = 100 PCS). */
  conversionFactor: number;
  /** Sale price per primary unit (e.g. ₹500/BOX). */
  unitPrice: number;
  /** Sale price per secondary unit (e.g. ₹5/PCS). Derived from unitPrice ÷ conversionFactor when omitted. */
  unitPriceSecondary?: number;
  /** Canonical on-hand stock in secondary units (PCS, ML, GM). Authoritative for dual-unit parts. */
  stockQuantitySecondary?: number;
  /** Reorder threshold for count-based parts. */
  reorderLevel: number;
  supplier: string;
  vendor?: string;
  purchaseDate?: string;
  lastRestocked: string;
  /**
   * Fluid stock in millilitres (canonical). When set, internal calculations use ml;
   * primary display unit is litres (1 L = 1000 ml).
   */
  stockQuantityMl?: number;
  /** Reorder threshold in ml for fluid parts. */
  reorderLevelMl?: number;
}

export interface StockMovement {
  id: string;
  partId: string;
  type: "IN" | "OUT";
  quantity: number;
  unit: string;
  reason: string;
  jobCardId?: string;
  invoiceId?: string;
  purchaseId?: string;
  vendor?: string;
  performedBy: string;
  createdAt: string;
  /** Canonical stock before movement (secondary units / ml). */
  stockBeforeSecondary?: number;
  /** Canonical stock after movement (secondary units / ml). */
  stockAfterSecondary?: number;
  /** User-facing consumed/adjusted quantity in the movement unit. */
  displayQuantity?: number;
  displayUnit?: string;
}

export interface ProductPurchase {
  id: string;
  partId: string;
  vendorName: string;
  quantityMl: number;
  unitCost?: number;
  reference?: string;
  purchasedAt: string;
  recordedBy: string;
}

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

export type ActivityEntityType =
  | "JOB_CARD"
  | "CUSTOMER"
  | "VEHICLE"
  | "INVOICE"
  | "APPOINTMENT"
  | "INVENTORY"
  | "STAFF"
  | "QUOTATION"
  | "EXPENSE"
  | "WALLET";

export type ActivityAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "PAYMENT_RECEIVED"
  | "ASSIGNED"
  | "COMPLETED"
  | "CANCELLED"
  | "STOCK_ADJUSTED"
  | "WHATSAPP_SENT"
  | "EMAIL_SENT"
  | "MECHANIC_SWITCHED"
  | "OWNERSHIP_TRANSFERRED"
  | "WALLET_CREDITED"
  | "WALLET_DEBITED";

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  userId: string;
  userName: string;
  details: string;
  createdAt: string;
}

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

/** Optional vendor directory row for expense pickers (demo/local). */
export interface ExpenseVendorProfile {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  address?: string;
  gstNumber?: string;
  panNumber?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  /** Short label for tables (e.g. "Office supplies"). */
  title: string;
  /** Category key or custom label (matches expense category pickers). */
  category: string;
  /** Optional long-form notes. */
  description?: string;
  amount: number;
  /** When status is PARTIAL, amount already paid (must be less than amount). */
  amountPaid?: number;
  date: string;
  vendorName?: string;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  /** Stored receipt file name for display (demo; no upload backend). */
  receipt?: string;
  createdBy: string;
  createdByName: string;
  branchId: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  branchId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  durationMinutes?: number;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";
  qrScanned: boolean;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  source: "REFERRAL_REWARD" | "LOYALTY_POINTS" | "ADMIN_CREDIT" | "INVOICE_PAYMENT" | "REFUND";
  referenceId?: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastVisitDate: string;
  daysSinceLastVisit: number;
  assignedTo?: string;
  assignedToName?: string;
  status: "PENDING" | "CALLED" | "SCHEDULED" | "NOT_INTERESTED" | "REENGAGED";
  callNotes?: string;
  nextCallbackDate?: string;
  createdAt: string;
  updatedAt: string;
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
