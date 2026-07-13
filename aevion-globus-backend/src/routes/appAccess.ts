/**
 * /api/apps/access — query which individual app subscriptions are active.
 *
 * GET /api/apps/access?email=<email>
 *   → { apps: ["qventure", "qpaynet", ...] }
 *   Public by email (no auth required — same pattern as /api/pricing/subscription/me).
 *
 * GET /api/apps/access/check?email=<email>&app=<slug>
 *   → { active: true|false }
 *   Convenience check for a single app.
 */

import { Router } from "express";
import { getPool } from "../lib/dbPool";

export const appAccessRouter = Router();

appAccessRouter.get("/", async (req, res) => {
  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`,
      [email],
    );
    return res.json({ apps: result.rows.map((r: { appSlug: string }) => r.appSlug) });
  } catch (err) {
    console.error("[appAccess] query error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "db error" });
  }
});

appAccessRouter.get("/check", async (req, res) => {
  const email = String(req.query.email ?? "").trim().toLowerCase();
  const app = String(req.query.app ?? "").trim().toLowerCase();
  if (!email || !app) return res.status(400).json({ error: "email and app required" });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 1 FROM "AppSubscription" WHERE "email"=$1 AND "appSlug"=$2 AND "status"='active' LIMIT 1`,
      [email, app],
    );
    return res.json({ active: result.rowCount! > 0 });
  } catch (err) {
    console.error("[appAccess] check error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "db error" });
  }
});
