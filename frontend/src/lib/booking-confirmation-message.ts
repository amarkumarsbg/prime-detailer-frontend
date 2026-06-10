import { format, parseISO } from "date-fns";
import type { Appointment } from "@/types";

const OUR_SERVICES_LINE =
  "Foam Wash | Steam Wash | Underbody Cleaning | Interior Deep Dry Clean | Odour Removal | Rubbing Polish | Clay Bar Treatment | Headlight Restoration | Nitrogen Fill | Teflon Coating | 9H Ceramic | 3M Ceramic | Meguiar's Ceramic | 10H Ceramic | Graphene | PPF (TPU)";

const PRODUCTS_LINE =
  "We use 100% original products from 3M, Meguiar's, Puris, SystemX, PaintGuard, Garware, XPEL, Llumar, Saint-Gobain & more.";

const EXTRA_SERVICES_LINE = "& Denting-Painting & Mechanical Services (where offered).";

const BRAND_TAGLINE =
  "Quality never goes out of style — fair pricing, genuine products, and workmanship you can trust.";

const DISCLAIMER = `No car wash or detailing is perfect. Most concerns relate to pre-existing conditions that show up after cleaning. We are not liable for mechanical or electrical issues found after service. We avoid sensitive areas (engine bay, infotainment, cameras, etc.). Your presence during service is required. Please remove all valuables before handover.`;

function buildTermsLine(termsUrl?: string): string {
  const base =
    "(a) A GST invoice will be provided. (b) Services are subject to availability and feasibility. (c) Advance is non-refundable and non-transferable if you cancel or reschedule. (d) Visit / pick-up charges: Rs. 200 minimum plus Rs. 10/km beyond 10 km from our outlet.";
  if (termsUrl?.trim()) {
    return `${base} Full terms: ${termsUrl.trim()}`;
  }
  return base;
}

