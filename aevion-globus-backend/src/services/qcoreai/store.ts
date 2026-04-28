/**
 * QCoreAI persistence helpers.
 *
 * Two-mode store:
 *   1. Postgres (primary) — raw SQL via pg Pool when the DB is reachable.
 *   2. In-memory (fallback) — transparent Maps when the DB is unavailable.
 *
 * The mode is decided by `ensureQCoreTables()` on first use. Every exported
 * function probes `isDbReady()` and dispatches accordingly, so routes never
 * need to branch. The in-memory mode survives the life of the Node process
 * — perfect for local demos and self-contained investor runs.
 */

import crypto from "crypto";
import { getPool } from "../../lib/dbPool";
import { ensureQCoreTables, isDbReady } from "../../lib/ensureQCoreTables";
import type { ChatMessage } from "./providers";

const pool = getPool();

export type SessionRow = {
  id: string;
  userId: string | null;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
};

export type RunRow = {
  id: string;
  sessionId: string;
  userInput: string;
  status: "pending" | "running" | "done" | "error" | "stopped" | "capped";
  error: string | null;
  agentConfig: any;
  strategy: string | null;
  finalContent: string | null;
  totalDurationMs: number | null;
  totalCostUsd: number | null;
  shareToken: string | null;
  tags: string[];
  startedAt: string;
  finishedAt: string | null;
};

export type UserWebhookRow = {
  userId: string;
  url: string;
  secret: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRow = {
  id: string;
  runId: string;
  role: string;
  stage: string | null;
  instance: string | null;
  provider: string | null;
  model: string | null;
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number | null;
  costUsd: number | null;
  ordering: number;
  createdAt: string;
};

/* ═══════════════════════════════════════════════════════════════════════
   In-memory fallback state
   ═══════════════════════════════════════════════════════════════════════ */

const memSessions = new Map<string, SessionRow>();
const memRuns = new Map<string, RunRow>();
const memMessagesByRun = new Map<string, MessageRow[]>();
const memUserWebhooks = new Map<string, UserWebhookRow>();

function nowIso(): string { return new Date().toISOString(); }

function deriveTitle(text: string): string {
  const s = (text || "").trim().replace(/\s+/g, " ");
  if (!s) return "New session";
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sessions
   ═══════════════════════════════════════════════════════════════════════ */

export async function createSession(opts: {
  userId?: string | null;
  title?: string | null;
  mode?: string;
}): Promise<SessionRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const title = (opts.title?.trim() || "New session").slice(0, 120);
  const mode = opts.mode || "multi-agent";

  if (!isDbReady()) {
    const row: SessionRow = {
      id,
      userId: opts.userId ?? null,
      title,
      mode,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memSessions.set(id, row);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreSession" ("id","userId","title","mode")
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [id, opts.userId ?? null, title, mode]
  );
  return r.rows[0] as SessionRow;
}

export async function ensureSession(opts: {
  sessionId?: string | null;
  userId?: string | null;
  seedTitle?: string | null;
}): Promise<SessionRow> {
  await ensureQCoreTables(pool);

  if (opts.sessionId) {
    if (!isDbReady()) {
      const existing = memSessions.get(opts.sessionId);
      if (existing) {
        if (existing.userId && opts.userId && existing.userId !== opts.userId) {
          throw new Error("session not owned by caller");
        }
        return existing;
      }
    } else {
      const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [opts.sessionId]);
      const row = r.rows?.[0] as SessionRow | undefined;
      if (row) {
        if (row.userId && opts.userId && row.userId !== opts.userId) {
          throw new Error("session not owned by caller");
        }
        return row;
      }
    }
  }

  return createSession({
    userId: opts.userId ?? null,
    title: opts.seedTitle ? deriveTitle(opts.seedTitle) : null,
  });
}

export async function touchSession(sessionId: string): Promise<void> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memSessions.get(sessionId);
    if (s) s.updatedAt = nowIso();
    return;
  }
  await pool.query(`UPDATE "QCoreSession" SET "updatedAt"=NOW() WHERE "id"=$1`, [sessionId]);
}

