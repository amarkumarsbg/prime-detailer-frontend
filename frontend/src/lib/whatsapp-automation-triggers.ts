import type {
  Appointment,
  Invoice,
  JobCard,
  MembershipTier,
  PaymentMethod,
  Quotation,
} from "@/types";
import type { BookingConfirmationBusiness } from "@/lib/booking-confirmation-message";
import { buildBookingWhatsAppMessageCompact } from "@/lib/booking-confirmation-message";
import {
  buildInvoiceWhatsAppMessage,
  buildJobDeliveredWhatsAppMessage,
  buildJobReadyForPickupWhatsAppMessage,
  buildQuotationConvertedWhatsAppMessage,
  buildMembershipWelcomeWhatsAppMessage,
  buildHighEndAdvanceReceiptWhatsAppMessage,
} from "@/lib/whatsapp-customer-messages";
import { executeCustomerWhatsAppAutomation } from "@/lib/whatsapp-automation-flow";
import { useJobCardStore } from "@/store/job-card-store";

function branchIdForJobCardId(jobCardId: string | undefined): string | undefined {
  if (!jobCardId) return undefined;
  return useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId)?.branchId;
}

export function notifyJobReadyWhatsApp(job: JobCard, businessName: string): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const message = buildJobReadyForPickupWhatsAppMessage(job, { businessName });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Ready for pickup — WhatsApp sent",
      composer: "Ready for pickup — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Automated ready-for-pickup WhatsApp to ${job.customerName}`,
    },
  });
}

export function notifyJobDeliveredWhatsApp(job: JobCard, businessName: string): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const message = buildJobDeliveredWhatsAppMessage(job, { businessName });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Delivered — WhatsApp sent",
      composer: "Delivered — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Automated delivered confirmation WhatsApp to ${job.customerName}`,
    },
  });
}

export function notifyInvoiceCreatedWhatsApp(inv: Invoice, businessName: string): void {
  const phone = inv.customerPhone?.trim();
  if (!phone) return;
  const totalPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const remainingBalance = Math.max(0, inv.grandTotal - totalPaid);
  const message = buildInvoiceWhatsAppMessage(inv, {
    businessName,
    remainingBalance,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "New invoice — WhatsApp sent",
      composer: "New invoice — WhatsApp composer",
    },
    notificationSummary: `${inv.invoiceNumber} → ${phone}`,
    href: `/billing/${inv.id}`,
    branchId: branchIdForJobCardId(inv.jobCardId),
    activityLog: {
      entityType: "INVOICE",
      entityId: inv.id,
      entityLabel: inv.invoiceNumber,
      details: `Automated invoice summary WhatsApp for ${inv.customerName}`,
    },
  });
}

export function notifyAppointmentScheduledWhatsApp(
  apt: Appointment,
  business: BookingConfirmationBusiness
): void {
  const phone = (apt.whatsappPhone ?? apt.customerPhone)?.trim();
  if (!phone) return;
  const message = buildBookingWhatsAppMessageCompact(apt, business);
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Appointment scheduled — WhatsApp sent",
      composer: "Appointment scheduled — WhatsApp composer",
    },
    notificationSummary: `${apt.bookingId} → ${phone}`,
    href: "/appointments",
    branchId: branchIdForJobCardId(apt.jobCardId),
    activityLog: {
      entityType: "APPOINTMENT",
      entityId: apt.id,
      entityLabel: apt.bookingId,
      details: `Booking acknowledgement WhatsApp for ${apt.customerName}`,
    },
  });
}

export function notifyQuotationConvertedWhatsApp(
  q: Quotation,
  jobNumber: string,
  jobId: string,
  businessName: string
): void {
  const phone = q.customerPhone?.trim();
  if (!phone) return;
  const message = buildQuotationConvertedWhatsAppMessage(q, jobNumber, businessName);
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Estimate converted — WhatsApp sent",
      composer: "Estimate converted — WhatsApp composer",
    },
    notificationSummary: `${q.quotationNumber} → ${jobNumber} → ${phone}`,
    href: `/job-cards/${jobId}`,
    branchId: branchIdForJobCardId(jobId),
    activityLog: {
      entityType: "QUOTATION",
      entityId: q.id,
      entityLabel: q.quotationNumber,
      details: `Quotation converted — WhatsApp to ${q.customerName} (${jobNumber})`,
    },
  });
}

export function notifyMembershipWelcomeWhatsApp(opts: {
  customerPhone: string;
  customerName: string;
  customerId: string;
  businessName: string;
  packageName: string;
  tier: MembershipTier;
  validUntilIso: string;
  vehicleReg?: string;
  includedServiceNames?: string[];
}): void {
  const phone = opts.customerPhone.trim();
  if (!phone) return;
  const message = buildMembershipWelcomeWhatsAppMessage({
    customerName: opts.customerName,
    businessName: opts.businessName,
    packageName: opts.packageName,
    tier: opts.tier,
    validUntilIso: opts.validUntilIso,
    vehicleReg: opts.vehicleReg,
    includedServiceNames: opts.includedServiceNames,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Membership welcome — WhatsApp sent",
      composer: "Membership welcome — WhatsApp composer",
    },
    notificationSummary: `${opts.packageName} → ${phone}`,
    href: "/membership",
    activityLog: {
      entityType: "CUSTOMER",
      entityId: opts.customerId,
      entityLabel: opts.customerName,
      details: `Membership welcome WhatsApp — ${opts.packageName}`,
    }  });
}

export function notifyHighEndAdvanceRecordedWhatsApp(
  job: JobCard,
  businessName: string,
  amount: number,
  method: PaymentMethod,
  reference?: string
): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const message = buildHighEndAdvanceReceiptWhatsAppMessage(job, {
    businessName,
    amount,
    method,
    reference,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Advance receipt — WhatsApp sent",
      composer: "Advance receipt — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Advance receipt WhatsApp (${amount} ${method})`,
    },
  });
}
