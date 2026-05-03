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
  status: "pending" | "running" | "done" | "error" | "stopped";
  error: string | null;
  agentConfig: any;
  strategy: string | null;
  finalContent: string | null;
  totalDurationMs: number | null;
  totalCostUsd: number | null;
  shareToken: string | null;
  startedAt: string;
  finishedAt: string | null;
  tags?: string[];
  parentRunId?: string | null;
  threadId?: string | null;
  batchId?: string | null;
};

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
  parentRunId?: string | null;
  threadId?: string | null;
  batchId?: string | null;
}): Promise<RunRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const parentRunId = opts.parentRunId ?? null;
  const threadId = opts.threadId ?? (parentRunId ? null : id);
  const batchId = opts.batchId ?? null;

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
      startedAt: nowIso(),
      finishedAt: null,
      parentRunId,
      threadId: threadId ?? id,
      batchId,
    };
    memRuns.set(id, row);
    memMessagesByRun.set(id, []);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreRun" ("id","sessionId","userInput","status","agentConfig","strategy","parentRunId","threadId","batchId")
     VALUES ($1,$2,$3,'running',$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      id,
      opts.sessionId,
      opts.userInput,
      opts.agentConfig ? JSON.stringify(opts.agentConfig) : null,
      opts.strategy ?? null,
      parentRunId,
      threadId ?? id,
      batchId,
    ]
  );
  return r.rows[0] as RunRow;
}

export async function finishRun(
  runId: string,
  status: "done" | "error" | "stopped",
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
   Agent marketplace — shared presets (V4-E)

   Lets a user publish their saved agent preset (strategy + per-role
   provider/model) so others can browse and import it into their personal
   localStorage presets bar. Owner-only delete. Read-only browse for the
   public — auth required only to publish, delete, or import (so we can
   bump importCount per user).
   ═══════════════════════════════════════════════════════════════════════ */

export type SharedPresetRow = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  strategy: string;
  overrides: any;
  isPublic: boolean;
  importCount: number;
  createdAt: string;
  updatedAt: string;
};

const memSharedPresets = new Map<string, SharedPresetRow>();

export async function createSharedPreset(opts: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  strategy?: string;
  overrides?: any;
  isPublic?: boolean;
}): Promise<SharedPresetRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const name = (opts.name || "").trim().slice(0, 80);
  if (!name) throw new Error("preset name required");
  const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
  const strategy = opts.strategy === "parallel" || opts.strategy === "debate" ? opts.strategy : "sequential";
  const overrides = opts.overrides && typeof opts.overrides === "object" ? opts.overrides : {};
  const isPublic = opts.isPublic !== false;

  if (!isDbReady()) {
    const row: SharedPresetRow = {
      id,
      ownerUserId: opts.ownerUserId,
      name,
      description,
      strategy,
      overrides,
      isPublic,
      importCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memSharedPresets.set(id, row);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCoreSharedPreset"
       ("id","ownerUserId","name","description","strategy","overrides","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
     RETURNING *`,
    [id, opts.ownerUserId, name, description, strategy, JSON.stringify(overrides), isPublic]
  );
  return r.rows[0] as SharedPresetRow;
}

export async function listPublicSharedPresets(query?: string, limit = 30): Promise<SharedPresetRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(100, limit));
  const q = (query || "").trim();

  if (!isDbReady()) {
    let rows = Array.from(memSharedPresets.values()).filter((p) => p.isPublic);
    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(ql) || (p.description || "").toLowerCase().includes(ql)
      );
    }
    rows.sort(
      (a, b) =>
        b.importCount - a.importCount || b.updatedAt.localeCompare(a.updatedAt)
    );
    return rows.slice(0, lim);
  }

  if (q) {
    const r = await pool.query(
      `SELECT * FROM "QCoreSharedPreset"
        WHERE "isPublic" = TRUE
          AND ("name" ILIKE $1 OR "description" ILIKE $1)
        ORDER BY "importCount" DESC, "updatedAt" DESC
        LIMIT $2`,
      [`%${q}%`, lim]
    );
    return r.rows as SharedPresetRow[];
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreSharedPreset"
      WHERE "isPublic" = TRUE
      ORDER BY "importCount" DESC, "updatedAt" DESC
      LIMIT $1`,
    [lim]
  );
  return r.rows as SharedPresetRow[];
}

export async function getSharedPreset(id: string): Promise<SharedPresetRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memSharedPresets.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreSharedPreset" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as SharedPresetRow) || null;
}

export async function importSharedPreset(id: string): Promise<SharedPresetRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const p = memSharedPresets.get(id);
    if (!p || !p.isPublic) return null;
    p.importCount += 1;
    p.updatedAt = nowIso();
    return p;
  }
  const r = await pool.query(
    `UPDATE "QCoreSharedPreset"
        SET "importCount" = "importCount" + 1,
            "updatedAt"   = NOW()
      WHERE "id"=$1 AND "isPublic"=TRUE
      RETURNING *`,
    [id]
  );
  return (r.rows?.[0] as SharedPresetRow) || null;
}

export async function deleteSharedPreset(id: string, userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const p = memSharedPresets.get(id);
    if (!p || p.ownerUserId !== userId) return false;
    memSharedPresets.delete(id);
    return true;
  }
  const r = await pool.query(
    `DELETE FROM "QCoreSharedPreset" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`,
    [id, userId]
  );
  return (r.rowCount ?? 0) > 0;
}

/* ═══════════════════════════════════════════════════════════════════════
   Refinement / search / tagging extras
   ═══════════════════════════════════════════════════════════════════════ */

/** Highest ordering value for a run, or 0 if no messages — used to append refinement messages. */
export async function getMaxOrdering(runId: string): Promise<number> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memMessagesByRun.get(runId) || [];
    return list.reduce((m, r) => (r.ordering > m ? r.ordering : m), 0);
  }
  const r = await pool.query(
    `SELECT COALESCE(MAX("ordering"), 0)::int AS m FROM "QCoreMessage" WHERE "runId"=$1`,
    [runId]
  );
  return Number(r.rows?.[0]?.m ?? 0);
}

/** Apply refinement on top of a finished run: replace finalContent, accumulate cost/duration. */
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

/** Replace a run's tags. Owner-checked, normalized (trim/dedupe/cap 16x32). */
export async function setRunTags(
  runId: string,
  userId: string | null,
  tags: string[]
): Promise<RunRow | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const session = await getSession(run.sessionId, userId);
  if (!session) return null;

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

/** Substring search across the user's runs — userInput / finalContent / session.title / tags. */
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
      const session = sessionById.get(r.sessionId);
      if (!session) continue;
      const inInput = (r.userInput || "").toLowerCase().includes(ql);
      const inFinal = (r.finalContent || "").toLowerCase().includes(ql);
      const inTitle = (session.title || "").toLowerCase().includes(ql);
      const inTags = (r.tags || []).some((t) => t.toLowerCase().includes(ql));
      if (!inInput && !inFinal && !inTitle && !inTags) continue;
      const preview = inInput
        ? buildPreview(r.userInput, q)
        : inFinal
        ? buildPreview(r.finalContent || "", q)
        : inTags
        ? `tag · ${(r.tags || []).find((t) => t.toLowerCase().includes(ql))}`
        : (session.title || "");
      hits.push({
        runId: r.id,
        sessionId: r.sessionId,
        sessionTitle: session.title || "",
        strategy: r.strategy || null,
        status: r.status,
        startedAt: r.startedAt,
        totalCostUsd: r.totalCostUsd ?? null,
        preview,
        matched: inInput ? "input" : inFinal ? "final" : inTags ? "tag" : "title",
      });
    }
    hits.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return hits.slice(0, lim);
  }

  const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
  const params: any[] = userId ? [userId, `%${q}%`, lim] : [`%${q}%`, lim];
  const qParam = userId ? `$2` : `$1`;
  const limParam = userId ? `$3` : `$2`;
  const r = await pool.query(
    `SELECT r."id" AS "runId", r."sessionId", r."strategy", r."status",
            r."startedAt", r."totalCostUsd",
            r."userInput", r."finalContent", r."tags",
            s."title" AS "sessionTitle",
            CASE
              WHEN r."userInput" ILIKE ${qParam} THEN 'input'
              WHEN r."finalContent" ILIKE ${qParam} THEN 'final'
              WHEN EXISTS (SELECT 1 FROM unnest(r."tags") t WHERE t ILIKE ${qParam}) THEN 'tag'
              ELSE 'title'
            END AS matched
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
        AND ( r."userInput" ILIKE ${qParam}
           OR r."finalContent" ILIKE ${qParam}
           OR s."title" ILIKE ${qParam}
           OR EXISTS (SELECT 1 FROM unnest(r."tags") t WHERE t ILIKE ${qParam}) )
      ORDER BY r."startedAt" DESC
      LIMIT ${limParam}`,
    params
  );
  return r.rows.map((row: any) => {
    const matched = row.matched as "input" | "final" | "title" | "tag";
    const preview =
      matched === "input"
        ? buildPreview(row.userInput || "", q)
        : matched === "final"
        ? buildPreview(row.finalContent || "", q)
        : matched === "tag"
        ? `tag · ${(row.tags || []).find((t: string) => t.toLowerCase().includes(q.toLowerCase())) || ""}`
        : (row.sessionTitle || "");
    return {
      runId: row.runId,
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle || "",
      strategy: row.strategy,
      status: row.status,
      startedAt: row.startedAt,
      totalCostUsd: row.totalCostUsd ?? null,
      preview,
      matched,
    };
  });
}

