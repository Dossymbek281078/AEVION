/**
 * AEVION Ventures — Идея-Маркет backend.
 *
 * Turns the static /ventures showcase into a live idea exchange:
 *   GET  /health                 — module health + counts
 *   GET  /stats                  — totals (ideas, interest votes, submissions)
 *   GET  /ideas                  — 20 curated ideas + live interest tallies
 *   POST /ideas/:id/interest     — cast interest on a curated idea (build|buy),
 *                                  deduped per voter (IP-hash) so it can't be spammed
 *   POST /submit                 — visitor submits their OWN business idea
 *                                  (stored pending; not shown publicly until vetted)
 *   GET  /submissions            — approved community submissions (empty until vetted)
 *
 * Storage: Postgres when available, in-memory fallback so the market still works
 * (interest tallies + submissions) even if the DB is offline. IP is never stored
 * raw — only a salted SHA-256 hash for per-idea dedupe.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import { makeServiceCapture } from "../lib/sentry/platform";

const captureVenturesError = makeServiceCapture("ventures");

export const venturesRouter = Router();

// ── Curated idea catalog (mirrors the /ventures board; source of truth for ids)
type SeedIdea = {
  id: string;
  name: string;
  model: string;
  ceiling: string;
  diff: number;
  status: "live" | "open" | "lab" | "pump";
};

const SEED_IDEAS: SeedIdea[] = [
  { id: "01", name: "AEVIA — longevity / anti-grey гамми", model: "DTC + подписка", ceiling: "$1B", diff: 4, status: "live" },
  { id: "02", name: "AI-ресепшн / голосовой агент", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "03", name: "Collagen sticks — 口服美容", model: "DTC", ceiling: "$250M", diff: 4, status: "lab" },
  { id: "04", name: "Longevity coffee / грибной латте", model: "DTC", ceiling: "$120M", diff: 3, status: "lab" },
  { id: "05", name: "AI-лидоген как сервис", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "06", name: "AI-клон эксперта", model: "Creator SaaS", ceiling: "$10M", diff: 4, status: "open" },
  { id: "07", name: "DTC beauty / skincare hero-SKU", model: "E-commerce", ceiling: "$80M", diff: 4, status: "open" },
  { id: "08", name: "Высокочек-курс по AI", model: "Info product", ceiling: "$20M", diff: 2, status: "pump" },
  { id: "09", name: "Pet-товар с подпиской", model: "DTC подписка", ceiling: "$60M", diff: 4, status: "open" },
  { id: "10", name: "White-label AI-платформа", model: "B2B2C SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "11", name: "STEM-игрушка + unboxing-воронка", model: "DTC + media", ceiling: "$70M", diff: 4, status: "open" },
  { id: "12", name: "Функциональный beauty-снек", model: "Food", ceiling: "$90M", diff: 4, status: "open" },
  { id: "13", name: "Sleep / calm гамми", model: "DTC подписка", ceiling: "$150M", diff: 3, status: "lab" },
  { id: "14", name: "Gut / probiotic гамми", model: "DTC подписка", ceiling: "$140M", diff: 3, status: "lab" },
  { id: "15", name: "Адаптоген-шот (энергия без сахара)", model: "Напиток", ceiling: "$200M", diff: 4, status: "open" },
  { id: "16", name: "Compliance / документооборот AI", model: "SaaS", ceiling: "$10M", diff: 3, status: "open" },
  { id: "17", name: "Ниша-маркетплейс", model: "Marketplace", ceiling: "$50M", diff: 5, status: "open" },
  { id: "18", name: "Nootropic / focus гамми", model: "DTC подписка", ceiling: "$110M", diff: 3, status: "lab" },
  { id: "19", name: "Виральный health-гаджет", model: "Device", ceiling: "$100M", diff: 4, status: "open" },
  { id: "20", name: "3D-визуализация недвижимости", model: "Service → SaaS", ceiling: "$10M", diff: 3, status: "open" },
];
const IDEA_IDS = new Set(SEED_IDEAS.map((i) => i.id));
const KINDS = new Set(["build", "buy"]);

// ── Storage (Postgres + in-memory fallback) ──────────────────────────────────

type Submission = {
  id: string;
  name: string;
  pitch: string;
  model: string;
  ceiling: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const memInterest = new Map<string, Set<string>>(); // ideaId -> set of voterHashes
const memSubmissions: Submission[] = [];
let tablesReady = false;
let dbAvailable = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ventures_interest (
        id          TEXT PRIMARY KEY,
        idea_id     TEXT NOT NULL,
        voter_hash  TEXT NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'build',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (idea_id, voter_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_ventures_interest_idea ON ventures_interest (idea_id);
      CREATE TABLE IF NOT EXISTS ventures_submissions (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        pitch       TEXT NOT NULL,
        model       TEXT NOT NULL DEFAULT '',
        ceiling     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ventures_sub_status ON ventures_submissions (status, created_at DESC);
    `);
    tablesReady = true;
    dbAvailable = true;
  } catch (err) {
    tablesReady = true;
    dbAvailable = false;
    console.warn(
      "[ventures] table init skipped — using in-memory store:",
      err instanceof Error ? err.message : err,
    );
  }
}

const IP_SALT = process.env.VENTURES_IP_SALT ?? "aevion-ventures-v1";
function voterHash(req: Request): string {
  const ip =
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : (req.headers["x-forwarded-for"] as string | undefined)
    )?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";
  return createHash("sha256").update(IP_SALT + ip).digest("hex").slice(0, 32);
}

function str(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}

async function interestTallies(): Promise<Record<string, number>> {
  await ensureTables();
  const out: Record<string, number> = {};
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        "SELECT idea_id, COUNT(*)::int AS c FROM ventures_interest GROUP BY idea_id",
      );
      for (const row of r.rows as { idea_id: string; c: number }[]) out[row.idea_id] = row.c;
      return out;
    } catch {
      // fall through to memory
    }
  }
  for (const [ideaId, voters] of memInterest) out[ideaId] = voters.size;
  return out;
}

// ── Rate limits ──────────────────────────────────────────────────────────────

const interestLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "ventures:interest",
  message: "rate_limit_exceeded: max 30 votes per minute per IP",
});
const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "ventures:submit",
  message: "rate_limit_exceeded: max 5 submissions per minute per IP",
});

// ── Endpoints ────────────────────────────────────────────────────────────────

venturesRouter.get("/health", async (_req, res) => {
  await ensureTables();
  const tallies = await interestTallies();
  const totalVotes = Object.values(tallies).reduce((a, b) => a + b, 0);
  res.json({
    ok: true,
    module: "ventures",
    dbReady: dbAvailable,
    ideas: SEED_IDEAS.length,
    totalInterest: totalVotes,
    timestamp: new Date().toISOString(),
  });
});

venturesRouter.get("/stats", async (_req, res) => {
  await ensureTables();
  const tallies = await interestTallies();
  const totalVotes = Object.values(tallies).reduce((a, b) => a + b, 0);
  let submissionCount = memSubmissions.length;
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query("SELECT COUNT(*)::int AS c FROM ventures_submissions");
      submissionCount = (r.rows[0] as { c: number }).c;
    } catch {
      /* keep memory count */
    }
  }
  // Most-wanted idea by interest.
  let topIdeaId: string | null = null;
  let topVotes = 0;
  for (const [id, c] of Object.entries(tallies)) {
    if (c > topVotes) { topVotes = c; topIdeaId = id; }
  }
  const topIdea = topIdeaId ? SEED_IDEAS.find((i) => i.id === topIdeaId) ?? null : null;
  res.json({
    ideas: SEED_IDEAS.length,
    totalInterest: totalVotes,
    submissionCount,
    topIdea: topIdea ? { id: topIdea.id, name: topIdea.name, votes: topVotes } : null,
    source: dbAvailable ? "postgres" : "memory",
  });
});

