import { format, parseISO } from "date-fns";
import type { Appointment, JobCard } from "@/types";

const OUR_SERVICES_LINE =
  "Foam Wash | Steam Wash | Underbody Cleaning | Interior Deep Dry Clean | Odour Removal | Rubbing Polish | Clay Bar Treatment | Headlight Restoration | Nitrogen Fill | Teflon Coating | 9H Ceramic | 3M Ceramic | Meguiar's Ceramic | 10H Ceramic | Graphene | PPF (TPU).";

const PRODUCTS_LINE =
  "We use 100% original products from 3M, Meguiar's, Puris, SystemX, PaintGuard, Garware, XPEL, Llumar, Saint-Gobain, etc.";

const EXTRA_SERVICES_LINE = "Denting-Painting & Mechanical Services";

const BRAND_TAGLINE = [
  "Quality Never Goes Out of Cost – Don't Be Cheap!",
  "Choose Fair Pricing with Guaranteed Quality & Original Products!",
].join("\n");

const DISCLAIMER = `No car wash or detailing is perfect. Most complaints arise from pre-existing conditions that become noticeable after cleaning. Our team is not liable for any mechanical or electrical issues revealed post-service. We avoid cleaning sensitive areas like the engine, infotainment screen, cameras, etc. Your presence during the service is mandatory. We are not liable once our team leaves your premises. Please remove all valuables before handing over your vehicle.`;

function buildTermsLine(termsUrl?: string): string {
  const base =
    "(a) A GST invoice will be provided online. (b) Services are subject to availability and feasibility. (c) Advance payment is non-refundable and non-transferable in case of customer rescheduling or cancellation. (d) Visiting/pick-up charges: Rs. 200 minimum, plus Rs. 10/km beyond 10 km from our office.";
  if (termsUrl?.trim()) {
    return `${base} For full terms and disclaimers, please visit: ${termsUrl.trim()}`;
  }
  return base;
}