/** Top tags across the user's runs — drives the sidebar chip strip. */
export async function getTopUserTags(
  userId: string | null,
  limit = 20
): Promise<Array<{ tag: string; count: number }>> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(100, limit));

  if (!isDbReady()) {
    const sessionIds = new Set(
      Array.from(memSessions.values())
        .filter((s) => (userId ? s.userId === userId : s.userId == null))
        .map((s) => s.id)
    );
    const counts = new Map<string, number>();
    for (const r of memRuns.values()) {
      if (!sessionIds.has(r.sessionId)) continue;
      for (const t of r.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, lim)
      .map(([tag, count]) => ({ tag, count }));
  }

  const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
  const params: any[] = userId ? [userId, lim] : [lim];
  const limParam = userId ? `$2` : `$1`;
  const r = await pool.query(
    `SELECT t AS tag, COUNT(*)::int AS count
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId",
            unnest(r."tags") AS t
      WHERE ${userPredicate}
      GROUP BY t
      ORDER BY count DESC, t ASC
      LIMIT ${limParam}`,
    params
  );
  return r.rows.map((row: any) => ({ tag: String(row.tag), count: Number(row.count) }));
}

/** Daily cost/run timeseries for analytics — last `days` calendar days. */
export async function getCostTimeseries(
  userId: string | null,
  days = 30
): Promise<Array<{ date: string; runs: number; costUsd: number }>> {
  await ensureQCoreTables(pool);
  const d = Math.max(1, Math.min(365, days));

  if (!isDbReady()) {
    const sessionIds = new Set(
      Array.from(memSessions.values())
        .filter((s) => (userId ? s.userId === userId : s.userId == null))
        .map((s) => s.id)
    );
    const buckets = new Map<string, { runs: number; costUsd: number }>();
    const cutoff = Date.now() - d * 86_400_000;
    for (const r of memRuns.values()) {
      if (!sessionIds.has(r.sessionId)) continue;
      const t = Date.parse(r.startedAt);
      if (!Number.isFinite(t) || t < cutoff) continue;
      const date = new Date(t).toISOString().slice(0, 10);
      const cur = buckets.get(date) || { runs: 0, costUsd: 0 };
      cur.runs += 1;
      cur.costUsd += r.totalCostUsd ?? 0;
      buckets.set(date, cur);
    }
    return Array.from(buckets.entries())
      .map(([date, v]) => ({ date, runs: v.runs, costUsd: v.costUsd }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const userPredicate = userId ? `s."userId" = $1` : `s."userId" IS NULL`;
  const params: any[] = userId ? [userId] : [];
  const r = await pool.query(
    `SELECT to_char(date_trunc('day', r."startedAt"), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd"
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
        AND r."startedAt" >= NOW() - INTERVAL '${d} days'
      GROUP BY date
      ORDER BY date ASC`,
    params
  );
  return r.rows.map((row: any) => ({
    date: String(row.date),
    runs: Number(row.runs),
    costUsd: Number(row.costUsd),
  }));
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

/** Returns all runs in a thread ordered oldest→newest (root included). */
export async function getThread(threadId: string): Promise<RunRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const rows = Array.from(memRuns.values()).filter(
      (r) => r.threadId === threadId || r.id === threadId
    );
    rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return rows;
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreRun" WHERE "threadId"=$1 ORDER BY "startedAt" ASC`,
    [threadId]
  );
  return r.rows as RunRow[];
}

/**
 * Builds a ChatMessage[] conversation history by walking UP the parent chain
 * from the given run (not including it). Used when continuing a specific run
 * so the agent sees the full thread context, not just the session's last N turns.
 */
export async function buildThreadContext(runId: string, maxTurns = 12): Promise<ChatMessage[]> {
  await ensureQCoreTables(pool);
  const chain: RunRow[] = [];
  let current: RunRow | null = await getRun(runId);
  let steps = 0;
  while (current && steps < maxTurns) {
    chain.unshift(current);
    if (!current.parentRunId) break;
    current = await getRun(current.parentRunId);
    steps++;
  }
  const out: ChatMessage[] = [];
  for (const run of chain) {
    if (run.userInput) out.push({ role: "user", content: run.userInput });
    if (run.finalContent) out.push({ role: "assistant", content: run.finalContent });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   Eval harness
   ═══════════════════════════════════════════════════════════════════════
   A suite holds a list of test cases (input + judge config). A run executes
   each case through the orchestrator, applies the per-case judge, and
   aggregates a 0..1 score so the user can track regressions over time. */

export type EvalJudge =
  | { type: "contains"; needle: string; caseSensitive?: boolean }
  | { type: "equals"; expected: string; caseSensitive?: boolean; trim?: boolean }
  | { type: "regex"; pattern: string; flags?: string }
  | { type: "min_length"; chars: number }
  | { type: "max_length"; chars: number }
  | { type: "not_contains"; needle: string; caseSensitive?: boolean }
  | { type: "llm_judge"; rubric: string; provider?: string; model?: string; passThreshold?: number };

export type EvalCase = {
  id: string;
  name?: string;
  input: string;
  judge: EvalJudge;
  weight?: number;
};

export type EvalSuiteRow = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  strategy: string;
  overrides: any;
  cases: EvalCase[];
  createdAt: string;
  updatedAt: string;
};

export type EvalCaseResult = {
  caseId: string;
  caseName: string;
  passed: boolean;
  judgeKind: string;
  reason: string;
  output: string;
  costUsd: number;
  durationMs: number;
  runId?: string | null;
  error?: string;
};

export type EvalRunRow = {
  id: string;
  suiteId: string;
  ownerUserId: string;
  status: "running" | "done" | "error" | "aborted";
  score: number | null;
  totalCases: number;
  passedCases: number;
  totalCostUsd: number;
  results: EvalCaseResult[];
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

const memEvalSuites = new Map<string, EvalSuiteRow>();
const memEvalRuns = new Map<string, EvalRunRow>();

function normalizeStrategy(s?: string): string {
  return s === "parallel" || s === "debate" ? s : "sequential";
}

function normalizeCases(cases: any): EvalCase[] {
  if (!Array.isArray(cases)) return [];
  const out: EvalCase[] = [];
  for (const c of cases) {
    if (!c || typeof c !== "object") continue;
    const id = String(c.id || crypto.randomUUID()).slice(0, 64);
    const input = String(c.input ?? "").slice(0, 4000);
    if (!input.trim()) continue;
    const j = c.judge || {};
    let judge: EvalJudge | null = null;
    if (j.type === "contains" && typeof j.needle === "string") {
      judge = { type: "contains", needle: String(j.needle).slice(0, 500), caseSensitive: !!j.caseSensitive };
    } else if (j.type === "not_contains" && typeof j.needle === "string") {
      judge = { type: "not_contains", needle: String(j.needle).slice(0, 500), caseSensitive: !!j.caseSensitive };
    } else if (j.type === "equals" && typeof j.expected === "string") {
      judge = { type: "equals", expected: String(j.expected).slice(0, 4000), caseSensitive: !!j.caseSensitive, trim: j.trim !== false };
    } else if (j.type === "regex" && typeof j.pattern === "string") {
      judge = { type: "regex", pattern: String(j.pattern).slice(0, 500), flags: typeof j.flags === "string" ? j.flags.slice(0, 8) : "" };
    } else if (j.type === "min_length" && Number.isFinite(Number(j.chars))) {
      judge = { type: "min_length", chars: Math.max(0, Math.min(100000, Number(j.chars))) };
    } else if (j.type === "max_length" && Number.isFinite(Number(j.chars))) {
      judge = { type: "max_length", chars: Math.max(0, Math.min(100000, Number(j.chars))) };
    } else if (j.type === "llm_judge" && typeof j.rubric === "string" && j.rubric.trim()) {
      const passThreshold = Number(j.passThreshold);
      judge = {
        type: "llm_judge",
        rubric: String(j.rubric).slice(0, 4000),
        provider: typeof j.provider === "string" ? j.provider.slice(0, 32) : undefined,
        model: typeof j.model === "string" ? j.model.slice(0, 64) : undefined,
        passThreshold: Number.isFinite(passThreshold) ? Math.max(0, Math.min(1, passThreshold)) : undefined,
      };
    } else {
      continue;
    }
    const weight = Number.isFinite(Number(c.weight)) ? Math.max(0, Math.min(100, Number(c.weight))) : 1;
    const name = c.name ? String(c.name).slice(0, 80) : `Case ${id.slice(0, 6)}`;
    out.push({ id, name, input, judge, weight });
    if (out.length >= 200) break;
  }
  return out;
}

export async function createEvalSuite(opts: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  strategy?: string;
  overrides?: any;
  cases?: any;
}): Promise<EvalSuiteRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const name = (opts.name || "").trim().slice(0, 80) || "Untitled suite";
  const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
  const strategy = normalizeStrategy(opts.strategy);
  const overrides = opts.overrides && typeof opts.overrides === "object" ? opts.overrides : {};
  const cases = normalizeCases(opts.cases);

  if (!isDbReady()) {
    const row: EvalSuiteRow = {
      id,
      ownerUserId: opts.ownerUserId,
      name,
      description,
      strategy,
      overrides,
      cases,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memEvalSuites.set(id, row);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCoreEvalSuite"
       ("id","ownerUserId","name","description","strategy","overrides","cases")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     RETURNING *`,
    [id, opts.ownerUserId, name, description, strategy, JSON.stringify(overrides), JSON.stringify(cases)]
  );
  return r.rows[0] as EvalSuiteRow;
}

export async function listEvalSuites(userId: string, limit = 50): Promise<EvalSuiteRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(200, limit));
  if (!isDbReady()) {
    return Array.from(memEvalSuites.values())
      .filter((s) => s.ownerUserId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, lim);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreEvalSuite"
      WHERE "ownerUserId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT $2`,
    [userId, lim]
  );
  return r.rows as EvalSuiteRow[];
}

export async function getEvalSuite(id: string): Promise<EvalSuiteRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memEvalSuites.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreEvalSuite" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as EvalSuiteRow) || null;
}

export async function updateEvalSuite(
  id: string,
  userId: string,
  patch: { name?: string; description?: string | null; strategy?: string; overrides?: any; cases?: any }
): Promise<EvalSuiteRow | null> {
  await ensureQCoreTables(pool);

  if (!isDbReady()) {
    const cur = memEvalSuites.get(id);
    if (!cur || cur.ownerUserId !== userId) return null;
    if (patch.name != null) cur.name = String(patch.name).trim().slice(0, 80) || cur.name;
    if (patch.description !== undefined)
      cur.description = patch.description ? String(patch.description).trim().slice(0, 400) : null;
    if (patch.strategy) cur.strategy = normalizeStrategy(patch.strategy);
    if (patch.overrides && typeof patch.overrides === "object") cur.overrides = patch.overrides;
    if (patch.cases !== undefined) cur.cases = normalizeCases(patch.cases);
    cur.updatedAt = nowIso();
    return cur;
  }

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (patch.name != null) {
    const v = String(patch.name).trim().slice(0, 80);
    if (v) {
      sets.push(`"name"=$${i++}`);
      params.push(v);
    }
  }
  if (patch.description !== undefined) {
    sets.push(`"description"=$${i++}`);
    params.push(patch.description ? String(patch.description).trim().slice(0, 400) : null);
  }
  if (patch.strategy) {
    sets.push(`"strategy"=$${i++}`);
    params.push(normalizeStrategy(patch.strategy));
  }
  if (patch.overrides && typeof patch.overrides === "object") {
    sets.push(`"overrides"=$${i++}::jsonb`);
    params.push(JSON.stringify(patch.overrides));
  }
  if (patch.cases !== undefined) {
    sets.push(`"cases"=$${i++}::jsonb`);
    params.push(JSON.stringify(normalizeCases(patch.cases)));
  }
  if (!sets.length) return getEvalSuite(id);
  sets.push(`"updatedAt"=NOW()`);
  params.push(id, userId);
  const r = await pool.query(
    `UPDATE "QCoreEvalSuite" SET ${sets.join(", ")}
      WHERE "id"=$${i++} AND "ownerUserId"=$${i++}
      RETURNING *`,
    params
  );
  return (r.rows?.[0] as EvalSuiteRow) || null;
}

export async function deleteEvalSuite(id: string, userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memEvalSuites.get(id);
    if (!s || s.ownerUserId !== userId) return false;
    memEvalSuites.delete(id);
    for (const [runId, run] of memEvalRuns) {
      if (run.suiteId === id) memEvalRuns.delete(runId);
    }
    return true;
  }
  const r = await pool.query(
    `DELETE FROM "QCoreEvalSuite" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`,
    [id, userId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function createEvalRun(opts: {
  suiteId: string;
  ownerUserId: string;
  totalCases: number;
}): Promise<EvalRunRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  if (!isDbReady()) {
    const row: EvalRunRow = {
      id,
      suiteId: opts.suiteId,
      ownerUserId: opts.ownerUserId,
      status: "running",
      score: null,
      totalCases: opts.totalCases,
      passedCases: 0,
      totalCostUsd: 0,
      results: [],
      errorMessage: null,
      startedAt: nowIso(),
      completedAt: null,
    };
    memEvalRuns.set(id, row);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCoreEvalRun"
       ("id","suiteId","ownerUserId","status","totalCases","passedCases","totalCostUsd","results")
     VALUES ($1,$2,$3,'running',$4,0,0,'[]'::jsonb)
     RETURNING *`,
    [id, opts.suiteId, opts.ownerUserId, opts.totalCases]
  );
  return r.rows[0] as EvalRunRow;
}

export async function updateEvalRun(
  id: string,
  patch: Partial<Omit<EvalRunRow, "id" | "suiteId" | "ownerUserId" | "startedAt">>
): Promise<EvalRunRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const cur = memEvalRuns.get(id);
    if (!cur) return null;
    Object.assign(cur, patch);
    return cur;
  }
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (patch.status !== undefined) { sets.push(`"status"=$${i++}`); params.push(patch.status); }
  if (patch.score !== undefined) { sets.push(`"score"=$${i++}`); params.push(patch.score); }
  if (patch.passedCases !== undefined) { sets.push(`"passedCases"=$${i++}`); params.push(patch.passedCases); }
  if (patch.totalCostUsd !== undefined) { sets.push(`"totalCostUsd"=$${i++}`); params.push(patch.totalCostUsd); }
  if (patch.results !== undefined) { sets.push(`"results"=$${i++}::jsonb`); params.push(JSON.stringify(patch.results)); }
  if (patch.errorMessage !== undefined) { sets.push(`"errorMessage"=$${i++}`); params.push(patch.errorMessage); }
  if (patch.completedAt !== undefined) { sets.push(`"completedAt"=$${i++}`); params.push(patch.completedAt); }
  if (!sets.length) return getEvalRun(id);
  params.push(id);
  const r = await pool.query(
    `UPDATE "QCoreEvalRun" SET ${sets.join(", ")}
      WHERE "id"=$${i++}
      RETURNING *`,
    params
  );
  return (r.rows?.[0] as EvalRunRow) || null;
}

export async function getEvalRun(id: string): Promise<EvalRunRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memEvalRuns.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreEvalRun" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as EvalRunRow) || null;
}

export async function listSuiteRuns(suiteId: string, limit = 30): Promise<EvalRunRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(100, limit));
  if (!isDbReady()) {
    return Array.from(memEvalRuns.values())
      .filter((r) => r.suiteId === suiteId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, lim);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreEvalRun"
      WHERE "suiteId"=$1
      ORDER BY "startedAt" DESC
      LIMIT $2`,
    [suiteId, lim]
  );
  return r.rows as EvalRunRow[];
}

/* ═══════════════════════════════════════════════════════════════════════
   Prompts library (V6-P)
   ═══════════════════════════════════════════════════════════════════════ */

export type PromptRow = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  role: string;
  content: string;
  version: number;
  parentPromptId: string | null;
  isPublic: boolean;
  importCount: number;
  createdAt: string;
  updatedAt: string;
};

const memPrompts = new Map<string, PromptRow>();

const VALID_PROMPT_ROLES = new Set(["analyst", "writer", "writerB", "critic", "judge", "system"]);

function normalizePromptRole(role: any): string {
  if (typeof role !== "string") return "writer";
  return VALID_PROMPT_ROLES.has(role) ? role : "writer";
}

export async function createPrompt(opts: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  role?: string;
  content: string;
  parentPromptId?: string | null;
  isPublic?: boolean;
}): Promise<PromptRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const name = (opts.name || "").trim().slice(0, 80);
  if (!name) throw new Error("prompt name required");
  const content = (opts.content || "").slice(0, 16000);
  if (!content.trim()) throw new Error("prompt content required");
  const description = opts.description ? String(opts.description).trim().slice(0, 400) : null;
  const role = normalizePromptRole(opts.role);
  const isPublic = opts.isPublic === true;
  const parentPromptId = opts.parentPromptId ? String(opts.parentPromptId) : null;

  // Compute version: parent.version + 1, default 1.
  let version = 1;
  if (parentPromptId) {
    const parent = await getPrompt(parentPromptId);
    if (parent) version = (parent.version || 1) + 1;
  }

  if (!isDbReady()) {
    const row: PromptRow = {
      id,
      ownerUserId: opts.ownerUserId,
      name,
      description,
      role,
      content,
      version,
      parentPromptId,
      isPublic,
      importCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memPrompts.set(id, row);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCorePrompt"
       ("id","ownerUserId","name","description","role","content","version","parentPromptId","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [id, opts.ownerUserId, name, description, role, content, version, parentPromptId, isPublic]
  );
  return r.rows[0] as PromptRow;
}

export async function getPrompt(id: string): Promise<PromptRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memPrompts.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCorePrompt" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as PromptRow) || null;
}

export async function listPrompts(userId: string, limit = 100): Promise<PromptRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(500, limit));
  if (!isDbReady()) {
    return Array.from(memPrompts.values())
      .filter((p) => p.ownerUserId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, lim);
  }
  const r = await pool.query(
    `SELECT * FROM "QCorePrompt"
      WHERE "ownerUserId"=$1
      ORDER BY "updatedAt" DESC
      LIMIT $2`,
    [userId, lim]
  );
  return r.rows as PromptRow[];
}

