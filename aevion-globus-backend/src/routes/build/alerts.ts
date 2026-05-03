import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, vString } from "../../lib/build";

export const alertsRouter = Router();

// GET /api/build/alerts/me — my job alert subscription
alertsRouter.get("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT * FROM "BuildJobAlert" WHERE "userId" = $1 LIMIT 1`,
      [auth.sub],
    );
    return ok(res, { alert: r.rows[0] ?? null });
  } catch (err: unknown) {
    return fail(res, 500, "alerts_me_failed", { details: (err as Error).message });
  }
});

// POST /api/build/alerts — upsert job alert subscription
alertsRouter.post("/", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const keywords = vString(req.body?.keywords ?? "", "keywords", { max: 500, allowEmpty: true });
    if (!keywords.ok) return fail(res, 400, keywords.error);

    const skills = vString(req.body?.skills ?? "", "skills", { max: 500, allowEmpty: true });
    if (!skills.ok) return fail(res, 400, skills.error);

    const city = req.body?.city == null
      ? { ok: true as const, value: null }
      : vString(req.body.city, "city", { max: 100, allowEmpty: true });
    if (!city.ok) return fail(res, 400, city.error);

    // Get user email for notifications
    const u = await pool.query(`SELECT "email" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`, [auth.sub]);
    if (u.rowCount === 0) return fail(res, 404, "user_not_found");

    const id = crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO "BuildJobAlert" ("id","userId","email","keywords","skills","city","active")
       VALUES ($1,$2,$3,$4,$5,$6,true)
       ON CONFLICT ("userId") DO UPDATE SET
         "email" = EXCLUDED."email",
         "keywords" = EXCLUDED."keywords",
         "skills" = EXCLUDED."skills",
         "city" = EXCLUDED."city",
         "active" = true
       RETURNING *`,
      [id, auth.sub, u.rows[0].email, keywords.value.trim(), skills.value.trim(), city.value || null],
    );
    return ok(res, { alert: r.rows[0] }, 201);
  } catch (err: unknown) {
    return fail(res, 500, "alerts_upsert_failed", { details: (err as Error).message });
  }
});

// DELETE /api/build/alerts/me — unsubscribe
alertsRouter.delete("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await pool.query(`UPDATE "BuildJobAlert" SET "active" = false WHERE "userId" = $1`, [auth.sub]);
    return ok(res, { unsubscribed: true });
  } catch (err: unknown) {
    return fail(res, 500, "alerts_delete_failed", { details: (err as Error).message });
  }
});

// Internal: called by vacanciesRouter.post after creating a vacancy
export async function dispatchJobAlerts(vacancy: {
  id: string;
  title: string;
  description: string;
  skillsJson: string;
  city: string | null;
  salary: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const vacancySkills = safeSkillsJson(vacancy.skillsJson);
    const vacancyWords = `${vacancy.title} ${vacancy.description}`.toLowerCase();

    const alerts = await pool.query(
      `SELECT "email","keywords","skills","city" FROM "BuildJobAlert" WHERE "active" = true LIMIT 200`,
    );

    const matches: string[] = [];
    for (const a of alerts.rows as { email: string; keywords: string; skills: string; city: string | null }[]) {
      // City filter
      if (a.city && vacancy.city && a.city.toLowerCase() !== vacancy.city.toLowerCase()) continue;
      // Skill match
      const alertSkills = a.skills.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
      const skillMatch = alertSkills.length === 0 || alertSkills.some((s) => vacancySkills.includes(s));
      // Keyword match
      const alertKws = a.keywords.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
      const kwMatch = alertKws.length === 0 || alertKws.some((k) => vacancyWords.includes(k));
      if (skillMatch && kwMatch) matches.push(a.email);
    }

    if (matches.length === 0) return;

    // Batch send — fire and forget per recipient (Resend supports to array)
    const subject = `New vacancy: ${vacancy.title}`;
    const text = [
      `New vacancy posted on AEVION QBuild:`,
      ``,
      `${vacancy.title}${vacancy.salary > 0 ? ` · $${vacancy.salary.toLocaleString()}` : ""}${vacancy.city ? ` · ${vacancy.city}` : ""}`,
      ``,
      `Apply: https://aevion.tech/build/vacancy/${vacancy.id}`,
      ``,
      `Unsubscribe: https://aevion.tech/build/profile#alerts`,
      ``,
      `— AEVION QBuild`,
    ].join("\n");

    // Send in chunks of 50 (Resend max)
    for (let i = 0; i < matches.length; i += 50) {
      const batch = matches.slice(i, i + 50);
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "QBuild <noreply@aevion.tech>", to: batch, subject, text }),
      }).catch(() => {});
    }
    console.info(`[build] job alerts sent to ${matches.length} subscribers for vacancy ${vacancy.id}`);
  } catch (e) {
    console.warn("[build] dispatchJobAlerts failed:", (e as Error).message);
  }
}

function safeSkillsJson(j: string): string[] {
  try { return (JSON.parse(j) as string[]).map((s) => s.toLowerCase()); } catch { return []; }
}
