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
  isAppReference,
  appSlugForReference,
  type LemonSqueezyReference,
} from "../data/lemonSqueezyVariants";
import { MEDIUM_BUNDLE } from "../data/pricing";
import { makeServiceCapture } from "../lib/sentry/platform";
import { getPool } from "../lib/dbPool";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";

async function upsertAppSubscription(
  email: string,
  appSlug: string,
  status: "active" | "cancelled",
  lsSubId?: string,
): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO "AppSubscription" ("id","email","appSlug","lsSubId","status","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT ("email","appSlug") DO UPDATE
         SET "status"=$4, "lsSubId"=COALESCE($3,"AppSubscription"."lsSubId"), "updatedAt"=NOW()`,
      [email, appSlug, lsSubId ?? null, status],
    );
  } catch (err) {
    console.error("[ls/app-sub] upsertAppSubscription error:", err instanceof Error ? err.message : err);
  }
}

async function upgradeDevHubByEmail(email: string, tier: "free" | "pro"): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(`
      INSERT INTO "DevHubEmailTier" ("email","tier","updatedAt") VALUES ($1,$2,NOW())
      ON CONFLICT ("email") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
    `, [email, tier]);
    const ur = await pool.query(`SELECT "id" FROM "AEVIONUser" WHERE LOWER("email")=$1 LIMIT 1`, [email]);
    if (ur.rows[0]?.id) {
      await pool.query(`
        INSERT INTO "DevHubTier" ("userId","tier","updatedAt") VALUES ($1,$2,NOW())
        ON CONFLICT ("userId") DO UPDATE SET "tier"=$2, "updatedAt"=NOW()
      `, [ur.rows[0].id, tier]);
    }
  } catch (err) {
    console.error("[ls/devhub] upgradeByEmail error:", err instanceof Error ? err.message : err);
  }
}

const capture = makeServiceCapture("lemonSqueezyWebhook");

export const lemonSqueezyWebhookRouter = Router();

interface LsSubscriptionPayload {
  meta?: {
    event_name?: string;
    custom_data?: { reference?: string; email?: string; module?: string };
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

// Dedup survives restarts (see lib/webhookDedup): LS delivers at-least-once.
// Key on subscription id + event + the renews/ends timestamp so a redelivery is
// a no-op but a genuine later state change (new renews_at) still provisions.
//
// This used to be a process-lifetime Set, and the comment here said a missed
// dedup was tolerable because /subscription/me is latest-wins. That reasoning
// only covered the subscription record — a second provisioning run also sends
// the customer a second welcome email, which no reader tolerates.

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

  if (event === "order_created") {
    // DevHub Studio Pro one-time purchase (not a subscription)
    const studioVariant = process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_STUDIO_PRO?.trim();
    const variantId = String(attrs.variant_id ?? "");
    if (studioVariant && variantId === studioVariant && email) {
      await upgradeDevHubByEmail(email, "pro");
      console.log(`[ls/webhook] order_created devhub-studio-pro → pro for ${email}`);
      return res.json({ ok: true, action: "devhub_studio_pro_activated", email });
    }
    return res.json({ ok: true, ignored: event });
  }

  if (!event.startsWith("subscription_")) {
    return res.json({ ok: true, ignored: event || "unknown" });
  }
  if (!email) {
    return res.status(400).json({ ok: false, error: "missing user_email" });
  }

  // Dedup
  const dedupKey = `${payload.data?.id ?? "?"}:${event}:${attrs.renews_at ?? attrs.ends_at ?? ""}`;
  if (hasSeenWebhook("lemonsqueezy", dedupKey)) {
    return res.json({ ok: true, deduped: true });
  }
  markWebhookSeen("lemonsqueezy", dedupKey);

  try {
    const ref = referenceForVariantId(attrs.variant_id);
    const lsSubId = payload.data?.id ?? undefined;

    // ── Individual app subscription (app_* variants) ──────────────────
    if (isAppReference(ref)) {
      const appSlug = appSlugForReference(ref)!;
      if (ACTIVATE_EVENTS.has(event)) {
        await upsertAppSubscription(email, appSlug, "active", lsSubId);
        console.log(`[ls/webhook] ${event} → app_sub activated: ${appSlug} for ${email}`);
        return res.json({ ok: true, action: "app_activated", appSlug, email });
      }
      if (DEACTIVATE_EVENTS.has(event)) {
        await upsertAppSubscription(email, appSlug, "cancelled", lsSubId);
        console.log(`[ls/webhook] ${event} → app_sub cancelled: ${appSlug} for ${email}`);
        return res.json({ ok: true, action: "app_cancelled", appSlug, email });
      }
      return res.json({ ok: true, ignored: event });
    }

    // ── Platform tier subscription (tier_* variants) ─────────────────
    if (ACTIVATE_EVENTS.has(event)) {
      const tierId = tierForLemonSqueezyReference(ref);
      // Lite = 1 продукт на выбор: берём его из custom_data (передан на чекауте).
      const customModule = payload.meta?.custom_data?.module;
      const modules = tierId === "lite" && customModule ? [customModule] : modulesForReference(ref);
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
    capture(err);
    console.error("[ls/webhook] handler error:", msg);
    // 500 so LS retries — provisioning is idempotent enough (latest-wins).
    releaseWebhookKey("lemonsqueezy", dedupKey);
    return res.status(500).json({ ok: false, error: msg });
  }
});
