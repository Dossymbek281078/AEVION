import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/dbPool";

export const smetaTrainerRouter = Router();

const LMS_WEBHOOK_SECRET = process.env.SMETA_LMS_WEBHOOK_SECRET ?? "";

// Lesson ref → level number mapping (mirrors LEVELS in frontend/lib/levels.ts)
const LESSON_LEVEL_MAP: Record<string, number> = {
  "урок-2-1": 1,
  "урок-2-2": 2,
  "урок-2-3": 3,
  "урок-2-4": 4,
  "урок-2-5": 5,
};

let tablesReady = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS smeta_sessions (
        id            TEXT PRIMARY KEY,
        session_id    TEXT UNIQUE NOT NULL,
        student_name  TEXT,
        student_group TEXT,
        levels_json   TEXT NOT NULL DEFAULT '{}',
        started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_smeta_sessions_sid ON smeta_sessions (session_id);
    `);
    tablesReady = true;
  } catch (err) {
    console.warn("[smeta-trainer] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// POST /api/smeta-trainer/sync — upsert progress from localStorage
smetaTrainerRouter.post("/sync", async (req, res) => {
  try {
    await ensureTables();
    const { sessionId, studentName, studentGroup, levelsJson } = req.body as {
      sessionId?: string;
      studentName?: string;
      studentGroup?: string;
      levelsJson?: string;
    };
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const pool = getPool();
    await pool.query(
      `INSERT INTO smeta_sessions (id, session_id, student_name, student_group, levels_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         student_name  = EXCLUDED.student_name,
         student_group = EXCLUDED.student_group,
         levels_json   = EXCLUDED.levels_json,
         updated_at    = NOW()`,
      [randomUUID(), sessionId, studentName ?? null, studentGroup ?? null, levelsJson ?? "{}"],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "sync_failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/smeta-trainer/sync/:sessionId — restore progress (cross-device)
smetaTrainerRouter.get("/sync/:sessionId", async (req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const result = await pool.query(
      `SELECT session_id, student_name, student_group, levels_json, started_at, updated_at
       FROM smeta_sessions WHERE session_id = $1`,
      [req.params.sessionId],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "session_not_found" });
    const row = result.rows[0];
    res.json({
      sessionId:    row.session_id,
      studentName:  row.student_name,
      studentGroup: row.student_group,
      levels:       JSON.parse(row.levels_json || "{}"),
      startedAt:    row.started_at,
      updatedAt:    row.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: "fetch_failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/smeta-trainer/lms/lesson-complete
// Called by an LMS when a student completes a lesson. Returns a deep-link URL
// that the LMS can open (or send to the student) to jump straight to the
// matching trainer level.
smetaTrainerRouter.post("/lms/lesson-complete", (req, res) => {
  // Optional shared-secret header auth
  if (LMS_WEBHOOK_SECRET) {
    const provided = req.headers["x-webhook-secret"] as string | undefined;
    if (provided !== LMS_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "invalid_webhook_secret" });
    }
  }

  const { lessonRef, studentName, studentGroup } = req.body as {
    lessonRef?: string;
    studentName?: string;
    studentGroup?: string;
  };
  if (!lessonRef) return res.status(400).json({ error: "lessonRef required" });

  const levelNum = LESSON_LEVEL_MAP[lessonRef] ?? null;
  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  const deepLink = levelNum
    ? `${frontendBase}/smeta-trainer/level/${levelNum}?lesson=${encodeURIComponent(lessonRef)}`
    : `${frontendBase}/smeta-trainer`;

  res.json({
    ok: true,
    lessonRef,
    levelNum,
    deepLink,
    studentName: studentName ?? null,
    studentGroup: studentGroup ?? null,
  });
});

// GET /api/smeta-trainer/stats — aggregate counts (no personal data exposed)
smetaTrainerRouter.get("/stats", async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const [total, named] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM smeta_sessions"),
      pool.query("SELECT COUNT(*) AS n FROM smeta_sessions WHERE student_name IS NOT NULL AND student_name <> ''"),
    ]);
    res.json({
      totalSessions: Number(total.rows[0]?.n ?? 0),
      namedSessions: Number(named.rows[0]?.n ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "stats_failed", detail: err instanceof Error ? err.message : String(err) });
  }
});