export async function listPublicPrompts(query?: string, limit = 30): Promise<PromptRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(100, limit));
  const q = (query || "").trim();

  if (!isDbReady()) {
    let rows = Array.from(memPrompts.values()).filter((p) => p.isPublic);
    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(ql) ||
          (p.description || "").toLowerCase().includes(ql) ||
          p.content.toLowerCase().includes(ql)
      );
    }
    rows.sort((a, b) => b.importCount - a.importCount || b.updatedAt.localeCompare(a.updatedAt));
    return rows.slice(0, lim);
  }
  if (q) {
    const r = await pool.query(
      `SELECT * FROM "QCorePrompt"
        WHERE "isPublic"=TRUE
          AND ("name" ILIKE $1 OR "description" ILIKE $1 OR "content" ILIKE $1)
        ORDER BY "importCount" DESC, "updatedAt" DESC
        LIMIT $2`,
      [`%${q}%`, lim]
    );
    return r.rows as PromptRow[];
  }
  const r = await pool.query(
    `SELECT * FROM "QCorePrompt"
      WHERE "isPublic"=TRUE
      ORDER BY "importCount" DESC, "updatedAt" DESC
      LIMIT $1`,
    [lim]
  );
  return r.rows as PromptRow[];
}

export async function updatePrompt(
  id: string,
  userId: string,
  patch: { name?: string; description?: string | null; role?: string; isPublic?: boolean }
): Promise<PromptRow | null> {
  await ensureQCoreTables(pool);

  if (!isDbReady()) {
    const cur = memPrompts.get(id);
    if (!cur || cur.ownerUserId !== userId) return null;
    if (patch.name != null) {
      const v = String(patch.name).trim().slice(0, 80);
      if (v) cur.name = v;
    }
    if (patch.description !== undefined)
      cur.description = patch.description ? String(patch.description).trim().slice(0, 400) : null;
    if (patch.role != null) cur.role = normalizePromptRole(patch.role);
    if (patch.isPublic != null) cur.isPublic = patch.isPublic === true;
    cur.updatedAt = nowIso();
    return cur;
  }

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (patch.name != null) {
    const v = String(patch.name).trim().slice(0, 80);
    if (v) {
      sets.push(`"name"=$${i++}`);
      params.push(v);
    }
  }
  if (patch.description !== undefined) {
    sets.push(`"description"=$${i++}`);
    params.push(patch.description ? String(patch.description).trim().slice(0, 400) : null);
  }
  if (patch.role != null) {
    sets.push(`"role"=$${i++}`);
    params.push(normalizePromptRole(patch.role));
  }
  if (patch.isPublic != null) {
    sets.push(`"isPublic"=$${i++}`);
    params.push(patch.isPublic === true);
  }
  if (!sets.length) return getPrompt(id);
  sets.push(`"updatedAt"=NOW()`);
  params.push(id, userId);
  const r = await pool.query(
    `UPDATE "QCorePrompt" SET ${sets.join(", ")}
      WHERE "id"=$${i++} AND "ownerUserId"=$${i++}
      RETURNING *`,
    params
  );
  return (r.rows?.[0] as PromptRow) || null;
}

