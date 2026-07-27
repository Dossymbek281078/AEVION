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
import { gumroadPaymentProvider, verifyGumroadSale } from "../lib/payment/gumroadProvider";
import { provisionSubscription, writeSubscription, type Subscription } from "./provisioning";
import type { TierId } from "../data/pricing";
import { getPool } from "../lib/dbPool";
import { makeServiceCapture } from "../lib/sentry/platform";
import { hasSeenWebhook, markWebhookSeen, releaseWebhookKey } from "../lib/webhookDedup";

// DevHub Studio Pro: upgrade DevHubTier + DevHubEmailTier on purchase
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
    console.error("[gumroad/devhub] upgradeByEmail error:", err instanceof Error ? err.message : err);
  }
}

const capture = makeServiceCapture("gumroadWebhook");

export const gumroadWebhookRouter = Router();


// Tier products are sold via the same GUMROAD_PERMALINK_TIER_* permalinks the
// checkout layer builds the buy-URL from. Gumroad pings that permalink back, so
// we can reverse-map it to a tier reference here — no separate opaque
// GUMROAD_PRODUCT_<id> mapping needed for the four subscription tiers.
const TIER_PERMALINK_ENV: Record<string, string> = {
  GUMROAD_PERMALINK_TIER_LITE_MONTHLY: "tier_lite_monthly",
  GUMROAD_PERMALINK_TIER_LITE_ANNUAL: "tier_lite_annual",
  GUMROAD_PERMALINK_TIER_MEDIUM_MONTHLY: "tier_medium_monthly",
  GUMROAD_PERMALINK_TIER_MEDIUM_ANNUAL: "tier_medium_annual",
  GUMROAD_PERMALINK_TIER_FULL_MONTHLY: "tier_full_monthly",
  GUMROAD_PERMALINK_TIER_FULL_ANNUAL: "tier_full_annual",
};

/**
 * Code-level defaults for the permalinks that actually exist in the AEVION
 * Gumroad account (verified against the live dashboard 2026-07-26 — 8 products
 * Published). Env still wins: this map is consulted only AFTER the env-driven
 * branches, and only replaces the legacy `constitution-pro` catch-all below.
 *
 * WHY THIS EXISTS — without it, entitlement depended on env vars nobody had set,
 * and the catch-all silently mis-provisioned real money:
 *   - a $9.99 BOOK buyer fell through to "constitution-pro" → tierForReference()
 *     → "lite", i.e. a book purchase handed out a paid subscription tier. The
 *     comment on branch 0 already warned about exactly this, but the protection
 *     was opt-in via GUMROAD_EXTERNAL_PERMALINKS. Three book sales have already
 *     gone through this path (27/29 May, 2 June).
 *   - an "AEVION All-Access" $59/mo buyer likewise landed on "lite" unless
 *     GUMROAD_PERMALINK_TIER_FULL_MONTHLY happened to be set to xpxzam.
 *
 * Deliberately NOT listed: `wjvquw` (Constitution Team $49/mo). tierForReference()
 * maps anything containing "team" to `full` = the whole ecosystem, which is very
 * likely not what a Constitution-scoped product should grant. Leaving it on the
 * catch-all keeps today's behaviour; deciding what Team actually unlocks is a
 * product call, not a silent code change.
 */
const KNOWN_PERMALINK_REFERENCE: Record<string, string> = {
  // Books and one-off guides — files, not subscriptions. "external" stops
  // provisioning from granting any tier at all.
  orcfbo: "external", // Gratitude ∞ Forever Young — Book (PDF + EPUB) $9.99
  lelzw: "external",  // Gratitude ∞ Forever Young — Book + Audiobook $14.99
  ghvzq: "external",  // Gratitude ∞ Forever Young — Complete Pack $29.99
  tmuyxw: "external", // Протокол «Анти-седина» (RU) $9
  oijxmq: "external", // Протокол долголетия — 12 недель (RU) $19
  kkiavh: "external", // The Anti-Grey Protocol (EN) $19
  // Platform bundle — the whole ecosystem.
  xpxzam: "tier_full_monthly", // AEVION All-Access $59/mo
  // Constitution entry tier — same as the legacy default, made explicit.
  pyiaz: "constitution-pro", // Constitution Pro $9/mo
};

