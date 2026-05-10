import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail } from "../../lib/build";

export const leadsRouter = Router();

// POST /api/build/leads — public email capture, no auth required.
leadsRouter.post("/", async (req, res) => {
  try {
    const emailRaw = String(req.body?.email ?? "").trim();
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 200) {
      return fail(res, 400, "invalid_email");
    }
    const city = req.body?.city == null ? null : String(req.body.city).trim().slice(0, 120) || null;
    const locale = ["ru", "en", "kz"].includes(String(req.body?.locale))
      ? String(req.body.locale)
      : "ru";
    const source =
      typeof req.body?.source === "string"
        ? String(req.body.source).trim().slice(0, 64) || "why-aevion"
        : "why-aevion";

    const existing = await pool.query(
      `SELECT "id" FROM "BuildLead" WHERE lower("email") = lower($1) AND "source" = $2 LIMIT 1`,
      [emailRaw, source],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return ok(res, { alreadyExists: true });
    }

    const sliceOpt = (v: unknown): string | null =>
      v == null ? null : String(v).trim().slice(0, 200) || null;

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "BuildLead"
         ("id","email","city","locale","source","referrer","utmSource","utmCampaign")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (lower("email"), "source") DO NOTHING`,
      [
        id, emailRaw, city, locale, source,
        sliceOpt(req.body?.referrer),
        sliceOpt(req.body?.utmSource),
        sliceOpt(req.body?.utmCampaign),
      ],
    );
    return ok(res, { alreadyExists: false }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "lead_create_failed", { details: (err as Error).message });
  }
});
