/**
 * Gumroad webhook handler — platform-wide.
 *
 *   POST /api/gumroad/webhook
 *
 * Handles Gumroad "ping" events for ALL AEVION products:
 *   - Bureau single-purchase (Verified tier, All-Access, bundles)
 *   - Constitution Pro / Team memberships
 *   - Any product whose Gumroad ping points to this URL
 *
 * Gumroad sends application/x-www-form-urlencoded POST.
 * Required env: GUMROAD_ACCESS_TOKEN (for identity confirmation if needed)
 * Optional env: GUMROAD_WEBHOOK_SECRET (for signature verification)
 *
 * Product routing:
 *   product_id / short_product_id is matched against
 *   GUMROAD_PRODUCT_<ID>=<reference>  env vars.
 *   If no match, falls back to "default" → generic Pro upgrade.
 *
 * References:
 *   https://help.gumroad.com/article/53-webhooks
 *   https://help.gumroad.com/article/56-ping
 */

import { Router, type Request, type Response } from "express";
import { gumroadPaymentProvider } from "../lib/payment/gumroadProvider";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";

export const gumroadWebhookRouter = Router();

const SEEN = new Set<string>();

function resolveReferenceFromProductId(productId: string): string {
  const envKey = `GUMROAD_PRODUCT_${productId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[envKey] ?? "constitution-pro";
}

function tierForReference(ref: string): "pro" | "business" {
  if (ref === "all-access" || ref.includes("all-access") || ref.includes("business")) return "business";
  return "pro";
}

function isConstitutionProduct(ref: string): boolean {
  return ref.includes("constitution");
}

// Liveness probe — Gumroad sends only POST, but a GET in the browser used to
// answer "Cannot GET" which looks like the URL is broken when configuring the
// webhook. Return a tiny JSON manifest instead so admins can sanity-check the
// endpoint by visiting it.
gumroadWebhookRouter.get("/webhook", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoint: "gumroad webhook",
    accepts: "POST application/x-www-form-urlencoded",
    signed: Boolean(process.env.GUMROAD_WEBHOOK_SECRET),
    info: "Gumroad sends sale/refund pings here as POST form-encoded. GET is for liveness check only.",
  });
});

gumroadWebhookRouter.post("/webhook", async (req: Request, res: Response) => {
  // Gumroad sends form-encoded — grab raw body for signature check
  const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
  const rawBody = rawBuf ? rawBuf.toString("utf8") : "";

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
  }

  let parsed: ReturnType<typeof gumroadPaymentProvider.parseWebhook>;
  try {
    parsed = gumroadPaymentProvider.parseWebhook(headers, rawBody);
  } catch (err) {
    console.error("[gumroad/webhook] parse error:", err);
    return res.status(400).json({ ok: false, error: "parse_failed" });
  }

  const { result, eventId } = parsed;

  // Reject a bad HMAC explicitly. parseWebhook signals a signature mismatch
  // via reason:"invalid_signature" with an emptied raw — without this guard
  // that would fall through to the no_email branch and answer 200, masking a
  // forged/misconfigured ping as a benign "no email" and telling Gumroad the
  // delivery succeeded. 401 makes rejection observable and retryable.
  if (result.reason === "invalid_signature") {
    console.warn("[gumroad/webhook] invalid signature — rejecting 401");
    return res.status(401).json({ ok: false, error: "invalid_signature" });
  }

  const raw = result.raw as Record<string, string> | null ?? {};

  const saleId = raw.sale_id ?? raw.id ?? eventId ?? "";
  const email = (raw.email ?? "").trim().toLowerCase();
  const productId = raw.product_id ?? raw.short_product_id ?? "";
  const refunded = result.status === "refunded";
  const failed = result.status === "failed";
  const isMembership = raw.is_recurring_billing === "true";

  if (!email) {
    console.warn("[gumroad/webhook] missing email, ignoring");
    return res.json({ ok: true, ignored: "no_email" });
  }

  // Dedup on sale_id + status
  const dedupKey = `${saleId}:${result.status}`;
  if (SEEN.has(dedupKey)) return res.json({ ok: true, deduped: true });
  SEEN.add(dedupKey);

  const reference = resolveReferenceFromProductId(productId);

  try {
    if (refunded || failed) {
      // Downgrade to free
      const downgrade: Subscription = {
        id: `sub_gumroad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ts: new Date().toISOString(),
        email,
        tierId: "free",
        period: "monthly",
        seats: 1,
        modules: [],
        trialDays: 0,
        source: `gumroad:${result.status}`,
      };
      writeSubscription(downgrade);
      console.log(`[gumroad/webhook] ${result.status} → downgraded ${email} to free`);
      return res.json({ ok: true, action: "downgraded", email });
    }

    if (result.status === "paid") {
      const tierId = tierForReference(reference);
      const period = isMembership ? "monthly" : "monthly"; // Gumroad one-time → treat as monthly for provisioning

      const provResult = await provisionSubscription({
        email,
        tierId,
        period,
        modules: [],
        source: "gumroad",
      });

      console.log(`[gumroad/webhook] paid → provisioned ${tierId} for ${email} (ref=${reference} product=${productId})`);

      return res.json({
        ok: true,
        action: "activated",
        tierId,
        email,
        subscriptionId: provResult.subscription.id,
        isConstitution: isConstitutionProduct(reference),
      });
    }

    return res.json({ ok: true, ignored: result.status });
  } catch (err) {
    SEEN.delete(dedupKey);
    console.error("[gumroad/webhook] handler error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "handler_failed" });
  }
});
