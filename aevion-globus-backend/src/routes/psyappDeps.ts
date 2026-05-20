/**
 * PsyApp-Deps — Addiction Recovery (alcohol / smoking / other).
 *
 * MVP scope: streak-tracker, trigger journal, AI support chat, daily affirmations.
 *
 * Endpoints:
 *   GET  /api/psyapp-deps/health
 *   POST /api/psyapp-deps/users/:alias/start     — start (or upsert) a program
 *   GET  /api/psyapp-deps/users/:alias           — user state + streak in days
 *   POST /api/psyapp-deps/users/:alias/relapse   — reset streak, append relapse row
 *   POST /api/psyapp-deps/triggers               — log a trigger event
 *   GET  /api/psyapp-deps/triggers/:alias        — list user's triggers (paginated)
 *   POST /api/psyapp-deps/support                — AI support chat (callProvider, 5/min)
 *   GET  /api/psyapp-deps/affirmations           — 10 hand-picked RU affirmations
 *   GET  /api/psyapp-deps/stats                  — total users, top trigger_type, avg streak
 *
 * Storage: Postgres via getPool() + in-memory fallback (mirrors qlife / qpersona pattern).
 * AI: callProvider() from services/qcoreai/providers (Anthropic/OpenAI/Gemini/DeepSeek/Grok).
 */

import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import {
  ensurePsyAppTables,
  isPsyAppDbReady,
  getPsyAppDbError,
} from "../lib/ensurePsyAppTables";
import { rateLimit } from "../lib/rateLimit";
import { callProvider, getProviders, resolveProvider } from "../services/qcoreai/providers";

export const psyappDepsRouter = Router();

const pool = getPool();

(async () => {
  try {
    await ensurePsyAppTables(pool);
  } catch {
    // in-memory fallback active
  }
})();

// ─── Rate limiters ─────────────────────────────────────────────────────────────
const readLimit  = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "psyapp-read" });
const writeLimit = rateLimit({ windowMs: 60_000, max: 60,  keyPrefix: "psyapp-write" });
const aiLimit    = rateLimit({ windowMs: 60_000, max: 5,   keyPrefix: "psyapp-ai" });

// ─── Types ────────────────────────────────────────────────────────────────────
const ADDICTIONS = ["alcohol", "smoking", "other"] as const;
type Addiction = typeof ADDICTIONS[number];

const TRIGGER_TYPES = ["craving", "stress", "social", "emotion"] as const;
type TriggerType = typeof TRIGGER_TYPES[number];

interface PsyAppUser {
  alias: string;
  addiction: Addiction;
  started_at: string;
  streak_start_at: string;
  total_relapses: number;
}

interface TriggerRecord {
  id: number;
  alias: string;
  trigger_type: TriggerType;
  intensity: number;
  note: string | null;
  coped_how: string | null;
  logged_at: string;
}

interface RelapseRecord {
  id: number;
  alias: string;
  relapsed_at: string;
  reason: string | null;
}

// ─── In-memory fallback ────────────────────────────────────────────────────────
const memUsers = new Map<string, PsyAppUser>();
const memTriggers: TriggerRecord[] = [];
const memRelapses: RelapseRecord[] = [];
let _memTriggerSeq = 1;
let _memRelapseSeq = 1;

function aliasValid(alias: string): boolean {
  return /^[a-z0-9_-]{2,40}$/i.test(alias);
}

