import { describe, expect, it } from "vitest";
import {
  advancePaymentReminderAfterSend,
  alreadySentForCurrentPeriod,
  markReminderSentForPeriod,
  selectRemindersForAutoWhatsApp,
} from "@/lib/reminder-auto-whatsapp";
import { nextDueDate, periodKey } from "@/lib/reminder-schedule";
import type { ServiceReminder } from "@/types";

function serviceReminder(overrides: Partial<ServiceReminder> = {}): ServiceReminder {
  return {
    id: "rem-svc-1",
    kind: "SERVICE",
    vehicleId: "veh-1",
    vehicleRegNumber: "KA01AB1234",
    vehicleMakeModel: "Swift",
    customerId: "cust-1",
    customerName: "Ada Lovelace",
    customerPhone: "9999999999",
    type: "GENERAL_SERVICE",
    frequency: "MONTHLY",
    dueDate: "2026-08-21",
    periodKey: "2026-08",
    status: "DUE",
    isHighEndService: false,
    whatsappSent: false,
    ...overrides,
  };
}

function paymentReminder(overrides: Partial<ServiceReminder> = {}): ServiceReminder {
  return {
    id: "rem-pay-1",
    kind: "PAYMENT",
    vehicleId: "veh-1",
    vehicleRegNumber: "KA01AB1234",
    vehicleMakeModel: "Swift",
    customerId: "cust-1",
    customerName: "Ada Lovelace",
    customerPhone: "9999999999",
    type: "GENERAL_SERVICE",
    frequency: "MONTHLY",
    dueDate: "2026-08-21",
    periodKey: "2026-08",
    status: "DUE",
    isHighEndService: false,
    invoiceId: "inv-1",
    invoiceNumber: "INV-2026-0001",
    outstandingAmount: 1500,
    whatsappSent: false,
    ...overrides,
  };
}

describe("selectRemindersForAutoWhatsApp", () => {
  it("WhatsApp disabled → no auto send", () => {
    const selected = selectRemindersForAutoWhatsApp(
      [serviceReminder(), paymentReminder()],
      { whatsappReminderEnabled: false }
    );
    expect(selected).toEqual([]);
  });

  it("DUE → send", () => {
    const selected = selectRemindersForAutoWhatsApp([serviceReminder({ status: "DUE" })], {
      whatsappReminderEnabled: true,
    });
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe("rem-svc-1");
  });

  it("OVERDUE → send", () => {
    const selected = selectRemindersForAutoWhatsApp(
      [paymentReminder({ status: "OVERDUE" })],
      { whatsappReminderEnabled: true }
    );
    expect(selected).toHaveLength(1);
  });

  it("UPCOMING → no send", () => {
    const selected = selectRemindersForAutoWhatsApp(
      [serviceReminder({ status: "UPCOMING" })],
      { whatsappReminderEnabled: true }
    );
    expect(selected).toEqual([]);
  });

  it("Same period → no duplicate", () => {
    const sent = serviceReminder({
      lastMessageSentAt: "2026-08-20T10:00:00.000Z",
      whatsappSent: true,
    });
    expect(alreadySentForCurrentPeriod(sent)).toBe(true);
    const selected = selectRemindersForAutoWhatsApp([sent], {
      whatsappReminderEnabled: true,
    });
    expect(selected).toEqual([]);
  });

  it("Payment fully paid → no send", () => {
    const paid = paymentReminder({ outstandingAmount: 0 });
    const selected = selectRemindersForAutoWhatsApp([paid], {
      whatsappReminderEnabled: true,
      getOutstanding: () => 0,
    });
    expect(selected).toEqual([]);
  });

  it("Payment fully paid via live outstanding → no send", () => {
    const selected = selectRemindersForAutoWhatsApp(
      [paymentReminder({ outstandingAmount: 900 })],
      {
        whatsappReminderEnabled: true,
        getOutstanding: (id) => (id === "inv-1" ? 0 : undefined),
      }
    );
    expect(selected).toEqual([]);
  });
});

describe("advancePaymentReminderAfterSend", () => {
  it("Payment still outstanding → next period advanced", () => {
    const rem = paymentReminder({
      dueDate: "2026-08-21",
      periodKey: "2026-08",
      lastMessageSentAt: "2026-08-21T12:00:00.000Z",
      whatsappSent: true,
    });
    const advanced = advancePaymentReminderAfterSend(rem, {
      leadDays: 7,
      outstanding: 800,
      now: new Date("2026-08-21T12:00:00"),
    });
    expect(advanced).not.toBeNull();
    if (!advanced) return;
    expect(advanced.dueDate).toBe(nextDueDate("2026-08-21", "MONTHLY"));
    expect(advanced.periodKey).toBe(periodKey(advanced.dueDate, "MONTHLY"));
    expect(advanced.outstandingAmount).toBe(800);
    expect(advanced.lastMessageSentAt).toBeUndefined();
    expect(advanced.whatsappSent).toBe(false);
    expect(advanced.status).toBe("UPCOMING");
  });

  it("fully paid → no advance", () => {
    expect(
      advancePaymentReminderAfterSend(paymentReminder(), {
        leadDays: 7,
        outstanding: 0,
      })
    ).toBeNull();
  });
});

describe("markReminderSentForPeriod", () => {
  it("records send for current period", () => {
    const marked = markReminderSentForPeriod(
      serviceReminder(),
      "2026-08-21T15:00:00.000Z"
    );
    expect(marked.lastMessageSentAt).toBe("2026-08-21T15:00:00.000Z");
    expect(marked.whatsappSent).toBe(true);
    expect(alreadySentForCurrentPeriod(marked)).toBe(true);
  });
});
