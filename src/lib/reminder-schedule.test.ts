import { describe, expect, it } from "vitest";
import {
  computeReminderStatus,
  nextDueDate,
  normalizeReminderKind,
  normalizeServiceReminder,
  parseReminderFrequency,
  periodKey,
} from "@/lib/reminder-schedule";
import type { ServiceReminder } from "@/types";

describe("nextDueDate", () => {
  it("advances weekly by 7 days", () => {
    expect(nextDueDate("2026-08-21", "WEEKLY")).toBe("2026-08-28");
  });

  it("advances monthly including month-end clamp", () => {
    expect(nextDueDate("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(nextDueDate("2026-08-21", "MONTHLY")).toBe("2026-09-21");
  });

  it("advances quarterly, biannual, yearly", () => {
    expect(nextDueDate("2026-08-21", "QUARTERLY")).toBe("2026-11-21");
    expect(nextDueDate("2026-08-21", "BIANNUAL")).toBe("2027-02-21");
    expect(nextDueDate("2026-08-21", "YEARLY")).toBe("2027-08-21");
  });

  it("rejects CUSTOM", () => {
    expect(() => nextDueDate("2026-08-21", "CUSTOM")).toThrow(/CUSTOM/);
  });
});

describe("periodKey", () => {
  it("builds monthly / quarterly / half-year / yearly keys", () => {
    expect(periodKey("2026-08-21", "MONTHLY")).toBe("2026-08");
    expect(periodKey("2026-08-21", "QUARTERLY")).toBe("2026-Q3");
    expect(periodKey("2026-02-01", "BIANNUAL")).toBe("2026-H1");
    expect(periodKey("2026-08-21", "BIANNUAL")).toBe("2026-H2");
    expect(periodKey("2026-08-21", "YEARLY")).toBe("2026");
  });

  it("builds weekly keys", () => {
    expect(periodKey("2026-08-21", "WEEKLY")).toMatch(/^2026-W\d{2}$/);
  });
});

describe("computeReminderStatus", () => {
  it("uses lead days window", () => {
    expect(computeReminderStatus("2026-08-28", 7, new Date("2026-08-21T12:00:00"))).toBe("DUE");
    expect(computeReminderStatus("2026-09-10", 7, new Date("2026-08-21T12:00:00"))).toBe(
      "UPCOMING"
    );
    expect(computeReminderStatus("2026-08-01", 7, new Date("2026-08-21T12:00:00"))).toBe(
      "OVERDUE"
    );
  });
});

describe("parseReminderFrequency", () => {
  it("maps aliases including half-yearly", () => {
    expect(parseReminderFrequency("HALF_YEARLY")).toBe("BIANNUAL");
    expect(parseReminderFrequency("6months")).toBe("BIANNUAL");
    expect(parseReminderFrequency("3months")).toBe("QUARTERLY");
    expect(parseReminderFrequency("weekly")).toBe("WEEKLY");
  });
});

describe("normalizeServiceReminder", () => {
  it("defaults missing kind to SERVICE and fills periodKey", () => {
    const raw = {
      id: "r1",
      vehicleId: "v1",
      vehicleRegNumber: "KA01",
      vehicleMakeModel: "Swift",
      customerId: "c1",
      customerName: "A",
      customerPhone: "1",
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      dueDate: "2026-08-21",
      status: "UPCOMING",
      isHighEndService: false,
    } as ServiceReminder;
    const n = normalizeServiceReminder(raw);
    expect(normalizeReminderKind(n.kind)).toBe("SERVICE");
    expect(n.kind).toBe("SERVICE");
    expect(n.periodKey).toBe("2026-08");
  });

  it("preserves PAYMENT kind", () => {
    const raw = {
      id: "r2",
      kind: "PAYMENT",
      vehicleId: "",
      vehicleRegNumber: "",
      vehicleMakeModel: "",
      customerId: "c1",
      customerName: "A",
      customerPhone: "1",
      type: "GENERAL_SERVICE",
      frequency: "WEEKLY",
      dueDate: "2026-08-21",
      status: "DUE",
      isHighEndService: false,
      invoiceId: "inv-1",
    } as ServiceReminder;
    expect(normalizeServiceReminder(raw).kind).toBe("PAYMENT");
  });
});