function toIsoString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function streakDays(streakStartIso: string): number {
  const start = new Date(streakStartIso).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || now < start) return 0;
  return Math.floor((now - start) / 86_400_000);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbUpsertUser(
  alias: string,
  addiction: Addiction,
  startedAtIso: string | null
): Promise<PsyAppUser> {
  const startedAt = startedAtIso ?? new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO psyapp_users (alias, addiction, started_at, streak_start_at)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (alias) DO UPDATE
       SET addiction = EXCLUDED.addiction
     RETURNING alias, addiction, started_at, streak_start_at, total_relapses`,
    [alias, addiction, startedAt]
  );
  const r = rows[0];
  return {
    alias: r.alias,
    addiction: r.addiction,
    started_at: toIsoString(r.started_at),
    streak_start_at: toIsoString(r.streak_start_at),
    total_relapses: Number(r.total_relapses ?? 0),
  };
}

async function dbGetUser(alias: string): Promise<PsyAppUser | null> {
  const { rows } = await pool.query(
    `SELECT alias, addiction, started_at, streak_start_at, total_relapses
     FROM psyapp_users WHERE alias = $1`,
    [alias]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    alias: r.alias,
    addiction: r.addiction,
    started_at: toIsoString(r.started_at),
    streak_start_at: toIsoString(r.streak_start_at),
    total_relapses: Number(r.total_relapses ?? 0),
  };
}

async function dbRelapse(alias: string, reason: string | null): Promise<PsyAppUser | null> {
  const exists = await dbGetUser(alias);
  if (!exists) return null;
  await pool.query(
    `INSERT INTO psyapp_relapses (alias, reason) VALUES ($1, $2)`,
    [alias, reason]
  );
  const { rows } = await pool.query(
    `UPDATE psyapp_users
       SET streak_start_at = NOW(),
           total_relapses  = total_relapses + 1
     WHERE alias = $1
     RETURNING alias, addiction, started_at, streak_start_at, total_relapses`,
    [alias]
  );
  const r = rows[0];
  return {
    alias: r.alias,
    addiction: r.addiction,
    started_at: toIsoString(r.started_at),
    streak_start_at: toIsoString(r.streak_start_at),
    total_relapses: Number(r.total_relapses ?? 0),
  };
}

async function dbInsertTrigger(fields: Omit<TriggerRecord, "id" | "logged_at">): Promise<TriggerRecord> {
  const { rows } = await pool.query(
    `INSERT INTO psyapp_triggers (alias, trigger_type, intensity, note, coped_how)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, alias, trigger_type, intensity, note, coped_how, logged_at`,
    [fields.alias, fields.trigger_type, fields.intensity, fields.note, fields.coped_how]
  );
  const r = rows[0];
  return {
    id: Number(r.id),
    alias: r.alias,
    trigger_type: r.trigger_type,
    intensity: Number(r.intensity),
    note: r.note,
    coped_how: r.coped_how,
    logged_at: toIsoString(r.logged_at),
  };
}

async function dbListTriggers(alias: string, limit: number, offset: number): Promise<TriggerRecord[]> {
  const { rows } = await pool.query(
    `SELECT id, alias, trigger_type, intensity, note, coped_how, logged_at
     FROM psyapp_triggers
     WHERE alias = $1
     ORDER BY logged_at DESC
     LIMIT $2 OFFSET $3`,
    [alias, limit, offset]
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    alias: r.alias,
    trigger_type: r.trigger_type,
    intensity: Number(r.intensity),
    note: r.note,
    coped_how: r.coped_how,
    logged_at: toIsoString(r.logged_at),
  }));
}

async function dbStats(): Promise<{
  total_users: number;
  top_trigger_type: TriggerType | null;
  avg_streak_days: number;
}> {
  const usersR = await pool.query(`SELECT COUNT(*)::int AS total FROM psyapp_users`);
  const topR = await pool.query(
    `SELECT trigger_type, COUNT(*)::int AS cnt
     FROM psyapp_triggers
     GROUP BY trigger_type
     ORDER BY cnt DESC
     LIMIT 1`
  );
  const streakR = await pool.query(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - streak_start_at)) / 86400), 0)::float AS avg_days
     FROM psyapp_users`
  );
  return {
    total_users: Number(usersR.rows[0]?.total ?? 0),
    top_trigger_type: (topR.rows[0]?.trigger_type as TriggerType | undefined) ?? null,
    avg_streak_days: Math.round(Number(streakR.rows[0]?.avg_days ?? 0) * 10) / 10,
  };
}

// ─── In-memory mirrors ────────────────────────────────────────────────────────
function memUpsertUser(alias: string, addiction: Addiction, startedAtIso: string | null): PsyAppUser {
  const existing = memUsers.get(alias);
  if (existing) {
    existing.addiction = addiction;
    return existing;
  }
  const startedAt = startedAtIso ?? new Date().toISOString();
  const record: PsyAppUser = {
    alias,
    addiction,
    started_at: startedAt,
    streak_start_at: startedAt,
    total_relapses: 0,
  };
  memUsers.set(alias, record);
  return record;
}

function memGetUser(alias: string): PsyAppUser | null {
  return memUsers.get(alias) ?? null;
}

function memRelapse(alias: string, reason: string | null): PsyAppUser | null {
  const u = memUsers.get(alias);
  if (!u) return null;
  memRelapses.push({
    id: _memRelapseSeq++,
    alias,
    relapsed_at: new Date().toISOString(),
    reason,
  });
  u.streak_start_at = new Date().toISOString();
  u.total_relapses += 1;
  return u;
}

