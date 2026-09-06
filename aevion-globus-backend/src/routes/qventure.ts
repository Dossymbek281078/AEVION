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

import express, { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { makeServiceCapture } from "../lib/sentry/platform";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import {
  ensureQVentureTables,
  isQVentureDbReady,
} from "../lib/ensureQVentureTables";
import { analyze, STAGES, RUBRIC_VERSION, type AnalysisInput, type Stage } from "../lib/qventure/engine";
import type { StructuredFinancials } from "../lib/qventure/signals";
import type { ProjectionPoint } from "../lib/qventure/projections";
import { runCouncil, type MemoOutput } from "../lib/qventure/lenses";
import { listSectors } from "../lib/qventure/sectors";
import { extractPdfText, extractDeckFields } from "../lib/qventure/deckExtract";
import { fetchComparables } from "../lib/qventure/comparables";
import { computeBenchmark, type BenchmarkSample } from "../lib/qventure/benchmark";
import { EXAMPLE_SEEDS, EXAMPLE_ID_PREFIX } from "../lib/qventure/examples";
import { verifyBearerOptional } from "../lib/authJwt";
import { csvNeutralizeFormula } from "../lib/csv";

const captureQVentureError = makeServiceCapture("qventure");

const pool = getPool();

// Canonical public showcase — a stable, shareable example report. Persisted
// once under a fixed id so "See a live example →" never breaks across restarts.
const DEMO_ID = "demo-neurodx";
const DEMO_INPUT: AnalysisInput = {
  name: "NeuroDx",
  sector: "healthtech",
  stage: "seed",
  geography: "US",
  askUsd: 6_000_000,
  description:
    "FDA-pathway diagnostic that detects early-stage Alzheimer's from a standard retinal scan using a self-supervised vision model, turning any optometrist's chair into a screening point years before symptom onset.",
  tractionNotes:
    "$55k MRR across 14 clinics growing 22% MoM, breakthrough-device designation filed, 89% sensitivity vs PET baseline in a 1,200-patient cohort, LTV/CAC 5.1x.",
};

async function ensureDemoAnalysis(): Promise<void> {
  try {
    const existing = await getById(DEMO_ID);
    // Re-seed if missing, if it predates cited-sources, OR if it was scored by an
    // older rubric. The showcase is the most-viewed report, so a stale demo would
    // display a v1 score (and none of the basis / reEntry fields the new UI needs)
    // while every fresh analysis uses the current rubric — exactly the version
    // mixing RUBRIC_VERSION exists to prevent.
    const fresh =
      existing &&
      (existing.result?.sector?.sources?.length ?? 0) > 0 &&
      (existing.result?.rubricVersion ?? 0) >= RUBRIC_VERSION;
    if (fresh) return;
    if (existing) await deleteById(DEMO_ID);
    const engineResult = analyze(DEMO_INPUT);
    const council = await runCouncil(DEMO_INPUT, engineResult);
    await persist({
      id: DEMO_ID,
      name: DEMO_INPUT.name,
      sector: engineResult.sector.id,
      stage: DEMO_INPUT.stage,
      geography: DEMO_INPUT.geography ?? "US",
      askUsd: DEMO_INPUT.askUsd ?? null,
      composite: engineResult.composite,
      verdict: engineResult.verdict,
      result: { ...engineResult, council },
      contentHash: contentHash(DEMO_INPUT),
      visibility: "public",
      createdAt: nowIso(),
    });
  } catch { /* best-effort — demo link degrades gracefully to not_found */ }
}

// Seed the curated example analyses (real engine + council runs), idempotently
// per id. Powers /qventure/gallery so a first-time visitor sees the tool's range
// across sectors. Best-effort — a failed seed just omits that example.
async function ensureExampleAnalyses(): Promise<void> {
  for (const seed of EXAMPLE_SEEDS) {
    const id = `${EXAMPLE_ID_PREFIX}${seed.slug}`;
    try {
      // Refresh a gallery example if it is stale under the current rubric, so the
      // gallery never ranks v1 and v3 scores side by side.
      const prior = await getById(id);
      if (prior && (prior.result?.rubricVersion ?? 0) >= RUBRIC_VERSION) continue;
      if (prior) await deleteById(id);
      const input: AnalysisInput = {
        name: seed.name, description: seed.description, sector: seed.sector, stage: seed.stage,
        geography: seed.geography, askUsd: seed.askUsd, tractionNotes: seed.tractionNotes,
      };
      const engineResult = analyze(input);
      const council = await runCouncil(input, engineResult);
      await persist({
        id, name: seed.name, sector: engineResult.sector.id, stage: seed.stage,
        geography: seed.geography ?? "US", askUsd: seed.askUsd ?? null,
        composite: engineResult.composite, verdict: engineResult.verdict,
        result: { ...engineResult, council }, contentHash: contentHash(input),
        visibility: "public", createdAt: nowIso(),
      });
    } catch { /* best-effort per seed */ }
  }
}

// Backfill dedupe_hash on rows that predate the column but kept their input.
// Dedup only catches future submissions; without this, a plan first analysed
// before the column existed would still mint a duplicate on resubmit. Rows with
// no analysis_input (pre-#735) cannot be backfilled — their input was never
// stored — and are left as-is. Idempotent: only touches NULL dedupe_hash rows,
// so it is a no-op after the first run.
async function backfillDedupeHashes(): Promise<void> {
  if (!isQVentureDbReady()) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, analysis_input FROM qventure_analyses
       WHERE dedupe_hash IS NULL AND analysis_input IS NOT NULL LIMIT 1000`
    );
    for (const row of rows) {
      try {
        const input = (typeof row.analysis_input === "string"
          ? JSON.parse(row.analysis_input)
          : row.analysis_input) as AnalysisInput;
        await pool.query(
          `UPDATE qventure_analyses SET dedupe_hash = $1 WHERE id = $2 AND dedupe_hash IS NULL`,
          [dedupeHash(input), row.id]
        );
      } catch { /* skip a row with unparseable input rather than abort the batch */ }
    }
    if (rows.length > 0) console.log(`[qventure] backfilled dedupe_hash on ${rows.length} row(s)`);
  } catch (e: unknown) {
    captureQVentureError(e);
  }
}

(async () => {
  try { await ensureQVentureTables(pool); }
  catch { /* silent — in-memory fallback active */ }
  await ensureDemoAnalysis();
  void ensureExampleAnalyses();
  void backfillDedupeHashes();
})();

// ── Limiters ────────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 60_000, max: 40, keyPrefix: "qventure:general", message: "rate_limited" });
// 6/min left no room: an investor screening a handful of deals in one sitting hit
// the wall, and the smoke suite sat exactly at the ceiling so any retry failed it.
// ЦЕНА ОДНОГО ЗАПРОСА, чтобы следующий менял предел с открытыми глазами.
// Один /analyze = ПЯТЬ вызовов платной модели: четыре линзы разом (runCouncil)
// плюс сведение. То есть 15/мин это до 75 вызовов в минуту с одного ключа —
// вдвое с лишним выше платформенной нормы для дорогих ручек (30/мин на ОДИН
// вызов у dhCostlyLimit в devhub).
//
// Почему это НЕ повод понижать сгоряча: 6/мин уже пробовали и вернули, причина
// строкой ниже. И наивное повторение денег не стоит — одинаковый вход отдаёт
// готовый разбор через dedupeHash, не считая заново. Чтобы жечь, надо
// намеренно менять вход каждый раз.
//
// Чего здесь НЕТ и что было бы настоящей защитой: суточного или месячного
// потолка. Поминутный предел сверен с человеческим темпом, а не с жёсткой
// квотой поставщика — 15/мин это 21 600 разборов в сутки с одного адреса.
// Сделать это правильно значит завести учёт как у DevHub (таблица расхода,
// checkCredit), а не второй ограничитель в памяти: он обнуляется при каждой
// выкатке, то есть даёт видимость потолка вместо потолка.
// Замер 03.09.2026.
const analyzeLimiter = rateLimit({ windowMs: 60_000, max: 15, keyPrefix: "qventure:analyze", message: "rate_limited" });

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
  /** The analysed plan, retained so this verdict can be re-derived when the rubric
   *  changes. Stripped from every API response by redactInput() — business plans
   *  are confidential and analyses are public by default. */
  input?: AnalysisInput;
  contentHash: string;
  /** Hash over all scoring inputs — returns an existing analysis instead of a duplicate. */
  dedupeHash?: string;
  visibility: string;
  createdAt: string;
}

// In-memory fallback store (newest-first).
const memStore: StoredAnalysis[] = [];

/**
 * Strip the retained plan before a record leaves the process.
 *
 * `input` exists only so a stored verdict stays reproducible when the rubric
 * changes. It is the founder's confidential business plan, and analyses are
 * public by default (and shareable by link), so it must never be serialised
 * into a response. Every read path funnels through here.
 */
function redactInput(record: StoredAnalysis): Omit<StoredAnalysis, "input"> {
  const { input: _retainedForReproducibility, ...safe } = record;
  return safe;
}

// ── Watchlist (per-investor saved deals) ───────────────────────────────────────
interface WatchItem {
  id: string;          // analysis id
  name: string;
  sector: string;
  stage: string;
  composite: number;
  verdict: string;
  savedAt: string;     // ISO
}
const MAX_WATCHLIST = 200;
// In-memory fallback: userId → newest-first list.
const memWatchlist = new Map<string, WatchItem[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function contentHash(input: AnalysisInput): string {
  const basis = `${input.name}|${input.sector}|${input.stage}|${input.description}`.toLowerCase();
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

// Dedupe key over EVERY scoring input — content_hash covers only name/sector/
// stage/description, so it would collide two plans that differ only in traction
// or financials (which change the score). Stable JSON of the normalised fields.
function dedupeHash(input: AnalysisInput): string {
  const norm = {
    name: (input.name || "").trim().toLowerCase(),
    sector: input.sector || "",
    stage: input.stage || "",
    description: (input.description || "").trim().toLowerCase(),
    traction: (input.tractionNotes || "").trim().toLowerCase(),
    askUsd: input.askUsd ?? null,
    financials: input.financials ?? null,
    projections: input.projections ?? null,
  };
  return crypto.createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 32);
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ ok: false, error: message });
}

/** Pick numeric, non-negative, finite fields from a client-supplied financials object. */
function sanitizeFinancials(raw: unknown): StructuredFinancials | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && isFinite(v) && v >= 0 ? Math.min(v, 1e15) : undefined;
  const f: StructuredFinancials = {
    revenueUsd: num(r.revenueUsd), mrrUsd: num(r.mrrUsd), arrUsd: num(r.arrUsd),
    growthPct: num(r.growthPct), grossMarginPct: num(r.grossMarginPct),
    cacUsd: num(r.cacUsd), ltvUsd: num(r.ltvUsd), ltvCacRatio: num(r.ltvCacRatio),
    paybackMonths: num(r.paybackMonths), churnPct: num(r.churnPct),
    retentionPct: num(r.retentionPct), customers: num(r.customers), bottomUpTamUsd: num(r.bottomUpTamUsd),
  };
  const period = r.growthPeriod;
  if (period === "MoM" || period === "YoY" || period === "WoW" || period === "unspecified") f.growthPeriod = period;
  const churnPeriod = r.churnPeriod;
  if (churnPeriod === "monthly" || churnPeriod === "quarterly" || churnPeriod === "annual" || churnPeriod === "weekly" || churnPeriod === "unspecified") {
    f.churnPeriod = churnPeriod;
  }
  const hasAny = Object.values(f).some((v) => v !== undefined);
  return hasAny ? f : undefined;
}

/** Sanitize a client-supplied revenue projection array. */
function sanitizeProjections(raw: unknown): ProjectionPoint[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts = raw
    .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
    .filter((p) => typeof p.year === "number" && typeof p.revenueUsd === "number" && isFinite(p.year) && isFinite(p.revenueUsd) && (p.revenueUsd as number) >= 0)
    .map((p) => ({ year: Math.round(p.year as number), revenueUsd: Math.min(p.revenueUsd as number, 1e15) }))
    .slice(0, 12);
  return pts.length >= 2 ? pts : undefined;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Lightweight row count for health — COUNT(*) on an indexed table, not a scan of
// rows like /stats does. Returns null if the count itself errors, so health never
// fails on a metrics hiccup.
async function countAnalyses(): Promise<number | null> {
  if (!isQVentureDbReady()) return memStore.length;
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM qventure_analyses`);
    return rows[0]?.n ?? null;
  } catch {
    return null;
  }
}