export async function deletePrompt(id: string, userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const p = memPrompts.get(id);
    if (!p || p.ownerUserId !== userId) return false;
    memPrompts.delete(id);
    return true;
  }
  const r = await pool.query(
    `DELETE FROM "QCorePrompt" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`,
    [id, userId]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Fork an existing prompt — creates a child version. Owner's own prompts
 * are forkable freely (creates next version in the chain). Public prompts
 * by other users get the importCount bumped + a fresh root for the forker.
 */
export async function forkPrompt(
  parentId: string,
  forkerUserId: string,
  patch: { content?: string; name?: string }
): Promise<PromptRow | null> {
  const parent = await getPrompt(parentId);
  if (!parent) return null;

  const isOwn = parent.ownerUserId === forkerUserId;
  const isAccessible = isOwn || parent.isPublic;
  if (!isAccessible) return null;

  if (!isOwn) {
    // Bump parent.importCount.
    if (!isDbReady()) {
      parent.importCount += 1;
      parent.updatedAt = nowIso();
    } else {
      await pool.query(
        `UPDATE "QCorePrompt" SET "importCount" = "importCount" + 1, "updatedAt"=NOW() WHERE "id"=$1`,
        [parentId]
      );
    }
  }

  return createPrompt({
    ownerUserId: forkerUserId,
    name: patch.name?.trim() || `${parent.name} (fork)`,
    description: parent.description,
    role: parent.role,
    content: patch.content?.trim() ? patch.content.slice(0, 16000) : parent.content,
    parentPromptId: isOwn ? parent.id : null,
    isPublic: false,
  });
}

/** Returns the version chain for a prompt: ancestors + descendants. */
export async function getPromptVersionChain(rootId: string): Promise<PromptRow[]> {
  await ensureQCoreTables(pool);
  // Walk up to root, then collect all descendants.
  const visited = new Set<string>();
  const chain: PromptRow[] = [];

  // Walk ancestors.
  let cur = await getPrompt(rootId);
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift(cur);
    if (!cur.parentPromptId) break;
    cur = await getPrompt(cur.parentPromptId);
  }

  // BFS descendants from every node already in the chain (each ancestor +
  // the original target). We keep visited for dedup, but the queue starts
  // populated so descendants of nodes deeper than the root are reachable.
  if (!chain.length) return [];

  if (!isDbReady()) {
    const all = Array.from(memPrompts.values());
    const queue: PromptRow[] = [...chain];
    while (queue.length) {
      const node = queue.shift()!;
      const children = all.filter((p) => p.parentPromptId === node.id && !visited.has(p.id));
      for (const c of children) {
        visited.add(c.id);
        chain.push(c);
        queue.push(c);
      }
    }
    return chain.sort((a, b) => a.version - b.version);
  }

  const queue: PromptRow[] = [...chain];
  while (queue.length) {
    const node = queue.shift()!;
    const r = await pool.query(`SELECT * FROM "QCorePrompt" WHERE "parentPromptId"=$1`, [node.id]);
    for (const child of r.rows as PromptRow[]) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      chain.push(child);
      queue.push(child);
    }
  }
  return chain.sort((a, b) => a.version - b.version);
}