function memInsertTrigger(fields: Omit<TriggerRecord, "id" | "logged_at">): TriggerRecord {
  const record: TriggerRecord = {
    id: _memTriggerSeq++,
    ...fields,
    logged_at: new Date().toISOString(),
  };
  memTriggers.push(record);
  return record;
}

function memListTriggers(alias: string, limit: number, offset: number): TriggerRecord[] {
  return memTriggers
    .filter((t) => t.alias === alias)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .slice(offset, offset + limit);
}

function memStats(): { total_users: number; top_trigger_type: TriggerType | null; avg_streak_days: number } {
  const counts: Record<string, number> = {};
  for (const t of memTriggers) counts[t.trigger_type] = (counts[t.trigger_type] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as TriggerType | undefined;
  const users = Array.from(memUsers.values());
  const avg = users.length
    ? users.reduce((s, u) => s + streakDays(u.streak_start_at), 0) / users.length
    : 0;
  return {
    total_users: users.length,
    top_trigger_type: top ?? null,
    avg_streak_days: Math.round(avg * 10) / 10,
  };
}

// ─── Affirmations (RU) ────────────────────────────────────────────────────────
const AFFIRMATIONS_RU = [
  "Ты сильнее, чем твоя зависимость. Один день — это победа.",
  "Каждая трезвая минута — кирпич в фундамент новой жизни.",
  "Тяга — это волна. Она поднимается и проходит. Дыши.",
  "Срыв не делает тебя слабым. Слабым делает отказ начать заново.",
  "Сегодня я выбираю себя. Не вещество, не привычку — себя.",
  "Тело помнит, как быть здоровым. Дай ему шанс.",
  "Я не один. Тысячи людей идут тем же путём прямо сейчас.",
  "Маленькие шаги — это и есть путь. Не геройство, а постоянство.",
  "Я учусь жить с эмоциями, а не убегать от них.",
  "Каждый день без — это подарок будущему мне.",
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/psyapp-deps/health */
psyappDepsRouter.get("/health", readLimit, (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "psyapp-deps",
    db: isPsyAppDbReady() ? "postgres" : "memory",
    dbError: getPsyAppDbError(),
  });
});

