/**
 * QLife — Longevity & Anti-Aging backend router.
 *
 * Endpoints:
 *   GET  /api/qlife/health
 *   POST /api/qlife/biomarkers      — log a biomarker reading
 *   GET  /api/qlife/biomarkers      — list readings (?type=&limit=&userId=)
 *   GET  /api/qlife/biomarkers/trends — weekly averages per type
 *   POST /api/qlife/plan            — AI longevity plan generation
 *   GET  /api/qlife/stats           — aggregate stats
 */

import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import { ensureQLifeTables, isQLifeDbReady, getQLifeDbError } from "../lib/ensureQLifeTables";
import { rateLimit } from "../lib/rateLimit";
import { callProvider, getProviders, resolveProvider } from "../services/qcoreai/providers";

export const qlifeRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensureQLifeTables(pool);
  } catch {
    // in-memory fallback active
  }
})();

// ─── Rate limiters ─────────────────────────────────────────────────────────────
const readLimit  = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "qlife-read" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 60,  keyPrefix: "qlife-write" });
const aiLimit    = rateLimit({ windowMs: 60_000, max: 5,   keyPrefix: "qlife-ai" });

// ─── Types ────────────────────────────────────────────────────────────────────
const VALID_TYPES = [
  "blood_pressure",
  "weight_kg",
  "sleep_hours",
  "vo2max",
  "hrv",
  "glucose",
  "stress_level",
] as const;

type BiomarkerType = typeof VALID_TYPES[number];

interface BiomarkerRecord {
  id: number;
  user_id: string;
  type: BiomarkerType;
  value: number;
  unit: string;
  notes: string | null;
  measured_at: string;
}

const GOAL_TYPES = ["sleep", "cardio", "nutrition", "stress", "brain"] as const;
type GoalType = typeof GOAL_TYPES[number];

// ─── In-memory fallback ────────────────────────────────────────────────────────
let _memSeq = 1;
const memBiomarkers: BiomarkerRecord[] = [];

function memInsert(fields: Omit<BiomarkerRecord, "id">): BiomarkerRecord {
  const record: BiomarkerRecord = { id: _memSeq++, ...fields };
  memBiomarkers.push(record);
  return record;
}

function memList(type?: string, limit = 30, userId?: string): BiomarkerRecord[] {
  return memBiomarkers
    .filter((r) => (!type || r.type === type) && (!userId || userId === "me" || r.user_id === userId))
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at))
    .slice(0, limit);
}

function memTrends(): Record<string, { type: string; week: string; avg: number; count: number }[]> {
  const grouped: Record<string, Record<string, { sum: number; count: number }>> = {};
  for (const r of memBiomarkers) {
    const d = new Date(r.measured_at);
    // ISO week approximation: floor to Monday
    const dayMs = 86_400_000;
    const monday = new Date(d.getTime() - ((d.getDay() || 7) - 1) * dayMs);
    const week = monday.toISOString().slice(0, 10);
    if (!grouped[r.type]) grouped[r.type] = {};
    if (!grouped[r.type][week]) grouped[r.type][week] = { sum: 0, count: 0 };
    grouped[r.type][week].sum += Number(r.value);
    grouped[r.type][week].count += 1;
  }
  const out: Record<string, { type: string; week: string; avg: number; count: number }[]> = {};
  for (const [type, weeks] of Object.entries(grouped)) {
    out[type] = Object.entries(weeks)
      .map(([week, { sum, count }]) => ({
        type,
        week,
        avg: Math.round((sum / count) * 100) / 100,
        count,
      }))
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, 8);
  }
  return out;
}