/* ═══════════════════════════════════════════════════════════════════════
   Per-user monthly spend limits — gate /multi-agent when the calendar-month
   total exceeds monthlyLimitUsd. alertAt (0..1) triggers a warning banner.
   ═══════════════════════════════════════════════════════════════════════ */

export type SpendLimitRow = {
  userId: string;
  monthlyLimitUsd: number;
  alertAt: number;
  createdAt: string;
  updatedAt: string;
};

const memSpendLimits = new Map<string, SpendLimitRow>();

export async function getSpendLimit(userId: string): Promise<SpendLimitRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memSpendLimits.get(userId) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreSpendLimit" WHERE "userId"=$1`, [userId]);
  return (r.rows[0] as SpendLimitRow) || null;
}

export async function setSpendLimit(
  userId: string,
  monthlyLimitUsd: number,
  alertAt = 0.8
): Promise<SpendLimitRow> {
  await ensureQCoreTables(pool);
  const clamped = Math.max(0, Math.min(1000, monthlyLimitUsd));
  const at = Math.max(0.1, Math.min(1, alertAt));

  if (!isDbReady()) {
    const row: SpendLimitRow = {
      userId,
      monthlyLimitUsd: clamped,
      alertAt: at,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memSpendLimits.set(userId, row);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreSpendLimit" ("userId","monthlyLimitUsd","alertAt")
     VALUES ($1,$2,$3)
     ON CONFLICT ("userId") DO UPDATE
       SET "monthlyLimitUsd"=$2, "alertAt"=$3, "updatedAt"=NOW()
     RETURNING *`,
    [userId, clamped, at]
  );
  return r.rows[0] as SpendLimitRow;
}

export async function deleteSpendLimit(userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const had = memSpendLimits.has(userId);
    memSpendLimits.delete(userId);
    return had;
  }
  const r = await pool.query(
    `DELETE FROM "QCoreSpendLimit" WHERE "userId"=$1 RETURNING "userId"`,
    [userId]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Sum of totalCostUsd for the calling user's runs in the current calendar month.
 * Falls back to an in-memory scan for the demo mode.
 */
export async function getMonthlySpend(userId: string): Promise<number> {
  await ensureQCoreTables(pool);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  if (!isDbReady()) {
    // In-memory: userId isn't stored on runs directly — approximate via sessions.
    const sessions = await listSessions(userId, 200);
    const sessionIds = new Set(sessions.map((s) => s.id));
    let total = 0;
    for (const run of memRuns.values()) {
      if (sessionIds.has(run.sessionId) && run.startedAt >= monthStart) {
        total += run.totalCostUsd ?? 0;
      }
    }
    return total;
  }

  const r = await pool.query(
    `SELECT COALESCE(SUM(r."totalCostUsd"), 0) AS total
     FROM "QCoreRun" r
     JOIN "QCoreSession" s ON s.id = r."sessionId"
     WHERE s."userId"=$1 AND r."startedAt" >= $2`,
    [userId, monthStart]
  );
  return parseFloat(r.rows[0]?.total ?? "0") || 0;
}

/* ═══════════════════════════════════════════════════════════════════════
   Run templates — reusable input + strategy + overrides bundles.
   Users save a named config once and apply it in one click; public
   templates are browsable across accounts.
   ═══════════════════════════════════════════════════════════════════════ */

export type TemplateRow = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  input: string;
  strategy: string;
  overrides: Record<string, unknown>;
  isPublic: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

const memTemplates = new Map<string, TemplateRow>();

export async function createTemplate(opts: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  input: string;
  strategy?: string;
  overrides?: Record<string, unknown>;
  isPublic?: boolean;
}): Promise<TemplateRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const row: TemplateRow = {
    id,
    ownerUserId: opts.ownerUserId,
    name: opts.name.slice(0, 80),
    description: opts.description?.slice(0, 400) ?? null,
    input: opts.input.slice(0, 16000),
    strategy: opts.strategy || "sequential",
    overrides: opts.overrides ?? {},
    isPublic: opts.isPublic ?? false,
    useCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!isDbReady()) {
    memTemplates.set(id, row);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreTemplate"
       ("id","ownerUserId","name","description","input","strategy","overrides","isPublic")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [id, row.ownerUserId, row.name, row.description, row.input, row.strategy,
     JSON.stringify(row.overrides), row.isPublic]
  );
  return r.rows[0] as TemplateRow;
}

export async function listTemplates(ownerUserId: string, limit = 50): Promise<TemplateRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    return Array.from(memTemplates.values())
      .filter((t) => t.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreTemplate" WHERE "ownerUserId"=$1 ORDER BY "updatedAt" DESC LIMIT $2`,
    [ownerUserId, limit]
  );
  return r.rows as TemplateRow[];
}

export async function listPublicTemplates(query?: string, limit = 30): Promise<TemplateRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(100, limit));
  if (!isDbReady()) {
    const q = (query || "").toLowerCase();
    return Array.from(memTemplates.values())
      .filter((t) => t.isPublic && (!q || t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)))
      .sort((a, b) => b.useCount - a.useCount || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, lim);
  }
  if (query?.trim()) {
    const q = `%${query.trim()}%`;
    const r = await pool.query(
      `SELECT * FROM "QCoreTemplate"
        WHERE "isPublic"=TRUE AND ("name" ILIKE $1 OR "description" ILIKE $1)
        ORDER BY "useCount" DESC, "updatedAt" DESC LIMIT $2`,
      [q, lim]
    );
    return r.rows as TemplateRow[];
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreTemplate" WHERE "isPublic"=TRUE ORDER BY "useCount" DESC, "updatedAt" DESC LIMIT $1`,
    [lim]
  );
  return r.rows as TemplateRow[];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memTemplates.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreTemplate" WHERE "id"=$1`, [id]);
  return (r.rows[0] as TemplateRow) || null;
}

