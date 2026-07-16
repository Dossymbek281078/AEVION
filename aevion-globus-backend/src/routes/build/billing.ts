import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vEnum,
  safeParseJson,
  getUserPlan,
  ensureUsageRow,
  isUnlimited,
  currentMonthKey,
  getRecruiterTier,
  applyBpsDiscount,
  PLAN_KEYS,
} from "../../lib/build";

export const billingRouter = Router();

// Guards the "mark order paid without a real payment" code paths. Allowed only
// outside production, or when BUILD_DEV_PAY=1 is explicitly set. In production
// these paths must stay closed so no one can activate a subscription or mint
// cashback without a genuine payment settled through the hosted channel.
function devPayAllowed(): boolean {
  if (process.env.BUILD_DEV_PAY === "1") return true;
  return (process.env.NODE_ENV || "").toLowerCase() !== "production";
}

async function markOrderPaid(
  orderId: string,
): Promise<{ order: Record<string, unknown>; alreadyPaid: boolean }> {
  await pool.query("BEGIN");
  try {
    const cur = await pool.query(`SELECT * FROM "BuildOrder" WHERE "id" = $1 FOR UPDATE`, [orderId]);
    if (cur.rowCount === 0) { await pool.query("ROLLBACK"); throw new Error("order_not_found"); }
    const row = cur.rows[0];
    if (row.status === "PAID") { await pool.query("ROLLBACK"); return { order: row, alreadyPaid: true }; }
    if (row.status !== "PENDING") { await pool.query("ROLLBACK"); throw new Error(`order_not_payable_status_${row.status}`); }

    const updated = await pool.query(`UPDATE "BuildOrder" SET "status" = 'PAID' WHERE "id" = $1 RETURNING *`, [orderId]);

    if (row.kind === "SUB_START" && row.ref) {
      await pool.query(`UPDATE "BuildSubscription" SET "status" = 'CANCELED', "endsAt" = NOW() WHERE "userId" = $1 AND "status" = 'ACTIVE' AND "id" <> $2`, [row.userId, row.ref]);
      await pool.query(`UPDATE "BuildSubscription" SET "status" = 'ACTIVE', "startedAt" = NOW() WHERE "id" = $1`, [row.ref]);
    }

    const orderAmount = Number(row.amount) || 0;
    if (orderAmount > 0) {
      const { tier } = await getRecruiterTier(row.userId);
      const rate = tier.cashbackBps / 10000;
      const cashbackAev = Math.round(orderAmount * rate * 1_000_000) / 1_000_000;
      await pool.query(
        `INSERT INTO "BuildCashback" ("id","userId","orderId","orderKind","orderAmount","orderCurrency","cashbackAev")
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("orderId") DO NOTHING`,
        [crypto.randomUUID(), row.userId, row.id, row.kind, orderAmount, row.currency || "RUB", cashbackAev],
      );
    }

    await pool.query("COMMIT");
    return { order: updated.rows[0], alreadyPaid: false };
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

// GET /api/build/usage/me
billingRouter.get("/usage/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const plan = await getUserPlan(auth.sub);
    const usage = await ensureUsageRow(auth.sub);
    const active = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "BuildVacancy" v JOIN "BuildProject" p ON p."id" = v."projectId"
       WHERE p."clientId" = $1 AND v."status" = 'OPEN'`,
      [auth.sub],
    );
    const activeVacancies = active.rows[0]?.c ?? 0;

    return ok(res, {
      plan, usage, monthKey: currentMonthKey(), activeVacancies,
      limits: {
        vacanciesRemaining: isUnlimited(plan.vacancySlots) ? -1 : Math.max(0, plan.vacancySlots - activeVacancies),
        talentSearchesRemaining: isUnlimited(plan.talentSearchPerMonth) ? -1 : Math.max(0, plan.talentSearchPerMonth - usage.talentSearches),
        boostsRemaining: isUnlimited(plan.boostsPerMonth) ? -1 : Math.max(0, plan.boostsPerMonth - usage.boostsUsed),
      },
    });
  } catch (err: unknown) {
    return fail(res, 500, "usage_me_failed");
  }
});

// GET /api/build/plans — public catalog
billingRouter.get("/plans", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT "key","name","tagline","priceMonthly","currency","vacancySlots","talentSearchPerMonth","boostsPerMonth","hireFeeBps","featuresJson","sortOrder"
       FROM "BuildPlan" WHERE "active" = TRUE ORDER BY "sortOrder" ASC`,
    );
    const items = result.rows.map((r: Record<string, unknown>) => ({ ...r, features: safeParseJson(r.featuresJson, [] as string[]) }));
    res.setHeader("Cache-Control", "public, max-age=300");
    return ok(res, { items, total: items.length });
  } catch (err: unknown) {
    return fail(res, 500, "plans_list_failed");
  }
});

