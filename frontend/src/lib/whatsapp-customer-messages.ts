import { format, parseISO } from "date-fns";
import type {
  FollowUp,
  Invoice,
  JobCard,
  JobCardStatus,
  MembershipTier,
  PaymentMethod,
  PickupDropRequest,
  Quotation,
  ReminderType,
  ServiceReminder,
} from "@/types";
import { formatCurrency } from "@/lib/utils";

const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  GENERAL_SERVICE: "General Service",
  OIL_CHANGE: "Oil Change",
  BRAKE_INSPECTION: "Brake Inspection",
  TIRE_ROTATION: "Tire Rotation",
  AC_SERVICE: "AC Service",
  BATTERY_CHECK: "Battery Check",
  INSURANCE: "Insurance Renewal",
  PUC: "PUC Certificate",
  PPF_MAINTENANCE: "PPF Maintenance",
  CERAMIC_MAINTENANCE: "Ceramic Maintenance",
};

const JOB_STATUS_CUSTOMER_LABEL: Record<JobCardStatus, string> = {
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "In Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready for pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function buildJobCardCustomerWhatsAppMessage(job: JobCard): string {
  const firstName = job.customerName.trim().split(/\s+/)[0] ?? job.customerName;
  const vehicle = `${job.vehicleMakeModel} (${job.vehicleRegNumber})`.trim();
  const serviceNames = job.services
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  const more =
    job.services.length > 6 ? ` (+${job.services.length - 6} more)` : "";
  const statusLabel =
    JOB_STATUS_CUSTOMER_LABEL[job.status] ?? JOB_STATUS_CUSTOMER_LABEL.RECEIVED;

  return [
    `Hi *${firstName}*,`,
    ``,
    `Update on your job *${job.jobNumber}* at *Prime Detailers*.`,
    `Status: *${statusLabel}*`,
    `Vehicle: ${vehicle}`,
    serviceNames ? `Services: ${serviceNames}${more}` : "",
    ``,
    `Reply here if you have any questions.`,
    ``,
    `— Team Prime Detailers`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildServiceReminderWhatsAppMessage(reminder: ServiceReminder): string {
  const firstName = reminder.customerName.trim().split(/\s+/)[0] ?? reminder.customerName;
  const typeLabel = REMINDER_TYPE_LABEL[reminder.type] ?? reminder.type;
  const due = format(parseISO(reminder.dueDate), "EEE, dd-MMM-yyyy");
  const vehicle = `${reminder.vehicleMakeModel} (${reminder.vehicleRegNumber})`.trim();

  return [
    `Hi *${firstName}*,`,
    ``,
    `Friendly reminder from *Prime Detailers* regarding your vehicle.`,
    `Reminder: *${typeLabel}*`,
    `Vehicle: ${vehicle}`,
    `Due: *${due}*`,
    reminder.notes?.trim() ? `Note: ${reminder.notes.trim()}` : "",
    ``,
    `Book a slot when convenient — reply here or call us.`,
    ``,
    `— Team Prime Detailers`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildQuotationWhatsAppMessage(q: Quotation): string {
  const first = q.customerName.trim().split(/\s+/)[0] ?? q.customerName;
  const serviceLines = q.services
    .map((s) => `• ${s.name}: ${formatCurrency(s.price)}`)
    .join("\n");
  const valid = q.validUntil
    ? format(parseISO(q.validUntil), "EEE, dd-MMM-yyyy")
    : null;

  return [
    `Hi *${first}*,`,
    ``,
    `Please find your estimate *${q.quotationNumber}* from *Prime Detailers*.`,
    ``,
    `*Vehicle:* ${q.vehicleMakeModel} (${q.vehicleRegNumber})`,
    `*Services:*`,
    serviceLines,
    ``,
    `Subtotal: ${formatCurrency(q.subtotal)}`,
    q.taxAmount > 0 ? `GST: ${formatCurrency(q.taxAmount)}` : "",
    `*Total:* *${formatCurrency(q.grandTotal)}*`,
    valid ? `Valid until: *${valid}*` : "",
    ``,
    `Reply here to approve or ask questions.`,
    ``,
    `— Team Prime Detailers`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFollowUpWhatsAppMessage(fu: FollowUp, lastVisitLabel: string): string {
  const first = fu.customerName.trim().split(/\s+/)[0] ?? fu.customerName;
  return [
    `Hi *${first}*,`,
    ``,
    `We miss you at *Prime Detailers* — it’s been a while since your last visit.`,
    `Last visit: *${lastVisitLabel}* (${fu.daysSinceLastVisit} days ago).`,
    ``,
    `Reply here or call us to book a service — we’ll be happy to help.`,
    ``,
    `— Team Prime Detailers`,
  ].join("\n");
}

export function buildPickupDropWhatsAppMessage(
  req: PickupDropRequest,
  opts: { branchName?: string } = {}
): string {
  const first = req.customerName.trim().split(/\s+/)[0] ?? req.customerName;
  const typeLabel = req.type === "PICKUP" ? "Pickup" : "Drop";
  const when = format(parseISO(req.scheduledTime), "EEE, dd-MMM-yyyy 'at' h:mm a");
  const branchLine = opts.branchName?.trim() ? `Branch: *${opts.branchName.trim()}*` : "";
  const driverLine = req.driverName?.trim() ? `Driver: *${req.driverName.trim()}*` : "";
  const mm = req.vehicleMakeModel?.trim();
  const reg = req.vehicleRegNumber?.trim();
  const vehicleLine =
    mm && reg ? `Vehicle: ${mm} (${reg})` : mm ? `Vehicle: ${mm}` : reg ? `Vehicle: ${reg}` : "";

  return [
    `Hi *${first}*,`,
    ``,
    `*${typeLabel}* update for job *${req.jobNumber}* at *Prime Detailers*.`,
    vehicleLine,
    `Scheduled: *${when}*`,
    branchLine,
    `Address: ${req.address}`,
    driverLine,
    `Status: *${req.status.replace(/_/g, " ")}*`,
    req.notes?.trim() ? `Note: ${req.notes.trim()}` : "",
    ``,
    `Reply here if you need to reschedule.`,
    ``,
    `— Team Prime Detailers`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvoiceWhatsAppMessage(
  invoice: Invoice,
  opts: { businessName: string; remainingBalance: number; invoiceLabel?: string }
): string {
  const first = invoice.customerName.trim().split(/\s+/)[0] ?? invoice.customerName;
  const lineSummary = invoice.lineItems
    .slice(0, 8)
    .map((l) => `• ${l.description}: ${formatCurrency(l.total)}`)
    .join("\n");
  const more =
    invoice.lineItems.length > 8
      ? `\n(+${invoice.lineItems.length - 8} more line(s) on full invoice)`
      : "";

  return [
    `Hi *${first}*,`,
    ``,
    `Your ${opts.invoiceLabel ?? "tax invoice"} *${invoice.invoiceNumber}* (Job *${invoice.jobNumber}*) from *${opts.businessName}*.`,
    ``,
    `*Vehicle:* ${invoice.vehicleRegNumber}`,
    `${lineSummary}${more}`,
    ``,
    `*Grand total:* *${formatCurrency(invoice.grandTotal)}*`,
    `*Balance due:* *${formatCurrency(opts.remainingBalance)}*`,
    ``,
    `Use the invoice PDF for UPI/bank details, or reply here for help.`,
    ``,
    `— ${opts.businessName}`,
  ].join("\n");
}

function formatWhatsAppInr(amount: number): string {
  const n = Math.round(amount * 100) / 100;
  return `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatWhatsAppInrDecimal(amount: number): string {
  return `₹${(Math.round(amount * 100) / 100).toFixed(1)}`;
}

function invoiceStatusShareLabel(status: Invoice["status"]): string {
  switch (status) {
    case "PARTIALLY_PAID":
      return "Partially Paid";
    case "PAID":
      return "Paid";
    case "ISSUED":
      return "Issued";
    case "DRAFT":
      return "Draft";
    default:
      return status;
  }
}

function publicAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** True when WhatsApp will usually not auto-link the URL (local / private hosts). */
export function isWhatsAppNonClickableShareUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return true;
  }
}

export function publicInvoiceShareUrl(invoiceId: string): string {
  return `${publicAppBaseUrl()}/public-invoice/${encodeURIComponent(invoiceId)}`;
}

/**
 * Payment reminder — opens in WhatsApp composer (MyBillBook-style pending dues).
 */
export function buildPaymentPendingReminderWhatsAppMessage(opts: {
  pendingAmount: number;
  statementUrl: string;
  businessName: string;
}): string {
  return [
    `Hi sir/ma'am,`,
    `Your payment of ${formatWhatsAppInr(opts.pendingAmount)} is pending.`,
    ``,
    `You can view the ledger statement by clicking on link below:`,
    opts.statementUrl,
    `Please clear the payment as soon as possible.`,
    ``,
    `Thank you,`,
    opts.businessName,
  ].join("\n");
}

/**
 * Invoice-ready notice — richer body for API / in-chat delivery (MyBillBook-style).
 */
export function buildInvoiceReadyWhatsAppMessage(
  invoice: Invoice,
  opts: { businessName: string; remainingBalance: number; viewUrl: string }
): string {
  const first = invoice.customerName.trim().split(/\s+/)[0] ?? invoice.customerName;
  const invoiceDate = format(parseISO(invoice.createdAt), "dd.MM.yyyy");
  return [
    `Hey ${first} ,`,
    ``,
    `Thank you for your business`,
    `Your Sales Invoice is ready! Check the details below`,
    ``,
    `*Due Amount*`,
    `*${formatWhatsAppInr(opts.remainingBalance)}*`,
    `Status: ${invoiceStatusShareLabel(invoice.status)}`,
    `Invoice Date : ${invoiceDate}`,
    ``,
    `Sales Invoice No: ${invoice.invoiceNumber}`,
    `Invoice Amount: ${formatWhatsAppInrDecimal(invoice.grandTotal)}`,
    `Balance Due: ${formatWhatsAppInrDecimal(opts.remainingBalance)}`,
    ``,
    `Click the link below to view your invoice:`,
    opts.viewUrl,
    ``,
    `Happy to serve you`,
    `${opts.businessName}.`,
  ].join("\n");
}

/** @deprecated Prefer buildPaymentPendingReminderWhatsAppMessage / buildInvoiceReadyWhatsAppMessage */
export function buildCustomerLedgerWhatsAppMessage(
  customer: { name: string; phone?: string },
  customerInvoices: Invoice[],
  opts: { businessName: string; statementUrl?: string }
): string {
  const open = customerInvoices
    .filter((inv) => inv.status !== "DRAFT")
    .map((inv) => ({
      inv,
      due: Math.max(
        0,
        Math.round(
          (inv.grandTotal -
            inv.payments.reduce((s, p) => s + p.amount, 0) -
            (inv.walletAmountUsed || 0)) *
            100
        ) / 100
      ),
    }))
    .filter((r) => r.due > 0.01);

  const totalDue = open.reduce((s, r) => s + r.due, 0);
  const newest = open.sort((a, b) => b.inv.createdAt.localeCompare(a.inv.createdAt))[0];
  const statementUrl =
    opts.statementUrl ||
    (newest ? publicInvoiceShareUrl(newest.inv.id) : publicAppBaseUrl());

  return buildPaymentPendingReminderWhatsAppMessage({
    pendingAmount: totalDue,
    statementUrl,
    businessName: opts.businessName,
  });
}

const PAYMENT_METHOD_CUSTOMER_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  WALLET: "Wallet",
};

export function buildInvoicePaymentReceivedWhatsAppMessage(
  invoice: Invoice,
  payment: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    paidAt: string;
  },
  remainingBalanceAfter: number,
  opts: { businessName: string }
): string {
  const first = invoice.customerName.trim().split(/\s+/)[0] ?? invoice.customerName;
  const when = format(parseISO(payment.paidAt), "EEE, dd-MMM-yyyy 'at' h:mm a");
  const methodLabel = PAYMENT_METHOD_CUSTOMER_LABEL[payment.method] ?? payment.method;
  const refLine = payment.referenceNumber?.trim()
    ? `Reference: *${payment.referenceNumber.trim()}*`
    : "";

  return [
    `Hi *${first}*,`,
    ``,
    `We’ve recorded your payment for invoice *${invoice.invoiceNumber}* at *${opts.businessName}*.`,
    `Job: *${invoice.jobNumber}*`,
    `Vehicle: ${invoice.vehicleRegNumber}`,
    ``,
    `*Amount paid:* *${formatCurrency(payment.amount)}*`,
    `Method: *${methodLabel}*`,
    refLine,
    `Date: ${when}`,
    ``,
    `*Balance due:* *${formatCurrency(Math.max(0, remainingBalanceAfter))}*`,
    ``,
    `Thank you for your payment.`,
    ``,
    `— ${opts.businessName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Append partial-advance acknowledgement to job-created WhatsApp when booking captured advance. */
export function appendAdvanceAckToJobMessage(base: string, job: JobCard): string {
  const amt = job.highEndAdvanceAmountInr;
  if (amt == null || !(amt > 0)) return base;
  const methodLabel = PAYMENT_METHOD_CUSTOMER_LABEL[job.highEndAdvanceMethod ?? "CASH"];
  const refLine = job.highEndAdvanceReference?.trim()
    ? `Reference: *${job.highEndAdvanceReference.trim()}*`
    : "";
  return [
    base,
    ``,
    `*Advance on account:* *${formatCurrency(amt)}* (${methodLabel})`,
    refLine,
    `This will be adjusted on your final invoice.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildJobReadyForPickupWhatsAppMessage(
  job: JobCard,
  opts: { businessName: string }
): string {
  const firstName = job.customerName.trim().split(/\s+/)[0] ?? job.customerName;
  const vehicle = `${job.vehicleMakeModel} (${job.vehicleRegNumber})`.trim();
  const deliveryHint = job.expectedDelivery
    ? format(parseISO(job.expectedDelivery), "EEE, dd-MMM-yyyy")
    : null;

  return [
    `Hi *${firstName}*,`,
    ``,
    `Good news — your vehicle is *ready for pickup* from *${opts.businessName}*.`,
    `Job: *${job.jobNumber}*`,
    `Vehicle: ${vehicle}`,
    deliveryHint ? `Expected originally: ${deliveryHint}` : "",
    ``,
    `Please collect at your convenience. Reply here if you need deferral or billing help.`,
    ``,
    `— ${opts.businessName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildJobDeliveredWhatsAppMessage(
  job: JobCard,
  opts: { businessName: string }
): string {
  const firstName = job.customerName.trim().split(/\s+/)[0] ?? job.customerName;
  const vehicle = `${job.vehicleMakeModel} (${job.vehicleRegNumber})`.trim();

  return [
    `Hi *${firstName}*,`,
    ``,
    `Thank you for choosing *${opts.businessName}*.`,
    `Your job *${job.jobNumber}* is marked *delivered* for ${vehicle}.`,
    ``,
    `We hope you’re happy with the work. For invoice / warranty questions, reply here or visit the workshop.`,
    ``,
    `— ${opts.businessName}`,
  ].join("\n");
}

export function buildQuotationConvertedWhatsAppMessage(
  q: Quotation,
  jobNumber: string,
  businessName: string
): string {
  const first = q.customerName.trim().split(/\s+/)[0] ?? q.customerName;
  return [
    `Hi *${first}*,`,
    ``,
    `Your estimate *${q.quotationNumber}* is now an active job at *${businessName}*.`,
    `Job number: *${jobNumber}*`,
    `Vehicle: ${q.vehicleMakeModel} (${q.vehicleRegNumber})`,
    ``,
    `We’ll proceed as agreed. Reply here for changes or questions.`,
    ``,
    `— ${businessName}`,
  ].join("\n");
}

const TIER_CUSTOMER_LABEL: Record<MembershipTier, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};

export function buildMembershipWelcomeWhatsAppMessage(params: {
  customerName: string;
  businessName: string;
  packageName: string;
  tier: MembershipTier;
  validUntilIso: string;
  vehicleReg?: string;
  includedServiceNames?: string[];
}): string {
  const first = params.customerName.trim().split(/\s+/)[0] ?? params.customerName;
  const until = format(parseISO(params.validUntilIso), "EEE, dd-MMM-yyyy");
  const tierLabel = TIER_CUSTOMER_LABEL[params.tier] ?? params.tier;
  const veh = params.vehicleReg?.trim() ? `Vehicle: *${params.vehicleReg.trim()}*` : "";
  const included =
    params.includedServiceNames && params.includedServiceNames.length > 0
      ? `Included services: ${params.includedServiceNames.slice(0, 8).join(", ")}${
          params.includedServiceNames.length > 8
            ? ` (+${params.includedServiceNames.length - 8} more)`
            : ""
        }`
      : "";

  return [
    `Hi *${first}*,`,
    ``,
    `Your *${params.packageName}* membership is now active at *${params.businessName}*.`,
    `Plan: *${tierLabel}* · Valid until *${until}*`,
    veh,
    included,
    ``,
    `Show this message or your vehicle registration when you visit. Questions? Reply here.`,
    ``,
    `— ${params.businessName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildHighEndAdvanceReceiptWhatsAppMessage(
  job: JobCard,
  opts: {
    businessName: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
  }
): string {
  const first = job.customerName.trim().split(/\s+/)[0] ?? job.customerName;
  const vehicle = `${job.vehicleMakeModel} (${job.vehicleRegNumber})`.trim();
  const methodLabel = PAYMENT_METHOD_CUSTOMER_LABEL[opts.method] ?? opts.method;
  const refLine = opts.reference?.trim() ? `Reference: *${opts.reference.trim()}*` : "";

  return [
    `Hi *${first}*,`,
    ``,
    `We’ve recorded an *advance payment* at *${opts.businessName}* for job *${job.jobNumber}*.`,
    `Vehicle: ${vehicle}`,
    ``,
    `*Amount:* *${formatCurrency(opts.amount)}*`,
    `Method: *${methodLabel}*`,
    refLine,
    ``,
    `This will be adjusted against your final invoice. Thank you.`,
    ``,
    `— ${opts.businessName}`,
  ]
    .filter(Boolean)
    .join("\n");
}
