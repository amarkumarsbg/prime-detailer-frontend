import { describe, expect, it } from "vitest";
import { topServicesByRevenue } from "@/lib/analytics/compute-metrics";
import type { JobCard } from "@/types";

function makeJobCard(
  id: string,
  status: JobCard["status"],
  serviceName: string,
  price: number
): JobCard {
  return {
    id,
    jobNumber: `JC-${id}`,
    branchId: "br-1",
    customerId: "c-1",
    customerName: "Customer",
    customerPhone: "9000000000",
    vehicleId: "v-1",
    vehicleRegNumber: "DL01AA0001",
    vehicleMakeModel: "Car",
    vehicleSegment: "SEDAN",
    status,
    reportedIssues: "",
    expectedDelivery: "2026-08-10T18:00:00.000Z",
    services: [
      {
        id: `svc-${id}`,
        jobCardId: id,
        serviceCatalogId: `cat-${id}`,
        name: serviceName,
        price,
        isCompleted: false,
      },
    ],
    estimatedAmount: price,
    incentivePercent: 0,
    incentiveAmount: 0,
    createdBy: "u1",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
  };
}

describe("topServicesByRevenue", () => {
  it("ignores cancelled job cards", () => {
    const start = new Date("2026-08-01T00:00:00.000Z");
    const end = new Date("2026-08-31T23:59:59.999Z");
    const rows = topServicesByRevenue(
      [
        makeJobCard("1", "DELIVERED", "PPF", 5000),
        makeJobCard("2", "CANCELLED", "PPF", 9000),
        makeJobCard("3", "READY", "Wash", 1200),
      ],
      start,
      10,
      end
    );

    expect(rows).toEqual([
      { name: "PPF", bookings: 1, revenue: 5000 },
      { name: "Wash", bookings: 1, revenue: 1200 },
    ]);
  });
});