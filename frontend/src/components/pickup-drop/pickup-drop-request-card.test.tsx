/* @vitest-environment jsdom */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PickupDropRequestCard } from "./pickup-drop-request-card";
import type { PickupDropRequest } from "@/types";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("@/components/pickup-drop/pickup-driver-select", () => ({
  PickupDriverSelect: () => <div data-testid="driver-select" />,
}));

function makeRequest(overrides: Partial<PickupDropRequest>): PickupDropRequest {
  return {
    id: "pd-1",
    jobCardId: "jc-1",
    jobNumber: "JC-001",
    type: "PICKUP",
    customerName: "Test Customer",
    vehicleMakeModel: "Honda City",
    vehicleRegNumber: "DL01AB1234",
    customerPhone: "9999999999",
    address: "Noida",
    scheduledTime: "2026-08-12T10:00:00.000Z",
    driverId: "drv-1",
    driverName: "Driver One",
    status: "PENDING",
    notes: "",
    branchId: "br-1",
    createdAt: "2026-08-12T09:00:00.000Z",
    updatedAt: "2026-08-12T09:00:00.000Z",
    ...overrides,
  };
}

describe("PickupDropRequestCard action labels", () => {
  const noop = vi.fn();

  it("shows Drop-off complete for DROP after driver assignment", () => {
    const req = makeRequest({ type: "DROP", status: "DRIVER_ASSIGNED" });

    render(
      <PickupDropRequestCard
        request={req}
        allRequests={[req]}
        branchScoped={false}
        hasPhone={true}
        onAssignDriver={noop}
        onAdvance={noop}
        onWhatsApp={noop}
      />
    );

    expect(screen.getByRole("button", { name: "Drop-off complete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "At workshop" })).toBeNull();
  });

  it("keeps At workshop action for PICKUP when next step is IN_SERVICE", () => {
    const req = makeRequest({ type: "PICKUP", status: "PICKED_UP" });

    render(
      <PickupDropRequestCard
        request={req}
        allRequests={[req]}
        branchScoped={false}
        hasPhone={true}
        onAssignDriver={noop}
        onAdvance={noop}
        onWhatsApp={noop}
      />
    );

    expect(screen.getByRole("button", { name: "At workshop" })).toBeInTheDocument();
  });
});
