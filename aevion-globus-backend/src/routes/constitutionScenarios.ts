/**
 * Constitution — saved scenarios.
 *
 *   GET  /api/constitution/scenarios?limit=30   public gallery, newest first
 *   POST /api/constitution/scenarios            { title, sliders, regime, metrics, tags }
 *
 * These two were called by /constitution long before they existed. The page
 * loads the gallery with `if (!r.ok) return;` and saves with a POST whose
 * result it only checks for `r.ok`, so a missing route rendered as an empty
 * list and a Save button that did nothing — no error anywhere. The platform's
 * own status page probes the GET expecting 200 (constitutionStatus.ts), which
 * means that check has been failing for as long as the page has shipped.
 *
 * Shapes are dictated by the caller, not invented here:
 *   { items: [{ id, title, summary, createdAt, payload: { sliders, metrics, tags }, tags }] }
 *
 * Public on purpose — the gallery is public in the UI and the page posts
 * without a bearer. That makes the POST a spam surface, so it is rate limited
 * per IP and every field is length-bounded before it reaches the database.
 * In-memory fallback mirrors constitutionWaitlist.ts: without Postgres the
 * page still works in dev rather than failing in a new way.
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("constitutionScenarios");

export const constitutionScenariosRouter = Router();

const readLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "constitution:scenarios:read" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "constitution:scenarios:write" });

type ScenarioRow = {
  id: string;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  tags: string[];
  createdAt: string;
};

const memRows: ScenarioRow[] = [];
let tableReady = false;
let dbAvailable = false;

async function ensureScenarioTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_scenario (
        "id"        TEXT PRIMARY KEY,
        "title"     TEXT NOT NULL,
        "summary"   TEXT,
        "payload"   JSONB NOT NULL DEFAULT '{}',
        "tags"      TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_scenario_created
        ON constitution_scenario ("createdAt" DESC);
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length === 0 || s.length > max ? null : s;
};

constitutionScenariosRouter.get("/scenarios", readLimit as unknown as (req: Request, res: Response, next: () => void) => void, async (req: Request, res: Response) => {
  try {
    await ensureScenarioTable();
    const raw = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.trunc(raw))) : 30;
    if (!dbAvailable) {
      return res.json({ items: memRows.slice(0, limit) });
    }
    const r = await getPool().query(
      `SELECT "id","title","summary","payload","tags","createdAt"
         FROM constitution_scenario ORDER BY "createdAt" DESC LIMIT $1`,
      [limit],
    );
    res.json({
      items: r.rows.map((row: Record<string, unknown> & { createdAt: unknown }) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        payload: row.payload ?? {},
        tags: row.tags ?? [],
        createdAt:
          row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      })),
    });
  } catch (err) {
    capture(err, { route: "scenarios:list" });
    res.status(500).json({ error: "scenarios list failed" });
  }
});

constitutionScenariosRouter.post("/scenarios", writeLimit as unknown as (req: Request, res: Response, next: () => void) => void, async (req: Request, res: Response) => {
  try {
    await ensureScenarioTable();
    const title = str(req.body?.title, 120);
    if (!title) return res.status(400).json({ error: "title required (1-120 chars)" });

    // `regime` is the human-readable name the page sends; it becomes the
    // summary line under the title in the gallery.
    const summary = str(req.body?.regime, 200);
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags
          .map((t: unknown) => str(t, 40))
          .filter((t: string | null): t is string => t !== null)
          .slice(0, 8)
      : [];
    // Sliders and metrics are plain number maps in the UI. Store them as sent
    // but bounded, so a large object cannot be parked in the gallery.
    const payload = { sliders: req.body?.sliders ?? {}, metrics: req.body?.metrics ?? {}, tags };
    const encoded = JSON.stringify(payload);
    if (encoded.length > 8000) return res.status(400).json({ error: "payload too large" });

    const id = `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    if (!dbAvailable) {
      memRows.unshift({ id, title, summary, payload, tags, createdAt });
      memRows.length = Math.min(memRows.length, 200);
      return res.status(201).json({ id, createdAt });
    }
    await getPool().query(
      `INSERT INTO constitution_scenario ("id","title","summary","payload","tags")
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [id, title, summary, encoded, tags],
    );
    res.status(201).json({ id, createdAt });
  } catch (err) {
    capture(err, { route: "scenarios:create" });
    res.status(500).json({ error: "scenario save failed" });
  }
});