/**
 * Откуда взят текст записки — по ФАКТУ ответа модели, не по настройке.
 * До 03.09.2026 признак считался от настройки поставщика: при упавших вызовах
 * документ утверждал «live model», хотя внутри была заготовка.
 */
function narrativeSource(c: { aiUsed: boolean; aiProvider: string; aiLive?: number; aiTotal?: number }): string {
  if (typeof c.aiLive !== "number" || typeof c.aiTotal !== "number") {
    return c.aiUsed ? `model ${c.aiProvider} (per-part source not recorded)` : "deterministic (no model)";
  }
  if (c.aiLive === 0) return "deterministic — model did not answer";
  if (c.aiLive === c.aiTotal) return `live model (${c.aiProvider})`;
  return `partial: ${c.aiLive} of ${c.aiTotal} parts from ${c.aiProvider}, rest deterministic`;
}

qventureRouter.get("/health", async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "qventure",
    storage: isQVentureDbReady() ? "postgres" : "in-memory",
    sectors: listSectors().length,
    stages: STAGES,
    // Observability: which rubric is live and how much data sits behind it, so a
    // monitor can spot a stuck showcase or a bad deploy without opening a report.
    rubricVersion: RUBRIC_VERSION,
    analyses: await countAnalyses(),
  });
});