export async function renameSessionIfDefault(sessionId: string, seed: string): Promise<void> {
  const nice = deriveTitle(seed);
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memSessions.get(sessionId);
    if (s && (!s.title || s.title === "New session")) {
      s.title = nice;
      s.updatedAt = nowIso();
    }
    return;
  }
  await pool.query(
    `UPDATE "QCoreSession"
       SET "title"=$2, "updatedAt"=NOW()
     WHERE "id"=$1 AND ("title"='New session' OR "title" IS NULL OR "title"='')`,
    [sessionId, nice]
  );
}

export async function listSessions(userId: string | null, limit = 50): Promise<SessionRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(200, limit));

  if (!isDbReady()) {
    const all = Array.from(memSessions.values());
    const filtered = all.filter((s) => (userId ? s.userId === userId : s.userId == null));
    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return filtered.slice(0, lim);
  }

  if (userId) {
    const r = await pool.query(
      `SELECT * FROM "QCoreSession" WHERE "userId"=$1 ORDER BY "updatedAt" DESC LIMIT $2`,
      [userId, lim]
    );
    return r.rows as SessionRow[];
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreSession" WHERE "userId" IS NULL ORDER BY "updatedAt" DESC LIMIT $1`,
    [lim]
  );
  return r.rows as SessionRow[];
}

export async function getSession(id: string, userId: string | null): Promise<SessionRow | null> {
  await ensureQCoreTables(pool);

  const check = (row: SessionRow | undefined): SessionRow | null => {
    if (!row) return null;
    if (row.userId && userId && row.userId !== userId) return null;
    if (row.userId && !userId) return null;
    return row;
  };

  if (!isDbReady()) {
    return check(memSessions.get(id));
  }
  const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [id]);
  return check(r.rows?.[0] as SessionRow | undefined);
}

export async function deleteSession(id: string, userId: string | null): Promise<boolean> {
  await ensureQCoreTables(pool);
  const session = await getSession(id, userId);
  if (!session) return false;

  if (!isDbReady()) {
    const runIds = Array.from(memRuns.values()).filter((r) => r.sessionId === id).map((r) => r.id);
    for (const rid of runIds) {
      memMessagesByRun.delete(rid);
      memRuns.delete(rid);
    }
    memSessions.delete(id);
    return true;
  }

  await pool.query(
    `DELETE FROM "QCoreMessage" WHERE "runId" IN (SELECT "id" FROM "QCoreRun" WHERE "sessionId"=$1)`,
    [id]
  );
  await pool.query(`DELETE FROM "QCoreRun" WHERE "sessionId"=$1`, [id]);
  await pool.query(`DELETE FROM "QCoreSession" WHERE "id"=$1`, [id]);
  return true;
}

