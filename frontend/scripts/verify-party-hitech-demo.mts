import {
  buildPartyItemWise,
  buildPartyStatement,
  buildPartySummary,
  buildPartyTransactions,
  partyCurrentBalance,
} from "../src/lib/party/ledger-math";
import {
  HI_TECH_CUSTOMER_ID,
  HI_TECH_INVOICE,
  HI_TECH_PARTY_ID,
} from "../src/lib/party/party-hitech-demo";
import type { Party } from "../src/types/party";

const party: Party = {
  id: HI_TECH_PARTY_ID,
  kind: "customer",
  name: "HI TECH CAR SPA & DETAILING",
  openingBalance: 0,
  customFields: [],
  customerId: HI_TECH_CUSTOMER_ID,
  createdAt: "2025-01-10T10:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

const period = "last365";
const invoices = [HI_TECH_INVOICE];
const expenses: never[] = [];

const balance = partyCurrentBalance(party, invoices, expenses);
const summary = buildPartySummary(party, invoices, expenses, period);
const transactions = buildPartyTransactions(party, invoices, expenses, period);
const statement = buildPartyStatement(party, invoices, expenses, period);
const itemWise = buildPartyItemWise(party, invoices, expenses, period);

const assert = (label: string, ok: boolean, detail?: string) => {
  console.log(ok ? "✓" : "✗", label, detail ?? "");
  if (!ok) process.exitCode = 1;
};

assert("balance is 217", balance === 217, `got ${balance}`);
assert("receivable 217", summary.totalReceivableOrPayable === 217);
assert("sales 32717", summary.totalSalesOrPurchases === 32717);
assert("received 32500", summary.totalReceivedOrPaid === 32500);
assert("overdue 217", summary.overdueAmount === 217);
assert("2 transactions", transactions.length === 2, `got ${transactions.length}`);
assert(
  "has payment in",
  transactions.some((t) => t.typeLabel === "Payment In" && t.amount === 32500)
);
assert(
  "has sales invoice",
  transactions.some((t) => t.typeLabel === "Sales Invoices" && t.unpaidAmount === 217)
);
assert("4 item rows", itemWise.length === 4, `got ${itemWise.length}`);
assert(
  "statement has sales + payment",
  statement.some((l) => l.voucher === "Sales Invoices") &&
    statement.some((l) => l.voucher === "Payment In")
);
const closing = statement.find((l) => l.id === "closing");
assert("closing balance 217", closing?.balance === 217, `got ${closing?.balance}`);

console.log("\nDemo verification", process.exitCode === 1 ? "FAILED" : "PASSED");