qventureRouter.get("/sectors", (_req: Request, res: Response) => {
  res.json({ ok: true, data: listSectors(), stages: STAGES });
});

// GET /comparables?sector=<label>&stage=<stage> — recent comparable rounds.
// Loaded independently by the frontend after a result renders (keeps analyze
// fast). Live web-sourced when SERPER_API_KEY is set, else illustrative.
qventureRouter.get("/comparables", analyzeLimiter, async (req: Request, res: Response) => {
  try {
    const sector = typeof req.query.sector === "string" ? req.query.sector.trim().slice(0, 80) : "";
    const stage = typeof req.query.stage === "string" ? req.query.stage.trim().slice(0, 20) : "seed";
    if (!sector) return badRequest(res, "sector is required");
    const data = await fetchComparables(sector, stage);
    res.json({ ok: true, data });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "comparables_failed" });
  }
});

// GET /benchmark?sector=<id>&stage=<stage>&score=<0..100> — proprietary signal:
// where this deal's score ranks against every comparable deal QVenture has
// already scored. Read-only over the persisted corpus; strengthens with usage.
qventureRouter.get("/benchmark", analyzeLimiter, async (req: Request, res: Response) => {
  try {
    const sectorId = typeof req.query.sector === "string" ? req.query.sector.trim().slice(0, 40) : "";
    const stage = typeof req.query.stage === "string" ? req.query.stage.trim().slice(0, 20) : "seed";
    const score = Number(req.query.score);
    if (!sectorId) return badRequest(res, "sector is required");
    if (!isFinite(score)) return badRequest(res, "score (0–100) is required");
    const sectorLabel = listSectors().find((s) => s.id === sectorId)?.label ?? sectorId;
    const samples = await fetchBenchmarkSamples();
    const data = computeBenchmark(samples, score, sectorId, sectorLabel, stage);
    res.json({ ok: true, data });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "benchmark_failed" });
  }
});

// GET /examples — curated example analyses (real engine outputs), highest score
// first. Powers /qventure/gallery. Summary shape only; full report via /a/:id.
qventureRouter.get("/examples", async (_req: Request, res: Response) => {
  try {
    const rows = await listExamples();
    const data = rows.map((r) => ({
      id: r.id, name: r.name, sector: r.sector, stage: r.stage,
      geography: r.geography, composite: r.composite, verdict: r.verdict,
    }));
    res.json({ ok: true, data, count: data.length });
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "examples_failed" });
  }
});

// GET /examples.csv — the same curated set as a spreadsheet (scout utility).
qventureRouter.get("/examples.csv", async (_req: Request, res: Response) => {
  try {
    const rows = await listExamples();
    const esc = (v: unknown) => {
      // name / sector / geography заполняет пользователь; гашение формул из lib/csv.
      const s = csvNeutralizeFormula(String(v ?? ""));
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["name", "sector", "stage", "geography", "score", "verdict", "report_url"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        esc(r.name), esc(r.sector), esc(r.stage), esc(r.geography ?? ""),
        esc(r.composite), esc(r.verdict), esc(`https://aevion.app/qventure/a/${r.id}`),
      ].join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="qventure-examples.csv"');
    res.send(lines.join("\n"));
  } catch (e: unknown) {
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "examples_csv_failed" });
  }
});

// POST /extract — upload a pitch-deck PDF (raw application/pdf body), get back
// the analyzer fields (name, sector, stage, description, traction, ask). The
// frontend autofills the form so the investor reviews and runs the analysis.
qventureRouter.post(
  "/extract",
  analyzeLimiter,
  express.raw({ type: "application/pdf", limit: "15mb" }),
  async (req: Request, res: Response) => {
    try {
      const buf = req.body as unknown;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return badRequest(res, "send the PDF as the raw request body with Content-Type: application/pdf");
      }
      if (buf.length > 15_000_000) return badRequest(res, "PDF too large (max ~15MB)");
      if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return badRequest(res, "not a valid PDF file");

      const text = await extractPdfText(buf);
      if (!text || text.length < 30) {
        return res.status(422).json({
          ok: false,
          error: "no_text_extracted",
          hint: "This looks like a scanned/image-only deck — paste the details manually.",
        });
      }
      const fields = await extractDeckFields(text);
      res.json({ ok: true, data: fields });
    } catch (e: unknown) {
      captureQVentureError(e);
      res.status(500).json({ ok: false, error: "extract_failed" });
    }
  }
);

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
      financials: sanitizeFinancials(body.financials),
      projections: sanitizeProjections(body.projections),
    };

    // Return an existing analysis for an identical plan instead of minting a
    // duplicate — but only if it was scored by the current rubric. A stale-rubric
    // match falls through to a fresh run so the score reflects today's engine.
    const dedupe = dedupeHash(input);
    const priorAnalysis = await getByDedupe(dedupe);
    if (priorAnalysis && (priorAnalysis.result?.rubricVersion ?? 0) >= RUBRIC_VERSION) {
      return res.json({ ok: true, data: redactInput(priorAnalysis), deduped: true });
    }

    const engineResult = analyze(input);
    const council = await runCouncil(input, engineResult);

    const record: StoredAnalysis = {
      id: crypto.randomUUID(),
      name, sector: engineResult.sector.id, stage,
      geography, askUsd: askUsd ?? null,
      composite: engineResult.composite,
      verdict: engineResult.verdict,
      result: { ...engineResult, council },
      input,
      contentHash: contentHash(input),
      dedupeHash: dedupe,
      visibility: "public",
      createdAt: nowIso(),
    };

    await persist(record);

    res.json({ ok: true, data: redactInput(record) });
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
    res.json({ ok: true, data: redactInput(row) });
  } catch (e: unknown) {
    if (e instanceof StorageUnavailable) return replyStorageUnavailable(res);
    captureQVentureError(e);
    res.status(500).json({ ok: false, error: "get_failed" });
  }
});

