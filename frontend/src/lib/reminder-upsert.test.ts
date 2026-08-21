import { describe, expect, it } from "vitest";
import {
  mapServiceToReminderType,
  reminderTypesFromJobServices,
} from "@/lib/reminder-service-map";
import {
  findOpenServiceCategoryReminder,
  planCategoryRemindersForDeliveredJob,
  planServiceCategoryReminderUpsert,
  serviceReminderDedupeKey,
} from "@/lib/reminder-upsert";
import { nextDueDate, periodKey } from "@/lib/reminder-schedule";
import type { JobCard, ServiceCatalogItem, ServiceReminder } from "@/types";
import {
  DEFAULT_REMINDER_CATEGORY_FREQUENCIES,
  type SerializableAppSettings,
} from "@/store/settings-store";
import type { SchedulableReminderFrequency } from "@/lib/reminder-schedule";

function baseJob(overrides: Partial<JobCard> = {}): JobCard {
  return {
    id: "jc-1",
    jobNumber: "JC-001",
    customerId: "cust-1",
    customerName: "Ada",
    customerPhone: "999",
    vehicleId: "veh-1",
    vehicleRegNumber: "KA01AB1234",
    vehicleMakeModel: "Swift",
    status: "DELIVERED",
    services: [
      {
        id: "line-1",
        jobCardId: "jc-1",
        serviceCatalogId: "srv-wash",
        name: "Exterior wash",
        price: 950,
        isCompleted: true,
      },
    ],
    parts: [],
    createdAt: "2026-08-21T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    ...overrides,
  } as JobCard;
}

const washCatalog: ServiceCatalogItem = {
  id: "srv-wash",
  name: "Exterior wash",
  description: "",
  defaultPrice: 950,
  segmentPricing: {
    HATCHBACK: 950,
    SEDAN: 950,
    SUV: 950,
    LUXURY: 950,
    MUV: 950,
    COMPACT_SUV: 950,
    BIKE: 950,
  },
  category: "cat-001",
  isActive: true,
  isHighEnd: false,
  incentivePercent: 0,
};

const oilCatalog: ServiceCatalogItem = {
  ...washCatalog,
  id: "srv-oil",
  name: "Engine oil change",
  category: "cat-004",
};

const ppfCatalog: ServiceCatalogItem = {
  ...washCatalog,
  id: "srv-ppf",
  name: "Full body PPF",
  category: "cat-003",
  isHighEnd: true,
};

const categories = [
  { id: "cat-001", name: "Wash & foam", slug: "wash" },
  { id: "cat-003", name: "Paint protection", slug: "ppf" },
  { id: "cat-004", name: "Engine bay", slug: "engine" },
];

const settingsBase: Pick<
  SerializableAppSettings,
  "reminderLeadDays" | "reminderCategoryFrequencies"
> = {
  reminderLeadDays: 7,
  reminderCategoryFrequencies: { ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES },
};

describe("mapServiceToReminderType", () => {
  it("maps wash / general service names to GENERAL_SERVICE", () => {
    expect(mapServiceToReminderType({ name: "Exterior wash" })).toBe("GENERAL_SERVICE");
    expect(mapServiceToReminderType({ name: "General Service" })).toBe("GENERAL_SERVICE");
  });

  it("maps oil, brake, tire, ac, battery, insurance, puc", () => {
    expect(mapServiceToReminderType({ name: "Oil Change" })).toBe("OIL_CHANGE");
    expect(mapServiceToReminderType({ name: "Brake pads" })).toBe("BRAKE_INSPECTION");
    expect(mapServiceToReminderType({ name: "Tire rotation" })).toBe("TIRE_ROTATION");
    expect(mapServiceToReminderType({ name: "AC service" })).toBe("AC_SERVICE");
    expect(mapServiceToReminderType({ name: "Battery check" })).toBe("BATTERY_CHECK");
    expect(mapServiceToReminderType({ name: "Insurance renewal" })).toBe("INSURANCE");
    expect(mapServiceToReminderType({ name: "PUC certificate" })).toBe("PUC");
  });

  it("skips high-end and PPF/Ceramic", () => {
    expect(mapServiceToReminderType({ name: "PPF install", isHighEnd: true })).toBeNull();
    expect(mapServiceToReminderType({ name: "Ceramic coating" })).toBeNull();
    expect(mapServiceToReminderType({ categoryName: "Paint protection", categorySlug: "ppf" })).toBeNull();
  });
});

