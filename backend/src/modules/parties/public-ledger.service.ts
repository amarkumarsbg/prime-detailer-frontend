import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { getPublicBranding } from "../../services/public-branding.service.js";
import {
  buildPartyStatement,
  buildPartySummary,
} from "../../lib/party-ledger.js";
import type { Party } from "../../types/party.js";
import { loadFinanceDocuments } from "./party.service.js";

function customerPartyId(customerId: string) {
  return `c:${customerId}`;
}

/**
 * Public-safe customer ledger statement (no auth).
 * Identified by studio customer id (`Customer.id`).
 */
export async function getPublicCustomerLedger(customerId: string, period = "last365") {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      organizationId: true,
    },
  });
  if (!customer) {
    throw AppError.notFound("Ledger not found");
  }

  const partyRow = await prisma.party.findFirst({
    where: {
      organizationId: customer.organizationId,
      OR: [{ id: customerPartyId(customer.id) }, { customerId: customer.id }],
    },
  });

  const party: Party = {
    id: partyRow?.id ?? customerPartyId(customer.id),
    kind: "customer",
    name: partyRow?.name ?? customer.name,
    mobile: partyRow?.mobile ?? customer.phone ?? undefined,
    openingBalance: partyRow?.openingBalance ?? 0,
    openingBalanceSide:
      partyRow?.openingBalanceSide === "TO_PAY"
        ? "toPay"
        : partyRow?.openingBalanceSide === "TO_COLLECT"
          ? "toCollect"
          : "toCollect",
    customFields: [],
    customerId: customer.id,
    createdAt: (partyRow?.createdAt ?? new Date()).toISOString(),
    updatedAt: (partyRow?.updatedAt ?? new Date()).toISOString(),
  };

  const { invoices, expenses } = await loadFinanceDocuments(customer.organizationId);
  const statement = buildPartyStatement(party, invoices, expenses, period);
  const summary = buildPartySummary(party, invoices, expenses, period);
  const branding = await getPublicBranding();

  return {
    customer: {
      id: customer.id,
      name: customer.name,
    },
    period,
    summary: {
      totalReceivableOrPayable: summary.totalReceivableOrPayable,
      overdueAmount: summary.overdueAmount,
      totalSalesOrPurchases: summary.totalSalesOrPurchases,
      totalReceivedOrPaid: summary.totalReceivedOrPaid,
    },
    statement: statement.map((line) => ({
      id: line.id,
      date: line.date,
      voucher: line.voucher,
      credit: line.credit ?? null,
      debit: line.debit ?? null,
      balance: line.balance,
      isSummary: Boolean(line.isSummary),
      dueLabel: line.dueLabel ?? null,
    })),
    business: {
      businessName: branding.businessName,
      businessLogo: branding.businessLogo,
    },
  };
}
