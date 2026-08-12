import type { PickupDropStatus, PickupDropType } from "@/types";

/** Type-specific label for advancing pickup/drop requests in UI action buttons. */
export function pickupAdvanceActionLabel(
  type: PickupDropType,
  nextStatus: PickupDropStatus
): string {
  if (type === "DROP") {
    switch (nextStatus) {
      case "DRIVER_ASSIGNED":
        return "Assign driver";
      case "DELIVERED":
      case "IN_SERVICE":
        return "Drop-off complete";
      default:
        return nextStatus;
    }
  }

  switch (nextStatus) {
    case "DRIVER_ASSIGNED":
      return "Assign driver";
    case "PICKED_UP":
      return "Mark picked up";
    case "IN_SERVICE":
      return "At workshop";
    case "DELIVERED":
      return "Complete";
    default:
      return nextStatus;
  }
}
