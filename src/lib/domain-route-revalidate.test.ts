import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invalidateDomainResources = vi.fn();
const ensureDomainResources = vi.fn(async () => {});

vi.mock("@/lib/domain-data-loader", () => ({
  invalidateDomainResources: (...args: unknown[]) => invalidateDomainResources(...args),
  ensureDomainResources: (...args: unknown[]) => ensureDomainResources(...args),
}));

describe("domain-route-revalidate", () => {
  beforeEach(async () => {
    vi.resetModules();
    invalidateDomainResources.mockClear();
    ensureDomainResources.mockClear();
    const mod = await import("@/lib/domain-route-revalidate");
    mod.__resetDomainRouteRevalidateTimersForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("revalidates accounting pack on navigation", async () => {
    const { revalidateRouteDomainData } = await import("@/lib/domain-route-revalidate");
    revalidateRouteDomainData("/accounting");
    expect(invalidateDomainResources).toHaveBeenCalledTimes(1);
    expect(invalidateDomainResources.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(["invoices", "expenses", "membership"])
    );
    expect(ensureDomainResources).toHaveBeenCalled();
  });

  it("debounces visibility revalidate on Android/iOS tab resume", async () => {
    const { revalidateRouteDomainData, maybeRevalidateRouteDomainDataFromVisibility } =
      await import("@/lib/domain-route-revalidate");

    revalidateRouteDomainData("/accounting");
    invalidateDomainResources.mockClear();
    ensureDomainResources.mockClear();

    vi.advanceTimersByTime(3_000);
    maybeRevalidateRouteDomainDataFromVisibility("/accounting");
    expect(invalidateDomainResources).toHaveBeenCalledTimes(1);

    invalidateDomainResources.mockClear();
    maybeRevalidateRouteDomainDataFromVisibility("/accounting");
    expect(invalidateDomainResources).not.toHaveBeenCalled();

    vi.advanceTimersByTime(8_000);
    maybeRevalidateRouteDomainDataFromVisibility("/accounting");
    expect(invalidateDomainResources).toHaveBeenCalledTimes(1);
  });

  it("revalidates on bfcache pageshow (persisted)", async () => {
    const { revalidateRouteDomainDataFromPageShow } = await import(
      "@/lib/domain-route-revalidate"
    );
    revalidateRouteDomainDataFromPageShow("/accounting", {
      persisted: true,
    } as PageTransitionEvent);
    expect(invalidateDomainResources).toHaveBeenCalledTimes(1);
  });

  it("ignores non-persisted pageshow (initial load)", async () => {
    const { revalidateRouteDomainDataFromPageShow } = await import(
      "@/lib/domain-route-revalidate"
    );
    revalidateRouteDomainDataFromPageShow("/accounting", {
      persisted: false,
    } as PageTransitionEvent);
    expect(invalidateDomainResources).not.toHaveBeenCalled();
  });
});
