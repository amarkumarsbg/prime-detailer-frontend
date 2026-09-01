import type { VehicleSegment } from "./vehicle";

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
  description?: string;
  tier: MembershipTier;
  /** Demo list price (no payment processing). */
  price: number;
  includedServiceIds: string[];
  /** Allowed usage count per included service id during the package period. */
  includedServiceQuantities?: Record<string, number>;
  /** Vehicle segments this package applies to. Empty/undefined = all segments. */
  applicableVehicleSegments?: VehicleSegment[];
  isActive: boolean;
  createdAt: string;
}

/** One redemption of an included membership service (demo; persisted on the subscription). */
export interface MembershipServiceUsage {
  usedAt: string;
  serviceCatalogId: string;
  /** Number of units consumed in this usage event (defaults to 1 for legacy rows). */
  quantity?: number;
  serviceName?: string;
  jobCardId?: string;
}

export interface CustomerMembership {
  id: string;
  customerId: string;
  packageId: string;
  /** Display name of the membership package — populated by the backend when returning customer data. */
  packageName?: string;
  startDate: string;
  endDate: string;
  status: CustomerMembershipStatus;
  notes?: string;
  /** When set, this pass applies to that vehicle; omit for legacy customer-wide rows. */
  vehicleId?: string;
  /** Redemptions of included services during this subscription window. */
  usageHistory?: MembershipServiceUsage[];
  /** Invoice created when this membership was activated. */
  invoiceId?: string;
}
