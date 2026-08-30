/**
 * WhatsApp message template for customer login credentials.
 * Used when a new customer account is created.
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
  const lines = [
    `Hi ${firstName}! 🎉 Welcome to ${businessName}!`,
    ``,
    ...(bookingReference
      ? [
          `Your booking ${bookingReference} has been confirmed.`,
          ``,
          `Here are your account credentials to track your service:`,
        ]
      : [`Here are your account credentials to track your service:`]),
    ``,
    `📱 Phone: ${phone}`,
    `🔑 Password: ${password}`,
    ``,
  ];

  if (customerPortalUrl) {
    lines.push(
      `Please log in at our customer portal to track your vehicle:`,
      `${customerPortalUrl}`,
      ``
    );
  }

  lines.push(
    `Please change your password after first login for security.`,
    ``,
    `Thank you for choosing ${businessName}! 🚗`,
    `We look forward to serving you.`
  );

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