/** Last path segment of a Gumroad permalink or full product URL, lowercased.
 *  "https://aevion.gumroad.com/l/xpxzam?x=1" → "xpxzam"; "xpxzam" → "xpxzam". */
function permalinkSlug(v?: string | null): string {
  if (!v) return "";
  const noQuery = v.trim().replace(/\/+$/, "").split("?")[0];
  return (noQuery.split("/").pop() ?? noQuery).toLowerCase();
}

function resolveReference(raw: Record<string, string>): string {
  const pingSlug = permalinkSlug(raw.product_permalink ?? raw.permalink ?? raw.short_product_id);

  // 0. Explicit external / non-AEVION products (e.g. books on the shared Gumroad
  //    account) — comma-separated permalinks in GUMROAD_EXTERNAL_PERMALINKS.
  //    Without this they hit the constitution-pro default and wrongly grant a
  //    subscription to a book buyer.
  if (pingSlug) {
    const externals = (process.env.GUMROAD_EXTERNAL_PERMALINKS ?? "")
      .split(",").map((s) => permalinkSlug(s)).filter(Boolean);
    if (externals.includes(pingSlug)) return "external";
  }

  // 1. Subscription tiers — reverse-map the ping's permalink to a tier reference.
  if (pingSlug) {
    for (const [envKey, reference] of Object.entries(TIER_PERMALINK_ENV)) {
      if (permalinkSlug(process.env[envKey]) === pingSlug && pingSlug) return reference;
    }
  }

  // 2. Explicit per-product override by product_id.
  const productId = raw.product_id ?? raw.short_product_id ?? "";
  if (productId) {
    const envKey = `GUMROAD_PRODUCT_${productId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const mapped = process.env[envKey];
    if (mapped) return mapped;
  }

  // 3. DevHub Studio Pro — matched by env or default slug "studio-pro"
  const studioPro = permalinkSlug(process.env.GUMROAD_PERMALINK_DEVHUB_STUDIO_PRO ?? "studio-pro");
  if (pingSlug && pingSlug === studioPro) return "devhub-studio-pro";

  // 4. Known AEVION permalinks — code-level default so entitlement never depends
  //    on an env var that was never set. See KNOWN_PERMALINK_REFERENCE above.
  if (pingSlug && KNOWN_PERMALINK_REFERENCE[pingSlug]) {
    return KNOWN_PERMALINK_REFERENCE[pingSlug];
  }

  // 5. Legacy catch-all — keep Constitution Pro working without explicit mapping.
  return "constitution-pro";
}

function tierForReference(ref: string): TierId {
  const r = ref.toLowerCase();
  if (r.includes("medium")) return "medium";
  // all-access / business / team / full → вся экосистема
  if (r.includes("full") || r.includes("all-access") || r.includes("business") || r.includes("team")) return "full";
  // lite / pro / constitution-pro → входной тир
  return "lite";
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
    capture(err);
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
  if (hasSeenWebhook("gumroad", dedupKey)) return res.json({ ok: true, deduped: true });
  markWebhookSeen("gumroad", dedupKey);

  const reference = resolveReference(raw);

  // Products from other services (book platform etc.) share this Gumroad account
  // but don't need AEVION subscription provisioning — skip them silently.
  if (reference === "external") {
    console.log(`[gumroad/webhook] external product ${productId} — skipping`);
    return res.json({ ok: true, ignored: "external_product" });
  }

  // Подтверждение продажи, когда пинг не подписан.
  //
  // parseWebhook проверяет HMAC только при заданном GUMROAD_WEBHOOK_SECRET. На
  // проде 26.07.2026 секрет не задан, а Ping-адрес публично известен — то есть
  // любой POST с чужим email выдавал бы платный тариф без единого платежа.
  // Здесь мы спрашиваем у самого Gumroad, существует ли такая продажа.
  //
  // Отклоняем ТОЛЬКО при определённом «нет такой продажи». Если подтвердить не
  // удалось (нет токена, сеть, 5xx) — ведём себя как раньше и провижиним:
  // реальный покупатель не должен терять доступ из-за сбоя стороннего API.
  // Аварийный выключатель: GUMROAD_VERIFY_SALES=0.
  const signatureEnforced = Boolean(process.env.GUMROAD_WEBHOOK_SECRET);
  if (!signatureEnforced && process.env.GUMROAD_VERIFY_SALES !== "0") {
    const verdict = await verifyGumroadSale(saleId);
    if (verdict === "not_found") {
      console.warn(`[gumroad/webhook] sale ${saleId} not found in Gumroad API — rejecting 401`);
      releaseWebhookKey("gumroad", dedupKey); // не занимать ключ отклонённым пингом
      return res.status(401).json({ ok: false, error: "sale_not_found" });
    }
    if (verdict === "unverifiable") {
      console.warn(
        `[gumroad/webhook] sale ${saleId} unverifiable (no token or API unavailable) — provisioning anyway`,
      );
    }
  }

  // DevHub Studio Pro — upgrades DevHubTier, not the main subscription tier.
  if (reference === "devhub-studio-pro") {
    const devhubTier = (refunded || failed) ? "free" : result.status === "paid" ? "pro" : null;
    if (devhubTier) {
      await upgradeDevHubByEmail(email, devhubTier);
      console.log(`[gumroad/webhook] devhub-studio-pro → tier=${devhubTier} for ${email}`);
      return res.json({ ok: true, action: "devhub_tier_set", tier: devhubTier, email });
    }
    return res.json({ ok: true, ignored: result.status });
  }

  // Bureau Verified one-time upgrade: match by email to the latest pending
  // BureauVerification row (KYC approved but payment not yet confirmed).
  if (reference === "bureau-verified") {
    if (refunded || failed) {
      console.log(`[gumroad/webhook] bureau ${result.status} for ${email} — ignored (one-time, no downgrade)`);
      return res.json({ ok: true, ignored: `bureau_${result.status}` });
    }
    if (result.status === "paid") {
      try {
        const pool = getPool();
        const intentId = `gumroad:sale:${saleId}`;
        const { rowCount } = await pool.query(
          `UPDATE "BureauVerification"
              SET "paymentStatus" = 'paid',
                  "paymentProvider" = 'gumroad',
                  "paymentIntentId" = $1
            WHERE "email" = $2
              AND "kycStatus" = 'approved'
              AND "paymentStatus" = 'unpaid'
              AND "id" = (
                SELECT "id" FROM "BureauVerification"
                 WHERE "email" = $2
                   AND "kycStatus" = 'approved'
                   AND "paymentStatus" = 'unpaid'
                 ORDER BY "createdAt" DESC
                 LIMIT 1
              )`,
          [intentId, email],
        );
        if ((rowCount ?? 0) > 0) {
          console.log(`[gumroad/webhook] bureau paid — marked verification for ${email}`);
          return res.json({ ok: true, action: "bureau_verified", email });
        } else {
          console.warn(`[gumroad/webhook] bureau paid — no pending verification for ${email}`);
          return res.json({ ok: true, action: "bureau_no_match", email });
        }
      } catch (err) {
        capture(err);
        console.error("[gumroad/webhook] bureau DB error:", err instanceof Error ? err.message : err);
        return res.status(500).json({ ok: false, error: "bureau_db_failed" });
      }
    }
    return res.json({ ok: true, ignored: result.status });
  }

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
    releaseWebhookKey("gumroad", dedupKey);
    capture(err);
    console.error("[gumroad/webhook] handler error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "handler_failed" });
  }
});
