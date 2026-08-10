import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Guard: every payment webhook must have a replay defence that survives a
// restart — 2026-08-10.
//
// All four payment webhooks shipped with an in-process `SEEN` Set and nothing
// else. A deploy empties it, which is exactly when a provider retries a
// delivery it never got an answer for, and provisioning is not idempotent: a
// replay grants another paid period and re-emails the buyer.
//
// Bureau already does this correctly (BureauWebhookEvent row inserted before
// any side effect — see webhookIdempotency.test.ts); the payment webhooks had
// simply not caught up. They now check the persisted subscription journal via
// subscriptionExistsForEvent().
//
// This test reads the sources rather than exercising each provider's
// signature scheme: it is here to stop a FIFTH payment webhook from being
// added with memory-only dedup, which is the failure that actually recurs.

const ROUTES = join(__dirname, "..", "src", "routes");

function source(file: string): string {
  return readFileSync(join(ROUTES, file), "utf8");
}

/** Route files that both take money and deduplicate deliveries. */
function paymentWebhookFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((f) => f.endsWith("Webhook.ts"))
    .filter((f) => {
      const s = source(f);
      // Only those that provision paid access — the ones where a replay costs
      // real money. A webhook that merely records something is out of scope.
      return s.includes("provisionSubscription") && s.includes("new Set<string>()");
    });
}

describe("payment webhooks survive a restart between retries", () => {
  test("the set of payment webhooks is the one we think it is", () => {
    // If this list changes, the tests below are covering something new — or
    // have stopped covering something that still matters.
    expect(paymentWebhookFiles().sort()).toEqual([
      "gumroadWebhook.ts",
      "lemonSqueezyWebhook.ts",
      "payboxWebhook.ts",
      "paypalWebhook.ts",
    ]);
  });

  test.each(paymentWebhookFiles())("%s consults the persisted journal, not only memory", (file) => {
    const s = source(file);
    expect(s).toContain("subscriptionExistsForEvent");
    // The in-memory Set alone must never be the whole check.
    expect(s).toMatch(/SEEN\.has\(dedupKey\)\s*\|\|\s*subscriptionExistsForEvent\(dedupKey\)/);
  });

  test.each(paymentWebhookFiles())("%s stamps the event id on what it writes", (file) => {
    const s = source(file);
    // Without the stamp the lookup above can never find anything, so the
    // check would pass while doing nothing — the exact silent failure this
    // whole change is about.
    expect(s).toContain("externalEventId: dedupKey");
  });
});
