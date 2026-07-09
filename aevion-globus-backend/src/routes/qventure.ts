/**
 * QVenture — AI Investment Analyst API
 * ────────────────────────────────────
 * Turns a structured business/app/company input into a fund-grade screening
 * memo: a transparent 0–100 quant score (engine.ts), a four-role analyst
 * council (lenses.ts: scientist / data-analyst / economist / lawyer), and a
 * concrete entry strategy (ticket, tranches, valuation band, risk-adjusted
 * return). Built for an English-speaking investor audience.
 *
 * Hybrid storage: Postgres when available, in-memory Map otherwise — the
 * endpoint is fully functional in local dev / preview with no DB and no AI key.
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { makeServiceCapture } from "../lib/sentry/platform";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import {
  ensureQVentureTables,
  isQVentureDbReady,
} from "../lib/ensureQVentureTables";
import { analyze, STAGES, type AnalysisInput, type Stage } from "../lib/qventure/engine";
import { runCouncil, type MemoOutput } from "../lib/qventure/lenses";
import { listSectors } from "../lib/qventure/sectors";

const captureQVentureError = makeServiceCapture("qventure");

const pool = getPool();
(async () => {
  try { await ensureQVentureTables(pool); }
  catch { /* silent — in-memory fallback active */ }
})();

// ── Limiters ────────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 60_000, max: 40, keyPrefix: "qventure:general", message: "rate_limited" });
const analyzeLimiter = rateLimit({ windowMs: 60_000, max: 6, keyPrefix: "qventure:analyze", message: "rate_limited" });

export const qventureRouter = Router();
qventureRouter.use(generalLimiter);

// ── Validation constants ──────────────────────────────────────────────────────
const MAX_NAME = 160;
const MAX_DESCRIPTION = 4000;
const MAX_TRACTION = 3000;
const MAX_GEO = 80;
const MEM_MAX = 200;

// ── Stored record ─────────────────────────────────────────────────────────────
interface StoredAnalysis {
  id: string;
  name: string;
  sector: string;
  stage: Stage;
  geography: string | null;
  askUsd: number | null;
  composite: number;
  verdict: string;
  result: ReturnType<typeof analyze> & { council: MemoOutput };
  contentHash: string;
  visibility: string;
  createdAt: string;
}

// In-memory fallback store (newest-first).
const memStore: StoredAnalysis[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function contentHash(input: AnalysisInput): string {
  const basis = `${input.name}|${input.sector}|${input.stage}|${input.description}`.toLowerCase();
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ ok: false, error: message });
}

// ── Routes ────────────────────────────────────────────────────────────────────

qventureRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "qventure",
    storage: isQVentureDbReady() ? "postgres" : "in-memory",
    sectors: listSectors().length,
    stages: STAGES,
  });
});

qventureRouter.get("/sectors", (_req: Request, res: Response) => {
  res.json({ ok: true, data: listSectors(), stages: STAGES });
});

qventureRouter.post("/analyze", analyzeLimiter, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const stageRaw = typeof body.stage === "string" ? body.stage.trim() : "seed";
    const sector = typeof body.sector === "string" ? body.sector.trim() : "other";
    const geography = typeof body.geography === "string" ? body.geography.trim().slice(0, MAX_GEO) : "US";
    const tractionNotes = typeof body.tractionNotes === "string" ? body.tractionNotes.trim().slice(0, MAX_TRACTION) : "";
    const url = typeof body.url === "string" ? body.url.trim().slice(0, 400) : undefined;
    const askUsd = typeof body.askUsd === "number" && isFinite(body.askUsd) && body.askUsd > 0
      ? Math.min(body.askUsd, 5_000_000_000)
      : undefined;

    if (!name) return badRequest(res, "name is required");
    if (name.length > MAX_NAME) return badRequest(res, `name too long (max ${MAX_NAME})`);
    if (!description || description.length < 12) return badRequest(res, "description is required (min 12 chars)");
    if (description.length > MAX_DESCRIPTION) return badRequest(res, `description too long (max ${MAX_DESCRIPTION})`);
    const stage = (STAGES as readonly string[]).includes(stageRaw) ? (stageRaw as Stage) : "seed";

    const input: AnalysisInput = {
      name, description, sector, stage, geography,
      askUsd, tractionNotes: tractionNotes || undefined, url,
    };

    const engineResult = analyze(input);
    const council = await runCouncil(input, engineResult);

    const record: StoredAnalysis = {
      id: crypto.randomUUID(),
      name, sector: engineResult.sector.id, stage,
      geography, askUsd: askUsd ?? null,
      composite: engineResult.composite,
      verdict: engineResult.verdict,
      result: { ...engineResult, council },
      contentHash: contentHash(input),
      visibility: "public",
      createdAt: nowIso(),
    };

    await persist(record);

    res.json({ ok: true, data: record });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "analysis_failed" });
  }
});

