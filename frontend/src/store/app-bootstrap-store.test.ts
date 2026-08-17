import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapAppData = vi.fn(async () => {});

vi.mock("@/lib/bootstrap-app-data", () => ({
  bootstrapAppData: (...args: unknown[]) => bootstrapAppData(...args),
}));

describe("app-bootstrap-store single-flight", () => {
  beforeEach(async () => {
    vi.resetModules();
    bootstrapAppData.mockReset();
    bootstrapAppData.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const { useAppBootstrapStore, __resetBootstrapInflightForTests } = await import(
      "@/store/app-bootstrap-store"
    );
    __resetBootstrapInflightForTests();
    useAppBootstrapStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes concurrent run() calls into one bootstrapAppData invocation", async () => {
    const { useAppBootstrapStore } = await import("@/store/app-bootstrap-store");
    const a = useAppBootstrapStore.getState().run();
    const b = useAppBootstrapStore.getState().run();
    await Promise.all([a, b]);
    expect(bootstrapAppData).toHaveBeenCalledTimes(1);
    expect(useAppBootstrapStore.getState().ready).toBe(true);
  });

  it("run() is a no-op when already ready unless force", async () => {
    const { useAppBootstrapStore } = await import("@/store/app-bootstrap-store");
    await useAppBootstrapStore.getState().run();
    expect(bootstrapAppData).toHaveBeenCalledTimes(1);
    await useAppBootstrapStore.getState().run();
    expect(bootstrapAppData).toHaveBeenCalledTimes(1);
    await useAppBootstrapStore.getState().run({ force: true });
    expect(bootstrapAppData).toHaveBeenCalledTimes(2);
  });

  it("refresh() joins an in-flight run()", async () => {
    const { useAppBootstrapStore } = await import("@/store/app-bootstrap-store");
    const runP = useAppBootstrapStore.getState().run();
    const refreshP = useAppBootstrapStore.getState().refresh();
    await Promise.all([runP, refreshP]);
    expect(bootstrapAppData).toHaveBeenCalledTimes(1);
  });

  it("retries failed run inside the same inflight (no parallel callers)", async () => {
    vi.useFakeTimers();
    bootstrapAppData
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValueOnce(undefined);

    const { useAppBootstrapStore } = await import("@/store/app-bootstrap-store");
    const p = useAppBootstrapStore.getState().run();
    // Second caller joins; should not start another retry series
    const p2 = useAppBootstrapStore.getState().run();

    await vi.advanceTimersByTimeAsync(2500);
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all([p, p2]);

    expect(bootstrapAppData).toHaveBeenCalledTimes(3);
    expect(useAppBootstrapStore.getState().ready).toBe(true);
  });
});

describe("AppDataSync visibility grace", () => {
  it("exports a positive grace window", async () => {
    const { BOOTSTRAP_VISIBILITY_GRACE_MS } = await import(
      "@/components/layout/app-data-sync"
    );
    expect(BOOTSTRAP_VISIBILITY_GRACE_MS).toBeGreaterThan(0);
  });
});
