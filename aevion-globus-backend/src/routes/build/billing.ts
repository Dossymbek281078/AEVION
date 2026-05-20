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

// POST /api/build/orders/:id/checkout — create a Paddle transaction checkout.
// Returns { url } — redirect the browser there to complete payment.
// On success Paddle calls /api/build/webhooks/payment via build webhook route.
// Falls back to dev-mode payOrder stub if PADDLE_API_KEY is not set.
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

    const paddleKey = process.env.PADDLE_API_KEY?.trim();
    const frontendUrl = (process.env.FRONTEND_URL || "https://aevion.app").replace(/\/+$/, "");

    if (!paddleKey) {
      // Dev mode: immediately mark as paid
      const result = await markOrderPaid(id);
      return ok(res, { devMode: true, order: result.order });
    }

    const isSandbox = process.env.PADDLE_SANDBOX !== "false";
    const paddleBase = isSandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
    const amountCents = Math.round(Number(row.amount) * 100);
    const currency = String(row.currency || "USD").toUpperCase().slice(0, 3);

    const txBody = {
      items: [{
        quantity: 1,
        price: {
          name: `AEVION QBuild — ${String(row.kind).replace("_", " ")}`,
          description: `Order #${id.slice(0, 8)}`,
          unit_price: { amount: String(amountCents), currency_code: currency },
          tax_mode: "exclusive",
          custom_data: { buildOrderId: id, userId: auth.sub },
        },
      }],
      custom_data: { buildOrderId: id, userId: auth.sub },
      checkout: { url: `${frontendUrl}/build?payment=success&orderId=${id}` },
    };

    const r = await fetch(`${paddleBase}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${paddleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(txBody),
    });

    if (!r.ok) {
      console.error("[build-billing] Paddle error", r.status, await r.text().catch(() => ""));
      return fail(res, 500, "checkout_session_failed");
    }

    const data = await r.json() as { data?: { id: string; checkout?: { url: string } } };
    const tx = data.data;
    if (!tx?.id) return fail(res, 500, "checkout_session_failed");

    const url = tx.checkout?.url ?? `${paddleBase.replace("api.", "")}/checkout/${tx.id}`;
    return ok(res, { url, transactionId: tx.id, provider: "paddle" });
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

    const result = await markOrderPaid(id);
    return ok(res, { order: result.order });
  } catch (err: unknown) {
    return fail(res, 500, "order_pay_failed");
  }
});

// POST /api/build/webhooks/payment — Paddle webhook handler
billingRouter.post("/webhooks/payment", async (req, res) => {
  try {
    const secret = (process.env.BUILD_PAYMENT_WEBHOOK_SECRET || "").trim();
    const remoteAddr = (req.ip || (req.socket && req.socket.remoteAddress) || "").toString();
    const isLocal = /^(127\.|::1|::ffff:127\.|localhost)/.test(remoteAddr);

    if (secret) {
      // Paddle signature format: Paddle-Signature: ts=<unix>;h1=<hmac-sha256>
      const paddleSig = (req.headers["paddle-signature"] || "").toString();
      if (paddleSig) {
        const parts = Object.fromEntries(paddleSig.split(";").map((p) => p.split("=")));
        const ts = parts["ts"] || "";
        const h1 = parts["h1"] || "";
        const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
        const body = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});
        const signed = `${ts}:${body}`;
        const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
        if (!h1 || h1.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(expected, "hex"))) {
          return fail(res, 401, "invalid_signature");
        }
        // Replay protection: reject events older than 5 minutes
        const nowSec = Math.floor(Date.now() / 1000);
        if (!ts || Math.abs(nowSec - Number(ts)) > 300) {
          return fail(res, 401, "timestamp_outside_tolerance");
        }
      } else {
        // Legacy x-aevion-signature (smoke tests)
        const sigHeader = (req.headers["x-aevion-signature"] || "").toString();
        const rawBuf = (req as unknown as { rawBody?: Buffer }).rawBody;
        const canonical = rawBuf ? rawBuf.toString("utf8") : JSON.stringify(req.body ?? {});
        const expected = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
        if (sigHeader.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"))) {
          return fail(res, 401, "invalid_signature");
        }
      }
    } else if (!isLocal) {
      return fail(res, 503, "webhook_secret_not_configured");
    }

    // Parse Paddle event
    const eventType = String(req.body?.event_type || req.body?.event || "").trim();
    const txData = req.body?.data as Record<string, unknown> | undefined;
    const customData = (txData?.custom_data || {}) as Record<string, string>;

    // Support both Paddle (buildOrderId in custom_data) and legacy (orderId in body)
    const orderId = customData["buildOrderId"] || String(req.body?.orderId || "").trim();
    if (!orderId) return fail(res, 400, "orderId_required");

    if (eventType === "transaction.completed" || eventType === "payment.succeeded") {
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
    if (eventType === "transaction.payment_failed" || eventType === "payment.failed") {
      const upd = await pool.query(
        `UPDATE "BuildOrder" SET "status" = 'CANCELED' WHERE "id" = $1 AND "status" = 'PENDING' RETURNING "id","status"`,
        [orderId],
      );
      return ok(res, { processed: true, orderId, status: upd.rows[0]?.status || "noop" });
    }
    // Unknown event — acknowledge to prevent Paddle retries
    return ok(res, { processed: false, ignored: true, event: eventType });
  } catch (err: unknown) {
    return fail(res, 500, "webhook_failed");
  }
});