// GET /api/build/subscriptions/me
billingRouter.get("/subscriptions/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const sub = await pool.query(
      `SELECT s.*, p."name" AS "planName", p."priceMonthly", p."currency",
              p."vacancySlots", p."talentSearchPerMonth", p."boostsPerMonth", p."hireFeeBps"
       FROM "BuildSubscription" s LEFT JOIN "BuildPlan" p ON p."key" = s."planKey"
       WHERE s."userId" = $1 AND s."status" = 'ACTIVE' ORDER BY s."createdAt" DESC LIMIT 1`,
      [auth.sub],
    );
    if (sub.rowCount === 0) return ok(res, { subscription: null });
    return ok(res, { subscription: sub.rows[0] });
  } catch (err: unknown) {
    return fail(res, 500, "subscription_me_failed");
  }
});

// POST /api/build/subscriptions/start
billingRouter.post("/subscriptions/start", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const planKey = vEnum(
      typeof req.body?.planKey === "string" ? req.body.planKey.slice(0, 50) : req.body?.planKey,
      "planKey",
      PLAN_KEYS,
    );
    if (!planKey.ok) return fail(res, 400, planKey.error);

    const plan = await pool.query(
      `SELECT "key","priceMonthly","currency" FROM "BuildPlan" WHERE "key" = $1 AND "active" = TRUE LIMIT 1`,
      [planKey.value],
    );
    if (plan.rowCount === 0) return fail(res, 404, "plan_not_found");
    const planRow = plan.rows[0];

    const { tier: payerTier } = await getRecruiterTier(auth.sub);
    const baseAmount = Number(planRow.priceMonthly) || 0;
    const discountedAmount = applyBpsDiscount(baseAmount, payerTier.subDiscountBps);
    const isFreeStart = planRow.priceMonthly === 0;
    const subStatus = isFreeStart ? "ACTIVE" : "PENDING";
    const orderStatus = isFreeStart ? "PAID" : "PENDING";

    await pool.query("BEGIN");
    try {
      await pool.query(
        `UPDATE "BuildSubscription" SET "status" = 'CANCELED', "endsAt" = NOW() WHERE "userId" = $1 AND "status" = 'ACTIVE'`,
        [auth.sub],
      );

      const subId = crypto.randomUUID();
      const subResult = await pool.query(
        `INSERT INTO "BuildSubscription" ("id","userId","planKey","status") VALUES ($1,$2,$3,$4) RETURNING *`,
        [subId, auth.sub, planKey.value, subStatus],
      );

      const orderId = crypto.randomUUID();
      const orderResult = await pool.query(
        `INSERT INTO "BuildOrder" ("id","userId","kind","ref","amount","currency","status","metaJson")
         VALUES ($1,$2,'SUB_START',$3,$4,$5,$6,$7) RETURNING *`,
        [orderId, auth.sub, subId, discountedAmount, planRow.currency, orderStatus,
          JSON.stringify({ planKey: planKey.value, tierKey: payerTier.key, baseAmount, tierDiscountBps: payerTier.subDiscountBps, tierDiscountAmount: baseAmount - discountedAmount })],
      );

      await pool.query("COMMIT");
      return ok(res, { subscription: subResult.rows[0], order: orderResult.rows[0] }, 201);
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "subscription_start_failed");
  }
});