// GET /analyses/:id/pdf — render the stored memo as a downloadable PDF.
// Uses pdfkit (already in deps for Planet certs). Helvetica has no emoji glyphs,
// so the layout stays ASCII/text — clean and printable.
qventureRouter.get("/analyses/:id/pdf", async (req: Request, res: Response) => {
  try {
    const row = await getById(String(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });

    const PDFDocument = ((await import("pdfkit")) as unknown as { default: new (opts: object) => PDFKit.PDFDocument }).default;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const r = row.result;
    const s = r.strategy;
    const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    const W = 495;

    // Header
    // Записка и весь PDF намеренно на АНГЛИЙСКОМ, хотя интерфейс модуля
    // русский. Это не недосмотр: промт итоговой записки прямо задаёт
    // «for an English-speaking investor» (lib/qventure/lenses.ts) — покупатель
    // пересылает документ инвесткомитету и внешним инвесторам.
    // 02.09.2026 я чуть не «починил» это, переведя 28 строк. Не переводить
    // без решения основателя: это состав продукта, а не язык кнопок.
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f172a").text("AEVION QVenture — Investment Memo");
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text(`Generated ${new Date().toISOString().slice(0, 10)} · AEVION AI Investment Analyst · not investment advice`);
    doc.moveDown(0.8);

    // Company + verdict banner
    doc.fontSize(17).font("Helvetica-Bold").fillColor("#0f172a").text(row.name);
    doc.fontSize(10).font("Helvetica").fillColor("#334155")
      .text(`${r.sector.label} · ${r.stage} · ${row.geography ?? "US"}${row.askUsd ? ` · raising ${usd(row.askUsd)}` : ""}`);
    doc.moveDown(0.4);
    const verdictColor = row.verdict === "invest" ? "#15803d" : row.verdict === "watch" ? "#b45309" : "#b91c1c";
    doc.fontSize(15).font("Helvetica-Bold").fillColor(verdictColor)
      .text(`Score ${row.composite}/100  —  ${row.verdict.toUpperCase()}  (conviction: ${s.conviction})`);
    doc.moveDown(0.4);

    // Signal coverage + red flags (company-specific analysis)
    if (typeof r.signalCoverage === "number") {
      doc.fontSize(9).font("Helvetica").fillColor("#475569")
        .text(`Signal coverage: ${Math.round(r.signalCoverage * 100)}% company-specific (${r.signals?.fieldsFound ?? 0} metrics parsed from the plan); remainder from sector priors.`, { width: W });
      doc.moveDown(0.3);
    }
    if (r.redFlags && r.redFlags.length) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#b45309").text(`Red flags (${r.redFlags.length})`);
      doc.fontSize(9.5).font("Helvetica").fillColor("#78350f");
      for (const f of r.redFlags) doc.text(`  (!) ${f}`, { width: W });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.4);

    // Investment memo
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Investment memo");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").fillColor("#1e293b").text(r.council.memo, { width: W, align: "left" });
    doc.fontSize(8).fillColor("#94a3b8")
      // Тот же признак, что на экране, и та же честность: partial —
      // отдельное состояние. Документ покупатель пересылает инвесткомитету,
      // и «live model» на заготовке было бы утверждением, а не пометкой.
      // Записи до 03.09.2026 полей не имеют — для них честно «not recorded».
      .text(`Narrative engine: ${narrativeSource(r.council)}`, { width: W })
    doc.moveDown(0.8);

    // Entry strategy
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Entry strategy");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    doc.text(`Ticket: ${usd(s.ticketUsd.target)} target  (range ${usd(s.ticketUsd.min)}–${usd(s.ticketUsd.max)})`);
    doc.text(`Target ownership: ${s.ownershipTargetPct}%`);
    doc.text(`Valuation band (pre-money): ${usd(s.valuationBandUsd.low)} / ${usd(s.valuationBandUsd.base)} / ${usd(s.valuationBandUsd.high)}`);
    doc.text(`Return: ${s.returns.expectedMoic}x expected (${s.returns.baseMoic}x base) · ~${s.returns.targetIrrPct}% IRR over ${s.returns.horizonYears}yr · loss prob ${Math.round(s.returns.lossProbability * 100)}%`);
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fillColor("#0f172a").text("Deployment schedule:");
    doc.font("Helvetica").fillColor("#334155");
    for (const t of s.tranches) doc.text(`  • ${t.pct}% — ${t.label}: ${t.trigger}`, { width: W });
    doc.moveDown(0.2);
    doc.fillColor("#166534").text(`Portfolio: ${s.portfolioNote}`, { width: W });
    doc.moveDown(0.8);

    // Bottom-up TAM triangulation
    if (r.tam && r.tam.mode !== "insufficient") {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Bottom-up TAM triangulation");
      doc.moveDown(0.2);
      doc.fontSize(9.5).font("Helvetica").fillColor("#475569");
      for (const t of r.tam.triangulation) doc.text(`  • ${t}`, { width: W });
      if (r.tam.flags.length) {
        doc.fillColor("#b45309");
        for (const f of r.tam.flags) doc.text(`  (!) ${f}`, { width: W });
      }
      doc.moveDown(0.7);
    }

    // Financial stress test
    if (r.stress && r.stress.resilience !== "insufficient-data") {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a")
        .text(`Financial stress test — resilience: ${r.stress.resilience.toUpperCase()}`);
      doc.moveDown(0.2);
      doc.fontSize(9.5).font("Helvetica").fillColor("#334155")
        .text(`Base LTV/CAC ${r.stress.base.ltvCac} -> worst-case ${r.stress.worstLtvCac} under combined CAC+churn shocks.`, { width: W });
      for (const sc of r.stress.scenarios) {
        doc.text(`  • ${sc.label}: LTV/CAC ${sc.ltvCac}${sc.paybackMonths !== null ? `, payback ${sc.paybackMonths}mo` : ""}`, { width: W });
      }
      doc.fillColor("#475569").text(r.stress.note, { width: W });
      doc.moveDown(0.7);
    }

    // Revenue projection
    if (r.projections) {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a")
        .text(`Revenue projection — ${r.projections.verdict.toUpperCase()}`);
      doc.moveDown(0.2);
      doc.fontSize(9.5).font("Helvetica").fillColor("#334155").text(r.projections.note, { width: W });
      doc.moveDown(0.7);
    }

    // Score breakdown
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Score breakdown");
    doc.moveDown(0.2);
    doc.fontSize(9.5).font("Helvetica").fillColor("#334155");
    for (const f of r.factors) {
      doc.font("Helvetica-Bold").fillColor("#0f172a")
        .text(`${f.label} — ${f.score}/100 (weight ${Math.round(f.weight * 100)}%)`, { continued: false });
      doc.font("Helvetica").fillColor("#475569").text(f.rationale, { width: W });
      doc.moveDown(0.15);
    }
    doc.moveDown(0.6);

    // Analyst council
    doc.addPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Analyst council");
    doc.moveDown(0.3);
    for (const l of r.council.lenses) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text(`${l.role} — ${l.headline}`, { width: W });
      doc.fontSize(9.5).font("Helvetica").fillColor("#166534");
      for (const p of l.points) doc.text(`  + ${p}`, { width: W });
      doc.fillColor("#b91c1c");
      for (const rk of l.risks) doc.text(`  ! ${rk}`, { width: W });
      doc.moveDown(0.5);
    }

    // Market data sources
    const srcs = r.sector.sources ?? [];
    if (srcs.length) {
      doc.moveDown(0.3);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("Market data sources");
      doc.fontSize(9).font("Helvetica");
      for (const src of srcs) {
        doc.fillColor("#0f172a").text(`  • ${src.publisher} (${src.year}) — ${src.claim}`, { width: W });
        doc.fillColor("#2563eb").text(`     ${src.url}`, { width: W });
      }
    }

    // Assumptions
    doc.moveDown(0.3);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#92400e").text("Assumptions & limitations");
    doc.fontSize(9).font("Helvetica").fillColor("#78350f");
    for (const a of r.assumptions) doc.text(`  • ${a}`, { width: W });
    doc.moveDown(0.6);
    doc.fontSize(8).fillColor("#94a3b8")
      .text("This memo is generated by an AI screening tool for research purposes and is not investment advice, an offer, or a solicitation. Figures are model estimates, not guarantees.", { width: W });

    doc.end();
    const pdf = await done;

    res.setHeader("Content-Type", "application/pdf");
    const safeName = row.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "memo";
    res.setHeader("Content-Disposition", `attachment; filename="qventure-${safeName}.pdf"`);
    return res.send(pdf);
  } catch (e: unknown) {
    if (e instanceof StorageUnavailable) return replyStorageUnavailable(res);
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "pdf_failed" });
  }
});