export async function updateTemplate(
  id: string,
  ownerUserId: string,
  patch: Partial<Pick<TemplateRow, "name" | "description" | "input" | "strategy" | "overrides" | "isPublic">>
): Promise<TemplateRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const t = memTemplates.get(id);
    if (!t || t.ownerUserId !== ownerUserId) return null;
    const updated = { ...t, ...patch, updatedAt: nowIso() };
    memTemplates.set(id, updated);
    return updated;
  }
  const sets: string[] = [];
  const vals: unknown[] = [id, ownerUserId];
  let idx = 3;
  if (patch.name !== undefined) { sets.push(`"name"=$${idx++}`); vals.push(patch.name.slice(0, 80)); }
  if (patch.description !== undefined) { sets.push(`"description"=$${idx++}`); vals.push(patch.description?.slice(0, 400) ?? null); }
  if (patch.input !== undefined) { sets.push(`"input"=$${idx++}`); vals.push(patch.input.slice(0, 16000)); }
  if (patch.strategy !== undefined) { sets.push(`"strategy"=$${idx++}`); vals.push(patch.strategy); }
  if (patch.overrides !== undefined) { sets.push(`"overrides"=$${idx++}`); vals.push(JSON.stringify(patch.overrides)); }
  if (patch.isPublic !== undefined) { sets.push(`"isPublic"=$${idx++}`); vals.push(patch.isPublic); }
  if (!sets.length) return getTemplate(id);
  sets.push(`"updatedAt"=NOW()`);
  const r = await pool.query(
    `UPDATE "QCoreTemplate" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`,
    vals
  );
  return (r.rows[0] as TemplateRow) || null;
}

export async function deleteTemplate(id: string, ownerUserId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const t = memTemplates.get(id);
    if (!t || t.ownerUserId !== ownerUserId) return false;
    memTemplates.delete(id);
    return true;
  }
  const r = await pool.query(
    `DELETE FROM "QCoreTemplate" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`,
    [id, ownerUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

/* ═══════════════════════════════════════════════════════════════════════
   Scheduled batch runs — fire a batch on a recurring or one-shot schedule.
   The backend polls due schedules every minute and fires a batch run.
   ═══════════════════════════════════════════════════════════════════════ */

export type ScheduleKind = "once" | "hourly" | "daily" | "weekly";

export type ScheduledBatchRow = {
  id: string;
  ownerUserId: string;
  name: string;
  inputs: string[];
  strategy: string;
  overrides: Record<string, unknown>;
  schedule: ScheduleKind;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastBatchId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const memScheduledBatches = new Map<string, ScheduledBatchRow>();

function nextRunTime(schedule: ScheduleKind, from = new Date()): Date | null {
  if (schedule === "once") return null; // one-shot: set manually by caller
  const d = new Date(from);
  if (schedule === "hourly") d.setHours(d.getHours() + 1, 0, 0, 0);
  else if (schedule === "daily") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else if (schedule === "weekly") { d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); }
  return d;
}

export async function createScheduledBatch(opts: {
  ownerUserId: string;
  name: string;
  inputs: string[];
  strategy?: string;
  overrides?: Record<string, unknown>;
  schedule?: ScheduleKind;
  nextRunAt?: string | null;
}): Promise<ScheduledBatchRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const schedule = (opts.schedule || "once") as ScheduleKind;
  let nextRunAt: string | null = opts.nextRunAt ?? null;
  if (!nextRunAt && schedule !== "once") {
    nextRunAt = nextRunTime(schedule)?.toISOString() ?? null;
  }

  const row: ScheduledBatchRow = {
    id,
    ownerUserId: opts.ownerUserId,
    name: opts.name.slice(0, 80),
    inputs: opts.inputs.slice(0, 20).map((s) => s.slice(0, 16000)),
    strategy: opts.strategy || "sequential",
    overrides: opts.overrides ?? {},
    schedule,
    nextRunAt,
    lastRunAt: null,
    lastBatchId: null,
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!isDbReady()) { memScheduledBatches.set(id, row); return row; }

  const r = await pool.query(
    `INSERT INTO "QCoreScheduledBatch"
       ("id","ownerUserId","name","inputs","strategy","overrides","schedule","nextRunAt","enabled")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
     RETURNING *`,
    [id, row.ownerUserId, row.name, JSON.stringify(row.inputs), row.strategy,
     JSON.stringify(row.overrides), row.schedule, row.nextRunAt]
  );
  return r.rows[0] as ScheduledBatchRow;
}

export async function listScheduledBatches(ownerUserId: string): Promise<ScheduledBatchRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    return Array.from(memScheduledBatches.values())
      .filter((s) => s.ownerUserId === ownerUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreScheduledBatch" WHERE "ownerUserId"=$1 ORDER BY "createdAt" DESC`,
    [ownerUserId]
  );
  return r.rows as ScheduledBatchRow[];
}

export async function getScheduledBatch(id: string): Promise<ScheduledBatchRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memScheduledBatches.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreScheduledBatch" WHERE "id"=$1`, [id]);
  return (r.rows[0] as ScheduledBatchRow) || null;
}

export async function updateScheduledBatch(
  id: string,
  ownerUserId: string,
  patch: Partial<Pick<ScheduledBatchRow, "name" | "inputs" | "strategy" | "overrides" | "schedule" | "nextRunAt" | "enabled">>
): Promise<ScheduledBatchRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memScheduledBatches.get(id);
    if (!s || s.ownerUserId !== ownerUserId) return null;
    const updated = { ...s, ...patch, updatedAt: nowIso() };
    memScheduledBatches.set(id, updated);
    return updated;
  }
  const sets: string[] = ["\"updatedAt\"=NOW()"];
  const vals: unknown[] = [id, ownerUserId];
  let idx = 3;
  if (patch.name !== undefined) { sets.push(`"name"=$${idx++}`); vals.push(patch.name); }
  if (patch.inputs !== undefined) { sets.push(`"inputs"=$${idx++}`); vals.push(JSON.stringify(patch.inputs)); }
  if (patch.strategy !== undefined) { sets.push(`"strategy"=$${idx++}`); vals.push(patch.strategy); }
  if (patch.overrides !== undefined) { sets.push(`"overrides"=$${idx++}`); vals.push(JSON.stringify(patch.overrides)); }
  if (patch.schedule !== undefined) { sets.push(`"schedule"=$${idx++}`); vals.push(patch.schedule); }
  if (patch.nextRunAt !== undefined) { sets.push(`"nextRunAt"=$${idx++}`); vals.push(patch.nextRunAt); }
  if (patch.enabled !== undefined) { sets.push(`"enabled"=$${idx++}`); vals.push(patch.enabled); }
  const r = await pool.query(
    `UPDATE "QCoreScheduledBatch" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING *`,
    vals
  );
  return (r.rows[0] as ScheduledBatchRow) || null;
}

