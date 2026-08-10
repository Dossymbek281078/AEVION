import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  provisionSubscription,
  subscriptionExistsForEvent,
  readLatestSubscription,
} from "../src/routes/provisioning";

// Durable replay guard for payment webhooks — 2026-08-10.
//
// Every payment webhook (Gumroad, LemonSqueezy, PayPal, PayBox) deduplicates
// on an in-process Set. A deploy empties it, and a deploy is exactly when a
// provider retries a delivery it never got an answer for. Provisioning is NOT
// idempotent — each call writes a subscription running 30/365 days from *now*
// and emails the customer — so a replay hands out an extra period for free.
//
// The subscription journal is already persisted, so stamping the provider's
// event id on the record turns it into evidence that survives the restart.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aevion-subs-"));
  process.env.SUBSCRIPTIONS_FILE = join(dir, "subscriptions.jsonl");
  // Keep the welcome email in stub mode.
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe("subscriptionExistsForEvent", () => {
  test("an unseen event is not a replay", () => {
    expect(subscriptionExistsForEvent("sale_1:paid")).toBe(false);
  });

  test("an event that was provisioned is recognised afterwards", async () => {
    await provisionSubscription({
      email: "buyer@example.com",
      tierId: "full",
      externalEventId: "sale_1:paid",
    });
    // This is the check that survives a restart: it reads the journal, not
    // any in-memory state.
    expect(subscriptionExistsForEvent("sale_1:paid")).toBe(true);
  });

  test("a different event id is still new", async () => {
    await provisionSubscription({
      email: "buyer@example.com",
      tierId: "full",
      externalEventId: "sale_1:paid",
    });
    expect(subscriptionExistsForEvent("sale_2:paid")).toBe(false);
    // Same sale, different status, is a genuinely different event —
    // a refund after a purchase must not be swallowed as a replay.
    expect(subscriptionExistsForEvent("sale_1:refunded")).toBe(false);
  });

  test("provisioning without an event id does not claim the empty key", async () => {
    await provisionSubscription({ email: "buyer@example.com", tierId: "full" });
    expect(subscriptionExistsForEvent("")).toBe(false);
    expect(subscriptionExistsForEvent("   ")).toBe(false);
  });

  test("a malformed line does not hide a real replay", async () => {
    await provisionSubscription({
      email: "buyer@example.com",
      tierId: "full",
      externalEventId: "sale_9:paid",
    });
    // Append garbage the way a partial write would.
    writeFileSync(process.env.SUBSCRIPTIONS_FILE!, "{not json\n", { flag: "a" });
    expect(subscriptionExistsForEvent("sale_9:paid")).toBe(true);
  });

  test("an unreadable store reports 'not seen' rather than dropping a real delivery", () => {
    process.env.SUBSCRIPTIONS_FILE = join(dir, "nope", "missing.jsonl");
    // Erring the other way would silently deny a paying customer their access.
    expect(subscriptionExistsForEvent("sale_1:paid")).toBe(false);
  });

  test("the stamped record is otherwise a normal subscription", async () => {
    await provisionSubscription({
      email: "Buyer@Example.com",
      tierId: "full",
      externalEventId: "sale_5:paid",
    });
    const sub = readLatestSubscription("buyer@example.com");
    expect(sub?.tierId).toBe("full");
    expect(sub?.externalEventId).toBe("sale_5:paid");
    expect(sub?.validUntil).toBeTruthy();
  });
});

describe("what a replay would have cost", () => {
  test("provisioning twice really does write two records with two end dates", async () => {
    // Not a bug report on provisionSubscription — it is correct for a genuine
    // renewal. It is the reason the webhook must never call it twice for one
    // payment: the second call extends access by another full period.
    const a = await provisionSubscription({ email: "b@example.com", tierId: "full" });
    const b = await provisionSubscription({ email: "b@example.com", tierId: "full" });
    expect(a.subscription.id).not.toBe(b.subscription.id);
    expect(new Date(b.subscription.validUntil!).getTime()).toBeGreaterThanOrEqual(
      new Date(a.subscription.validUntil!).getTime(),
    );
  });
});
