import { describe, expect, it } from "vitest";
import {
  findOpenPaymentRemindersForInvoice,
  paymentReminderDedupeKey,
  planPaymentReminderForInvoice,
} from "@/lib/reminder-payment";
import { nextDueDate, periodKey } from "@/lib/reminder-schedule";
import type { Invoice, ServiceReminder } from "@/types";
import type { SchedulableReminderFrequency } from "@/lib/reminder-schedule";

function baseInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-0001",
    jobNumber: "JC-001",
    customerId: "cust-1",
    customerName: "Ada",
    customerPhone: "999",
    vehicleRegNumber: "KA01AB1234",
    lineItems: [],
    subtotal: 1000,
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    grandTotal: 1000,
    status: "ISSUED",
    payments: [],
    createdAt: "2026-08-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("planPaymentReminderForInvoice", () => {
  it("creates PAYMENT reminder for unpaid invoice", () => {
    const result = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [],
      partyId: "party-1",
      vehicleId: "veh-1",
    });
    expect(result.action).toBe("create");
    if (result.action !== "create") return;
    expect(result.reminder.kind).toBe("PAYMENT");
    expect(result.reminder.invoiceId).toBe("inv-1");
    expect(result.reminder.invoiceNumber).toBe("INV-2026-0001");
    expect(result.reminder.outstandingAmount).toBe(1000);
    expect(result.reminder.partyId).toBe("party-1");
    expect(result.reminder.dueDate).toBe("2026-09-21");
    expect(result.reminder.periodKey).toBe(periodKey("2026-09-21", "MONTHLY"));
    expect(result.reminder.nextDueDate).toBe(nextDueDate("2026-09-21", "MONTHLY"));
    expect(result.reminder.isHighEndService).toBe(false);
  });

  it.each([
    ["WEEKLY", "2026-08-28"],
    ["MONTHLY", "2026-09-21"],
    ["QUARTERLY", "2026-11-21"],
    ["BIANNUAL", "2027-02-21"],
    ["YEARLY", "2027-08-21"],
  ] as const)("frequency %s → due %s", (frequency, due) => {
    const result = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 500,
      frequency: frequency as SchedulableReminderFrequency,
      leadDays: 7,
      existing: [],
    });
    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.reminder.dueDate).toBe(due);
      expect(result.reminder.frequency).toBe(frequency);
    }
  });

  it("updates outstandingAmount on partial payment without duplicating", () => {
    const first = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [],
    });
    expect(first.action).toBe("create");
    if (first.action !== "create") return;

    const second = planPaymentReminderForInvoice({
      invoice: baseInvoice({ status: "PARTIALLY_PAID" }),
      outstanding: 400,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [first.reminder],
    });
    expect(second.action).toBe("update");
    if (second.action !== "update") return;
    expect(second.reminder.id).toBe(first.reminder.id);
    expect(second.reminder.outstandingAmount).toBe(400);
    expect(second.reminder.status).not.toBe("COMPLETED");
  });

  it("marks open PAYMENT reminders COMPLETED when outstanding is 0", () => {
    const open: ServiceReminder = {
      id: "rem-pay-1",
      kind: "PAYMENT",
      vehicleId: "veh-1",
      vehicleRegNumber: "KA01AB1234",
      vehicleMakeModel: "Swift",
      customerId: "cust-1",
      customerName: "Ada",
      customerPhone: "999",
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      dueDate: "2026-09-21",
      periodKey: "2026-09",
      status: "UPCOMING",
      isHighEndService: false,
      invoiceId: "inv-1",
      invoiceNumber: "INV-2026-0001",
      outstandingAmount: 400,
      whatsappSent: false,
    };
    const result = planPaymentReminderForInvoice({
      invoice: baseInvoice({ status: "PAID" }),
      outstanding: 0,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [open],
    });
    expect(result.action).toBe("complete");
    if (result.action !== "complete") return;
    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].status).toBe("COMPLETED");
    expect(result.reminders[0].outstandingAmount).toBe(0);
  });

  it("noop on refresh when open reminder already matches", () => {
    const created = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [],
    });
    expect(created.action).toBe("create");
    if (created.action !== "create") return;

    const again = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [created.reminder],
    });
    expect(again.action).toBe("noop");
    if (again.action !== "noop") return;
    expect(again.reminder.id).toBe(created.reminder.id);
  });

  it("skips DRAFT invoices", () => {
    const result = planPaymentReminderForInvoice({
      invoice: baseInvoice({ status: "DRAFT" }),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [],
    });
    expect(result.action).toBe("skip");
  });

  it("does not touch SERVICE reminders", () => {
    const service: ServiceReminder = {
      id: "rem-svc-1",
      kind: "SERVICE",
      vehicleId: "veh-1",
      vehicleRegNumber: "KA01AB1234",
      vehicleMakeModel: "Swift",
      customerId: "cust-1",
      customerName: "Ada",
      customerPhone: "999",
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      dueDate: "2026-09-21",
      status: "UPCOMING",
      isHighEndService: false,
      whatsappSent: false,
    };
    const result = planPaymentReminderForInvoice({
      invoice: baseInvoice(),
      outstanding: 1000,
      frequency: "MONTHLY",
      leadDays: 7,
      existing: [service],
    });
    expect(result.action).toBe("create");
    expect(findOpenPaymentRemindersForInvoice([service], "inv-1")).toHaveLength(0);
    expect(paymentReminderDedupeKey("inv-1", "2026-09")).toBe("inv-1|2026-09");
  });
});