function formatRs(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function firstName(apt: Appointment): string {
  if (apt.customerFirstName?.trim()) return apt.customerFirstName.trim();
  return apt.customerName.split(/\s+/)[0] ?? apt.customerName;
}

/** Make/model with registration (car number), optional colour — matches job-card WhatsApp style. */
export function appointmentVehicleDisplayLine(apt: Appointment): string {
  const reg = apt.vehicleRegNumber.trim();
  const base = reg ? `${apt.vehicleMakeModel} (${reg})` : apt.vehicleMakeModel;
  const colour = apt.vehicleColor?.trim();
  return colour ? `${base} · ${colour}` : base;
}

function bookingDateTimeLine(apt: Appointment): string {
  const d = parseISO(apt.date);
  const day = format(d, "EEE, dd-MMM-yyyy");
  return `*${day}* (${apt.time})`;
}

function expectedDeliveryLine(apt: Appointment): string {
  if (apt.expectedDeliveryDate) {
    const ed = parseISO(apt.expectedDeliveryDate);
    return format(ed, "EEE, dd-MMM-yyyy");
  }
  return "— (to be confirmed)";
}

export type BookingConfirmationBusiness = {
  /**
   * Branch / outlet label shown as *Prime Detailers - {branchName}* (e.g. "Main workshop").
   */
  branchName: string;
  /** @deprecated Use branchName; kept for older call sites */
  studioName?: string;
  address: string;
  phone: string;
  email: string;
  /** Optional full terms URL appended to T&C */
  termsUrl?: string;
};

function outletBrandLine(business: BookingConfirmationBusiness): string {
  const branch = (business.branchName || business.studioName || "Main workshop").trim();
  return `Prime Detailers - ${branch}`;
}

export function buildBookingConfirmationMessage(
  apt: Appointment,
  business: BookingConfirmationBusiness
): string {
  const name = firstName(apt);
  const brand = outletBrandLine(business);
  const vehicleLine = appointmentVehicleDisplayLine(apt);

  const bookingDetailsExtra =
    apt.bookingPricingLine?.trim() ||
    `Pricing and package details will be confirmed at the outlet.`;

  const priceBlock =
    apt.priceSubtotalExGst != null &&
    apt.priceGstAmount != null &&
    apt.priceGrandTotal != null
      ? [
          `*PRICE DETAILS:*`,
          `${formatRs(apt.priceSubtotalExGst)} + ${formatRs(apt.priceGstAmount)} (GST) = *${formatRs(apt.priceGrandTotal)}*`,
          apt.advancePaid != null ? `Advance: ${formatRs(apt.advancePaid)}` : "",
          apt.advancePolicyNote
            ? `Note: ${apt.advancePolicyNote}`
            : "Note: An advance payment of 30% is required to confirm and pre-schedule your service slot.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `*PRICE DETAILS:*`,
          `Pricing will be confirmed at the outlet before work begins.`,
          apt.advancePaid != null ? `Advance: ${formatRs(apt.advancePaid)}` : "",
          apt.advancePolicyNote
            ? `Note: ${apt.advancePolicyNote}`
            : "Note: An advance payment of 30% is required to confirm and pre-schedule your service slot.",
        ]
          .filter(Boolean)
          .join("\n");

  const deliveryNote =
    apt.deliveryExpectationNote?.trim() ||
    "(We will do our best to meet the expected delivery date.)";

  const wa = (apt.whatsappPhone ?? apt.customerPhone).trim();
  const mobile = apt.customerPhone.trim();
  const terms = buildTermsLine(business.termsUrl);

  return [
    `Hi *${name}*,`,
    `Your booking request *(No: ${apt.bookingId})* has been successfully accepted @*${brand}*.`,
    ``,
    `*BOOKING DETAILS:*`,
    vehicleLine,
    apt.serviceType,
    bookingDetailsExtra,
    ``,
    priceBlock,
    ``,
    `*BOOKING DATE & TIME:*`,
    `${bookingDateTimeLine(apt)} | Expected delivery: *${expectedDeliveryLine(apt)}*`,
    deliveryNote,
    `Kindly reach our outlet *30 minutes before* your slot so we can start on time, subject to feasibility.`,
    ``,
    `*CUSTOMER DETAILS:*`,
    `Name: ${apt.customerName}`,
    `Mobile No: ${mobile} | WhatsApp: ${wa}`,
    `Address: ${apt.customerAddress ?? "—"}`,
    ``,
    `*OUR SERVICES:*`,
    OUR_SERVICES_LINE,
    ``,
    PRODUCTS_LINE,
    EXTRA_SERVICES_LINE,
    ``,
    BRAND_TAGLINE,
    ``,
    `*DISCLAIMER:*`,
    DISCLAIMER,
    ``,
    `*STANDARD TERMS & CONDITIONS:*`,
    terms,
    ``,
    `Regards,`,
    `*${brand}*`,
    `${business.address}`,
    `${business.phone} | ${business.email}`,
  ].join("\n");
}

const WHATSAPP_BOOKING_BODY_SAFE_MAX = 1550;

function clipLine(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Short WhatsApp body for Twilio/session templates (keeps under ~1600 chars).
 * Use for automated sends; use {@link buildBookingConfirmationMessage} only when length is not capped (e.g. preview/copy).
 */
export function buildBookingWhatsAppMessageCompact(
  apt: Appointment,
  business: BookingConfirmationBusiness
): string {
  const name = firstName(apt);
  const brand = outletBrandLine(business);
  const vehicleLine = appointmentVehicleDisplayLine(apt);

  const statusWord =
    apt.status === "CONFIRMED"
      ? "confirmed"
      : apt.status === "SCHEDULED"
        ? "scheduled"
        : apt.status === "IN_PROGRESS"
          ? "in progress"
          : apt.status.replace(/_/g, " ").toLowerCase();

  const priceOneLiner =
    apt.priceGrandTotal != null &&
    apt.priceSubtotalExGst != null &&
    apt.priceGstAmount != null
      ? `Estimate: ${formatRs(apt.priceSubtotalExGst)} + GST ${formatRs(apt.priceGstAmount)} = *${formatRs(apt.priceGrandTotal)}*`
      : "Pricing will be confirmed at the outlet before work begins.";

  const termsHint = business.termsUrl?.trim()
    ? `Terms: ${clipLine(business.termsUrl.trim(), 240)}`
    : "GST invoice on completion. Advance / reschedule rules apply — confirm at outlet.";

  const wa = (apt.whatsappPhone ?? apt.customerPhone).trim();
  const mobile = apt.customerPhone.trim();

  const body = [
    `Hi *${name}*,`,
    ``,
    `Your booking *(${apt.bookingId})* is *${statusWord}* @ *${brand}*.`,
    ``,
    `*When:* ${bookingDateTimeLine(apt)}`,
    `*Expected delivery:* ${expectedDeliveryLine(apt)}`,
    `*Vehicle:* ${clipLine(vehicleLine, 160)}`,
    `*Service:* ${clipLine(apt.serviceType, 80)}`,
    ``,
    priceOneLiner,
    apt.advancePaid != null ? `Advance recorded: ${formatRs(apt.advancePaid)}` : "",
    ``,
    `*Where:* ${clipLine(business.address, 220)}`,
    `*Contact:* ${business.phone} | ${business.email}`,
    `Mobile: ${mobile}${wa !== mobile ? ` | WhatsApp: ${wa}` : ""}`,
    ``,
    termsHint,
    ``,
    `Please reach ~30 minutes before your slot. Reply here to reschedule or ask questions.`,
    ``,
    `— *${brand}*`,
  ]
    .filter(Boolean)
    .join("\n");

  if (body.length > WHATSAPP_BOOKING_BODY_SAFE_MAX) {
    return clipLine(body, WHATSAPP_BOOKING_BODY_SAFE_MAX);
  }
  return body;
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