export async function renameSession(
  id: string,
  userId: string | null,
  nextTitle: string
): Promise<SessionRow | null> {
  const session = await getSession(id, userId);
  if (!session) return null;
  const clean = (nextTitle || "").trim().slice(0, 120) || "New session";

  if (!isDbReady()) {
    session.title = clean;
    session.updatedAt = nowIso();
    memSessions.set(id, session);
    return session;
  }

  const r = await pool.query(
    `UPDATE "QCoreSession" SET "title"=$2, "updatedAt"=NOW() WHERE "id"=$1 RETURNING *`,
    [id, clean]
  );
  return (r.rows?.[0] as SessionRow) ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Runs
   ═══════════════════════════════════════════════════════════════════════ */

export async function createRun(opts: {
  sessionId: string;
  userInput: string;
  agentConfig?: unknown;
  strategy?: string | null;
}): Promise<RunRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();

  if (!isDbReady()) {
    const row: RunRow = {
      id,
      sessionId: opts.sessionId,
      userInput: opts.userInput,
      status: "running",
      error: null,
      agentConfig: opts.agentConfig ?? null,
      strategy: opts.strategy ?? null,
      finalContent: null,
      totalDurationMs: null,
      totalCostUsd: null,
      shareToken: null,
      tags: [],
      startedAt: nowIso(),
      finishedAt: null,
    };
    memRuns.set(id, row);
    memMessagesByRun.set(id, []);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreRun" ("id","sessionId","userInput","status","agentConfig","strategy")
     VALUES ($1,$2,$3,'running',$4,$5)
     RETURNING *`,
    [
      id,
      opts.sessionId,
      opts.userInput,
      opts.agentConfig ? JSON.stringify(opts.agentConfig) : null,
      opts.strategy ?? null,
    ]
  );
  return r.rows[0] as RunRow;
}

export async function finishRun(
  runId: string,
  status: "done" | "error" | "stopped" | "capped",
  opts: {
    error?: string | null;
    finalContent?: string | null;
    totalDurationMs?: number | null;
    totalCostUsd?: number | null;
  }
): Promise<void> {
  await ensureQCoreTables(pool);

  if (!isDbReady()) {
    const r = memRuns.get(runId);
    if (!r) return;
    r.status = status;
    r.error = opts.error ?? null;
    r.finalContent = opts.finalContent ?? null;
    r.totalDurationMs = opts.totalDurationMs ?? null;
    r.totalCostUsd = opts.totalCostUsd ?? null;
    r.finishedAt = nowIso();
    return;
  }

  await pool.query(
    `UPDATE "QCoreRun"
       SET "status"=$2,"error"=$3,"finalContent"=$4,"totalDurationMs"=$5,"totalCostUsd"=$6,"finishedAt"=NOW()
     WHERE "id"=$1`,
    [runId, status, opts.error ?? null, opts.finalContent ?? null, opts.totalDurationMs ?? null, opts.totalCostUsd ?? null]
  );
}

export async function listRuns(sessionId: string, limit = 50): Promise<RunRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(200, limit));

  if (!isDbReady()) {
    const rows = Array.from(memRuns.values()).filter((r) => r.sessionId === sessionId);
    rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return rows.slice(0, lim);
  }

  const r = await pool.query(
    `SELECT * FROM "QCoreRun" WHERE "sessionId"=$1 ORDER BY "startedAt" ASC LIMIT $2`,
    [sessionId, lim]
  );
  return r.rows as RunRow[];
}

export async function getRun(id: string): Promise<RunRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memRuns.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as RunRow) || null;
}

/**
 * Apply a refinement on top of an already-finished run: replaces finalContent,
 * accumulates cost + duration. Used by POST /runs/:id/refine.
 */
export async function applyRefinement(opts: {
  runId: string;
  finalContent: string;
  addCostUsd: number;
  addDurationMs: number;
}): Promise<RunRow | null> {
  await ensureQCoreTables(pool);

  if (!isDbReady()) {
    const r = memRuns.get(opts.runId);
    if (!r) return null;
    r.finalContent = opts.finalContent;
    r.totalCostUsd = (r.totalCostUsd ?? 0) + opts.addCostUsd;
    r.totalDurationMs = (r.totalDurationMs ?? 0) + opts.addDurationMs;
    return r;
  }

  const r = await pool.query(
    `UPDATE "QCoreRun"
       SET "finalContent"=$2,
           "totalCostUsd"=COALESCE("totalCostUsd",0)+$3,
           "totalDurationMs"=COALESCE("totalDurationMs",0)+$4
     WHERE "id"=$1
     RETURNING *`,
    [opts.runId, opts.finalContent, opts.addCostUsd, opts.addDurationMs]
  );
  return (r.rows?.[0] as RunRow) || null;
}

/**
 * Replace the run's tags. Returns the updated row, or null if the run
 * doesn't exist or the caller doesn't own the parent session.
 */
export async function setRunTags(
  runId: string,
  userId: string | null,
  tags: string[]
): Promise<RunRow | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const session = await getSession(run.sessionId, userId);
  if (!session) return null;

  // Normalize: trim, drop empty, dedupe, cap to 16 tags x 32 chars each.
  const cleaned = Array.from(
    new Set(
      tags
        .map((t) => (typeof t === "string" ? t.trim().slice(0, 32) : ""))
        .filter((t) => t.length > 0)
    )
  ).slice(0, 16);

  if (!isDbReady()) {
    run.tags = cleaned;
    memRuns.set(runId, run);
    return run;
  }
  const r = await pool.query(
    `UPDATE "QCoreRun" SET "tags"=$2 WHERE "id"=$1 RETURNING *`,
    [runId, cleaned]
  );
  return (r.rows?.[0] as RunRow) || null;
}

/** Returns the highest ordering value for a run, or 0 if no messages. */
export async function getMaxOrdering(runId: string): Promise<number> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memMessagesByRun.get(runId) || [];
    return list.reduce((m, x) => Math.max(m, x.ordering), 0);
  }
  const r = await pool.query(
    `SELECT COALESCE(MAX("ordering"), 0)::int AS max FROM "QCoreMessage" WHERE "runId"=$1`,
    [runId]
  );
  return Number(r.rows?.[0]?.max ?? 0);
}

/* ═══════════════════════════════════════════════════════════════════════
   Messages
   ═══════════════════════════════════════════════════════════════════════ */

export async function insertMessage(opts: {
  runId: string;
  role: string;
  stage?: string | null;
  instance?: string | null;
  provider?: string | null;
  model?: string | null;
  content: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  durationMs?: number | null;
  costUsd?: number | null;
  ordering: number;
}): Promise<MessageRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();

  if (!isDbReady()) {
    const row: MessageRow = {
      id,
      runId: opts.runId,
      role: opts.role,
      stage: opts.stage ?? null,
      instance: opts.instance ?? null,
      provider: opts.provider ?? null,
      model: opts.model ?? null,
      content: opts.content,
      tokensIn: opts.tokensIn ?? null,
      tokensOut: opts.tokensOut ?? null,
      durationMs: opts.durationMs ?? null,
      costUsd: opts.costUsd ?? null,
      ordering: opts.ordering,
      createdAt: nowIso(),
    };
    const list = memMessagesByRun.get(opts.runId) || [];
    list.push(row);
    memMessagesByRun.set(opts.runId, list);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreMessage"
      ("id","runId","role","stage","instance","provider","model","content","tokensIn","tokensOut","durationMs","costUsd","ordering")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      id, opts.runId, opts.role, opts.stage ?? null, opts.instance ?? null,
      opts.provider ?? null, opts.model ?? null, opts.content,
      opts.tokensIn ?? null, opts.tokensOut ?? null, opts.durationMs ?? null,
      opts.costUsd ?? null, opts.ordering,
    ]
  );
  return r.rows[0] as MessageRow;
}

export async function listMessages(runId: string): Promise<MessageRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memMessagesByRun.get(runId) || [];
    return [...list].sort((a, b) => a.ordering - b.ordering);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreMessage" WHERE "runId"=$1 ORDER BY "ordering" ASC`,
    [runId]
  );
  return r.rows as MessageRow[];
}

