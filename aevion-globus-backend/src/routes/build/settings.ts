import { Router } from "express";
import { buildPool as pool, ok, fail, requireBuildAuth } from "../../lib/build";

export const settingsRouter = Router();

type Prefs = {
  jobAlerts: boolean;
  applicationEmail: boolean;
  weeklyDigest: boolean;
  marketing: boolean;
  updatedAt?: string;
};

const DEFAULT_PREFS: Prefs = {
  jobAlerts: true,
  applicationEmail: true,
  weeklyDigest: true,
  marketing: true,
};

// GET /api/build/settings/notifications — current user's prefs.
// Returns defaults if no row exists yet.
settingsRouter.get("/notifications", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT "jobAlerts","applicationEmail","weeklyDigest","marketing","updatedAt"
       FROM "BuildNotifPrefs" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (r.rowCount === 0) {
      return ok(res, DEFAULT_PREFS);
    }
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "notifications_get_failed", { details: (err as Error).message });
  }
});

// PUT /api/build/settings/notifications — upsert all 4 toggles.
// Each field is optional; missing fields keep their existing value.
settingsRouter.put("/notifications", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const body = req.body ?? {};
    const next: Prefs = { ...DEFAULT_PREFS };
    // Read existing first so we only patch the requested fields.
    const cur = await pool.query(
      `SELECT "jobAlerts","applicationEmail","weeklyDigest","marketing"
       FROM "BuildNotifPrefs" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    if (cur.rowCount === 1) {
      Object.assign(next, cur.rows[0]);
    }
    for (const k of ["jobAlerts", "applicationEmail", "weeklyDigest", "marketing"] as const) {
      if (typeof body[k] === "boolean") next[k] = body[k] as boolean;
    }
    const r = await pool.query(
      `INSERT INTO "BuildNotifPrefs" ("userId","jobAlerts","applicationEmail","weeklyDigest","marketing","updatedAt")
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         "jobAlerts" = EXCLUDED."jobAlerts",
         "applicationEmail" = EXCLUDED."applicationEmail",
         "weeklyDigest" = EXCLUDED."weeklyDigest",
         "marketing" = EXCLUDED."marketing",
         "updatedAt" = NOW()
       RETURNING "jobAlerts","applicationEmail","weeklyDigest","marketing","updatedAt"`,
      [auth.sub, next.jobAlerts, next.applicationEmail, next.weeklyDigest, next.marketing],
    );
    return ok(res, r.rows[0]);
  } catch (err: unknown) {
    return fail(res, 500, "notifications_update_failed", { details: (err as Error).message });
  }
});