// GET /compare/pdf?a=<id>&b=<id> — a single side-by-side comparison PDF of two
// stored analyses (scores, verdicts, factor-by-factor delta, memo snippets).
qventureRouter.get("/compare/pdf", async (req: Request, res: Response) => {
  try {
    const aId = typeof req.query.a === "string" ? req.query.a : "";
    const bId = typeof req.query.b === "string" ? req.query.b : "";
    if (!aId || !bId) return badRequest(res, "both a and b query params are required");

    const [a, b] = await Promise.all([getById(aId), getById(bId)]);
    if (!a || !b) return res.status(404).json({ ok: false, error: "not_found" });

    const PDFDocument = ((await import("pdfkit")) as unknown as { default: new (opts: object) => PDFKit.PDFDocument }).default;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const W = 495;
    const firstSentences = (t: string, n = 2) => t.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).slice(0, n).join(" ");
    const vColor = (v: string) => (v === "invest" ? "#15803d" : v === "watch" ? "#b45309" : "#b91c1c");

    // Header
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f172a").text("AEVION QVenture — Deal Comparison");
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text(`Generated ${new Date().toISOString().slice(0, 10)} · AEVION AI Investment Analyst · not investment advice`);
    doc.moveDown(0.8);

    // Two headline blocks
    const headline = (r: NonNullable<Awaited<ReturnType<typeof getById>>>) => {
      doc.fontSize(15).font("Helvetica-Bold").fillColor("#0f172a").text(r.name, { continued: true });
      doc.font("Helvetica").fontSize(11).fillColor("#64748b").text(`   ${r.result.sector.label} · ${r.stage}`);
      doc.fontSize(13).font("Helvetica-Bold").fillColor(vColor(r.verdict))
        .text(`Score ${r.composite}/100  —  ${r.verdict.toUpperCase()} (conviction: ${r.result.strategy.conviction})`);
      doc.moveDown(0.5);
    };
    doc.fillColor("#7c3aed").fontSize(11).font("Helvetica-Bold").text("COMPANY A");
    headline(a);
    doc.fillColor("#7c3aed").fontSize(11).font("Helvetica-Bold").text("COMPANY B");
    headline(b);

    const winner = a.composite === b.composite ? null : a.composite > b.composite ? a : b;
    doc.moveDown(0.2);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a")
      .text(winner ? `Higher composite: ${winner.name} (${winner.composite}/100)` : "Composite scores are tied.");
    doc.moveDown(0.8);

    // Factor-by-factor delta table
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Factor-by-factor delta (B − A)");
    doc.moveDown(0.3);
    const col = { factor: 50, a: 300, b: 375, d: 450 };
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748b");
    doc.text("Factor", col.factor, doc.y, { continued: false });
    let rowY = doc.y - 12;
    doc.text("A", col.a, rowY); doc.text("B", col.b, rowY); doc.text("Δ", col.d, rowY);
    doc.moveDown(0.2);
    doc.font("Helvetica");
    for (const fa of a.result.factors) {
      const fb = b.result.factors.find((x) => x.key === fa.key);
      const bs = fb ? fb.score : 0;
      const delta = bs - fa.score;
      rowY = doc.y;
      doc.fillColor("#0f172a").fontSize(9.5).text(`${fa.label} (${Math.round(fa.weight * 100)}%)`, col.factor, rowY, { width: 240 });
      const lineY = doc.y - 11;
      doc.fillColor("#334155").text(String(fa.score), col.a, lineY);
      doc.fillColor("#334155").text(String(bs), col.b, lineY);
      doc.fillColor(delta > 0 ? "#15803d" : delta < 0 ? "#b91c1c" : "#94a3b8").font("Helvetica-Bold")
        .text(`${delta > 0 ? "+" : ""}${delta}`, col.d, lineY);
      doc.font("Helvetica");
    }
    // Composite row
    doc.moveDown(0.2);
    rowY = doc.y;
    const cd = Math.round((b.composite - a.composite) * 10) / 10;
    doc.font("Helvetica-Bold").fillColor("#0f172a").fontSize(10).text("Composite", col.factor, rowY);
    const cY = doc.y - 12;
    doc.text(String(a.composite), col.a, cY);
    doc.text(String(b.composite), col.b, cY);
    doc.fillColor(cd >= 0 ? "#15803d" : "#b91c1c").text(`${cd > 0 ? "+" : ""}${cd}`, col.d, cY);
    doc.font("Helvetica").fillColor("#0f172a");
    doc.moveDown(1);

    // Diligence signals — side by side (guarded so older records without the
    // deeper analysis fields still render a clean, if sparser, comparison).
    type Rec = NonNullable<Awaited<ReturnType<typeof getById>>>;
    const diligence = (r: Rec) => {
      const rr = r.result;
      const coverage = typeof rr.signalCoverage === "number" ? `${Math.round(rr.signalCoverage * 100)}% company-specific` : "n/a";
      const flags = rr.redFlags && rr.redFlags.length ? `${rr.redFlags.length} flag${rr.redFlags.length > 1 ? "s" : ""}` : "none";
      const stress = rr.stress && rr.stress.resilience !== "insufficient-data" ? rr.stress.resilience.toUpperCase() : "n/a";
      const tam = rr.tam && rr.tam.mode !== "insufficient" && typeof rr.tam.currentPenetrationPct === "number"
        ? `${rr.tam.currentPenetrationPct < 0.1 ? "<0.1" : rr.tam.currentPenetrationPct.toFixed(1)}% penetration${rr.tam.flags && rr.tam.flags.length ? " (!)" : ""}`
        : "n/a";
      const proj = rr.projections ? rr.projections.verdict.toUpperCase() : "n/a";
      return { coverage, flags, stress, tam, proj };
    };
    const da = diligence(a);
    const db = diligence(b);
    const hasDiligence = [da, db].some((d) => d.coverage !== "n/a" || d.flags !== "none" || d.stress !== "n/a" || d.tam !== "n/a" || d.proj !== "n/a");
    if (hasDiligence) {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Diligence signals — side by side");
      doc.moveDown(0.3);
      const drow = (label: string, av: string, bv: string, flagWorse?: boolean) => {
        const y = doc.y;
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#475569").text(label, col.factor, y, { width: 240 });
        const ly = doc.y - 11;
        doc.font("Helvetica").fillColor(flagWorse ? "#b45309" : "#0f172a").text(av, col.a, ly, { width: 120 });
        doc.fillColor(flagWorse ? "#b45309" : "#0f172a").text(bv, col.b, ly, { width: 120 });
        doc.fillColor("#0f172a");
        doc.moveDown(0.15);
      };
      drow("Signal coverage", da.coverage, db.coverage);
      drow("Red flags", da.flags, db.flags, da.flags !== "none" || db.flags !== "none");
      drow("Stress resilience", da.stress, db.stress, da.stress === "UNDERWATER" || db.stress === "UNDERWATER" || da.stress === "FRAGILE" || db.stress === "FRAGILE");
      drow("TAM triangulation", da.tam, db.tam, da.tam.includes("(!)") || db.tam.includes("(!)"));
      drow("Revenue projection", da.proj, db.proj, da.proj.includes("HOCKEY") || db.proj.includes("HOCKEY"));
      doc.x = 50;
      doc.moveDown(0.8);
    }

    // Per-side memo snippets
    doc.x = 50;
    for (const r of [a, b]) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor(vColor(r.verdict)).text(`${r.name} — ${r.verdict.toUpperCase()}`);
      doc.fontSize(9.5).font("Helvetica").fillColor("#334155").text(firstSentences(r.result.council.memo, 3), { width: W });
      doc.moveDown(0.5);
    }
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor("#94a3b8")
      .text("Generated by an AI screening tool for research purposes. Not investment advice, an offer, or a solicitation. Figures are model estimates.", { width: W });

    doc.end();
    const pdf = await done;

    res.setHeader("Content-Type", "application/pdf");
    const nm = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 24);
    res.setHeader("Content-Disposition", `attachment; filename="qventure-compare-${nm(a.name)}-vs-${nm(b.name)}.pdf"`);
    return res.send(pdf);
  } catch (e: unknown) {
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "compare_pdf_failed" });
  }
});