/* ═══════════════════════════════════════════════════════════════════════
   Sharing
   ═══════════════════════════════════════════════════════════════════════ */

/** Enable public sharing of a run — returns the token. Idempotent (reuses existing token). */
export async function shareRun(runId: string, userId: string | null): Promise<string | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const session = await getSession(run.sessionId, userId);
  if (!session) return null;
  if (run.shareToken) return run.shareToken;
  const token = crypto.randomBytes(24).toString("base64url");

  if (!isDbReady()) {
    run.shareToken = token;
    memRuns.set(runId, run);
    return token;
  }

  await pool.query(`UPDATE "QCoreRun" SET "shareToken"=$2 WHERE "id"=$1`, [runId, token]);
  return token;
}

/** Disable public sharing. Returns true if a token was revoked. */
export async function unshareRun(runId: string, userId: string | null): Promise<boolean> {
  const run = await getRun(runId);
  if (!run) return false;
  const session = await getSession(run.sessionId, userId);
  if (!session) return false;
  if (!run.shareToken) return false;

  if (!isDbReady()) {
    run.shareToken = null;
    memRuns.set(runId, run);
    return true;
  }

  await pool.query(`UPDATE "QCoreRun" SET "shareToken"=NULL WHERE "id"=$1`, [runId]);
  return true;
}

