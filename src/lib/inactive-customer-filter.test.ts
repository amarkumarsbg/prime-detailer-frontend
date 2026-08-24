/**
 * Unit tests for the inactive-customer filter UX.
 *
 * Covers:
 * - isInactiveCustomer definition (no lastVisitDate, or lastVisitDate > 90 days ago)
 * - badge derivation: Boolean(c.isInactive) || isInactiveCustomer(c)
 * - filter produces only inactive customers
 * - DASHBOARD_FILTER.INACTIVE key exists and is "inactive"
 * - count label should reflect inactive filter when active
 */
import { describe, expect, it } from "vitest";
import { isInactiveCustomer } from "./dashboard-filters";
import { DASHBOARD_FILTER } from "@/store/dashboard-filter-store";
import type { Customer } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCustomer(
  overrides: Partial<Customer> & { lastVisitDate?: string | null }
): Customer {
  return {
    id: "c-1",
    name: "Test Customer",
    phone: "9000000000",
    email: "test@example.com",
    address: "",
    referralCode: "REF-TEST",
    totalVisits: 0,
    rewardPoints: 0,
    walletBalance: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as Customer;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Simulate the tableData isInactive field derivation from customers/page.tsx
function deriveIsInactive(c: Customer): boolean {
  return Boolean(c.isInactive) || isInactiveCustomer(c);
}

// ---------------------------------------------------------------------------
// isInactiveCustomer definition
// ---------------------------------------------------------------------------

describe("isInactiveCustomer — definition", () => {
  it("customer with no lastVisitDate is inactive", () => {
    expect(isInactiveCustomer(makeCustomer({ lastVisitDate: undefined }))).toBe(true);
  });

  it("customer with null lastVisitDate is inactive", () => {
    // lastVisitDate is string|undefined in the type; cast to test the null guard path
    const c = makeCustomer({ lastVisitDate: undefined });
    // also test the runtime null path via type assertion
    expect(isInactiveCustomer({ ...c, lastVisitDate: null as unknown as undefined })).toBe(true);
  });

  it("customer last visited 91 days ago is inactive", () => {
    expect(isInactiveCustomer(makeCustomer({ lastVisitDate: daysAgoIso(91) }))).toBe(true);
  });

  it("boundary: cutoff is midnight of day-90; a visit at current hour on day-90 is still active", () => {
    // The cutoff is setHours(0,0,0,0) — midnight of 90 days ago.
    // daysAgoIso(90) is the current hour 90 days ago, which is AFTER midnight → still active.
    // A customer needs to have visited BEFORE midnight of 90 days ago to be inactive.
    const c = makeCustomer({ lastVisitDate: daysAgoIso(90) });
    expect(isInactiveCustomer(c)).toBe(false); // current hour 90 days ago is after midnight cutoff
  });

  it("customer last visited 30 days ago is active", () => {
    expect(isInactiveCustomer(makeCustomer({ lastVisitDate: daysAgoIso(30) }))).toBe(false);
  });

  it("customer visited today is active", () => {
    expect(isInactiveCustomer(makeCustomer({ lastVisitDate: new Date().toISOString() }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Badge derivation: Boolean(c.isInactive) || isInactiveCustomer(c)
// ---------------------------------------------------------------------------

describe("inactive badge derivation", () => {
  it("shows badge when stored isInactive=true and has a recent visit", () => {
    const c = makeCustomer({ isInactive: true, lastVisitDate: daysAgoIso(10) });
    expect(deriveIsInactive(c)).toBe(true);
  });

  it("shows badge when stored isInactive=false but no lastVisitDate (computed inactive)", () => {
    const c = makeCustomer({ isInactive: false, lastVisitDate: undefined });
    expect(deriveIsInactive(c)).toBe(true);
  });

  it("shows badge when stored isInactive=undefined and last visit was 100 days ago", () => {
    const c = makeCustomer({ isInactive: undefined, lastVisitDate: daysAgoIso(100) });
    expect(deriveIsInactive(c)).toBe(true);
  });

  it("does NOT show badge for active customer with no stored flag", () => {
    const c = makeCustomer({ isInactive: false, lastVisitDate: daysAgoIso(5) });
    expect(deriveIsInactive(c)).toBe(false);
  });

  it("does NOT show badge when both flags are false", () => {
    const c = makeCustomer({ isInactive: undefined, lastVisitDate: daysAgoIso(1) });
    expect(deriveIsInactive(c)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Filter: only inactive customers shown when INACTIVE filter is active
// ---------------------------------------------------------------------------

describe("inactive filter — only inactive customers shown", () => {
  const allCustomers: Customer[] = [
    makeCustomer({ id: "c-1", isInactive: false, lastVisitDate: daysAgoIso(5) }),   // active
    makeCustomer({ id: "c-2", isInactive: false, lastVisitDate: daysAgoIso(95) }),  // inactive by date
    makeCustomer({ id: "c-3", isInactive: true, lastVisitDate: daysAgoIso(5) }),    // explicitly inactive
    makeCustomer({ id: "c-4", isInactive: false, lastVisitDate: undefined }),        // inactive (no visit)
  ];

  const applyInactiveFilter = (customers: Customer[]) =>
    customers.filter(isInactiveCustomer);

  it("filters to only inactive customers", () => {
    const result = applyInactiveFilter(allCustomers);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain("c-1");         // active, recent visit
    expect(ids).toContain("c-2");             // no visit in 95 days
    expect(ids).not.toContain("c-3");         // stored isInactive=true BUT has recent visit — not inactive by date
    expect(ids).toContain("c-4");             // no lastVisitDate
  });

  it("all filtered customers are inactive by definition", () => {
    const result = applyInactiveFilter(allCustomers);
    expect(result.every(isInactiveCustomer)).toBe(true);
  });

  it("no active customer is included", () => {
    const result = applyInactiveFilter(allCustomers);
    const active = allCustomers.filter((c) => !isInactiveCustomer(c));
    for (const a of active) {
      expect(result.find((r) => r.id === a.id)).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// DASHBOARD_FILTER key exists
// ---------------------------------------------------------------------------

describe("DASHBOARD_FILTER.INACTIVE", () => {
  it("is set to 'inactive'", () => {
    expect(DASHBOARD_FILTER.INACTIVE).toBe("inactive");
  });

  it("clearing the filter (setActiveFilter(null)) would show all customers", () => {
    // Simulate: when activeFilter is null, source = all customers
    const activeFilter = null;
    const allCustomers = [
      makeCustomer({ id: "c-1", lastVisitDate: daysAgoIso(5) }),
      makeCustomer({ id: "c-2", lastVisitDate: undefined }),
    ];
    const source =
      activeFilter === DASHBOARD_FILTER.INACTIVE
        ? allCustomers.filter(isInactiveCustomer)
        : allCustomers;
    expect(source.length).toBe(2);
  });

  it("when activeFilter is INACTIVE, filter is applied", () => {
    const activeFilter = DASHBOARD_FILTER.INACTIVE;
    const allCustomers = [
      makeCustomer({ id: "c-1", lastVisitDate: daysAgoIso(5) }),
      makeCustomer({ id: "c-2", lastVisitDate: undefined }),
    ];
    const source =
      activeFilter === DASHBOARD_FILTER.INACTIVE
        ? allCustomers.filter(isInactiveCustomer)
        : allCustomers;
    expect(source.length).toBe(1);
    expect(source[0]?.id).toBe("c-2");
  });
});

// ---------------------------------------------------------------------------
// Count label text derivation
// ---------------------------------------------------------------------------

describe("inactive filter count label", () => {
  function countLabel(count: number, isInactiveFilter: boolean): string {
    const noun = `customer${count !== 1 ? "s" : ""}`;
    return isInactiveFilter ? `${count} inactive ${noun}` : `${count} ${noun}`;
  }

  it("shows 'N inactive customers' when filter is active", () => {
    expect(countLabel(6, true)).toBe("6 inactive customers");
    expect(countLabel(1, true)).toBe("1 inactive customer");
    expect(countLabel(0, true)).toBe("0 inactive customers");
  });

  it("shows 'N customers' when filter is not active", () => {
    expect(countLabel(46, false)).toBe("46 customers");
    expect(countLabel(1, false)).toBe("1 customer");
    expect(countLabel(0, false)).toBe("0 customers");
  });
});