// GET /funnel/pdf?ids=<id>,<id>,... - one ranked "deal funnel" PDF over 2-20
// stored analyses: a scored league table (score / verdict / red flags / stress)
// plus a one-line thesis per deal, top-ranked first. Turns a batch of decks into
// a single triage document.
qventureRouter.get("/funnel/pdf", async (req: Request, res: Response) => {
  try {
    const idsRaw = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = Array.from(new Set(idsRaw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 20);
    if (ids.length < 2) return badRequest(res, "ids must list at least 2 analysis ids (comma-separated)");

    const fetched = await Promise.all(ids.map((id) => getById(id)));
    const deals = (fetched.filter((d) => d !== null) as StoredAnalysis[])
      .sort((a, b) => b.composite - a.composite);
    if (deals.length < 2) return res.status(404).json({ ok: false, error: "not_found", hint: "fewer than 2 of those ids resolved" });

    const PDFDocument = ((await import("pdfkit")) as unknown as { default: new (opts: object) => PDFKit.PDFDocument }).default;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const W = 495;
    const vColor = (v: string) => (v === "invest" ? "#15803d" : v === "watch" ? "#b45309" : "#b91c1c");
    const firstSentence = (t: string) => {
      const clean = (t || "").trim().replace(/\s+/g, " ");
      const m = clean.match(/^.*?[.!?](\s|$)/);
      return m ? m[0].trim() : clean.slice(0, 200);
    };

    doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f172a").text("AEVION QVenture - Deal Funnel");
    doc.fontSize(9).font("Helvetica").fillColor("#64748b")
      .text("Generated " + new Date().toISOString().slice(0, 10) + " | " + deals.length + " deals ranked | AEVION AI Investment Analyst | not investment advice");
    doc.moveDown(0.6);

    const invest = deals.filter((d) => d.verdict === "invest").length;
    const watch = deals.filter((d) => d.verdict === "watch").length;
    const top = deals[0];
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a")
      .text("Top pick: " + top.name + " (" + top.composite + "/100). Funnel: " + invest + " invest, " + watch + " watch, " + (deals.length - invest - watch) + " pass.", { width: W });
    doc.moveDown(0.7);

    const col = { rank: 50, name: 80, score: 300, verdict: 350, flags: 420, stress: 465 };
    const headerRow = (y: number) => {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#64748b");
      doc.text("#", col.rank, y);
      doc.text("Company", col.name, y);
      doc.text("Score", col.score, y);
      doc.text("Verdict", col.verdict, y);
      doc.text("Flags", col.flags, y);
      doc.text("Stress", col.stress, y);
    };
    headerRow(doc.y);
    doc.moveDown(0.4);
    doc.font("Helvetica");
    deals.forEach((d, i) => {
      if (doc.y > 770) { doc.addPage(); headerRow(doc.y); doc.moveDown(0.4); }
      const rr = d.result;
      const flags = rr.redFlags && rr.redFlags.length ? String(rr.redFlags.length) : "0";
      const stress = rr.stress && rr.stress.resilience !== "insufficient-data"
        ? rr.stress.resilience.slice(0, 8) : "n/a";
      const y = doc.y;
      doc.fillColor("#0f172a").fontSize(9.5).font("Helvetica-Bold").text(String(i + 1), col.rank, y);
      doc.font("Helvetica").fillColor("#0f172a").text(d.name.slice(0, 34), col.name, y, { width: 210 });
      const ly = doc.y - 11;
      doc.fillColor("#334155").text(String(d.composite), col.score, ly);
      doc.fillColor(vColor(d.verdict)).font("Helvetica-Bold").text(d.verdict.toUpperCase().slice(0, 6), col.verdict, ly);
      doc.font("Helvetica").fillColor(flags !== "0" ? "#b45309" : "#94a3b8").text(flags, col.flags, ly);
      doc.fillColor(stress === "underwat" || stress === "fragile" ? "#b45309" : "#334155").text(stress, col.stress, ly);
      doc.fillColor("#0f172a");
      doc.moveDown(0.25);
    });

    doc.x = 50;
    doc.moveDown(0.8);

    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Thesis per deal");
    doc.moveDown(0.3);
    deals.forEach((d, i) => {
      if (doc.y > 760) doc.addPage();
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(vColor(d.verdict))
        .text((i + 1) + ". " + d.name + " - " + d.composite + "/100 - " + d.verdict.toUpperCase(), { width: W });
      const memo = firstSentence(d.result.council ? d.result.council.memo : "");
      if (memo) doc.fontSize(9.5).font("Helvetica").fillColor("#334155").text(memo, { width: W });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);
    doc.fontSize(8).fillColor("#94a3b8")
      .text("Generated by an AI screening tool for research purposes. Not investment advice, an offer, or a solicitation. Figures are model estimates.", { width: W });

    doc.end();
    const pdf = await done;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="qventure-funnel-' + deals.length + '-deals.pdf"');
    return res.send(pdf);
  } catch (e: unknown) {
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "funnel_pdf_failed" });
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

// ── Watchlist endpoints (require a signed-in user) ─────────────────────────────
// The saved-deals list is private per investor. The frontend keeps a localStorage
// copy for instant, offline rendering; these endpoints make it durable and
// cross-device once the user signs in. All three require a valid Bearer JWT.

function sanitizeWatchItem(raw: unknown): WatchItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim().slice(0, 128) : "";
  const name = typeof o.name === "string" ? o.name.trim().slice(0, MAX_NAME) : "";
  if (!id || !name) return null;
  const composite = typeof o.composite === "number" && isFinite(o.composite)
    ? Math.max(0, Math.min(100, Math.round(o.composite * 10) / 10)) : 0;
  const savedAt = typeof o.savedAt === "string" && !Number.isNaN(Date.parse(o.savedAt))
    ? new Date(o.savedAt).toISOString() : nowIso();
  return {
    id,
    name,
    sector: typeof o.sector === "string" ? o.sector.trim().slice(0, 60) : "other",
    stage: typeof o.stage === "string" ? o.stage.trim().slice(0, 40) : "seed",
    composite,
    verdict: typeof o.verdict === "string" ? o.verdict.trim().slice(0, 40) : "",
    savedAt,
  };
}

// GET /watchlist — the signed-in user's saved deals, newest-first.
qventureRouter.get("/watchlist", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ ok: false, error: "auth_required" });
  try {
    const items = await watchlistList(auth.sub);
    return res.json({ ok: true, data: items });
  } catch (e: unknown) {
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "watchlist_failed" });
  }
});

