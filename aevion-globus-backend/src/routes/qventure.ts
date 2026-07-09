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
    doc.moveDown(0.8);

    // Investment memo
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Investment memo");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").fillColor("#1e293b").text(r.council.memo, { width: W, align: "left" });
    doc.fontSize(8).fillColor("#94a3b8")
      .text(`Narrative engine: ${r.council.aiUsed ? `live model (${r.council.aiProvider})` : "deterministic (no AI key)"}`);
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