describe("planServiceCategoryReminderUpsert", () => {
  it("creates GENERAL_SERVICE reminder with monthly next due", () => {
    const job = baseJob();
    const result = planServiceCategoryReminderUpsert({
      job,
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      serviceDate: "2026-08-21T12:00:00.000Z",
      leadDays: 7,
      existing: [],
    });
    expect(result.action).toBe("create");
    if (result.action !== "create") return;
    expect(result.reminder.dueDate).toBe("2026-09-21");
    expect(result.reminder.nextDueDate).toBe(nextDueDate("2026-09-21", "MONTHLY"));
    expect(result.reminder.periodKey).toBe(periodKey("2026-09-21", "MONTHLY"));
    expect(result.reminder.kind).toBe("SERVICE");
    expect(result.reminder.frequency).toBe("MONTHLY");
    expect(result.reminder.isHighEndService).toBe(false);
    expect(result.reminder.lastJobCardId).toBe("jc-1");
  });

  it.each([
    ["WEEKLY", "2026-08-28"],
    ["MONTHLY", "2026-09-21"],
    ["QUARTERLY", "2026-11-21"],
    ["BIANNUAL", "2027-02-21"],
    ["YEARLY", "2027-08-21"],
  ] as const)("frequency %s → due %s", (frequency, due) => {
    const result = planServiceCategoryReminderUpsert({
      job: baseJob(),
      type: "GENERAL_SERVICE",
      frequency: frequency as SchedulableReminderFrequency,
      serviceDate: "2026-08-21",
      leadDays: 7,
      existing: [],
    });
    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.reminder.dueDate).toBe(due);
    }
  });

  it("does not duplicate when open reminder exists for same period", () => {
    const job = baseJob();
    const first = planServiceCategoryReminderUpsert({
      job,
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      serviceDate: "2026-08-21",
      leadDays: 7,
      existing: [],
    });
    expect(first.action).toBe("create");
    if (first.action !== "create") return;

    const second = planServiceCategoryReminderUpsert({
      job,
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      serviceDate: "2026-08-21",
      leadDays: 7,
      existing: [first.reminder],
    });
    expect(second.action).toBe("noop");
    expect(second.reminder.id).toBe(first.reminder.id);
  });

  it("updates open reminder when a later delivery moves the period", () => {
    const existing: ServiceReminder = {
      id: "rem-old",
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
      periodKey: "2026-09",
      lastServiceDate: "2026-08-21",
      lastJobCardId: "jc-1",
      status: "UPCOMING",
      isHighEndService: false,
      whatsappSent: false,
    };
    const result = planServiceCategoryReminderUpsert({
      job: baseJob({ id: "jc-2", jobNumber: "JC-002" }),
      type: "GENERAL_SERVICE",
      frequency: "MONTHLY",
      serviceDate: "2026-10-15",
      leadDays: 7,
      existing: [existing],
    });
    expect(result.action).toBe("update");
    if (result.action !== "update") return;
    expect(result.reminder.id).toBe("rem-old");
    expect(result.reminder.dueDate).toBe("2026-11-15");
    expect(result.reminder.lastJobCardId).toBe("jc-2");
  });
});