/** Look up a run by its public share token (read-only path, no auth required). */
export async function getRunByShareToken(token: string): Promise<RunRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    for (const r of memRuns.values()) if (r.shareToken === token) return r;
    return null;
  }
  const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "shareToken"=$1 LIMIT 1`, [token]);
  return (r.rows?.[0] as RunRow) || null;
}

/** Public-safe session fetch (used by shared endpoint — returns only title/mode). */
export async function getSessionPublic(id: string): Promise<{ id: string; title: string; mode: string } | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memSessions.get(id);
    return s ? { id: s.id, title: s.title, mode: s.mode } : null;
  }
  const r = await pool.query(`SELECT "id","title","mode" FROM "QCoreSession" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as any) || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Analytics
   ═══════════════════════════════════════════════════════════════════════ */

export type AnalyticsSummary = {
  scope: "mine" | "anonymous";
  runs: number;
  sessions: number;
  messages: number;
  totals: { tokensIn: number; tokensOut: number; costUsd: number; durationMs: number };
  byStrategy: Array<{ strategy: string; runs: number; costUsd: number; tokens: number; avgDurationMs: number }>;
  byProvider: Array<{ provider: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>;
  byModel: Array<{ provider: string; model: string; calls: number; costUsd: number; tokens: number }>;
  recent: Array<{ sessionId: string; runId: string; strategy: string | null; costUsd: number | null; totalDurationMs: number | null; startedAt: string; title: string }>;
};

export async function getAnalytics(userId: string | null): Promise<AnalyticsSummary> {
  await ensureQCoreTables(pool);
  const scope: "mine" | "anonymous" = userId ? "mine" : "anonymous";

  if (!isDbReady()) {
    return analyticsFromMemory(userId, scope);
  }

  const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
  const params = userId ? [userId] : [];

  const runsQ = await pool.query(
    `SELECT COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(r."totalDurationMs"), 0)::bigint AS "durationMs"
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}`,
    params
  );
  const sessQ = await pool.query(
    `SELECT COUNT(*)::int AS sessions FROM "QCoreSession" s WHERE ${userPredicate}`,
    params
  );
  const tokensQ = await pool.query(
    `SELECT COALESCE(SUM(m."tokensIn"),0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"),0)::bigint AS "tokensOut",
            COUNT(*)::int AS messages
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}`,
    params
  );
  const strategyQ = await pool.query(
    `SELECT COALESCE(r."strategy",'sequential') AS strategy,
            COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(
              (SELECT COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)
                 FROM "QCoreMessage" m WHERE m."runId"=r."id")
            ),0)::bigint AS "tokens",
            COALESCE(AVG(r."totalDurationMs"),0)::float8 AS "avgDurationMs"
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}
      GROUP BY COALESCE(r."strategy",'sequential')
      ORDER BY runs DESC`,
    params
  );
  const providerQ = await pool.query(
    `SELECT m."provider" AS provider,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(m."tokensIn"),0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"),0)::bigint AS "tokensOut"
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL
      GROUP BY m."provider" ORDER BY calls DESC`,
    params
  );
  const modelQ = await pool.query(
    `SELECT m."provider" AS provider, m."model" AS model,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"),0)::float8 AS "costUsd",
            COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)::bigint AS "tokens"
       FROM "QCoreMessage" m JOIN "QCoreRun" r ON r."id"=m."runId"
       JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL AND m."model" IS NOT NULL
      GROUP BY m."provider", m."model" ORDER BY calls DESC LIMIT 20`,
    params
  );
  const recentQ = await pool.query(
    `SELECT r."id" AS "runId", r."sessionId" AS "sessionId", r."strategy" AS strategy,
            r."totalCostUsd" AS "costUsd", r."totalDurationMs" AS "totalDurationMs",
            r."startedAt" AS "startedAt", s."title" AS title
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate} ORDER BY r."startedAt" DESC LIMIT 10`,
    params
  );

  return {
    scope,
    runs: runsQ.rows[0]?.runs ?? 0,
    sessions: sessQ.rows[0]?.sessions ?? 0,
    messages: tokensQ.rows[0]?.messages ?? 0,
    totals: {
      tokensIn: Number(tokensQ.rows[0]?.tokensIn ?? 0),
      tokensOut: Number(tokensQ.rows[0]?.tokensOut ?? 0),
      costUsd: Number(runsQ.rows[0]?.costUsd ?? 0),
      durationMs: Number(runsQ.rows[0]?.durationMs ?? 0),
    },
    byStrategy: strategyQ.rows.map((r: any) => ({
      strategy: r.strategy, runs: r.runs,
      costUsd: Number(r.costUsd), tokens: Number(r.tokens),
      avgDurationMs: Number(r.avgDurationMs),
    })),
    byProvider: providerQ.rows.map((r: any) => ({
      provider: r.provider, calls: r.calls,
      costUsd: Number(r.costUsd),
      tokensIn: Number(r.tokensIn), tokensOut: Number(r.tokensOut),
    })),
    byModel: modelQ.rows.map((r: any) => ({
      provider: r.provider, model: r.model, calls: r.calls,
      costUsd: Number(r.costUsd), tokens: Number(r.tokens),
    })),
    recent: recentQ.rows.map((r: any) => ({
      runId: r.runId, sessionId: r.sessionId, strategy: r.strategy,
      costUsd: r.costUsd, totalDurationMs: r.totalDurationMs,
      startedAt: r.startedAt, title: r.title,
    })),
  };
}

function analyticsFromMemory(userId: string | null, scope: "mine" | "anonymous"): AnalyticsSummary {
  const sessions = Array.from(memSessions.values()).filter((s) =>
    userId ? s.userId === userId : s.userId == null
  );
  const sessIds = new Set(sessions.map((s) => s.id));
  const runs = Array.from(memRuns.values()).filter((r) => sessIds.has(r.sessionId));

  let tokensIn = 0, tokensOut = 0, messagesCount = 0;
  const messages: MessageRow[] = [];
  for (const r of runs) {
    const ms = memMessagesByRun.get(r.id) || [];
    for (const m of ms) {
      messages.push(m);
      tokensIn += m.tokensIn ?? 0;
      tokensOut += m.tokensOut ?? 0;
      messagesCount += 1;
    }
  }
  const totalCostUsd = runs.reduce((s, r) => s + (r.totalCostUsd ?? 0), 0);
  const totalDurationMs = runs.reduce((s, r) => s + (r.totalDurationMs ?? 0), 0);

  const byStrategyMap = new Map<string, { strategy: string; runs: number; costUsd: number; tokens: number; durSum: number; durCount: number }>();
  for (const r of runs) {
    const s = r.strategy || "sequential";
    const entry = byStrategyMap.get(s) || { strategy: s, runs: 0, costUsd: 0, tokens: 0, durSum: 0, durCount: 0 };
    entry.runs += 1;
    entry.costUsd += r.totalCostUsd ?? 0;
    const ms = memMessagesByRun.get(r.id) || [];
    for (const m of ms) entry.tokens += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
    if (r.totalDurationMs != null) { entry.durSum += r.totalDurationMs; entry.durCount += 1; }
    byStrategyMap.set(s, entry);
  }

  const byProviderMap = new Map<string, { provider: string; calls: number; costUsd: number; tokensIn: number; tokensOut: number }>();
  const byModelMap = new Map<string, { provider: string; model: string; calls: number; costUsd: number; tokens: number }>();
  for (const m of messages) {
    if (m.provider) {
      const pe = byProviderMap.get(m.provider) || { provider: m.provider, calls: 0, costUsd: 0, tokensIn: 0, tokensOut: 0 };
      pe.calls += 1;
      pe.costUsd += m.costUsd ?? 0;
      pe.tokensIn += m.tokensIn ?? 0;
      pe.tokensOut += m.tokensOut ?? 0;
      byProviderMap.set(m.provider, pe);
    }
    if (m.provider && m.model) {
      const key = `${m.provider}|${m.model}`;
      const me = byModelMap.get(key) || { provider: m.provider, model: m.model, calls: 0, costUsd: 0, tokens: 0 };
      me.calls += 1;
      me.costUsd += m.costUsd ?? 0;
      me.tokens += (m.tokensIn ?? 0) + (m.tokensOut ?? 0);
      byModelMap.set(key, me);
    }
  }

  const recent = runs
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 10)
    .map((r) => ({
      runId: r.id,
      sessionId: r.sessionId,
      strategy: r.strategy,
      costUsd: r.totalCostUsd,
      totalDurationMs: r.totalDurationMs,
      startedAt: r.startedAt,
      title: memSessions.get(r.sessionId)?.title || "(session)",
    }));

  return {
    scope,
    runs: runs.length,
    sessions: sessions.length,
    messages: messagesCount,
    totals: { tokensIn, tokensOut, costUsd: totalCostUsd, durationMs: totalDurationMs },
    byStrategy: Array.from(byStrategyMap.values())
      .map((e) => ({
        strategy: e.strategy,
        runs: e.runs,
        costUsd: e.costUsd,
        tokens: e.tokens,
        avgDurationMs: e.durCount ? e.durSum / e.durCount : 0,
      }))
      .sort((a, b) => b.runs - a.runs),
    byProvider: Array.from(byProviderMap.values()).sort((a, b) => b.calls - a.calls),
    byModel: Array.from(byModelMap.values()).sort((a, b) => b.calls - a.calls).slice(0, 20),
    recent,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Search across runs (substring match on userInput / finalContent / title)
   ═══════════════════════════════════════════════════════════════════════ */

export type SearchHit = {
  runId: string;
  sessionId: string;
  sessionTitle: string;
  strategy: string | null;
  status: string;
  startedAt: string;
  totalCostUsd: number | null;
  preview: string;
  matched: "input" | "final" | "title" | "tag";
};

export async function searchRuns(
  userId: string | null,
  query: string,
  limit = 30
): Promise<SearchHit[]> {
  await ensureQCoreTables(pool);
  const q = (query || "").trim();
  if (!q) return [];
  const lim = Math.max(1, Math.min(100, limit));

  const buildPreview = (hay: string, needle: string): string => {
    const lower = hay.toLowerCase();
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx < 0) return hay.slice(0, 160);
    const start = Math.max(0, idx - 40);
    const end = Math.min(hay.length, idx + needle.length + 80);
    const slice = hay.slice(start, end).replace(/\s+/g, " ");
    return (start > 0 ? "…" : "") + slice + (end < hay.length ? "…" : "");
  };

  if (!isDbReady()) {
    const sessions = Array.from(memSessions.values()).filter((s) =>
      userId ? s.userId === userId : s.userId == null
    );
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const hits: SearchHit[] = [];
    const ql = q.toLowerCase();
    for (const r of memRuns.values()) {
      const sess = sessionById.get(r.sessionId);
      if (!sess) continue;
      const inInput = r.userInput?.toLowerCase().includes(ql);
      const inFinal = r.finalContent?.toLowerCase().includes(ql);
      const inTitle = sess.title?.toLowerCase().includes(ql);
      const inTags = (r.tags || []).some((t) => t.toLowerCase().includes(ql));
      if (!inInput && !inFinal && !inTitle && !inTags) continue;
      hits.push({
        runId: r.id,
        sessionId: r.sessionId,
        sessionTitle: sess.title,
        strategy: r.strategy,
        status: r.status,
        startedAt: r.startedAt,
        totalCostUsd: r.totalCostUsd,
        preview: inInput
          ? buildPreview(r.userInput, q)
          : inFinal
          ? buildPreview(r.finalContent || "", q)
          : inTags
          ? `tag · ${(r.tags || []).find((t) => t.toLowerCase().includes(ql))}`
          : sess.title,
        matched: inInput ? "input" : inFinal ? "final" : inTags ? "tag" : "title",
      });
    }
    hits.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return hits.slice(0, lim);
  }

  const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
  const baseParams: any[] = userId ? [userId] : [];
  const pat = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  const queryParamIdx = baseParams.length + 1;
  const r = await pool.query(
    `SELECT r."id" AS "runId", r."sessionId" AS "sessionId", s."title" AS "sessionTitle",
            r."strategy", r."status", r."startedAt", r."totalCostUsd",
            r."userInput", r."finalContent", r."tags",
            (CASE
               WHEN r."userInput"    ILIKE $${queryParamIdx} THEN 'input'
               WHEN r."finalContent" ILIKE $${queryParamIdx} THEN 'final'
               WHEN EXISTS (SELECT 1 FROM unnest(COALESCE(r."tags", ARRAY[]::TEXT[])) AS t WHERE t ILIKE $${queryParamIdx}) THEN 'tag'
               ELSE 'title'
             END) AS matched
       FROM "QCoreRun" r JOIN "QCoreSession" s ON s."id"=r."sessionId"
      WHERE ${userPredicate}
        AND (r."userInput" ILIKE $${queryParamIdx}
             OR r."finalContent" ILIKE $${queryParamIdx}
             OR s."title" ILIKE $${queryParamIdx}
             OR EXISTS (SELECT 1 FROM unnest(COALESCE(r."tags", ARRAY[]::TEXT[])) AS t WHERE t ILIKE $${queryParamIdx}))
      ORDER BY r."startedAt" DESC
      LIMIT $${queryParamIdx + 1}`,
    [...baseParams, pat, lim]
  );
  return r.rows.map((row: any): SearchHit => {
    const matched = row.matched as "input" | "final" | "title" | "tag";
    const preview =
      matched === "input"
        ? buildPreview(row.userInput || "", q)
        : matched === "final"
        ? buildPreview(row.finalContent || "", q)
        : matched === "tag"
        ? `tag · ${(row.tags || []).find((t: string) => t.toLowerCase().includes(q.toLowerCase())) || ""}`
        : row.sessionTitle || "";
    return {
      runId: row.runId,
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      strategy: row.strategy,
      status: row.status,
      startedAt: row.startedAt,
      totalCostUsd: row.totalCostUsd != null ? Number(row.totalCostUsd) : null,
      preview,
      matched,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Per-user webhook (multi-tenant overlay on top of env-based webhook)
   ═══════════════════════════════════════════════════════════════════════ */

export async function getUserWebhook(userId: string): Promise<UserWebhookRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memUserWebhooks.get(userId) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreUserWebhook" WHERE "userId"=$1`, [userId]);
  return (r.rows?.[0] as UserWebhookRow) || null;
}

export async function setUserWebhook(
  userId: string,
  url: string,
  secret: string | null
): Promise<UserWebhookRow> {
  await ensureQCoreTables(pool);
  const cleanUrl = url.trim().slice(0, 2000);
  const cleanSecret = secret ? secret.trim().slice(0, 256) : null;

  if (!isDbReady()) {
    const existing = memUserWebhooks.get(userId);
    const row: UserWebhookRow = {
      userId,
      url: cleanUrl,
      secret: cleanSecret,
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    memUserWebhooks.set(userId, row);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreUserWebhook" ("userId","url","secret")
       VALUES ($1,$2,$3)
     ON CONFLICT ("userId") DO UPDATE
       SET "url"=EXCLUDED."url",
           "secret"=EXCLUDED."secret",
           "updatedAt"=NOW()
     RETURNING *`,
    [userId, cleanUrl, cleanSecret]
  );
  return r.rows[0] as UserWebhookRow;
}

export async function deleteUserWebhook(userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memUserWebhooks.delete(userId);
  const r = await pool.query(`DELETE FROM "QCoreUserWebhook" WHERE "userId"=$1`, [userId]);
  return (r.rowCount ?? 0) > 0;
}

/** Returns the user webhook for the run's session.userId, or null if none. */
export async function getUserWebhookForRun(runId: string): Promise<UserWebhookRow | null> {
  const run = await getRun(runId);
  if (!run) return null;
  if (!isDbReady()) {
    const sess = memSessions.get(run.sessionId);
    if (!sess?.userId) return null;
    return memUserWebhooks.get(sess.userId) ?? null;
  }
  const r = await pool.query(
    `SELECT w.*
       FROM "QCoreSession" s
       JOIN "QCoreUserWebhook" w ON w."userId" = s."userId"
      WHERE s."id" = $1`,
    [run.sessionId]
  );
  return (r.rows?.[0] as UserWebhookRow) || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   History (for follow-up turns)
   ═══════════════════════════════════════════════════════════════════════ */

export async function buildHistoryContext(sessionId: string, maxTurns = 6): Promise<ChatMessage[]> {
  const runs = await listRuns(sessionId, maxTurns);
  const out: ChatMessage[] = [];
  for (const run of runs) {
    if (run.userInput) out.push({ role: "user", content: run.userInput });
    if (run.finalContent) out.push({ role: "assistant", content: run.finalContent });
  }
  return out;
}
