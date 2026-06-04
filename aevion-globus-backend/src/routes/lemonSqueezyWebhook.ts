/**
 * Lemon Squeezy SUBSCRIPTION webhook → plan provisioning.
 *
 * Distinct from the bureau one-off payment webhook (/api/bureau/payment/webhook,
 * which confirms a single Verified-tier purchase). This endpoint handles
 * recurring bundle / All-Access subscriptions and maps them to a user plan:
 *
 *   subscription_created | subscription_updated(active) |
 *   subscription_resumed | subscription_unpaused
 *     → provisionSubscription(...) — writes data/subscriptions.jsonl +
 *       welcome email. /api/pricing/subscription/me then reports the plan.
 *
 *   subscription_cancelled | subscription_expired | subscription_paused
 *     → writes a tierId:"free" downgrade record so /subscription/me reflects it.
 *
 * Activation tier (variant_id → reference → tier):
 *   - LEMON_SQUEEZY_VARIANT_MEDIUM_* → "medium" (modules = MEDIUM_BUNDLE)
 *   - LEMON_SQUEEZY_VARIANT_FULL_*   → "full"   (modules = [] == all)
 *   - LEMON_SQUEEZY_VARIANT_LITE_*   → "lite"   (modules = [], 1 product chosen in cabinet)
 *   - unrecognised variant id        → "lite"   (safest paid entry)
 *
 * Signature: HMAC-SHA256(rawBody, LEMON_SQUEEZY_WEBHOOK_SECRET) compared to
 * the x-signature header (hex). See
 * https://docs.lemonsqueezy.com/help/webhooks/signing-requests
 *
 * Env:
 *   LEMON_SQUEEZY_WEBHOOK_SECRET — required; if unset the route is a no-op
 *     stub (200 OK, logs) so a misconfigured deploy doesn't 500 on every hit.
 */

import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";
import {
  referenceForVariantId,
  tierForLemonSqueezyReference,
  type LemonSqueezyReference,
} from "../data/lemonSqueezyVariants";
import { MEDIUM_BUNDLE } from "../data/pricing";

export const lemonSqueezyWebhookRouter = Router();

interface LsSubscriptionPayload {
  meta?: {
    event_name?: string;
    custom_data?: { reference?: string; email?: string };
  };
  data?: {
    id?: string;
    attributes?: {
      user_email?: string;
      variant_id?: number | string;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
    };
  };
}

const ACTIVATE_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_resumed",
  "subscription_unpaused",
]);

const DEACTIVATE_EVENTS = new Set([
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
]);

// Process-lifetime dedup: LS delivers at-least-once. Key on subscription id +
// event + the renews/ends timestamp so a redelivery is a no-op but a genuine
// later state change (new renews_at) still provisions. Cleared on restart;
// jsonl is append-only so a missed dedup just appends a duplicate that
// /subscription/me (latest-wins) tolerates.
const SEEN = new Set<string>();

function modulesForReference(ref: LemonSqueezyReference | null): string[] {
  if (!ref) return [];
  if (ref.includes("medium")) return [...MEDIUM_BUNDLE];
  // full → [] is read as "all" by the welcome email + access is granted by tier;
  // lite → [] (1 product of choice, selected in the cabinet after checkout).
  return [];
}

function verifySignature(rawBody: string, presented: string | undefined, secret: string): boolean {
  if (!presented) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

lemonSqueezyWebhookRouter.post("/webhook", async (req, res) => {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.log("[ls/webhook] STUB — LEMON_SQUEEZY_WEBHOOK_SECRET unset, ignoring");
    return res.json({ ok: true, mode: "stub" });
  }

  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});

  const sig = (req.headers["x-signature"] as string | undefined) ?? undefined;
  if (!verifySignature(rawBody, sig, secret)) {
    console.error("[ls/webhook] signature mismatch");
    return res.status(401).json({ ok: false, error: "signature mismatch" });
  }

  let payload: LsSubscriptionPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "body is not JSON" });
  }

  const event = (payload.meta?.event_name ?? "").toLowerCase();
  const attrs = payload.data?.attributes ?? {};
  const email = (attrs.user_email ?? payload.meta?.custom_data?.email ?? "").trim().toLowerCase();

  if (!event.startsWith("subscription_")) {
    // Not a subscription event (e.g. order_created) — out of scope here.
    return res.json({ ok: true, ignored: event || "unknown" });
  }
  if (!email) {
    return res.status(400).json({ ok: false, error: "missing user_email" });
  }

  // Dedup
  const dedupKey = `${payload.data?.id ?? "?"}:${event}:${attrs.renews_at ?? attrs.ends_at ?? ""}`;
  if (SEEN.has(dedupKey)) {
    return res.json({ ok: true, deduped: true });
  }
  SEEN.add(dedupKey);

  try {
    if (ACTIVATE_EVENTS.has(event)) {
      const ref = referenceForVariantId(attrs.variant_id);
      const tierId = tierForLemonSqueezyReference(ref);
      const modules = modulesForReference(ref);
      const result = await provisionSubscription({
        email,
        tierId,
        period: "monthly",
        modules,
        source: "lemonsqueezy",
      });
      console.log(`[ls/webhook] ${event} → provisioned ${tierId} for ${email} (ref=${ref ?? "default"})`);
      return res.json({ ok: true, action: "activated", tierId, subscriptionId: result.subscription.id });
    }

    if (DEACTIVATE_EVENTS.has(event)) {
      const downgrade: Subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
        source: "lemonsqueezy:cancel",
      };
      writeSubscription(downgrade);
      console.log(`[ls/webhook] ${event} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded" });
    }

    // Known subscription_* event we don't act on (e.g. subscription_payment_success).
    return res.json({ ok: true, ignored: event });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ls webhook failed";
    console.error("[ls/webhook] handler error:", msg);
    // 500 so LS retries — provisioning is idempotent enough (latest-wins).
    SEEN.delete(dedupKey);
    return res.status(500).json({ ok: false, error: msg });
  }
});
