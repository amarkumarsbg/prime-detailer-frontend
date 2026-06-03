import type { Customer, Invoice, JobCard } from "@/types";
import type { Party } from "@/types/party";
import { loadPartyOverrides, savePartyOverride } from "@/lib/party/party-persistence";
import type { BootstrapPayload } from "@/lib/bootstrap-app-data";

/** MyBillBook-style demo party — HI TECH CAR SPA & DETAILING (₹ 217 balance). */
export const HI_TECH_CUSTOMER_ID = "cust-hitech";
export const HI_TECH_PARTY_ID = `c:${HI_TECH_CUSTOMER_ID}`;
export const HI_TECH_INVOICE_ID = "inv-hitech-demo";
export const HI_TECH_JOB_ID = "jc-hitech-001";

const DEMO_FLAG_KEY = "party-hitech-demo:v1";

export const HI_TECH_CUSTOMER: Customer = {
  id: HI_TECH_CUSTOMER_ID,
  name: "HI TECH CAR SPA & DETAILING",
  phone: "+919876543299",
  email: "hitech@example.test",
  address: "Sector 63, Noida, Uttar Pradesh",
  referralCode: "REFHITECH",
  totalVisits: 12,
  rewardPoints: 0,
  walletBalance: 0,
  lastVisitDate: "2025-07-16",
  isInactive: false,
  emailVerified: true,
  createdAt: "2025-01-10T10:00:00.000Z",
};

export const HI_TECH_JOB_CARD: JobCard = {
  id: HI_TECH_JOB_ID,
  jobNumber: "JC-2025-046",
  branchId: "br-main",
  customerId: HI_TECH_CUSTOMER_ID,
  customerName: HI_TECH_CUSTOMER.name,
  customerPhone: HI_TECH_CUSTOMER.phone,
  vehicleId: "veh-hitech-001",
  vehicleRegNumber: "UP16AB9999",
  vehicleMakeModel: "BMW 5 Series",
  vehicleSegment: "SEDAN",
  mechanicId: "usr-003",
  mechanicName: "Ravi Mechanic",
  status: "DELIVERED",
  reportedIssues: "Detailing package",
  odometerReading: 22000,
  expectedDelivery: "2025-07-14T18:00:00.000Z",
  services: [
    {
      id: "si-hitech-1",
      jobCardId: HI_TECH_JOB_ID,
      serviceCatalogId: "srv-001",
      name: "Premium detail",
      price: 27726,
      isCompleted: true,
      durationMinutes: 480,
    },
  ],
  estimatedAmount: 27726,
  incentivePercent: 10,
  incentiveAmount: 2772,
  termsAndConditions: "Standard workshop T&C apply.",
  notes: "Party demo — HI TECH",
  createdBy: "usr-admin",
  createdAt: "2025-07-13T09:00:00.000Z",
  updatedAt: "2025-07-16T11:00:00.000Z",
};

export const HI_TECH_INVOICE: Invoice = {
  id: HI_TECH_INVOICE_ID,
  invoiceNumber: "46",
  jobCardId: HI_TECH_JOB_ID,
  jobNumber: HI_TECH_JOB_CARD.jobNumber,
  customerId: HI_TECH_CUSTOMER_ID,
  customerName: HI_TECH_CUSTOMER.name,
  customerPhone: HI_TECH_CUSTOMER.phone,
  vehicleRegNumber: HI_TECH_JOB_CARD.vehicleRegNumber,
  lineItems: [
    {
      id: "li-hitech-1",
      description: "CERAMIC SPRAY (TURTLE WAX)",
      type: "PARTS",
      quantity: 3,
      unitPrice: 1270.34,
      total: 3811.02,
    },
    {
      id: "li-hitech-2",
      description: "GLASS COATING (TURTLEWAX) 100ml",
      type: "PARTS",
      quantity: 5,
      unitPrice: 237.288,
      total: 1186.44,
    },
    {
      id: "li-hitech-3",
      description: "HEAVY CUT COMPOUND",
      type: "PARTS",
      quantity: 6,
      unitPrice: 2771.1867,
      total: 16627.12,
    },
    {
      id: "li-hitech-4",
      description: "POLISHING COMPOUND T-40",
      type: "PARTS",
      quantity: 3,
      unitPrice: 2033.8967,
      total: 6101.69,
    },
  ],
  subtotal: 27726.27,
  taxRate: 18,
  taxAmount: 4990.73,
  discountAmount: 0,
  rewardDiscount: 0,
  walletAmountUsed: 0,
  grandTotal: 32717,
  status: "PARTIALLY_PAID",
  payments: [
    {
      id: "pay-hitech-8",
      invoiceId: HI_TECH_INVOICE_ID,
      amount: 32500,
      method: "UPI",
      referenceNumber: "HDFC 7180",
      paidAt: "2025-07-16T10:00:00.000Z",
    },
  ],
  mechanicName: "Ravi Mechanic",
  createdAt: "2025-07-13T10:00:00.000Z",
};

const HI_TECH_PARTY_PROFILE: Partial<Party> = {
  gstin: "09AARFH6895B1ZT",
  pan: "AARFH6895B",
  billingAddress: "Sector 63, Noida, Uttar Pradesh",
  shippingAddress: "Sector 63, Noida, Uttar Pradesh",
  category: "Customer",
  creditPeriodDays: 7,
  creditLimit: 500000,
};

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) {
    const next = [...list];
    next[i] = item;
    return next;
  }
  return [item, ...list];
}

/** Merge demo customer, job card, and invoice into bootstrap payload (idempotent). */
export function mergeHitechPartyDemoBootstrap(data: BootstrapPayload): BootstrapPayload {
  const customers = upsertById(data.customers, HI_TECH_CUSTOMER);
  const c = { ...data.collections };
  const jobCards = upsertById((c.jobCards as JobCard[]) ?? [], HI_TECH_JOB_CARD);
  const invoices = upsertById((c.invoices as Invoice[]) ?? [], HI_TECH_INVOICE);
  return {
    ...data,
    customers,
    collections: { ...c, jobCards, invoices },
  };
}

/** One-time localStorage profile patch for the HI TECH party (browser only). */
export function ensureHitechPartyProfile(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(DEMO_FLAG_KEY) === "1") return;
    const existing = loadPartyOverrides()[HI_TECH_PARTY_ID];
    if (!existing?.gstin) {
      savePartyOverride(HI_TECH_PARTY_ID, {
        ...HI_TECH_PARTY_PROFILE,
        name: HI_TECH_CUSTOMER.name,
        kind: "customer",
        customerId: HI_TECH_CUSTOMER_ID,
      });
    }
    localStorage.setItem(DEMO_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}
