import type { JobCard, JobCardStatus } from "@/types";

export type JobCardWhatsAppTemplateId =
  | "booking_confirmed"
  | "vehicle_arrived"
  | "work_started"
  | "qc_passed"
  | "ready_for_pickup"
  | "invoice_ready"
  | "job_closed"
  | "custom";

export type JobCardWhatsAppTemplateDef = {
  id: JobCardWhatsAppTemplateId;
  label: string;
  emoji: string;
};

export const JOB_CARD_WHATSAPP_TEMPLATES: JobCardWhatsAppTemplateDef[] = [
  { id: "booking_confirmed", label: "Booking Confirmed", emoji: "✅" },
  { id: "vehicle_arrived", label: "Vehicle Arrived", emoji: "🚗" },
  { id: "work_started", label: "Work Started", emoji: "🔧" },
  { id: "qc_passed", label: "QC Passed", emoji: "✅" },
  { id: "ready_for_pickup", label: "Ready for Pickup", emoji: "✅" },
  { id: "invoice_ready", label: "Invoice Ready", emoji: "📄" },
  { id: "job_closed", label: "Job Closed", emoji: "🔓" },
  { id: "custom", label: "Custom Message", emoji: "📝" },
];

const STATUS_NOTIFY_LABEL: Record<JobCardStatus, string> = {
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "In Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready for Billing",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function jobCardNotifyStatusLabel(status: JobCardStatus): string {
  return STATUS_NOTIFY_LABEL[status] ?? status;
}

/** Pick a sensible default template from current job status. */
export function defaultWhatsAppTemplateForStatus(status: JobCardStatus): JobCardWhatsAppTemplateId {
  switch (status) {
    case "RECEIVED":
      return "vehicle_arrived";
    case "INSPECTION":
      return "vehicle_arrived";
    case "AWAITING_SERVICE":
      return "work_started";
    case "QUALITY_CHECK":
      return "qc_passed";
    case "READY":
      return "ready_for_pickup";
    case "DELIVERED":
      return "job_closed";
    case "CANCELLED":
    default:
      return "custom";
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full.trim();
}

function serviceSummary(job: JobCard): string {
  const names = job.services.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} (+${names.length - 3} more)`;
}

function vehicleLine(job: JobCard): string {
  return `${job.vehicleMakeModel} ${job.vehicleRegNumber}`.replace(/\s+/g, " ").trim();
}

export type BuildJobCardTemplateMessageOpts = {
  businessName: string;
  invoiceNumber?: string | null;
  customerLoginUrl?: string | null;
  customerPhotosLink?: string | null;
};

function joinMessage(lines: Array<string | false | null | undefined>): string {
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}

export function buildJobCardTemplateMessage(
  templateId: JobCardWhatsAppTemplateId,
  job: JobCard,
  opts: BuildJobCardTemplateMessageOpts
): string {
  const name = job.customerName.trim() || "there";
  const first = firstName(name);
  const biz = opts.businessName.trim() || "Prime Detailers";
  const vehicle = vehicleLine(job);
  const services = serviceSummary(job);
  const login = opts.customerLoginUrl?.trim();
  const invoiceNo = opts.invoiceNumber?.trim();

  switch (templateId) {
    case "booking_confirmed":
      return joinMessage([
        `Hi ${name}! ✅ Your booking is confirmed at *${biz}*.`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        `🚗 Vehicle: ${vehicle}`,
        services ? `🛠️ Services: ${services}` : null,
        ``,
        `We’ll keep you updated as work progresses.`,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `— ${biz}`,
      ]);

    case "vehicle_arrived":
      return joinMessage([
        `Hi ${name}! 🚗 We’ve received your vehicle at *${biz}*.`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        `🚗 Vehicle: ${vehicle}`,
        services ? `🛠️ Services booked: ${services}` : null,
        ``,
        `Inspection / service will begin shortly. Reply here if you have notes for our team.`,
        opts.customerPhotosLink ? `📸 *View Before Photos:*` : null,
        opts.customerPhotosLink || null,
        opts.customerPhotosLink ? `` : null,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `— ${biz}`,
      ]);

    case "work_started":
      return joinMessage([
        `Hi ${first}! 🔧 Work has started on your vehicle at *${biz}*.`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        `🚗 Vehicle: ${vehicle}`,
        services ? `🛠️ In progress: ${services}` : null,
        ``,
        `We’ll notify you when quality check is done.`,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `— ${biz}`,
      ]);

    case "qc_passed":
      return joinMessage([
        `Hi ${first}! ✅ Quality check passed for your vehicle at *${biz}*.`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        `🚗 Vehicle: ${vehicle}`,
        services ? `🛠️ Services: ${services}` : null,
        ``,
        `We’re finishing up and will share when it’s ready for pickup.`,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `— ${biz}`,
      ]);

    case "ready_for_pickup":
      return joinMessage([
        `Hi ${name}! 🎉 Great news — your vehicle is ready for pickup at *${biz}*!`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        `🚗 Vehicle: ${vehicle}`,
        services ? `✅ Service Completed: ${services}` : null,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `Please collect at your convenience. Reply here if you need help with billing.`,
        ``,
        `— ${biz}`,
      ]);

    case "invoice_ready":
      return joinMessage([
        `Hi ${name}! 📄 Your invoice is ready from *${biz}*.`,
        ``,
        `📋 Job Card: *${job.jobNumber}*`,
        invoiceNo ? `🧾 Invoice: *${invoiceNo}*` : null,
        `🚗 Vehicle: ${vehicle}`,
        services ? `🛠️ Services: ${services}` : null,
        login ? `🔗 *Your Customer Login*` : null,
        login || null,
        ``,
        `Reply here if you have any questions about payment.`,
        ``,
        `— ${biz}`,
      ]);

    case "job_closed":
      return joinMessage([
        `Hi ${name},`,
        ``,
        `Thank you for choosing ${biz}.`,
        `Your job ${job.jobNumber} is marked delivered for ${job.vehicleMakeModel} (${job.vehicleRegNumber}).`,
        ``,
        opts.customerPhotosLink ? `📸 *View Before & After Comparison:*` : null,
        opts.customerPhotosLink || null,
        opts.customerPhotosLink ? `` : null,
        `We hope you’re happy with the work. For invoice / warranty questions, reply here or visit the workshop.`,
        ``,
        `— ${biz}`,
      ]);

    case "custom":
    default:
      return joinMessage([
        `Hi ${name},`,
        ``,
        `Regarding job *${job.jobNumber}* (${vehicle}) at *${biz}*.`,
        ``,
        ``,
        `— ${biz}`,
      ]);
  }
}
