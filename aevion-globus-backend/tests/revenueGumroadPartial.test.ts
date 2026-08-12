import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

// Gumroad pagination that dies mid-walk — 2026-08-12.
//
// gumroadSalesUncached returned a bare array. A walk that failed on page 3
// returned the two pages it had, indistinguishable from a complete export, and
// computeLiveTotals added them straight into the headline number. Gumroad is
// the primary channel, so the visible effect was revenue quietly reported
// lower than reality, with nothing in the response saying the data was partial.
//
// These tests pin the signal, not the arithmetic: a partial walk must be
// marked, a complete one must not be, and a partial walk must not be cached
// (caching one failed page would spread it across every reader for the TTL).

const ORIGINAL_FETCH = globalThis.fetch;

function page(sales: unknown[], next?: string) {
  return {
    ok: true,
    json: async () => ({ success: true, sales, ...(next ? { next_page_url: next } : {}) }),
  } as unknown as Response;
}

const sale = (id: string, priceCents = 1000) => ({
  id,
  price: priceCents,
  gumroad_fee: 100,
  email: `buyer-${id}@example.com`,
  product_permalink: "https://gum.co/x",
  created_at: new Date().toISOString(),
});

beforeEach(() => {
  process.env.GUMROAD_ACCESS_TOKEN = "test-token";
  vi.resetModules();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  delete process.env.GUMROAD_ACCESS_TOKEN;
  vi.restoreAllMocks();
});

async function loadRevenue() {
  return (await import("../src/routes/revenue")) as any;
}

describe("a partial Gumroad export is not reported as the whole history", () => {
  test("a walk that fails on the second page is marked incomplete", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      if (call === 1) return page([sale("a")], "https://api.gumroad.com/v2/sales?page=2");
      return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    const res = await gumroadSalesUncached();

    expect(res).not.toBeNull();
    expect(res.sales).toHaveLength(1);
    // Was: the same shape as a full export, so the caller could not tell.
    expect(res.complete).toBe(false);
    expect(res.reason).toMatch(/429/);
  });

  test("a walk that finishes is complete and carries no reason", async () => {
    globalThis.fetch = vi.fn(async () => page([sale("a"), sale("b")])) as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    const res = await gumroadSalesUncached();

    expect(res.complete).toBe(true);
    expect(res.sales).toHaveLength(2);
    expect(res.reason).toBeUndefined();
  });

  test("a page that comes back without sales stops the walk and says so", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      if (call === 1) return page([sale("a")], "https://api.gumroad.com/v2/sales?page=2");
      return { ok: true, json: async () => ({ success: false }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    const res = await gumroadSalesUncached();

    expect(res.complete).toBe(false);
    expect(res.sales).toHaveLength(1);
  });

  test("hitting the page cap is reported to the caller, not just the log", async () => {
    // Every page offers another one, so the cap is what stops the walk.
    globalThis.fetch = vi.fn(async () =>
      page([sale("a")], "https://api.gumroad.com/v2/sales?page=next"),
    ) as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    const res = await gumroadSalesUncached(2);

    expect(res.complete).toBe(false);
    expect(res.reason).toMatch(/2 pages/);
  });

  test("a first page that fails outright is still null, not an empty success", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    ) as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    expect(await gumroadSalesUncached()).toBeNull();
  });

  test("no token means null, and no network call at all", async () => {
    delete process.env.GUMROAD_ACCESS_TOKEN;
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;

    const { gumroadSalesUncached } = await loadRevenue();
    expect(await gumroadSalesUncached()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