function memStats(): { total: number; activeUsers: number; mostLoggedType: string | null } {
  const userSet = new Set(memBiomarkers.map((r) => r.user_id));
  const typeCounts: Record<string, number> = {};
  for (const r of memBiomarkers) {
    typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
  }
  const mostLoggedType =
    Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] ?? null;
  return { total: memBiomarkers.length, activeUsers: userSet.size, mostLoggedType };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbInsert(fields: Omit<BiomarkerRecord, "id">): Promise<BiomarkerRecord> {
  const { rows } = await pool.query(
    `INSERT INTO qlife_biomarkers (user_id, type, value, unit, notes, measured_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      fields.user_id,
      fields.type,
      fields.value,
      fields.unit,
      fields.notes ?? null,
      fields.measured_at,
    ]
  );
  const row = rows[0];
  return {
    id:          row.id,
    user_id:     row.user_id,
    type:        row.type,
    value:       parseFloat(row.value),
    unit:        row.unit,
    notes:       row.notes,
    measured_at: row.measured_at instanceof Date
      ? row.measured_at.toISOString()
      : String(row.measured_at),
  };
}

async function dbList(type?: string, limit = 30, userId?: string): Promise<BiomarkerRecord[]> {
  const conditions: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (type) {
    conditions.push(`type = $${idx++}`);
    vals.push(type);
  }
  if (userId && userId !== "me") {
    conditions.push(`user_id = $${idx++}`);
    vals.push(userId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  vals.push(Math.min(limit, 200));

  const { rows } = await pool.query(
    `SELECT * FROM qlife_biomarkers ${where} ORDER BY measured_at DESC LIMIT $${idx}`,
    vals
  );
  return rows.map((row: any) => ({
    id:          row.id,
    user_id:     row.user_id,
    type:        row.type,
    value:       parseFloat(row.value),
    unit:        row.unit,
    notes:       row.notes,
    measured_at: row.measured_at instanceof Date
      ? row.measured_at.toISOString()
      : String(row.measured_at),
  }));
}

async function dbTrends(): Promise<Record<string, { type: string; week: string; avg: number; count: number }[]>> {
  const { rows } = await pool.query(`
    SELECT
      type,
      date_trunc('week', measured_at)::date::text AS week,
      ROUND(AVG(value)::numeric, 2)               AS avg,
      COUNT(*)::int                               AS count
    FROM qlife_biomarkers
    GROUP BY type, date_trunc('week', measured_at)
    ORDER BY type, week DESC
  `);
  const out: Record<string, { type: string; week: string; avg: number; count: number }[]> = {};
  for (const row of rows) {
    const t: string = row.type;
    if (!out[t]) out[t] = [];
    if (out[t].length < 8) {
      out[t].push({ type: t, week: row.week, avg: parseFloat(row.avg), count: row.count });
    }
  }
  return out;
}

async function dbStats(): Promise<{ total: number; activeUsers: number; mostLoggedType: string | null }> {
  const { rows: totRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM qlife_biomarkers`
  );
  const { rows: userRows } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS active_users FROM qlife_biomarkers`
  );
  const { rows: typeRows } = await pool.query(
    `SELECT type, COUNT(*)::int AS cnt FROM qlife_biomarkers GROUP BY type ORDER BY cnt DESC LIMIT 1`
  );
  return {
    total:          totRows[0]?.total ?? 0,
    activeUsers:    userRows[0]?.active_users ?? 0,
    mostLoggedType: typeRows[0]?.type ?? null,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/qlife/health */
qlifeRouter.get("/health", readLimit, (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qlife",
    db: isQLifeDbReady() ? "postgres" : "memory",
    dbError: getQLifeDbError(),
  });
});

/** GET /api/qlife/stats */
qlifeRouter.get("/stats", readLimit, async (_req: Request, res: Response) => {
  try {
    const stats = isQLifeDbReady() ? await dbStats() : memStats();
    res.json({ ok: true, ...stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/qlife/biomarkers/trends — must be registered before /:id style routes */
qlifeRouter.get("/biomarkers/trends", readLimit, async (_req: Request, res: Response) => {
  try {
    const trends = isQLifeDbReady() ? await dbTrends() : memTrends();
    res.json({ ok: true, trends });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/qlife/biomarkers */
qlifeRouter.get("/biomarkers", readLimit, async (req: Request, res: Response) => {
  try {
    const type   = typeof req.query.type   === "string" ? req.query.type   : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const limit  = Math.min(Number(req.query.limit) || 30, 200);

    if (type && !VALID_TYPES.includes(type as BiomarkerType)) {
      res.status(400).json({ ok: false, error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` });
      return;
    }

    const biomarkers = isQLifeDbReady()
      ? await dbList(type, limit, userId)
      : memList(type, limit, userId);

    res.json({ ok: true, biomarkers, count: biomarkers.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/qlife/biomarkers */
qlifeRouter.post("/biomarkers", writeLimit, async (req: Request, res: Response) => {
  try {
    const { userId, type, value, unit, notes, measuredAt } = req.body ?? {};

    if (!type || !VALID_TYPES.includes(type as BiomarkerType)) {
      res.status(400).json({
        ok: false,
        error: `type is required and must be one of: ${VALID_TYPES.join(", ")}`,
      });
      return;
    }
    if (value === undefined || value === null || isNaN(Number(value))) {
      res.status(400).json({ ok: false, error: "value must be a number" });
      return;
    }
    if (!unit || typeof unit !== "string") {
      res.status(400).json({ ok: false, error: "unit is required" });
      return;
    }

    const fields: Omit<BiomarkerRecord, "id"> = {
      user_id:     userId ? String(userId).slice(0, 128) : "anonymous",
      type:        type as BiomarkerType,
      value:       Number(value),
      unit:        String(unit).slice(0, 32),
      notes:       notes ? String(notes).slice(0, 1000) : null,
      measured_at: measuredAt ? new Date(measuredAt).toISOString() : new Date().toISOString(),
    };

    const biomarker = isQLifeDbReady() ? await dbInsert(fields) : memInsert(fields);

    res.status(201).json({ ok: true, biomarker });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/qlife/plan */
qlifeRouter.post("/plan", aiLimit, async (req: Request, res: Response) => {
  try {
    const { age, goals } = req.body ?? {};

    if (!age || isNaN(Number(age)) || Number(age) < 10 || Number(age) > 120) {
      res.status(400).json({ ok: false, error: "age must be a number between 10 and 120" });
      return;
    }

    const parsedGoals: GoalType[] = Array.isArray(goals)
      ? (goals as string[]).filter((g) => GOAL_TYPES.includes(g as GoalType)) as GoalType[]
      : [];

    if (parsedGoals.length === 0) {
      res.status(400).json({
        ok: false,
        error: `goals must be a non-empty array from: ${GOAL_TYPES.join(", ")}`,
      });
      return;
    }

    const providerId = resolveProvider();
    const providerDef = getProviders().find((p) => p.id === providerId);
    const modelName = providerDef?.defaultModel ?? "";

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a longevity and anti-aging specialist with expertise in evidence-based medicine. " +
          "Create a personalized longevity plan as a JSON array. " +
          "Each item must have exactly these fields: goal (string), recommendation (string, max 200 chars), " +
          "frequency (string, e.g. 'daily', '3x per week'), expected_benefit (string, max 150 chars). " +
          "Return ONLY the raw JSON array — no markdown, no explanation, no code fences.",
      },
      {
        role: "user" as const,
        content: `Age: ${Number(age)}\nGoals: ${parsedGoals.join(", ")}\n\nCreate a longevity plan with one recommendation per goal.`,
      },
    ];

    const result = await callProvider(providerId, messages, modelName, 0.7);

    let plan: { goal: string; recommendation: string; frequency: string; expected_benefit: string }[] = [];
    try {
      const raw = result.reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      plan = JSON.parse(raw);
      if (!Array.isArray(plan)) plan = [];
    } catch {
      // Fallback: build a basic plan from goals
      plan = parsedGoals.map((g) => ({
        goal: g,
        recommendation: `Evidence-based ${g} optimization protocol for age ${Number(age)}`,
        frequency: "daily",
        expected_benefit: `Improved longevity markers within 8-12 weeks`,
      }));
    }

    res.json({ ok: true, plan, provider: providerId, model: result.model });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "AI plan generation failed" });
  }
});

// ── MVP concept board surface ───────────────────────────────────────────────

qlifeRouter.get("/status", readLimit, (_req: Request, res: Response) => {
  res.json({
    module: "qlife",
    code: "QLIFE",
    status: "mvp",
    description: "Longevity & anti-aging: biomarkers, trends, AI plan + concept board.",
    endpoints: {
      health: "/api/qlife/health",
      stats: "/api/qlife/stats",
      biomarkers: "/api/qlife/biomarkers",
      conceptMessages: "/api/qlife/concept/messages",
      conceptStats: "/api/qlife/concept-stats",
    },
    timestamp: new Date().toISOString(),
  });
});

mountConceptBoard({ router: qlifeRouter, moduleId: "qlife", defaultTag: "qlife", readLimit, writeLimit });
