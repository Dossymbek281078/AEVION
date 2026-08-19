import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";

/**
 * End-to-end entitlement chain: PAY → PROVISION → 402 CLEARS → module in
 * entitlements → EXPIRE → 402 returns. This is the most expensive path to
 * break silently (a customer pays and still can't get in), and nothing
 * covered it. Exercised through the REAL requireModule middleware and the
 * REAL subscription store — only the store FILE and clock are redirected,
 * so the resolver/gate logic under test is untouched.
 */

// Isolate the subscription store + JWT secret BEFORE any module under test
// reads them (provisioning.ts binds SUBS_FILE at import time).
const TMP = mkdtempSync(join(tmpdir(), "aevion-subs-"));
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
process.env.AUTH_JWT_SECRET = "test-secret-at-least-32-chars-long-aevion-000";
process.env.PAYWALL_MODULES = "healthai"; // gate exactly one module for the test
process.env.NODE_ENV = "test";

import { requireModule, isModuleEntitled, resolveUserPlan } from "../src/lib/planGate";
import { provisionSubscription, writeSubscription } from "../src/routes/provisioning";

function bearerReq(email: string): any {
  const token = jwt.sign({ sub: "u1", email }, process.env.AUTH_JWT_SECRET as string, { algorithm: "HS256" });
  return { headers: { authorization: `Bearer ${token}` }, method: "GET", path: "/chat" };
}

function fakeRes() {
  return {
    statusCode: 0,
    body: null as any,
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
}

// Гейт стал асинхронным 13.08.2026 — при отказе по тарифу он спрашивает базу
// про отдельную подписку на модуль. Промис надо дождаться.
async function runGate(email: string) {
  const req = bearerReq(email);
  const res = fakeRes();
  let passed = false;
  await requireModule("healthai")(req, res as any, () => { passed = true; });
  return { passed, status: res.statusCode, body: res.body };
}

describe("paywall provision flow — pay → access → expire", () => {
  afterAll(() => rmSync(TMP, { recursive: true, force: true }));

  test("free user is denied healthai with a well-formed 402", async () => {
    const g = await runGate("free-user@test.aevion.dev");
    expect(g.passed).toBe(false);
    expect(g.status).toBe(402);
    expect(g.body.error).toBe("upgrade_required");
    expect(g.body.module).toBe("healthai");
    expect(g.body.requiredTiers.length).toBeGreaterThan(0);
  });

  test("after provisioning a paid tier, the SAME user passes the gate", async () => {
    const email = "buyer@test.aevion.dev";
    expect((await runGate(email)).status).toBe(402); // denied before purchase

    await provisionSubscription({ email, tierId: "medium", period: "monthly", source: "gumroad" });

    const g = await runGate(email);
    expect(g.passed).toBe(true);      // gate let the request through
    expect(g.status).toBe(0);          // no 402 written
    expect(isModuleEntitled(resolveUserPlan(bearerReq(email)), "healthai")).toBe(true);
  });

  test("an expired subscription falls back to 402 (latest-wins downgrade)", async () => {
    const email = "expired@test.aevion.dev";
    // Write a paid record that already lapsed yesterday.
    writeSubscription({
      id: "sub_expired", ts: new Date().toISOString(), email,
      tierId: "medium", period: "monthly", seats: 1, modules: [], trialDays: 0,
      validUntil: new Date(Date.now() - 86_400_000).toISOString(),
      source: "gumroad",
    } as any);

    const g = await runGate(email);
    expect(g.passed).toBe(false);
    expect(g.status).toBe(402);
  });

  test("a lite subscription unlocks ONLY its chosen module", async () => {
    const email = "lite-buyer@test.aevion.dev";
    await provisionSubscription({ email, tierId: "lite", period: "monthly", modules: ["healthai"], source: "gumroad" });
    expect((await runGate(email)).passed).toBe(true);
    // A different medium-tier module (qnews) is NOT unlocked by a lite pick
    // of healthai — lite is one product of choice, not the whole medium tier.
    const req = bearerReq(email);
    expect(isModuleEntitled(resolveUserPlan(req), "qnews")).toBe(false);
  });
});
