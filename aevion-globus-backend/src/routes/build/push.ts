import { Router } from "express";
import crypto from "crypto";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  vString,
} from "../../lib/build";

export const pushRouter = Router();

// Web Push subscriptions for QBuild. The frontend uses the standard
// Push API (navigator.serviceWorker.pushManager.subscribe) and posts the
// resulting PushSubscription JSON here. We store endpoint + p256dh +
// auth and use web-push to fan out notifications.
//
// VAPID keys are loaded lazily from env so an unconfigured deploy can
// still boot — sendToUser() becomes a no-op until keys are present.

let _wp: typeof import("web-push") | null = null;
let _wpReady = false;

async function getWebPush() {
  if (_wp) return _wp;
  const wp = (await import("web-push")).default;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@aevion.io";
  if (pub && priv) {
    wp.setVapidDetails(subject, pub, priv);
    _wpReady = true;
  }
  _wp = wp;
  return wp;
}

// GET /api/build/push/public-key — returns the VAPID public key for
// the browser to call subscribe(). Empty string when unconfigured.
pushRouter.get("/public-key", (_req, res) => {
  return ok(res, { publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || "" });
});

// POST /api/build/push/subscribe — register or refresh a subscription.
pushRouter.post("/subscribe", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const endpoint = vString(req.body?.endpoint, "endpoint", { min: 10, max: 1000 });
    if (!endpoint.ok) return fail(res, 400, endpoint.error);
    const keys = req.body?.keys ?? {};
    const p256dh = vString(keys.p256dh, "keys.p256dh", { min: 10, max: 500 });
    if (!p256dh.ok) return fail(res, 400, p256dh.error);
    const authKey = vString(keys.auth, "keys.auth", { min: 4, max: 500 });
    if (!authKey.ok) return fail(res, 400, authKey.error);

    // Upsert by endpoint — refreshes the userId if the same browser
    // signs in as a different account.
    const existing = await pool.query(
      `SELECT "id" FROM "BuildPushSubscription" WHERE "endpoint" = $1 LIMIT 1`,
      [endpoint.value],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await pool.query(
        `UPDATE "BuildPushSubscription"
           SET "userId" = $1, "p256dh" = $2, "auth" = $3
         WHERE "id" = $4`,
        [auth.sub, p256dh.value, authKey.value, existing.rows[0].id],
      );
      return ok(res, { id: existing.rows[0].id, refreshed: true });
    }

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "BuildPushSubscription" ("id","userId","endpoint","p256dh","auth")
       VALUES ($1,$2,$3,$4,$5)`,
      [id, auth.sub, endpoint.value, p256dh.value, authKey.value],
    );
    return ok(res, { id, refreshed: false }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "push_subscribe_failed", { details: (err as Error).message });
  }
});

// POST /api/build/push/unsubscribe — drop a subscription by endpoint.
pushRouter.post("/unsubscribe", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const endpoint = vString(req.body?.endpoint, "endpoint", { min: 10, max: 1000 });
    if (!endpoint.ok) return fail(res, 400, endpoint.error);
    const r = await pool.query(
      `DELETE FROM "BuildPushSubscription" WHERE "endpoint" = $1 AND "userId" = $2`,
      [endpoint.value, auth.sub],
    );
    return ok(res, { removed: r.rowCount ?? 0 });
  } catch (err: unknown) {
    return fail(res, 500, "push_unsubscribe_failed", { details: (err as Error).message });
  }
});

// POST /api/build/push/test — fan out a test notification to the
// caller's own subscriptions. Useful for the settings page "send test"
// button. Real product events use sendToUser() below.
pushRouter.post("/test", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const sent = await sendToUser(auth.sub, {
      title: "AEVION QBuild",
      body: "Push уведомления работают.",
      url: "/build",
    });
    return ok(res, sent);
  } catch (err: unknown) {
    return fail(res, 500, "push_test_failed", { details: (err as Error).message });
  }
});

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send a push to every subscription owned by userId. Cleans up dead
 * (410 Gone) endpoints automatically. Returns counters so callers can
 * log without parsing arrays.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number; configured: boolean }> {
  const wp = await getWebPush();
  if (!_wpReady) return { sent: 0, removed: 0, configured: false };

  const r = await pool.query(
    `SELECT "id","endpoint","p256dh","auth" FROM "BuildPushSubscription" WHERE "userId" = $1`,
    [userId],
  );
  if (r.rowCount === 0) return { sent: 0, removed: 0, configured: true };

  const json = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  for (const row of r.rows as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>) {
    try {
      await wp.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        json,
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await pool.query(`DELETE FROM "BuildPushSubscription" WHERE "id" = $1`, [row.id]);
        removed++;
      } else {
        console.warn("[push] send failed:", (err as Error).message);
      }
    }
  }
  return { sent, removed, configured: true };
}
