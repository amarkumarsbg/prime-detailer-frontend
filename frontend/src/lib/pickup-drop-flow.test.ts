import { describe, expect, it } from "vitest";
import {
  groupPickupDropByJob,
  jobDeclinesDropOff,
  jobHasDropIntent,
  jobNeedsDropOffForm,
  nextPickupDropStatus,
  orphanPickupRequestIdForJob,
  pickupDropDisplayLabel,
  validatePickupDropAdvance,
} from "./pickup-drop-flow";
import type { JobCard, PickupDropRequest } from "@/types";

describe("nextPickupDropStatus", () => {
  it("keeps pickup flow unchanged", () => {
    expect(nextPickupDropStatus("PICKUP", "PENDING")).toBe("DRIVER_ASSIGNED");
    expect(nextPickupDropStatus("PICKUP", "DRIVER_ASSIGNED")).toBe("PICKED_UP");
    expect(nextPickupDropStatus("PICKUP", "PICKED_UP")).toBe("IN_SERVICE");
  });

  it("uses dedicated drop flow without workshop action step", () => {
    expect(nextPickupDropStatus("DROP", "PENDING")).toBe("DRIVER_ASSIGNED");
    expect(nextPickupDropStatus("DROP", "DRIVER_ASSIGNED")).toBe("DELIVERED");
  });

  it("supports legacy drop rows that are already in service", () => {
    expect(nextPickupDropStatus("DROP", "IN_SERVICE")).toBe("DELIVERED");
  });
});

describe("drop delivery is blocked until the job is ready", () => {
  const dropReq = {
    id: "pd-drop",
    jobCardId: "jc-1",
    jobNumber: "JC-001",
    type: "DROP",
    customerName: "Test",
    address: "Noida",
    scheduledTime: "2026-08-18T10:00:00.000Z",
    driverId: "drv-1",
    driverName: "Driver",
    status: "DRIVER_ASSIGNED",
    branchId: "br-1",
    createdAt: "2026-08-18T09:00:00.000Z",
    updatedAt: "2026-08-18T09:00:00.000Z",
  } as PickupDropRequest;

  const pickupAtWorkshop = {
    ...dropReq,
    id: "pd-pickup",
    type: "PICKUP",
    status: "IN_SERVICE",
  } as PickupDropRequest;

  it("blocks drop-off while the job is still in the workshop", () => {
    const job = { id: "jc-1", status: "AWAITING_SERVICE" } as JobCard;
    expect(
      validatePickupDropAdvance(dropReq, { job, requests: [pickupAtWorkshop, dropReq] })
    ).toMatch(/under maintenance/i);
  });

  it("allows drop-off after the job is Ready", () => {
    const job = { id: "jc-1", status: "READY" } as JobCard;
    expect(
      validatePickupDropAdvance(dropReq, { job, requests: [pickupAtWorkshop, dropReq] })
    ).toBeNull();
  });

  it("allows drop-off complete when the job is already delivered at the workshop", () => {
    const job = { id: "jc-1", status: "DELIVERED" } as JobCard;
    expect(
      validatePickupDropAdvance(dropReq, { job, requests: [pickupAtWorkshop, dropReq] })
    ).toBeNull();
  });

  it("shows At workshop for pickup in service, not delivered", () => {
    expect(pickupDropDisplayLabel(pickupAtWorkshop, [pickupAtWorkshop, dropReq])).toBe(
      "At workshop"
    );
  });

  it("does not show drop as delivered while the job is still in the workshop", () => {
    const deliveredTooEarly = { ...dropReq, status: "DELIVERED" as const };
    const job = { id: "jc-1", status: "AWAITING_SERVICE" } as JobCard;
    expect(
      pickupDropDisplayLabel(deliveredTooEarly, [pickupAtWorkshop, deliveredTooEarly], job)
    ).toBe("Waiting for workshop");
  });
});

describe("booking drop intent helpers", () => {
  const baseJob = {
    notes: "",
    reportedIssues: "",
  } as JobCard;

  it("detects explicit drop-off decline from booking notes", () => {
    expect(jobDeclinesDropOff({ ...baseJob, notes: "Drop-off required: No" })).toBe(true);
    expect(jobDeclinesDropOff({ ...baseJob, notes: "Drop-off required: Yes" })).toBe(false);
  });

  it("detects drop-off intent from booking notes", () => {
    expect(jobHasDropIntent({ ...baseJob, notes: "Drop-off required: Yes" }, [])).toBe(true);
    expect(jobHasDropIntent({ ...baseJob, notes: "Drop-off required: No" }, [])).toBe(false);
  });

  it("asks for a drop-off form when a return trip is already queued", () => {
    const job = { id: "jc-1", notes: "" } as JobCard;
    const drop = {
      id: "pd-drop",
      jobCardId: "jc-1",
      type: "DROP",
      status: "DRIVER_ASSIGNED",
    } as PickupDropRequest;
    expect(jobNeedsDropOffForm(job, [drop])).toBe(true);
  });

  it("finds a NEW pickup group for a job created with the same phone", () => {
    const job = {
      id: "jc-new",
      jobNumber: "JC-2026-0111",
      customerPhone: "7004509790",
      vehicleRegNumber: "JH19A1234",
    } as JobCard;
    const pickup = {
      id: "PND-2026-0007",
      jobCardId: "new-abc",
      jobNumber: "NEW",
      type: "PICKUP",
      customerPhone: "7004509790",
      vehicleRegNumber: "KI7A3421",
      createdAt: "2026-08-18T12:00:00.000Z",
    } as PickupDropRequest;
    expect(orphanPickupRequestIdForJob(job, [pickup])).toBe("PND-2026-0007");
  });
});

describe("groupPickupDropByJob", () => {
  const base = {
    customerName: "Test",
    address: "Noida",
    scheduledTime: "2026-08-18T10:00:00.000Z",
    branchId: "br-1",
    updatedAt: "2026-08-18T09:00:00.000Z",
  };

  it("keeps a new pickup and drop-off as one card", () => {
    const jobCardId = "new-abc";
    const pickup = {
      ...base,
      id: "pnd-1",
      jobCardId,
      jobNumber: "NEW",
      type: "PICKUP",
      status: "PENDING",
      createdAt: "2026-08-18T12:00:00.000Z",
    } as PickupDropRequest;
    const drop = {
      ...pickup,
      id: "pnd-2",
      type: "DROP",
    } as PickupDropRequest;

    const groups = groupPickupDropByJob([pickup, drop]);
    expect(groups).toHaveLength(1);
    expect(groups[0].pickup?.id).toBe("pnd-1");
    expect(groups[0].drop?.id).toBe("pnd-2");
  });

  it("puts the newest request first even if an older job is scheduled later", () => {
    const older = {
      ...base,
      id: "pnd-old",
      jobCardId: "jc-old",
      jobNumber: "JC-2026-0110",
      type: "PICKUP",
      status: "IN_SERVICE",
      scheduledTime: "2026-08-29T11:53:00.000Z",
      createdAt: "2026-08-12T09:00:00.000Z",
    } as PickupDropRequest;
    const newer = {
      ...base,
      id: "pnd-new",
      jobCardId: "new-xyz",
      jobNumber: "NEW",
      type: "PICKUP",
      status: "PENDING",
      scheduledTime: "2026-08-18T12:00:00.000Z",
      createdAt: "2026-08-18T12:05:00.000Z",
    } as PickupDropRequest;

    const groups = groupPickupDropByJob([older, newer]);
    expect(groups.map((g) => g.jobCardId)).toEqual(["new-xyz", "jc-old"]);
  });
});