function formatRs(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function formatInrPlain(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

function firstName(apt: Appointment): string {
  if (apt.customerFirstName?.trim()) return apt.customerFirstName.trim();
  return apt.customerName.split(/\s+/)[0] ?? apt.customerName;
}

function greetingName(apt: Appointment): string {
  return firstName(apt).toUpperCase();
}

/** Vehicle line for booking details — make/model (COLOUR), registration omitted when colour is set. */
export function appointmentVehicleDisplayLine(apt: Appointment): string {
  const makeModel = apt.vehicleMakeModel.trim();
  const colour = apt.vehicleColor?.trim();
  const reg = apt.vehicleRegNumber.trim();
  if (colour) {
    return `${makeModel} (${colour.toUpperCase()})`;
  }
  return reg ? `${makeModel} (${reg})` : makeModel;
}

function bookingDetailsLine(apt: Appointment): string {
  const parts = [
    appointmentVehicleDisplayLine(apt),
    apt.serviceType?.trim(),
    apt.bookingPricingLine?.trim(),
  ].filter((x): x is string => Boolean(x && x.length > 0));
  if (parts.length > 0) return parts.join(" ");
  return "Pricing and package details will be confirmed at the outlet.";
}

function bookingDateLine(apt: Appointment): string {
  const d = parseISO(apt.date);
  return format(d, "EEE, dd-MMM-yyyy");
}

function expectedDeliveryFormatted(apt: Appointment): string {
  if (apt.expectedDeliveryDate) {
    const ed = parseISO(apt.expectedDeliveryDate);
    return format(ed, "EEE, dd-MMM-yyyy");
  }
  return "— (to be confirmed)";
}

function bookingScheduleBlock(apt: Appointment): string {
  const delivery = expectedDeliveryFormatted(apt);
  const note =
    apt.deliveryExpectationNote?.trim() ||
    "we will try our 100% to deliver it on Saturday Evening.";
  return `*${bookingDateLine(apt)}* | Expected Delivery time: ${delivery} (${note})`;
}

function priceDetailsBlock(apt: Appointment): string {
  const advanceNote =
    apt.advancePolicyNote?.trim() ||
    "An advance payment of 30% is required to confirm and pre-schedule your service slot.";

  if (
    apt.priceSubtotalExGst != null &&
    apt.priceGstAmount != null &&
    apt.priceGrandTotal != null
  ) {
    return [
      `*PRICE DETAILS:*`,
      `${formatRs(apt.priceSubtotalExGst)} + ${formatInrPlain(apt.priceGstAmount)} (GST) = ${formatInrPlain(apt.priceGrandTotal)}`,
      apt.advancePaid != null ? `Advance: ${formatRs(apt.advancePaid)}` : "",
      `Note: ${advanceNote}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `*PRICE DETAILS:*`,
    `Pricing will be confirmed at the outlet before work begins.`,
    apt.advancePaid != null ? `Advance: ${formatRs(apt.advancePaid)}` : "",
    `Note: ${advanceNote}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function regardsTeamLine(business: BookingConfirmationBusiness): string {
  const name = business.businessName?.trim() || business.branchName || "Our team";
  return name.toLowerCase().startsWith("team ") ? name : `Team ${name}`;
}

function outletAtLine(business: BookingConfirmationBusiness): string {
  return (business.acceptanceOutlet ?? business.studioName ?? "Visit Outlet").trim();
}

export type BookingConfirmationBusiness = {
  /** Label after @ in opening line (e.g. "Visit Outlet"). */
  acceptanceOutlet?: string;
  /** Branch / studio label (legacy; not used in @ line when acceptanceOutlet is set). */
  branchName: string;
  /** Business / studio name for Regards block (e.g. "The Detailing Gang"). */
  businessName?: string;
  /** @deprecated Use acceptanceOutlet */
  studioName?: string;
  address: string;
  phone: string;
  email: string;
  /** Full terms URL (e.g. https://www.thedetailinggang.com/terms-conditions) */
  termsUrl?: string;
};

/** Build business footer block from app settings + optional branch label. */
export function getBookingConfirmationBusiness(opts: {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite?: string;
  branchLabel?: string;
  acceptanceOutlet?: string;
}): BookingConfirmationBusiness {
  let termsUrl: string | undefined;
  const w = opts.businessWebsite?.trim();
  if (w) {
    const base = /^https?:\/\//i.test(w) ? w : `https://${w}`;
    const normalized = base.replace(/\/$/, "");
    termsUrl = /terms/i.test(normalized) ? normalized : `${normalized}/terms-conditions`;
  }
  return {
    acceptanceOutlet: opts.acceptanceOutlet ?? "Visit Outlet",
    branchName: opts.branchLabel?.trim() || "Visit Outlet",
    businessName: opts.businessName,
    address: opts.businessAddress,
    phone: opts.businessPhone,
    email: opts.businessEmail,
    termsUrl,
  };
}

export function buildBookingConfirmationMessage(
  apt: Appointment,
  business: BookingConfirmationBusiness
): string {
  const name = greetingName(apt);
  const outlet = outletAtLine(business);
  const wa = (apt.whatsappPhone ?? apt.customerPhone).trim();
  const mobile = apt.customerPhone.trim();
  const terms = buildTermsLine(business.termsUrl);
  const team = regardsTeamLine(business);

  return [
    `Hi *${name},*`,
    ``,
    `Your booking request *(No: ${apt.bookingId})* has been successfully accepted @${outlet}.`,
    ``,
    `*BOOKING DETAILS:*`,
    bookingDetailsLine(apt),
    ``,
    priceDetailsBlock(apt),
    ``,
    `*BOOKING DATE & TIME:*`,
    bookingScheduleBlock(apt),
    `Kindly visit our Studio Outlet before 30 min, we can start job accordingly, subject to feasibility.`,
    ``,
    `*CUSTOMER DETAILS:*`,
    `Name: ${apt.customerName}`,
    `Mobile No: ${mobile} WhatsApp: ${wa}`,
    `Address: ${apt.customerAddress ?? "—"}`,
    ``,
    `*OUR SERVICES:* ${OUR_SERVICES_LINE}`,
    PRODUCTS_LINE,
    `&`,
    EXTRA_SERVICES_LINE,
    ``,
    BRAND_TAGLINE,
    ``,
    `*DISCLAIMER:*`,
    DISCLAIMER,
    ``,
    `*STANDARD TERMS & CONDITIONS:* ${terms}`,
    ``,
    `Regards,`,
    team,
    business.address,
    business.phone,
    business.email,
  ].join("\n");
}

/**
 * WhatsApp body — full booking confirmation template (split into ≤1600-char parts at send time).
 */
export function buildBookingWhatsAppMessageCompact(
  apt: Appointment,
  business: BookingConfirmationBusiness
): string {
  return buildBookingConfirmationMessage(apt, business);
}

export type JobCardCreationConfirmationInput = {
  job: JobCard;
  business: BookingConfirmationBusiness;
  customerAddress?: string;
  vehicleColor?: string;
  priceSubtotalExGst: number;
  priceGstAmount: number;
  priceGrandTotal: number;
  advancePaid?: number;
  /** yyyy-MM-dd — visit / job intake date */
  appointmentDate: string;
  /** HH:mm */
  appointmentTime: string;
  bookingPricingLine?: string;
};

/** Full TDG-style confirmation when a job card is created (same template as bookings). */
export function buildJobCardCreationConfirmationMessage(
  input: JobCardCreationConfirmationInput
): string {
  const { job } = input;
  const serviceType =
    job.services
      .map((s) => s.name)
      .filter(Boolean)
      .join(" + ") || "Service";
  const expectedDeliveryDate =
    job.expectedDelivery && !Number.isNaN(Date.parse(job.expectedDelivery))
      ? format(parseISO(job.expectedDelivery), "yyyy-MM-dd")
      : undefined;

  const apt: Appointment = {
    id: job.id,
    bookingId: job.jobNumber,
    customerId: job.customerId,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    whatsappPhone: job.customerPhone,
    vehicleId: job.vehicleId,
    vehicleRegNumber: job.vehicleRegNumber,
    vehicleMakeModel: job.vehicleMakeModel,
    vehicleColor: input.vehicleColor,
    serviceType,
    date: input.appointmentDate,
    time: input.appointmentTime,
    status: "CONFIRMED",
    whatsappSent: true,
    createdAt: job.createdAt,
    customerFirstName: job.customerName.trim().split(/\s+/)[0],
    customerAddress: input.customerAddress,
    bookingPricingLine: input.bookingPricingLine,
    priceSubtotalExGst: input.priceSubtotalExGst,
    priceGstAmount: input.priceGstAmount,
    priceGrandTotal: input.priceGrandTotal,
    advancePaid: input.advancePaid,
    advancePolicyNote:
      "An advance payment of 30% is required to confirm and pre-schedule your service slot.",
    expectedDeliveryDate,
    deliveryExpectationNote:
      "we will try our 100% to deliver it on Saturday Evening.",
  };

  return buildBookingWhatsAppMessageCompact(apt, input.business);
}

/** Digits only for wa.me (e.g. 919369111655) */
export function whatsappDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.startsWith("91") && d.length >= 12) return d;
  return d;
}

/**
 * Picks a saved appointment for the “Demo: WhatsApp” preview.
 * Prefers apt-019 (5022) if present, then the richest pricing row, then earliest active booking.
 */
export function pickAppointmentForWhatsAppPreview(appointments: Appointment[]): Appointment | null {
  if (appointments.length === 0) return null;
  const preferred = appointments.find((a) => a.id === "apt-019");
  if (preferred) return preferred;
  const withPricing = appointments.find(
    (a) =>
      a.priceGrandTotal != null &&
      a.status !== "CANCELLED" &&
      a.status !== "COMPLETED" &&
      a.status !== "NOT_ATTENDED"
  );
  if (withPricing) return withPricing;
  const active = appointments.filter(
    (a) =>
      a.status !== "CANCELLED" &&
      a.status !== "COMPLETED" &&
      a.status !== "NOT_ATTENDED"
  );
  if (active.length > 0) {
    return [...active].sort((a, b) => {
      const ta = new Date(`${a.date}T${a.time}`).getTime();
      const tb = new Date(`${b.date}T${b.time}`).getTime();
      return ta - tb;
    })[0]!;
  }
  return appointments[0]!;
}