/** POST /api/psyapp-deps/users/:alias/start */
psyappDepsRouter.post("/users/:alias/start", writeLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias || "").trim();
    if (!aliasValid(alias)) {
      return res.status(400).json({ ok: false, error: "alias must be 2..40 chars [a-z0-9_-]" });
    }
    const body = req.body ?? {};
    const addiction = String(body.addiction || "").toLowerCase();
    if (!ADDICTIONS.includes(addiction as Addiction)) {
      return res.status(400).json({
        ok: false,
        error: `addiction must be one of: ${ADDICTIONS.join(", ")}`,
      });
    }
    const startedAtIso = body.startedAt ? new Date(String(body.startedAt)).toISOString() : null;

    const user = isPsyAppDbReady()
      ? await dbUpsertUser(alias, addiction as Addiction, startedAtIso)
      : memUpsertUser(alias, addiction as Addiction, startedAtIso);

    return res.status(201).json({
      ok: true,
      user,
      streak_days: streakDays(user.streak_start_at),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/psyapp-deps/users/:alias */
psyappDepsRouter.get("/users/:alias", readLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias || "").trim();
    if (!aliasValid(alias)) {
      return res.status(400).json({ ok: false, error: "alias invalid" });
    }
    const user = isPsyAppDbReady() ? await dbGetUser(alias) : memGetUser(alias);
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
    return res.json({ ok: true, user, streak_days: streakDays(user.streak_start_at) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/psyapp-deps/users/:alias/relapse */
psyappDepsRouter.post("/users/:alias/relapse", writeLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias || "").trim();
    if (!aliasValid(alias)) {
      return res.status(400).json({ ok: false, error: "alias invalid" });
    }
    const reasonRaw = req.body?.reason;
    const reason = typeof reasonRaw === "string" && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;

    const user = isPsyAppDbReady()
      ? await dbRelapse(alias, reason)
      : memRelapse(alias, reason);

    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });
    return res.json({
      ok: true,
      user,
      streak_days: 0,
      message: "Streak reset. New day, fresh start.",
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/psyapp-deps/triggers */
psyappDepsRouter.post("/triggers", writeLimit, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const alias = String(body.alias || "").trim();
    if (!aliasValid(alias)) {
      return res.status(400).json({ ok: false, error: "alias invalid (2..40 chars [a-z0-9_-])" });
    }
    const triggerType = String(body.trigger_type || "").toLowerCase();
    if (!TRIGGER_TYPES.includes(triggerType as TriggerType)) {
      return res.status(400).json({
        ok: false,
        error: `trigger_type must be one of: ${TRIGGER_TYPES.join(", ")}`,
      });
    }
    const intensityRaw = body.intensity_1_10 ?? body.intensity;
    const intensity = parseInt(String(intensityRaw ?? ""), 10);
    if (!Number.isFinite(intensity) || intensity < 1 || intensity > 10) {
      return res.status(400).json({ ok: false, error: "intensity_1_10 must be 1..10" });
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const copedHowRaw = body.copedHow ?? body.coped_how;
    const copedHow = typeof copedHowRaw === "string" ? copedHowRaw.trim().slice(0, 500) : null;

    const fields = {
      alias,
      trigger_type: triggerType as TriggerType,
      intensity,
      note: note && note.length > 0 ? note : null,
      coped_how: copedHow && copedHow.length > 0 ? copedHow : null,
    };

    const trigger = isPsyAppDbReady() ? await dbInsertTrigger(fields) : memInsertTrigger(fields);
    return res.status(201).json({ ok: true, trigger });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/psyapp-deps/triggers/:alias */
psyappDepsRouter.get("/triggers/:alias", readLimit, async (req: Request, res: Response) => {
  try {
    const alias = String(req.params.alias || "").trim();
    if (!aliasValid(alias)) {
      return res.status(400).json({ ok: false, error: "alias invalid" });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const triggers = isPsyAppDbReady()
      ? await dbListTriggers(alias, limit, offset)
      : memListTriggers(alias, limit, offset);

    return res.json({ ok: true, triggers, count: triggers.length, limit, offset });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** POST /api/psyapp-deps/support — AI support chat */
psyappDepsRouter.post("/support", aiLimit, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    if (!message) return res.status(400).json({ ok: false, error: "message required" });

    const providerId = resolveProvider();
    const providerDef = getProviders().find((p) => p.id === providerId);
    const modelName = providerDef?.defaultModel ?? "";

    const systemPrompt =
      "Ты — поддерживающий советник по выходу из зависимостей. " +
      "Не суди, мягко поддержи, предложи 1 конкретный шаг, который человек может сделать прямо сейчас. " +
      "Ответ на русском языке, не более 120 слов. " +
      "Не ставь диагнозы. При признаках кризиса напомни, что есть службы помощи и специалисты.";

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: message },
    ];

    try {
      const result = await callProvider(providerId, messages, modelName, 0.7);
      return res.json({
        ok: true,
        reply: result.reply,
        provider: providerId,
        model: result.model,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("No AI provider configured") || msg === "not-configured") {
        return res.status(503).json({
          ok: false,
          error: "llm-not-configured",
          reply:
            "Сейчас я не могу ответить — провайдер AI не настроен. Сделай 1 простой шаг: " +
            "выпей стакан воды, выйди на воздух на 5 минут, позвони близкому. Тяга пройдёт.",
        });
      }
      console.error("[psyapp-deps] support_failed", msg);
      return res.status(502).json({
        ok: false,
        error: "llm-failed",
        reply: "Сбой при обращении к AI. Попробуй ещё раз. Ты не один.",
      });
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

/** GET /api/psyapp-deps/affirmations */
psyappDepsRouter.get("/affirmations", readLimit, (_req: Request, res: Response) => {
  res.json({ ok: true, affirmations: AFFIRMATIONS_RU, total: AFFIRMATIONS_RU.length });
});

/** GET /api/psyapp-deps/stats */
psyappDepsRouter.get("/stats", readLimit, async (_req: Request, res: Response) => {
  try {
    const stats = isPsyAppDbReady() ? await dbStats() : memStats();
    res.json({ ok: true, ...stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal error" });
  }
});

// ── MVP concept board surface ───────────────────────────────────────────────

psyappDepsRouter.get("/status", readLimit, (_req: Request, res: Response) => {
  res.json({
    module: "psyapp-deps",
    code: "PSYAPP",
    status: "mvp",
    description: "Dependencies recovery: streak tracker, trigger log, AI support, affirmations + concept board.",
    endpoints: {
      streak: "/api/psyapp-deps/streak",
      triggers: "/api/psyapp-deps/triggers",
      affirmations: "/api/psyapp-deps/affirmations",
      conceptMessages: "/api/psyapp-deps/concept/messages",
      conceptStats: "/api/psyapp-deps/concept-stats",
    },
    timestamp: new Date().toISOString(),
  });
});

mountConceptBoard({ router: psyappDepsRouter, moduleId: "psyapp-deps", defaultTag: "psyapp", readLimit, writeLimit });
