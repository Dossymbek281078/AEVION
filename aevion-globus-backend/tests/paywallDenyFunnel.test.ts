import { describe, test, expect, vi, beforeEach } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import { recordDeny, funnelSummary, resetPaywallDenyLog } from "../src/lib/paywallDenyLog";

describe("paywall deny funnel (in-memory fallback)", () => {
  beforeEach(() => resetPaywallDenyLog());

  test("aggregates denies per module and plan, sorted by volume", async () => {
    recordDeny("qai", "free");
    recordDeny("qai", "free");
    recordDeny("qai", "lite");
    recordDeny("qnews", "free");

    const f = await funnelSummary(30);
    expect(f.source).toBe("memory");
    expect(f.totalDenies).toBe(4);
    expect(f.byModule.map((m) => m.module)).toEqual(["qai", "qnews"]);
    expect(f.byModule[0].denies).toBe(3);
    expect(f.byModule[0].byPlan).toEqual({ free: 2, lite: 1 });
  });

  test("empty funnel is a valid zero state", async () => {
    const f = await funnelSummary();
    expect(f.totalDenies).toBe(0);
    expect(f.byModule).toEqual([]);
  });

  test("module names containing colons survive the mem-key round trip", async () => {
    recordDeny("multichat-engine", "free");
    const f = await funnelSummary();
    expect(f.byModule[0].module).toBe("multichat-engine");
    expect(f.byModule[0].byPlan.free).toBe(1);
  });
});