qventureRouter.get("/analyses", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 50);
    const verdict = typeof req.query.verdict === "string" ? req.query.verdict : undefined;
    const rows = await listRecent(limit, verdict);
    // Redact heavy nested council text from the list view; keep the summary.
    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      sector: r.sector,
      stage: r.stage,
      geography: r.geography,
      composite: r.composite,
      verdict: r.verdict,
      createdAt: r.createdAt,
    }));
    res.json({ ok: true, data, count: data.length });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "list_failed" });
  }
});

qventureRouter.get("/analyses/:id", async (req: Request, res: Response) => {
  try {
    const row = await getById(String(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data: row });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "get_failed" });
  }
});

qventureRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const rows = await listRecent(500);
    const byVerdict: Record<string, number> = { invest: 0, watch: 0, pass: 0 };
    const bySector: Record<string, number> = {};
    let sum = 0;
    for (const r of rows) {
      byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
      bySector[r.sector] = (bySector[r.sector] || 0) + 1;
      sum += Number(r.composite);
    }
    res.json({
      ok: true,
      data: {
        total: rows.length,
        avgComposite: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
        byVerdict,
        bySector,
        storage: isQVentureDbReady() ? "postgres" : "in-memory",
      },
    });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "stats_failed" });
  }
});

// ── Storage layer (Postgres ⇄ in-memory) ──────────────────────────────────────

async function persist(record: StoredAnalysis): Promise<void> {
  if (isQVentureDbReady()) {
    try {
      await pool.query(
        `INSERT INTO qventure_analyses
         (id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, visibility, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          record.id, record.name, record.sector, record.stage, record.geography,
          record.askUsd, record.composite, record.verdict,
          JSON.stringify(record.result), record.contentHash, record.visibility, record.createdAt,
        ]
      );
      return;
    } catch (e: unknown) {
      captureQVentureError(e);
      // fall through to memory on transient DB error
    }
  }
  memStore.unshift(record);
  if (memStore.length > MEM_MAX) memStore.length = MEM_MAX;
}

async function listRecent(limit: number, verdict?: string): Promise<StoredAnalysis[]> {
  if (isQVentureDbReady()) {
    try {
      const params: unknown[] = [];
      let where = "WHERE visibility = 'public'";
      if (verdict) { params.push(verdict); where += ` AND verdict = $${params.length}`; }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, created_at
         FROM qventure_analyses ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return rows.map(rowToRecord);
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  const filtered = verdict ? memStore.filter((r) => r.verdict === verdict) : memStore;
  return filtered.slice(0, limit);
}

async function getById(id: string): Promise<StoredAnalysis | null> {
  if (isQVentureDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, created_at
         FROM qventure_analyses WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (rows[0]) return rowToRecord(rows[0]);
      return null;
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  return memStore.find((r) => r.id === id) ?? null;
}

function rowToRecord(row: Record<string, unknown>): StoredAnalysis {
  const result = typeof row.result === "string" ? JSON.parse(row.result as string) : row.result;
  return {
    id: String(row.id),
    name: String(row.name),
    sector: String(row.sector),
    stage: row.stage as Stage,
    geography: (row.geography as string) ?? null,
    askUsd: row.ask_usd != null ? Number(row.ask_usd) : null,
    composite: Number(row.composite),
    verdict: String(row.verdict),
    result: result as StoredAnalysis["result"],
    contentHash: (row.content_hash as string) ?? "",
    visibility: "public",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
