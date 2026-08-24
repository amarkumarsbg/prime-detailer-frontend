import type { Customer, Vehicle } from "@/types";
import { formatDate } from "@/lib/utils";

export type OwnershipTimelineItem =
  | {
      kind: "owner";
      customerId: string;
      name: string;
      detailLine: string;
      isCurrent: boolean;
    }
  | {
      kind: "transfer";
      transferredOn: string;
      reason?: string;
    };

/** Tag when this customer is the transferee (current owner after at least one transfer). */
export function getTransferTagForCustomer(
  vehicle: Vehicle,
  customerId: string
): { fromCustomerName: string; formattedDate: string } | null {
  if (vehicle.customerId !== customerId) return null;
  const prev = vehicle.previousOwners;
  if (!prev?.length) return null;
  const last = prev[prev.length - 1];
  return {
    fromCustomerName: last.customerName,
    formattedDate: formatDate(last.transferDate),
  };
}

function ownerDetailLine(
  vehicle: Vehicle,
  customers: Customer[],
  prev: NonNullable<Vehicle["previousOwners"]>,
  index: number
): string {
  if (index === 0) {
    const cust = customers.find((c) => c.id === prev[0].customerId);
    const from = cust?.createdAt ? formatDate(cust.createdAt) : `~${vehicle.year}`;
    return `Original Owner · from ${from}`;
  }
  return `Previous Owner · since ${formatDate(prev[index - 1].transferDate)}`;
}

export function buildOwnershipTimeline(
  vehicle: Vehicle,
  customers: Customer[]
): OwnershipTimelineItem[] | null {
  const prev = vehicle.previousOwners ?? [];
  if (prev.length === 0) return null;

  const items: OwnershipTimelineItem[] = [];

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    items.push({
      kind: "owner",
      customerId: p.customerId,
      name: p.customerName,
      detailLine: ownerDetailLine(vehicle, customers, prev, i),
      isCurrent: false,
    });
    items.push({
      kind: "transfer",
      transferredOn: p.transferDate,
      reason: p.reason,
    });
  }

  items.push({
    kind: "owner",
    customerId: vehicle.customerId,
    name: vehicle.customerName,
    detailLine: `Current Owner · since ${formatDate(prev[prev.length - 1].transferDate)}`,
    isCurrent: true,
  });

  return items;
}
