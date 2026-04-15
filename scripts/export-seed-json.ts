/**
 * Regenerates backend/prisma/seed-data.json from frontend mock-data.
 * Run from repo root: npx tsx scripts/export-seed-json.ts
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { branches } from "../src/lib/mock-data/branches.ts";
import { staff } from "../src/lib/mock-data/staff.ts";
import { customers } from "../src/lib/mock-data/customers.ts";
import { vehicles } from "../src/lib/mock-data/vehicles.ts";
import { jobCards } from "../src/lib/mock-data/job-cards.ts";
import { invoices } from "../src/lib/mock-data/invoices.ts";
import { quotations } from "../src/lib/mock-data/quotations.ts";
import { appointments } from "../src/lib/mock-data/appointments.ts";
import { expenses } from "../src/lib/mock-data/expenses.ts";
import { activityLogs } from "../src/lib/mock-data/activity-log.ts";
import { serviceReminders } from "../src/lib/mock-data/reminders.ts";
import { walletTransactions } from "../src/lib/mock-data/wallet-transactions.ts";
import { serviceCatalog } from "../src/lib/mock-data/services.ts";
import { parts, stockMovements, productPurchases } from "../src/lib/mock-data/inventory.ts";
import { followUps } from "../src/lib/mock-data/follow-ups.ts";
import { dashboardStats } from "../src/lib/mock-data/dashboard.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "../backend/prisma/seed-data.json");

const expenseMeta = {
  customCategories: [] as string[],
  categoryDescriptions: {} as Record<string, string>,
  vendorSuggestions: ["Urban Spaces Realty", "BESCOM", "AutoCare Wholesale"],
  vendorDirectory: [] as unknown[],
};

const collections = {
  jobCards,
  invoices,
  quotations,
  appointments,
  expenses,
  activityLogs,
  serviceReminders,
  walletTransactions,
  serviceCatalog,
  parts,
  stockMovements,
  productPurchases,
  followUps,
  dashboardStats,
  expenseMeta,
};

writeFileSync(
  out,
  JSON.stringify({ branches, staff, customers, vehicles, collections }, null, 2),
  "utf8"
);
console.log("Wrote", out);