export async function deleteScheduledBatch(id: string, ownerUserId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const s = memScheduledBatches.get(id);
    if (!s || s.ownerUserId !== ownerUserId) return false;
    memScheduledBatches.delete(id);
    return true;
  }
  const r = await pool.query(
    `DELETE FROM "QCoreScheduledBatch" WHERE "id"=$1 AND "ownerUserId"=$2 RETURNING "id"`,
    [id, ownerUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Called by the scheduler — advance nextRunAt and record lastRunAt + lastBatchId. */
export async function recordScheduledRun(
  id: string,
  batchId: string
): Promise<void> {
  await ensureQCoreTables(pool);
  const s = await getScheduledBatch(id);
  if (!s) return;
  const next = s.schedule === "once" ? null : nextRunTime(s.schedule)?.toISOString() ?? null;
  const enabledNext = s.schedule !== "once"; // disable after one-shot fires

  if (!isDbReady()) {
    const r = memScheduledBatches.get(id);
    if (!r) return;
    r.lastRunAt = nowIso();
    r.lastBatchId = batchId;
    r.nextRunAt = next;
    r.enabled = enabledNext;
    r.updatedAt = nowIso();
    return;
  }
  await pool.query(
    `UPDATE "QCoreScheduledBatch"
       SET "lastRunAt"=NOW(), "lastBatchId"=$2, "nextRunAt"=$3, "enabled"=$4, "updatedAt"=NOW()
     WHERE "id"=$1`,
    [id, batchId, next, enabledNext]
  );
}

/** Returns schedules that are due (nextRunAt <= now, enabled=true). */
export async function getDueSchedules(): Promise<ScheduledBatchRow[]> {
  await ensureQCoreTables(pool);
  const nowStr = new Date().toISOString();
  if (!isDbReady()) {
    return Array.from(memScheduledBatches.values()).filter(
      (s) => s.enabled && s.nextRunAt !== null && s.nextRunAt <= nowStr
    );
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreScheduledBatch" WHERE "enabled"=TRUE AND "nextRunAt" <= NOW()`,
  );
  return r.rows as ScheduledBatchRow[];
}

export async function useTemplate(id: string): Promise<TemplateRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const t = memTemplates.get(id);
    if (!t) return null;
    t.useCount++;
    return t;
  }
  const r = await pool.query(
    `UPDATE "QCoreTemplate" SET "useCount"="useCount"+1,"updatedAt"=NOW() WHERE "id"=$1 RETURNING *`,
    [id]
  );
  return (r.rows[0] as TemplateRow) || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Batch runs — send N prompts against a shared config in one call.
   QCoreBatch tracks aggregate progress; each individual run links back via
   batchId. The route fires runs asynchronously (max 5 parallel) and polls
   completedRuns + failedRuns to determine when the batch is done.
   ═══════════════════════════════════════════════════════════════════════ */

export type BatchRow = {
  id: string;
  ownerUserId: string;
  strategy: string;
  overrides: Record<string, unknown>;
  status: "running" | "done" | "error";
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalCostUsd: number;
  inputs: string[];
  createdAt: string;
  completedAt: string | null;
};

const memBatches = new Map<string, BatchRow>();

export async function createBatch(opts: {
  ownerUserId: string;
  strategy?: string;
  overrides?: Record<string, unknown>;
  inputs: string[];
}): Promise<BatchRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const row: BatchRow = {
    id,
    ownerUserId: opts.ownerUserId,
    strategy: opts.strategy || "sequential",
    overrides: opts.overrides ?? {},
    status: "running",
    totalRuns: opts.inputs.length,
    completedRuns: 0,
    failedRuns: 0,
    totalCostUsd: 0,
    inputs: opts.inputs,
    createdAt: nowIso(),
    completedAt: null,
  };

  if (!isDbReady()) {
    memBatches.set(id, row);
    return row;
  }

  const r = await pool.query(
    `INSERT INTO "QCoreBatch"
       ("id","ownerUserId","strategy","overrides","status","totalRuns","inputs")
     VALUES ($1,$2,$3,$4,'running',$5,$6)
     RETURNING *`,
    [id, row.ownerUserId, row.strategy, JSON.stringify(row.overrides), row.totalRuns, JSON.stringify(row.inputs)]
  );
  return r.rows[0] as BatchRow;
}

export async function getBatch(id: string): Promise<BatchRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memBatches.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreBatch" WHERE "id"=$1`, [id]);
  return (r.rows[0] as BatchRow) || null;
}

export async function listBatches(ownerUserId: string, limit = 30): Promise<BatchRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    return Array.from(memBatches.values())
      .filter((b) => b.ownerUserId === ownerUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreBatch" WHERE "ownerUserId"=$1 ORDER BY "createdAt" DESC LIMIT $2`,
    [ownerUserId, limit]
  );
  return r.rows as BatchRow[];
}

export async function updateBatchProgress(
  batchId: string,
  delta: { completedDelta?: number; failedDelta?: number; costDelta?: number }
): Promise<void> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const b = memBatches.get(batchId);
    if (!b) return;
    b.completedRuns += delta.completedDelta ?? 0;
    b.failedRuns += delta.failedDelta ?? 0;
    b.totalCostUsd += delta.costDelta ?? 0;
    if (b.completedRuns + b.failedRuns >= b.totalRuns) {
      b.status = b.failedRuns === b.totalRuns ? "error" : "done";
      b.completedAt = nowIso();
    }
    return;
  }
  await pool.query(
    `UPDATE "QCoreBatch"
       SET "completedRuns" = "completedRuns" + $2,
           "failedRuns"    = "failedRuns"    + $3,
           "totalCostUsd"  = "totalCostUsd"  + $4,
           "status" = CASE
             WHEN "completedRuns" + $2 + "failedRuns" + $3 >= "totalRuns"
             THEN CASE WHEN "completedRuns" + $2 = 0 THEN 'error' ELSE 'done' END
             ELSE 'running'
           END,
           "completedAt" = CASE
             WHEN "completedRuns" + $2 + "failedRuns" + $3 >= "totalRuns" THEN NOW()
             ELSE NULL
           END
     WHERE "id" = $1`,
    [batchId, delta.completedDelta ?? 0, delta.failedDelta ?? 0, delta.costDelta ?? 0]
  );
}

export async function listBatchRuns(batchId: string): Promise<RunRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    return Array.from(memRuns.values())
      .filter((r) => r.batchId === batchId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreRun" WHERE "batchId"=$1 ORDER BY "startedAt" ASC`,
    [batchId]
  );
  return r.rows as RunRow[];
}

/* ═══════════════════════════════════════════════════════════════════════
   Run comments (public — no auth, authorName is free-text)
   ═══════════════════════════════════════════════════════════════════════ */

export type CommentRow = {
  id: string;
  runId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

const memComments = new Map<string, CommentRow[]>();

export async function createComment(runId: string, authorName: string, content: string): Promise<CommentRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const name = (authorName || "Anonymous").trim().slice(0, 60) || "Anonymous";
  const text = (content || "").trim().slice(0, 2000);
  if (!text) throw new Error("content required");
  if (!isDbReady()) {
    const row: CommentRow = { id, runId, authorName: name, content: text, createdAt: nowIso() };
    const existing = memComments.get(runId) ?? [];
    existing.push(row);
    memComments.set(runId, existing);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCoreRunComment" ("id","runId","authorName","content") VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, runId, name, text]
  );
  return r.rows[0] as CommentRow;
}

export async function listComments(runId: string): Promise<CommentRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return (memComments.get(runId) ?? []).slice();
  const r = await pool.query(
    `SELECT * FROM "QCoreRunComment" WHERE "runId"=$1 ORDER BY "createdAt" ASC`,
    [runId]
  );
  return r.rows as CommentRow[];
}

/* ═══════════════════════════════════════════════════════════════════════
   Prompt library audit log
   ═══════════════════════════════════════════════════════════════════════ */

export type AuditLogRow = {
  id: string;
  userId: string;
  promptId: string;
  promptName: string;
  action: "create" | "update" | "delete";
  changedFields: string | null;
  createdAt: string;
};

const memAuditLog: AuditLogRow[] = [];

export async function logPromptAudit(
  userId: string, promptId: string, promptName: string,
  action: "create" | "update" | "delete", changedFields?: string
): Promise<void> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  if (!isDbReady()) {
    memAuditLog.push({ id, userId, promptId, promptName, action, changedFields: changedFields ?? null, createdAt: nowIso() });
    return;
  }
  await pool.query(
    `INSERT INTO "QCorePresetAuditLog" ("id","userId","promptId","promptName","action","changedFields") VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, userId, promptId, promptName, action, changedFields ?? null]
  );
}

export async function listPromptAudit(userId: string, limit = 100): Promise<AuditLogRow[]> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(500, limit));
  if (!isDbReady()) return memAuditLog.filter((e) => e.userId === userId).slice(-lim).reverse();
  const r = await pool.query(
    `SELECT * FROM "QCorePresetAuditLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, lim]
  );
  return r.rows as AuditLogRow[];
}

/* ═══════════════════════════════════════════════════════════════════════
   Workspaces — shared session collections with role-based access
   ═══════════════════════════════════════════════════════════════════════ */

export type WorkspaceRow = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

const memWorkspaces = new Map<string, WorkspaceRow>();

