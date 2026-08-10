import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { MAX_PROMO_DISCOUNT_RATIO, getTier } from "../src/data/pricing";

// Checkout: the zero-price branch — 2026-08-10.
//
// The branch provisions directly, with no payment provider involved, so
// provisioning IS the transaction there. It shipped fire-and-forget
// (`provisionSubscription(...).catch(console.error)`) and returned the
// success URL either way — including when no email was supplied, in which
// case nothing was provisioned at all and the customer still landed on the
// success page. That is now awaited, and a failure answers 502.
//
// While writing a test for it, the branch turned out to be UNREACHABLE:
// promo discounts are capped at MAX_PROMO_DISCOUNT_RATIO (0.5), and the free
// and enterprise tiers return earlier, so no request can drive totalCents to
// zero. The hardening stays as a guard for the day the cap is raised or a
// 100%-off code is introduced — but nobody should believe it is being
// exercised today. This file pins the reachability itself, so if the cap
// changes, the test says so instead of the branch quietly waking up
// unverified.

const { mockProvision } = vi.hoisted(() => ({ mockProvision: vi.fn() }));

vi.mock("../src/routes/provisioning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/routes/provisioning")>();
  return { ...actual, provisionSubscription: mockProvision };
});

async function makeApp() {
  const { checkoutRouter } = await import("../src/routes/checkout");
  const app = express();
  app.use(express.json());
  app.use("/api/checkout", checkoutRouter);
  return app;
}

beforeEach(() => {
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({
    subscription: { id: "sub_1" },
    emailSent: true,
    emailMode: "stub",
  });
});

afterEach(() => {
  vi.resetModules();
});

describe("the zero-price branch is currently unreachable", () => {
  test("promo discount is capped below 100%, so a paid tier never reaches zero", () => {
    // This is the fact that makes the branch dead. If someone raises the cap
    // to 1, this test fails and points at the branch that then goes live.
    expect(MAX_PROMO_DISCOUNT_RATIO).toBeLessThan(1);
  });

  test("every paid tier still costs something after the maximum discount", () => {
    for (const id of ["lite", "medium", "full", "pro"] as const) {
      const tier = getTier(id);
      if (!tier) continue;
      const monthly = tier.priceMonthly ?? 0;
      if (monthly <= 0) continue;
      const lowest = monthly - monthly * MAX_PROMO_DISCOUNT_RATIO;
      expect(lowest).toBeGreaterThan(0);
    }
  });
});

describe("the tiers that return before pricing are unaffected", () => {
  test("free redirects without provisioning anything", async () => {
    // "free" is the absence of a subscription, not a plan to issue.
    const app = await makeApp();
    const res = await request(app).post("/api/checkout/session").send({ tierId: "free" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("stub");
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("enterprise routes to contact, not to checkout", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/checkout/session").send({ tierId: "enterprise" });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("contact");
    expect(mockProvision).not.toHaveBeenCalled();
  });

  test("an invalid tier is rejected before anything else", async () => {
    const app = await makeApp();
    const res = await request(app).post("/api/checkout/session").send({ tierId: "nonsense" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_tier");
    expect(mockProvision).not.toHaveBeenCalled();
  });
});

describe("a paid tier is never provisioned at checkout time", () => {
  test("issuing access happens on the provider webhook, after money moves", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/checkout/session")
      .send({ tierId: "full", period: "monthly", email: "buyer@example.com" });
    // With no provider configured this answers 503 "checkout_unavailable";
    // with one it answers a checkout URL. Either way it must not hand out a
    // plan before payment.
    expect([200, 503]).toContain(res.status);
    expect(mockProvision).not.toHaveBeenCalled();
  });
});