venturesRouter.get("/ideas", async (_req, res) => {
  const tallies = await interestTallies();
  res.json({
    ideas: SEED_IDEAS.map((i) => ({ ...i, interest: tallies[i.id] ?? 0 })),
    total: SEED_IDEAS.length,
  });
});

venturesRouter.post("/ideas/:id/interest", interestLimiter, async (req: Request, res: Response) => {
  const id = str(req.params.id, 8);
  if (!IDEA_IDS.has(id)) {
    return res.status(404).json({ error: "unknown-idea" });
  }
  const kindRaw = str((req.body || {}).kind, 8) || "build";
  const kind = KINDS.has(kindRaw) ? kindRaw : "build";
  const hash = voterHash(req);
  await ensureTables();

  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `INSERT INTO ventures_interest (id, idea_id, voter_hash, kind)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (idea_id, voter_hash) DO NOTHING
         RETURNING id`,
        [randomUUID(), id, hash, kind],
      );
      const created = r.rowCount > 0;
      const count = await pool.query(
        "SELECT COUNT(*)::int AS c FROM ventures_interest WHERE idea_id = $1",
        [id],
      );
      return res.status(created ? 201 : 200).json({
        ok: true,
        ideaId: id,
        alreadyVoted: !created,
        interest: (count.rows[0] as { c: number }).c,
      });
    } catch (err) {
      captureVenturesError(err, { route: "ventures/POST/interest" });
      // fall through to memory
    }
  }
  const set = memInterest.get(id) ?? new Set<string>();
  const already = set.has(hash);
  set.add(hash);
  memInterest.set(id, set);
  res.status(already ? 200 : 201).json({ ok: true, ideaId: id, alreadyVoted: already, interest: set.size });
});

