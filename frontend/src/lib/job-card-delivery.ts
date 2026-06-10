import type { JobCard } from "@/types";

/** ISO timestamp used for sorting the Delivery column (actual if delivered, else expected). */
export function jobCardDeliveryAt(jc: JobCard): string {
  if (jc.status === "DELIVERED") {
    return jc.actualDelivery ?? jc.updatedAt ?? jc.createdAt;
  }
  return jc.expectedDelivery ?? jc.createdAt;
}