// POST /watchlist — upsert one item, or bulk-upsert `{ items: [...] }` (used by
// the frontend to migrate a browser's localStorage list up on first sign-in).
qventureRouter.post("/watchlist", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ ok: false, error: "auth_required" });
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(body.items) ? body.items : [body];
    const clean = rawItems.map(sanitizeWatchItem).filter((x): x is WatchItem => x !== null);
    if (!clean.length) return badRequest(res, "no valid watchlist item(s) in body");
    for (const item of clean) await watchlistUpsert(auth.sub, item);
    const items = await watchlistList(auth.sub);
    return res.json({ ok: true, data: items });
  } catch (e: unknown) {
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "watchlist_failed" });
  }
});

// DELETE /watchlist/:id — remove one saved deal.
qventureRouter.delete("/watchlist/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ ok: false, error: "auth_required" });
  try {
    await watchlistDelete(auth.sub, String(req.params.id));
    const items = await watchlistList(auth.sub);
    return res.json({ ok: true, data: items });
  } catch (e: unknown) {
    captureQVentureError(e);
    return res.status(500).json({ ok: false, error: "watchlist_failed" });
  }
});

// ── Storage layer (Postgres ⇄ in-memory) ──────────────────────────────────────

async function persist(record: StoredAnalysis): Promise<void> {
  if (isQVentureDbReady()) {
    try {
      await pool.query(
        `INSERT INTO qventure_analyses
         (id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, visibility, created_at, analysis_input, dedupe_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          record.id, record.name, record.sector, record.stage, record.geography,
          record.askUsd, record.composite, record.verdict,
          JSON.stringify(record.result), record.contentHash, record.visibility, record.createdAt,
          record.input ? JSON.stringify(record.input) : null, record.dedupeHash ?? null,
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

// Lightweight projection of the whole public corpus for the benchmark signal —
// just the fields it needs (composite/stage/sector), never the heavy result blob.
async function fetchBenchmarkSamples(): Promise<BenchmarkSample[]> {
  if (isQVentureDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT composite, stage, sector FROM qventure_analyses WHERE visibility = 'public'`
      );
      return rows.map((r: Record<string, unknown>) => ({
        composite: Number(r.composite),
        stage: String(r.stage),
        sector: String(r.sector),
      }));
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  return memStore.map((r) => ({ composite: r.composite, stage: r.stage, sector: r.sector }));
}

// Curated examples only (id prefixed EXAMPLE_ID_PREFIX), best score first.
async function listExamples(): Promise<StoredAnalysis[]> {
  if (isQVentureDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, created_at
         FROM qventure_analyses WHERE visibility = 'public' AND id LIKE $1 ORDER BY composite DESC`,
        [`${EXAMPLE_ID_PREFIX}%`]
      );
      return rows.map(rowToRecord);
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  return memStore.filter((r) => r.id.startsWith(EXAMPLE_ID_PREFIX)).sort((a, b) => b.composite - a.composite);
}

/** Хранилище не ответило. Это НЕ «анализа нет» — разные новости. */
class StorageUnavailable extends Error {
  constructor() {
    super("storage_unavailable");
    this.name = "StorageUnavailable";
  }
}

/** Общий ответ на отказ хранилища: один текст на все ручки модуля. */
function replyStorageUnavailable(res: Response): void {
  res.status(503).json({
    ok: false,
    error: "storage_unavailable",
    warning:
      "Хранилище временно недоступно. Это НЕ значит, что записи нет — " +
      "прочитать её не удалось. Повторите запрос позже.",
  });
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
      // Раньше отсюда управление уходило ВНИЗ, в память (в проде пустую), и
      // отказ базы возвращался вызывающему как null — то есть как «анализа
      // нет». Ручка честно отвечала 404, и ответ никого не тревожил.
      //
      // Проверено положительным контролем 21.08.2026: с работающей базой та же
      // ручка отдаёт 200 с данными, с падающей — 404. Значит база на пути, и
      // её отказ подменялся отсутствием записи.
      //
      // Запасное хранилище ниже осмысленно ТОЛЬКО когда база не настроена
      // (isQVentureDbReady() === false) — туда мы и так не попадаем из этой
      // Все шесть вызывающих обёрнуты в try/catch; две ручки чтения по
      // идентификатору различают этот класс и отвечают 503.
      throw new StorageUnavailable();
    }
  }
  return memStore.find((r) => r.id === id) ?? null;
}

// Most-recent analysis with this dedupe hash, or null — short-circuits a
// re-submitted plan back to its existing report.
async function getByDedupe(hash: string): Promise<StoredAnalysis | null> {
  if (isQVentureDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, sector, stage, geography, ask_usd, composite, verdict, result, content_hash, created_at
         FROM qventure_analyses WHERE dedupe_hash = $1 ORDER BY created_at DESC LIMIT 1`,
        [hash]
      );
      if (rows[0]) return rowToRecord(rows[0]);
      return null;
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  return memStore.find((r) => r.dedupeHash === hash) ?? null;
}

async function deleteById(id: string): Promise<void> {
  if (isQVentureDbReady()) {
    try {
      await pool.query(`DELETE FROM qventure_analyses WHERE id = $1`, [id]);
      return;
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  const idx = memStore.findIndex((r) => r.id === id);
  if (idx >= 0) memStore.splice(idx, 1);
}

// ── Watchlist storage (Postgres ⇄ in-memory), keyed by user ────────────────────
async function watchlistList(userId: string): Promise<WatchItem[]> {
  if (isQVentureDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT analysis_id, name, sector, stage, composite, verdict, saved_at
         FROM qventure_watchlist WHERE user_id = $1 ORDER BY saved_at DESC LIMIT $2`,
        [userId, MAX_WATCHLIST]
      );
      return rows.map((r: Record<string, unknown>) => ({
        id: String(r.analysis_id),
        name: String(r.name),
        sector: String(r.sector),
        stage: String(r.stage),
        composite: Number(r.composite),
        verdict: String(r.verdict),
        savedAt: new Date(r.saved_at as string).toISOString(),
      }));
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  return (memWatchlist.get(userId) ?? []).slice(0, MAX_WATCHLIST);
}

async function watchlistUpsert(userId: string, item: WatchItem): Promise<void> {
  if (isQVentureDbReady()) {
    try {
      await pool.query(
        `INSERT INTO qventure_watchlist
           (user_id, analysis_id, name, sector, stage, composite, verdict, saved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id, analysis_id) DO UPDATE SET
           name = EXCLUDED.name, sector = EXCLUDED.sector, stage = EXCLUDED.stage,
           composite = EXCLUDED.composite, verdict = EXCLUDED.verdict, saved_at = EXCLUDED.saved_at`,
        [userId, item.id, item.name, item.sector, item.stage, item.composite, item.verdict, item.savedAt]
      );
      return;
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  const list = (memWatchlist.get(userId) ?? []).filter((x) => x.id !== item.id);
  list.unshift(item);
  list.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  memWatchlist.set(userId, list.slice(0, MAX_WATCHLIST));
}

async function watchlistDelete(userId: string, analysisId: string): Promise<void> {
  if (isQVentureDbReady()) {
    try {
      await pool.query(
        `DELETE FROM qventure_watchlist WHERE user_id = $1 AND analysis_id = $2`,
        [userId, analysisId]
      );
      return;
    } catch (e: unknown) {
      captureQVentureError(e);
    }
  }
  const list = (memWatchlist.get(userId) ?? []).filter((x) => x.id !== analysisId);
  memWatchlist.set(userId, list);
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
    input: row.analysis_input
      ? ((typeof row.analysis_input === "string"
          ? JSON.parse(row.analysis_input as string)
          : row.analysis_input) as AnalysisInput)
      : undefined,
    contentHash: (row.content_hash as string) ?? "",
    visibility: "public",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