venturesRouter.post("/submit", submitLimiter, async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const name = str(body.name, 120);
  const pitch = str(body.pitch, 600);
  const model = str(body.model, 60);
  const ceiling = str(body.ceiling, 30);
  if (name.length < 3 || pitch.length < 10) {
    return res.status(400).json({ error: "name (>=3) and pitch (>=10) required" });
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await ensureTables();

  if (dbAvailable) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO ventures_submissions (id, name, pitch, model, ceiling, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [id, name, pitch, model, ceiling],
      );
      return res.status(201).json({ ok: true, id, status: "pending", note: "Идея принята — попадёт на маркет после проверки." });
    } catch (err) {
      captureVenturesError(err, { route: "ventures/POST/submit" });
      // fall through to memory
    }
  }
  memSubmissions.push({ id, name, pitch, model, ceiling, status: "pending", createdAt });
  res.status(201).json({ ok: true, id, status: "pending", note: "Идея принята — попадёт на маркет после проверки." });
});

venturesRouter.get("/submissions", async (_req, res) => {
  await ensureTables();
  // Only vetted (approved) submissions are shown publicly — new ones stay pending
  // to keep the public board free of spam/abuse until a human approves them.
  if (dbAvailable) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT id, name, pitch, model, ceiling, created_at
           FROM ventures_submissions
          WHERE status = 'approved'
          ORDER BY created_at DESC
          LIMIT 50`,
      );
      return res.json({ submissions: r.rows, total: r.rowCount ?? r.rows.length, source: "postgres" });
    } catch {
      // fall through to memory
    }
  }
  const approved = memSubmissions.filter((s) => s.status === "approved");
  res.json({ submissions: approved, total: approved.length, source: "memory" });
});

// ── MVP concept board surface ────────────────────────────────────────────────

mountConceptBoard({
  router: venturesRouter,
  moduleId: "ventures",
  defaultTag: "ventures",
  fieldMap: { idea: "name", rationale: "pitch" },
  writeLimit: submitLimiter,
});
