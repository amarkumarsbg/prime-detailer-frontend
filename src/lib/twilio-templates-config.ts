/**
 * TWILIO WHATSAPP CONTENT API CONFIGURATION
 * 
 * Replace the empty strings below with the actual `HX...` template SIDs from your Twilio Console.
 * If you only have one template approved, you can map multiple app events to the same SID,
 * or leave the others empty (which will fall back to the old string-based message format).
 */

export const TWILIO_TEMPLATE_SIDS = {
  // Example SID from your prompt: "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  STATUS_UPDATE: "", 
  BOOKING_CONFIRMATION: "",
  QUOTATION_READY: "",
  INVOICE_READY: "",
  PAYMENT_RECEIVED: "",
  SERVICE_REMINDER: "",
};

/**
 * Helper to build the contentVariables map exactly as your Twilio template expects them.
 * Modify the keys ("1", "2") to match how you defined the placeholders {{1}}, {{2}} in Twilio.
 */
export function buildStatusUpdateVariables(
  customerName: string,
  jobNumber: string,
  statusLabel: string,
  vehicleStr: string,
  serviceName: string,
  customerPhone: string,
  couponCode: string = ""
): Record<string, string> {
  return {
    "1": customerName,
    "2": jobNumber,
    "3": statusLabel,
    "4": vehicleStr,
    "5": serviceName,
    "6": customerPhone,
    "7": couponCode
  };
}
