/**
 * Constitution — email waitlist for Pro launch + future newsletter.
 *
 *   POST /api/constitution/waitlist/subscribe   { email, source? }
 *   GET  /api/admin/constitution/waitlist/list  (admin only)
 *
 * Postgres `constitution_waitlist` (email UNIQUE, source, createdAt)
 * with in-memory fallback.
 *
 * Cron stub: schedule a weekly digest "top-5 scenarios of the week"
 * once Pro launches + transactional email provider wired up. For now
 * /api/admin/constitution/waitlist/list provides CSV-like export.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { validate, WaitlistSubscribeSchema } from "../lib/constitutionSchemas";
import { sendWaitlistConfirm, sendWeeklyDigestEmail as sendDigestEmail } from "../lib/constitutionBrevo";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("constitutionWaitlist");

type WaitlistRow = {
  email: string;
  source: string;
  createdAt: string;
};

const memList = new Map<string, WaitlistRow>();
let tableReady = false;
let dbAvailable = false;

async function ensureWaitlistTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_waitlist (
        "email"     TEXT PRIMARY KEY,
        "source"    TEXT NOT NULL DEFAULT 'unknown',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_waitlist_created
        ON constitution_waitlist ("createdAt" DESC);
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

const ADMIN_ALLOWLIST = (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAdmin(req: Request): boolean {
  const payload = verifyBearerOptional(req);
  if (!payload) return false;
  const p = payload as Record<string, unknown>;
  if (p.role === "admin") return true;
  if (typeof p.email === "string" && ADMIN_ALLOWLIST.includes(p.email.toLowerCase())) {
    return true;
  }
  return false;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

export const constitutionWaitlistRouter = Router();
export const constitutionWaitlistAdminRouter = Router();

const writeLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "constitution-waitlist" });
const readLimit  = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "constitution-waitlist-read" });

constitutionWaitlistRouter.post(
  "/subscribe",
  writeLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  validate(WaitlistSubscribeSchema),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { email: string; source?: string };
      const emailRaw = body.email.trim().toLowerCase();
      const sourceRaw = (body.source ?? "unknown").slice(0, 60);

      const row: WaitlistRow = {
        email: emailRaw,
        source: sourceRaw,
        createdAt: new Date().toISOString(),
      };

      await ensureWaitlistTable();
      let storage: "postgres" | "memory" = "memory";
      if (dbAvailable) {
        try {
          const pool = getPool();
          await pool.query(
            `INSERT INTO constitution_waitlist ("email","source","createdAt")
             VALUES ($1,$2,$3)
             ON CONFLICT ("email") DO UPDATE SET "source" = EXCLUDED."source"`,
            [row.email, row.source, row.createdAt],
          );
          storage = "postgres";
        } catch { /* fall through */ }
      }
      if (!memList.has(row.email)) memList.set(row.email, row);

      // Fire-and-forget confirmation email via Brevo
      void sendWaitlistConfirm(row.email).catch(() => { /* ignore */ });

      res.status(201).json({ ok: true, storage });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "subscribe_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

constitutionWaitlistAdminRouter.get(
  "/list",
  readLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "admin_required" });
    try {
      await ensureWaitlistTable();
      let rows: WaitlistRow[] = [];
      if (dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT "email","source","createdAt"
             FROM constitution_waitlist
             ORDER BY "createdAt" DESC
             LIMIT 5000`,
          );
          rows = r.rows.map((x: Record<string, unknown>) => ({
            email: String(x.email),
            source: String(x.source),
            createdAt: x.createdAt instanceof Date
              ? x.createdAt.toISOString()
              : String(x.createdAt),
          }));
        } catch { /* fall through */ }
      }
      if (rows.length === 0) rows = Array.from(memList.values());
      const fmt = String(req.query.format ?? "json");
      if (fmt === "csv") {
        const lines = ["email,source,createdAt", ...rows.map((r) => `${r.email},${r.source},${r.createdAt}`)];
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="constitution-waitlist-${Date.now()}.csv"`);
        return res.send(lines.join("\n"));
      }
      res.json({
        total: rows.length,
        items: rows,
        bySource: aggregateBySource(rows),
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "list_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

function aggregateBySource(rows: WaitlistRow[]): Array<{ source: string; count: number }> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.source, (m.get(r.source) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Weekly digest cron — stub. When Pro launches and transactional
 * email provider (Brevo/Postmark/Resend) is wired up, replace this
 * with actual mail send. For now just no-op.
 *
 * Call from cron scheduler (already exists in qcoreai.ts) every Sunday.
 */
export async function sendWeeklyDigest(): Promise<{ sent: number; skipped: number }> {
  try {
    // 1. Get top-5 artifacts by votes in last 7 days
    await ensureWaitlistTable();
    let topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }> = [];
    if (dbAvailable) {
      try {
        const pool = getPool();
        const rows = await pool.query(`
          SELECT a."title", a."regimeName",
                 COALESCE(SUM(CASE WHEN v."vote" = 1 THEN 1 ELSE 0 END), 0) AS up_votes
          FROM planet_constitution_artifacts a
          LEFT JOIN planet_constitution_votes v ON v."artifactId" = a."id"
          WHERE a."publishedAt" > NOW() - INTERVAL '7 days'
          GROUP BY a."id", a."title", a."regimeName"
          ORDER BY up_votes DESC
          LIMIT 5
        `);
        topArtifacts = rows.rows.map((r: Record<string, unknown>) => ({
          title: String(r.title),
          regimeName: String(r.regimeName),
          url: `https://aevion.app/constitution/leaderboard`,
          votes: Number(r.up_votes),
        }));
      } catch { /* fall through */ }
    }
    if (!topArtifacts.length) return { sent: 0, skipped: 1 };

    // 2. Get waitlist subscribers
    let subscribers: Array<{ email: string }> = Array.from(memList.values());
    if (dbAvailable) {
      try {
        const pool = getPool();
        const r = await pool.query(`SELECT "email" FROM constitution_waitlist ORDER BY "createdAt" ASC LIMIT 5000`);
        subscribers = r.rows.map((x: Record<string, unknown>) => ({ email: String(x.email) }));
      } catch { /* fall through */ }
    }
    if (!subscribers.length) return { sent: 0, skipped: 0 };

    const weekOf = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
    const { sent, errors } = await sendDigestEmail(subscribers, topArtifacts, weekOf);
    return { sent, skipped: errors };
  } catch (err) {
    capture(err);
    return { sent: 0, skipped: 0 };
  }
}
