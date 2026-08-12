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
// simply not caught up. They now go through lib/webhookDedup, whose journal
// survives the restart.
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
      return s.includes("provisionSubscription") && s.includes("hasSeenWebhook");
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
    // The dedup must go through the shared persisted store, never a bare
    // in-process Set that a deploy would wipe.
    expect(s).toContain("hasSeenWebhook");
    expect(s).toContain("markWebhookSeen");
    expect(s).not.toMatch(/const SEEN = new Set<string>\(\)/);
  });

  test.each(paymentWebhookFiles())("%s releases the key when a ping is rejected", (file) => {
    const s = source(file);
    // A rejected ping must not keep the key claimed, or the genuine retry
    // that follows would be swallowed as a replay.
    expect(s).toContain("releaseWebhookKey");
  });
});