export async function createWorkspace(opts: { name: string; description?: string | null; ownerId: string }): Promise<WorkspaceRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const row: WorkspaceRow = { id, name: opts.name.slice(0, 80), description: opts.description ?? null, ownerId: opts.ownerId, createdAt: nowIso(), updatedAt: nowIso() };
  if (!isDbReady()) { memWorkspaces.set(id, row); return row; }
  const r = await pool.query(
    `INSERT INTO "QCoreWorkspace" ("id","name","description","ownerId") VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, row.name, row.description, row.ownerId]
  );
  return r.rows[0] as WorkspaceRow;
}

export async function listWorkspaces(userId: string): Promise<WorkspaceRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return Array.from(memWorkspaces.values()).filter((w) => w.ownerId === userId);
  const r = await pool.query(
    `SELECT w.* FROM "QCoreWorkspace" w LEFT JOIN "QCoreWorkspaceMember" m ON m."workspaceId"=w."id" AND m."userId"=$1 WHERE w."ownerId"=$1 OR m."userId"=$1 ORDER BY w."updatedAt" DESC`,
    [userId]
  );
  return r.rows as WorkspaceRow[];
}

export async function getWorkspace(id: string): Promise<WorkspaceRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memWorkspaces.get(id) ?? null;
  const r = await pool.query(`SELECT * FROM "QCoreWorkspace" WHERE "id"=$1`, [id]);
  return (r.rows[0] as WorkspaceRow) || null;
}

export async function updateWorkspace(id: string, ownerId: string, patch: { name?: string; description?: string | null }): Promise<WorkspaceRow | null> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const w = memWorkspaces.get(id);
    if (!w || w.ownerId !== ownerId) return null;
    const updated = { ...w, ...patch, updatedAt: nowIso() };
    memWorkspaces.set(id, updated);
    return updated;
  }
  const sets: string[] = ["\"updatedAt\"=NOW()"];
  const vals: unknown[] = [id, ownerId];
  let idx = 3;
  if (patch.name !== undefined) { sets.push(`"name"=$${idx++}`); vals.push(patch.name); }
  if (patch.description !== undefined) { sets.push(`"description"=$${idx++}`); vals.push(patch.description); }
  const r = await pool.query(
    `UPDATE "QCoreWorkspace" SET ${sets.join(",")} WHERE "id"=$1 AND "ownerId"=$2 RETURNING *`,
    vals
  );
  return (r.rows[0] as WorkspaceRow) || null;
}

export async function deleteWorkspace(id: string, ownerId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const w = memWorkspaces.get(id);
    if (!w || w.ownerId !== ownerId) return false;
    memWorkspaces.delete(id);
    return true;
  }
  const r = await pool.query(`DELETE FROM "QCoreWorkspace" WHERE "id"=$1 AND "ownerId"=$2 RETURNING "id"`, [id, ownerId]);
  return (r.rowCount ?? 0) > 0;
}

export type MemberRow = { workspaceId: string; userId: string; role: string; joinedAt: string };
const memMembers = new Map<string, MemberRow[]>(); // key = workspaceId

export async function addWorkspaceMember(workspaceId: string, userId: string, role: string): Promise<MemberRow> {
  await ensureQCoreTables(pool);
  const row: MemberRow = { workspaceId, userId, role, joinedAt: nowIso() };
  if (!isDbReady()) {
    const list = memMembers.get(workspaceId) ?? [];
    const idx = list.findIndex((m) => m.userId === userId);
    if (idx >= 0) list[idx] = row; else list.push(row);
    memMembers.set(workspaceId, list);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO "QCoreWorkspaceMember" ("workspaceId","userId","role") VALUES ($1,$2,$3)
     ON CONFLICT ("workspaceId","userId") DO UPDATE SET "role"=$3 RETURNING *`,
    [workspaceId, userId, role]
  );
  return r.rows[0] as MemberRow;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<MemberRow[]> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) return memMembers.get(workspaceId) ?? [];
  const r = await pool.query(`SELECT * FROM "QCoreWorkspaceMember" WHERE "workspaceId"=$1`, [workspaceId]);
  return r.rows as MemberRow[];
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memMembers.get(workspaceId) ?? [];
    const next = list.filter((m) => m.userId !== userId);
    memMembers.set(workspaceId, next);
    return list.length !== next.length;
  }
  const r = await pool.query(`DELETE FROM "QCoreWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 RETURNING "userId"`, [workspaceId, userId]);
  return (r.rowCount ?? 0) > 0;
}

const memWorkspaceSessions = new Map<string, string[]>(); // workspaceId → sessionId[]

export async function addWorkspaceSession(workspaceId: string, sessionId: string): Promise<void> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memWorkspaceSessions.get(workspaceId) ?? [];
    if (!list.includes(sessionId)) list.push(sessionId);
    memWorkspaceSessions.set(workspaceId, list);
    return;
  }
  await pool.query(
    `INSERT INTO "QCoreWorkspaceSession" ("workspaceId","sessionId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [workspaceId, sessionId]
  );
}

export async function removeWorkspaceSession(workspaceId: string, sessionId: string): Promise<boolean> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const list = memWorkspaceSessions.get(workspaceId) ?? [];
    const next = list.filter((s) => s !== sessionId);
    memWorkspaceSessions.set(workspaceId, next);
    return list.length !== next.length;
  }
  const r = await pool.query(`DELETE FROM "QCoreWorkspaceSession" WHERE "workspaceId"=$1 AND "sessionId"=$2 RETURNING "sessionId"`, [workspaceId, sessionId]);
  return (r.rowCount ?? 0) > 0;
}

export async function listWorkspaceSessions(workspaceId: string): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    const ids = memWorkspaceSessions.get(workspaceId) ?? [];
    return ids.map((id) => {
      const s = Array.from(memSessions.values()).find((x) => x.id === id);
      return s ? { id: s.id, title: s.title, updatedAt: s.updatedAt } : { id, title: id, updatedAt: "" };
    });
  }
  const r = await pool.query(
    `SELECT s."id", s."title", s."updatedAt" FROM "QCoreSession" s
     JOIN "QCoreWorkspaceSession" ws ON ws."sessionId"=s."id"
     WHERE ws."workspaceId"=$1 ORDER BY s."updatedAt" DESC`,
    [workspaceId]
  );
  return r.rows;
}

export async function deleteRunsBulk(ids: string[], userId: string): Promise<number> {
  await ensureQCoreTables(pool);
  if (!isDbReady()) {
    let deleted = 0;
    for (const id of ids) {
      const run = memRuns.get(id);
      // In-memory: no user ownership check (userId on session not tracked in mem-run)
      if (run) { memRuns.delete(id); deleted++; }
    }
    return deleted;
  }
  const result = await pool.query(
    `DELETE FROM "QCoreRun" WHERE "id"=ANY($1::text[]) AND "sessionId" IN (
       SELECT "id" FROM "QCoreSession" WHERE "userId"=$2
     ) RETURNING "id"`,
    [ids, userId]
  );
  return result.rowCount ?? 0;
}

export async function getSessionCostSummary(
  userId: string | null,
  days = 7,
  limit = 10
): Promise<Array<{ id: string; title: string; updatedAt: string; runCount: number; totalCostUsd: number; totalDurationMs: number }>> {
  await ensureQCoreTables(pool);
  const lim = Math.max(1, Math.min(50, limit));
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  if (!isDbReady()) {
    const sessions = Array.from(memSessions.values()).filter((s) => !userId || s.userId === userId);
    return sessions.slice(0, lim).map((s) => {
      const runs = Array.from(memRuns.values()).filter((r) => r.sessionId === s.id && r.startedAt >= since);
      return {
        id: s.id, title: s.title, updatedAt: s.updatedAt,
        runCount: runs.length,
        totalCostUsd: runs.reduce((acc, r) => acc + (r.totalCostUsd ?? 0), 0),
        totalDurationMs: runs.reduce((acc, r) => acc + (r.totalDurationMs ?? 0), 0),
      };
    }).filter((s) => s.runCount > 0).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }
  const r = await pool.query(
    `SELECT s."id", s."title", s."updatedAt",
            COUNT(r."id")::int AS "runCount",
            COALESCE(SUM(r."totalCostUsd"),0) AS "totalCostUsd",
            COALESCE(SUM(r."totalDurationMs"),0) AS "totalDurationMs"
     FROM "QCoreSession" s
     JOIN "QCoreRun" r ON r."sessionId"=s."id"
     WHERE s."userId"=$1 AND r."startedAt">=$2
     GROUP BY s."id", s."title", s."updatedAt"
     ORDER BY "totalCostUsd" DESC
     LIMIT $3`,
    [userId, since, lim]
  );
  return r.rows;
}