describe("planCategoryRemindersForDeliveredJob", () => {
  it("creates reminder from wash service on deliver", () => {
    const planned = planCategoryRemindersForDeliveredJob({
      job: baseJob(),
      serviceDateIso: "2026-08-21T12:00:00.000Z",
      settings: settingsBase,
      catalog: [washCatalog],
      categories,
      existingReminders: [],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].action).toBe("create");
    if (planned[0].action === "create") {
      expect(planned[0].reminder.type).toBe("GENERAL_SERVICE");
      expect(planned[0].reminder.dueDate).toBe("2026-09-21");
    }
  });

  it("maps oil service and respects category frequency override", () => {
    const job = baseJob({
      services: [
        {
          id: "line-oil",
          jobCardId: "jc-1",
          serviceCatalogId: "srv-oil",
          name: "Engine oil change",
          price: 1200,
          isCompleted: true,
        },
      ],
    });
    const planned = planCategoryRemindersForDeliveredJob({
      job,
      serviceDateIso: "2026-08-21",
      settings: {
        reminderLeadDays: 7,
        reminderCategoryFrequencies: {
          ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES,
          OIL_CHANGE: "QUARTERLY",
        },
      },
      catalog: [oilCatalog],
      categories,
      existingReminders: [],
    });
    expect(planned).toHaveLength(1);
    if (planned[0].action === "create") {
      expect(planned[0].reminder.type).toBe("OIL_CHANGE");
      expect(planned[0].reminder.frequency).toBe("QUARTERLY");
      expect(planned[0].reminder.dueDate).toBe("2026-11-21");
    }
  });

  it("skips high-end catalog lines (no category duplicate for PPF)", () => {
    const job = baseJob({
      services: [
        {
          id: "line-ppf",
          jobCardId: "jc-1",
          serviceCatalogId: "srv-ppf",
          name: "Full body PPF",
          price: 50000,
          isCompleted: true,
        },
      ],
      highEndServiceIds: ["hes-1"],
    });
    const planned = planCategoryRemindersForDeliveredJob({
      job,
      serviceDateIso: "2026-08-21",
      settings: settingsBase,
      catalog: [ppfCatalog],
      categories,
      existingReminders: [],
    });
    expect(planned).toHaveLength(0);
  });

  it("second deliver / refresh does not add another reminder", () => {
    const job = baseJob();
    const first = planCategoryRemindersForDeliveredJob({
      job,
      serviceDateIso: "2026-08-21",
      settings: settingsBase,
      catalog: [washCatalog],
      categories,
      existingReminders: [],
    });
    expect(first[0].action).toBe("create");
    const existing =
      first[0].action === "create" || first[0].action === "update" || first[0].action === "noop"
        ? [first[0].reminder]
        : [];
    const second = planCategoryRemindersForDeliveredJob({
      job,
      serviceDateIso: "2026-08-21",
      settings: settingsBase,
      catalog: [washCatalog],
      categories,
      existingReminders: existing,
    });
    expect(second[0].action).toBe("noop");
  });

  it("leaves legacy high-end CUSTOM reminders untouched", () => {
    const highEnd: ServiceReminder = {
      id: "rem-auto-1",
      kind: "SERVICE",
      vehicleId: "veh-1",
      vehicleRegNumber: "KA01AB1234",
      vehicleMakeModel: "Swift",
      customerId: "cust-1",
      customerName: "Ada",
      customerPhone: "999",
      type: "PPF_MAINTENANCE",
      frequency: "CUSTOM",
      dueDate: "2026-11-21",
      lastServiceDate: "2026-08-21",
      lastJobCardId: "jc-1",
      status: "UPCOMING",
      isHighEndService: true,
      intervalMonths: 3,
      whatsappSent: false,
    };
    const planned = planCategoryRemindersForDeliveredJob({
      job: baseJob(),
      serviceDateIso: "2026-08-21",
      settings: settingsBase,
      catalog: [washCatalog],
      categories,
      existingReminders: [highEnd],
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].action).toBe("create");
    expect(findOpenServiceCategoryReminder([highEnd], "cust-1", "veh-1", "GENERAL_SERVICE")).toBeUndefined();
    expect(
      serviceReminderDedupeKey({
        customerId: "cust-1",
        vehicleId: "veh-1",
        type: "GENERAL_SERVICE",
        periodKey: "2026-09",
      })
    ).toBe("cust-1|veh-1|GENERAL_SERVICE|2026-09");
  });
});

describe("reminderTypesFromJobServices", () => {
  it("dedupes types across lines", () => {
    const types = reminderTypesFromJobServices(
      [
        {
          id: "a",
          jobCardId: "jc-1",
          serviceCatalogId: "srv-wash",
          name: "Wash",
          price: 1,
          isCompleted: true,
        },
        {
          id: "b",
          jobCardId: "jc-1",
          serviceCatalogId: "srv-wash",
          name: "Foam wash",
          price: 1,
          isCompleted: true,
        },
      ],
      new Map([["srv-wash", washCatalog]]),
      new Map([["cat-001", { name: "Wash & foam", slug: "wash" }]])
    );
    expect(types).toEqual(["GENERAL_SERVICE"]);
  });
});