// GET /api/build/orders/me
billingRouter.get("/orders/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const result = await pool.query(
      `SELECT * FROM "BuildOrder" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [auth.sub],
    );
    return ok(res, { items: result.rows, total: result.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "orders_me_failed");
  }
});

// POST /api/build/orders/:id/checkout — hand the order off to the configured
// hosted payment channel and return { url } for the browser to complete payment.
// We use hosted links (Gumroad is live today; LemonSqueezy once KYC clears)
// rather than a server-side vendor API, so there is no payment-provider secret
// to store or rotate here — only BUILD_CHECKOUT_URL. On success the channel
// calls POST /api/build/webhooks/payment (generic HMAC), which marks the order
// PAID and mints cashback.
billingRouter.post("/orders/:id/checkout", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const order = await pool.query(`SELECT * FROM "BuildOrder" WHERE "id" = $1 LIMIT 1`, [id]);
    if (order.rowCount === 0) return fail(res, 404, "order_not_found");
    const row = order.rows[0];
    if (row.userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    if (row.status === "PAID") return ok(res, { alreadyPaid: true });
    if (row.status !== "PENDING") return fail(res, 400, "order_not_payable", { currentStatus: row.status });

    const checkoutBase = process.env.BUILD_CHECKOUT_URL?.trim();
    if (!checkoutBase) {
      if (!devPayAllowed()) {
        return fail(res, 503, "billing_not_configured", {
          hint: "Payment channel is not configured (set BUILD_CHECKOUT_URL to a Gumroad/LemonSqueezy link).",
        });
      }
      // Dev mode only: immediately mark as paid
      const result = await markOrderPaid(id);
      return ok(res, { devMode: true, order: result.order });
    }

    const provider = process.env.BUILD_CHECKOUT_PROVIDER?.trim() || "hosted";
    const amount = Number(row.amount) || 0;
    const currency = String(row.currency || "RUB").toUpperCase().slice(0, 3);
    // Thread the order id through the hosted link so both the thank-you redirect
    // and the webhook can reconcile it. We surface it under every convention we
    // support: a plain ?orderId= (Gumroad forwards unknown query params as
    // url_params) and checkout[custom][orderId] (LemonSqueezy exposes it as
    // meta.custom_data). Unknown params are ignored by whichever channel is live.
    const params = new URLSearchParams({
      orderId: id,
      "checkout[custom][orderId]": id,
      order_amount: String(amount),
      order_currency: currency,
    });
    const sep = checkoutBase.includes("?") ? "&" : "?";
    const url = `${checkoutBase}${sep}${params.toString()}`;
    return ok(res, { url, provider, orderId: id });
  } catch (err: unknown) {
    return fail(res, 500, "checkout_session_failed");
  }
});

// POST /api/build/orders/:id/pay
billingRouter.post("/orders/:id/pay", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const id = String(req.params.id);
    const order = await pool.query(`SELECT * FROM "BuildOrder" WHERE "id" = $1 LIMIT 1`, [id]);
    if (order.rowCount === 0) return fail(res, 404, "order_not_found");
    const row = order.rows[0];
    if (row.userId !== auth.sub && auth.role !== "ADMIN") return fail(res, 403, "not_owner");
    if (row.status === "PAID") return ok(res, { order: row, alreadyPaid: true });
    if (row.status !== "PENDING") return fail(res, 400, "order_not_payable", { currentStatus: row.status });

    // Direct no-payment settlement is a dev helper only. In production, callers
    // must pay via POST /orders/:id/checkout (hosted channel) + the webhook.
    if (!devPayAllowed()) {
      return fail(res, 403, "direct_pay_disabled", {
        hint: "Use POST /api/build/orders/:id/checkout to pay via the payment provider.",
      });
    }

    const result = await markOrderPaid(id);
    return ok(res, { order: result.order });
  } catch (err: unknown) {
    return fail(res, 500, "order_pay_failed");
  }
});

// POST /api/build/webhooks/payment — hosted-channel payment webhook.
// Verifies an HMAC-SHA256 signature (hex) of the raw body against
// BUILD_PAYMENT_WEBHOOK_SECRET. Compatible with LemonSqueezy (X-Signature) and
// our own signed relay / test events (x-aevion-signature). On a success event
// the referenced order is marked PAID (→ cashback mint); on a failure event a
// still-PENDING order is canceled.
billingRouter.post("/webhooks/payment", async (req, res) => {
  try {
    const secret = (process.env.BUILD_PAYMENT_WEBHOOK_SECRET || "").trim();
    const remoteAddr = (req.ip || (req.socket && req.socket.remoteAddress) || "").toString();
    const isLocal = /^(127\.|::1|::ffff:127\.|localhost)/.test(remoteAddr);

    if (secret) {
      // Both LemonSqueezy (X-Signature) and our relay/test events (x-aevion-signature)
      // send a hex HMAC-SHA256 of the raw request body keyed by the shared secret.
      const sigHeader = (
        req.headers["x-signature"] ||
        req.headers["x-aevion-signature"] ||
        ""
      ).toString();
      const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
      const canonical = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});
      const expected = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
      if (sigHeader.length !== expected.length ||
          !crypto.timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"))) {
        return fail(res, 401, "invalid_signature");
      }
    } else if (!isLocal) {
      return fail(res, 503, "webhook_secret_not_configured");
    }

    // Extract event name + order id across the shapes our channels emit:
    //   - our relay / smoke: { event|event_type, orderId }
    //   - LemonSqueezy:      { meta: { event_name, custom_data: { orderId } } }
    //   - Gumroad:           form fields incl. url_params[orderId] (+ resource)
    const body = (req.body || {}) as Record<string, unknown>;
    const meta = (body.meta || {}) as Record<string, unknown>;
    const metaCustom = (meta.custom_data || {}) as Record<string, string>;
    const dataObj = (body.data as Record<string, unknown>) || {};
    const dataCustom = (dataObj.custom_data || {}) as Record<string, string>;
    const urlParams = (body.url_params || {}) as Record<string, string>;

    const eventType = String(
      body.event_type || body.event || meta.event_name || "",
    ).trim();
    const orderId =
      metaCustom["orderId"] ||
      dataCustom["orderId"] ||
      dataCustom["buildOrderId"] ||
      urlParams["orderId"] ||
      String(body.orderId || "").trim();
    if (!orderId) return fail(res, 400, "orderId_required");

    const SUCCESS = new Set([
      "payment.succeeded", "transaction.completed",
      "order_created", "subscription_payment_success", "sale",
    ]);
    const FAILURE = new Set([
      "payment.failed", "transaction.payment_failed",
      "order_refunded", "subscription_payment_failed",
    ]);

    if (SUCCESS.has(eventType)) {
      try {
        const result = await markOrderPaid(orderId);
        return ok(res, { processed: true, orderId, alreadyPaid: result.alreadyPaid, order: result.order });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "order_not_found") return fail(res, 404, "order_not_found");
        if (msg.startsWith("order_not_payable_status_")) return fail(res, 409, "order_not_payable", { reason: msg });
        throw err;
      }
    }
    if (FAILURE.has(eventType)) {
      const upd = await pool.query(
        `UPDATE "BuildOrder" SET "status" = 'CANCELED' WHERE "id" = $1 AND "status" = 'PENDING' RETURNING "id","status"`,
        [orderId],
      );
      return ok(res, { processed: true, orderId, status: upd.rows[0]?.status || "noop" });
    }
    // Unknown event — acknowledge so the channel does not retry.
    return ok(res, { processed: false, ignored: true, event: eventType });
  } catch (err: unknown) {
    return fail(res, 500, "webhook_failed");
  }
});
