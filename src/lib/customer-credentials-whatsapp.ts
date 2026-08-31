/**
 * WhatsApp message templates for customer communications.
 *
 * TRIGGER POINTS (backend must call these at the right moments):
 *
 * 1. JOB CARD CREATED (new customer):
 *    → buildCustomerCredentialsWhatsAppMessage()
 *    → Sends login credentials so customer can track the service
 *
 * 2. JOB CARD DELIVERED:
 *    → buildJobDeliveredWhatsAppMessage()
 *    → Notifies customer their vehicle is ready / has been delivered
 */

export interface CustomerCredentialsMessageInput {
  customerName: string;
  phone: string;
  password: string;
  businessName: string;
  bookingReference?: string;
  customerPortalUrl?: string;
}

/**
 * Build WhatsApp message with customer login credentials.
 * To be used when customer account is created during booking wizard.
 */
export function buildCustomerCredentialsWhatsAppMessage(
  input: CustomerCredentialsMessageInput
): string {
  const {
    customerName,
    phone,
    password,
    businessName,
    bookingReference,
    customerPortalUrl,
  } = input;

  const firstName = customerName.split(" ")[0];

  const bookingLine = bookingReference
    ? `Your booking ${bookingReference} has been confirmed. Here are your account credentials to track your service:`
    : `Here are your account credentials to track your service:`;

  const portalLine = customerPortalUrl
    ? `Please log in at our portal to track your vehicle:\n${customerPortalUrl}`
    : "";

  const lines = [
    `Hi ${firstName}! 🎉 Welcome to ${businessName}!`,
    ``,
    bookingLine,
    ``,
    `📱 Phone: ${phone}`,
    `🔑 Password: ${password}`,
    ``,
    ...(portalLine ? [portalLine, ``] : []),
    `Thank you for choosing ${businessName}! 🚗`,
  ];

  return lines.join("\n");
}

/**
 * Get the customer portal login URL.
 * Falls back to deployed URL or localhost for development.
 */
export function getCustomerPortalUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/customer/login`;
  }

  // Server-side
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (publicUrl) {
    return `${publicUrl}/customer/login`;
  }

  return "https://yourapp.com/customer/login";
}

// ---------------------------------------------------------------------------
// Trigger 2: Job Card Delivered
// ---------------------------------------------------------------------------

export interface JobDeliveredMessageInput {
  customerName: string;
  jobCardNumber: string;
  vehicleMakeModel: string;
  registrationNumber: string;
  businessName: string;
  customerPortalUrl?: string;
}

/**
 * Build WhatsApp message sent when a job card is marked as DELIVERED.
 * Backend should call this when job card status transitions to DELIVERED.
 */
export function buildJobDeliveredWhatsAppMessage(
  input: JobDeliveredMessageInput
): string {
  const {
    customerName,
    jobCardNumber,
    vehicleMakeModel,
    registrationNumber,
    businessName,
    customerPortalUrl,
  } = input;

  const firstName = customerName.split(" ")[0];

  const lines = [
    `Hi ${firstName}! ✅ Your vehicle is delivered!`,
    ``,
    `Your ${vehicleMakeModel} (${registrationNumber}) has been successfully serviced and delivered.`,
    ``,
    `📋 Job Card: ${jobCardNumber}`,
    ``,
    ...(customerPortalUrl
      ? [
          `View your invoice and service details on our portal:`,
          `${customerPortalUrl}`,
          ``,
        ]
      : []),
    `Thank you for choosing ${businessName}! 🚗`,
    `We hope to see you again soon.`,
  ];

  return lines.join("\n");
}
