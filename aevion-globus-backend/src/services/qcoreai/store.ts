/**
 * QCoreAI persistence helpers (thin wrapper over raw SQL).
 *
 * Kept deliberately small and composable so route handlers stay readable.
 */

import crypto from "crypto";
import { getPool } from "../../lib/dbPool";
import { ensureQCoreTables } from "../../lib/ensureQCoreTables";
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

function deriveTitle(text: string): string {
  const s = (text || "").trim().replace(/\s+/g, " ");
  if (!s) return "New session";
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export async function createSession(opts: {
  userId?: string | null;
  title?: string | null;
  mode?: string;
}): Promise<SessionRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
  const title = (opts.title?.trim() || "New session").slice(0, 120);
  const mode = opts.mode || "multi-agent";
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
    const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [opts.sessionId]);
    const row = r.rows?.[0] as SessionRow | undefined;
    if (row) {
      // Enforce ownership: if session has a userId and caller has a different one, reject.
      if (row.userId && opts.userId && row.userId !== opts.userId) {
        throw new Error("session not owned by caller");
      }
      return row;
    }
  }
  return createSession({
    userId: opts.userId ?? null,
    title: opts.seedTitle ? deriveTitle(opts.seedTitle) : null,
  });
}

export async function touchSession(sessionId: string): Promise<void> {
  await pool.query(`UPDATE "QCoreSession" SET "updatedAt"=NOW() WHERE "id"=$1`, [sessionId]);
}

export async function renameSessionIfDefault(sessionId: string, seed: string): Promise<void> {
  const nice = deriveTitle(seed);
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
  if (userId) {
    const r = await pool.query(
      `SELECT * FROM "QCoreSession"
         WHERE "userId"=$1
         ORDER BY "updatedAt" DESC
         LIMIT $2`,
      [userId, lim]
    );
    return r.rows as SessionRow[];
  }
  const r = await pool.query(
    `SELECT * FROM "QCoreSession"
       WHERE "userId" IS NULL
       ORDER BY "updatedAt" DESC
       LIMIT $1`,
    [lim]
  );
  return r.rows as SessionRow[];
}

export async function getSession(id: string, userId: string | null): Promise<SessionRow | null> {
  await ensureQCoreTables(pool);
  const r = await pool.query(`SELECT * FROM "QCoreSession" WHERE "id"=$1`, [id]);
  const row = r.rows?.[0] as SessionRow | undefined;
  if (!row) return null;
  if (row.userId && userId && row.userId !== userId) return null;
  if (row.userId && !userId) return null;
  return row;
}

export async function deleteSession(id: string, userId: string | null): Promise<boolean> {
  await ensureQCoreTables(pool);
  const session = await getSession(id, userId);
  if (!session) return false;
  // Cascade delete manually (no FK declared for simplicity).
  await pool.query(
    `DELETE FROM "QCoreMessage" WHERE "runId" IN (SELECT "id" FROM "QCoreRun" WHERE "sessionId"=$1)`,
    [id]
  );
  await pool.query(`DELETE FROM "QCoreRun" WHERE "sessionId"=$1`, [id]);
  await pool.query(`DELETE FROM "QCoreSession" WHERE "id"=$1`, [id]);
  return true;
}

export async function createRun(opts: {
  sessionId: string;
  userInput: string;
  agentConfig?: unknown;
  strategy?: string | null;
}): Promise<RunRow> {
  await ensureQCoreTables(pool);
  const id = crypto.randomUUID();
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
  status: "done" | "error" | "stopped",
  opts: {
    error?: string | null;
    finalContent?: string | null;
    totalDurationMs?: number | null;
    totalCostUsd?: number | null;
  }
): Promise<void> {
  await pool.query(
    `UPDATE "QCoreRun"
       SET "status"=$2,
           "error"=$3,
           "finalContent"=$4,
           "totalDurationMs"=$5,
           "totalCostUsd"=$6,
           "finishedAt"=NOW()
     WHERE "id"=$1`,
    [
      runId,
      status,
      opts.error ?? null,
      opts.finalContent ?? null,
      opts.totalDurationMs ?? null,
      opts.totalCostUsd ?? null,
    ]
  );
}

export async function renameSession(
  id: string,
  userId: string | null,
  nextTitle: string
): Promise<SessionRow | null> {
  const session = await getSession(id, userId);
  if (!session) return null;
  const clean = (nextTitle || "").trim().slice(0, 120) || "New session";
  const r = await pool.query(
    `UPDATE "QCoreSession"
       SET "title"=$2, "updatedAt"=NOW()
     WHERE "id"=$1
     RETURNING *`,
    [id, clean]
  );
  return (r.rows?.[0] as SessionRow) ?? null;
}

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
  const id = crypto.randomUUID();
  const r = await pool.query(
    `INSERT INTO "QCoreMessage"
      ("id","runId","role","stage","instance","provider","model","content","tokensIn","tokensOut","durationMs","costUsd","ordering")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      id,
      opts.runId,
      opts.role,
      opts.stage ?? null,
      opts.instance ?? null,
      opts.provider ?? null,
      opts.model ?? null,
      opts.content,
      opts.tokensIn ?? null,
      opts.tokensOut ?? null,
      opts.durationMs ?? null,
      opts.costUsd ?? null,
      opts.ordering,
    ]
  );
  return r.rows[0] as MessageRow;
}

/** Enable public sharing of a run — returns the token. Idempotent (reuses existing token). */
export async function shareRun(runId: string, userId: string | null): Promise<string | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const session = await getSession(run.sessionId, userId);
  if (!session) return null;
  if (run.shareToken) return run.shareToken;
  const token = crypto.randomBytes(24).toString("base64url");
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
  await pool.query(`UPDATE "QCoreRun" SET "shareToken"=NULL WHERE "id"=$1`, [runId]);
  return true;
}

/** Look up a run by its public share token (read-only path, no auth required). */
export async function getRunByShareToken(token: string): Promise<RunRow | null> {
  await ensureQCoreTables(pool);
  const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "shareToken"=$1 LIMIT 1`, [token]);
  return (r.rows?.[0] as RunRow) || null;
}

/** Public-safe session fetch (used by shared endpoint — returns only title/mode). */
export async function getSessionPublic(id: string): Promise<{ id: string; title: string; mode: string } | null> {
  const r = await pool.query(`SELECT "id","title","mode" FROM "QCoreSession" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as any) || null;
}

export async function listRuns(sessionId: string, limit = 50): Promise<RunRow[]> {
  const lim = Math.max(1, Math.min(200, limit));
  const r = await pool.query(
    `SELECT * FROM "QCoreRun"
       WHERE "sessionId"=$1
       ORDER BY "startedAt" ASC
       LIMIT $2`,
    [sessionId, lim]
  );
  return r.rows as RunRow[];
}

export async function getRun(id: string): Promise<RunRow | null> {
  const r = await pool.query(`SELECT * FROM "QCoreRun" WHERE "id"=$1`, [id]);
  return (r.rows?.[0] as RunRow) || null;
}

export async function listMessages(runId: string): Promise<MessageRow[]> {
  const r = await pool.query(
    `SELECT * FROM "QCoreMessage"
       WHERE "runId"=$1
       ORDER BY "ordering" ASC`,
    [runId]
  );
  return r.rows as MessageRow[];
}

/**
 * Aggregate analytics across all runs a caller can see. Anonymous users see
 * anonymous sessions only; authenticated users see their own sessions only.
 */
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
  const userPredicate = userId
    ? `s."userId" = $1`
    : `s."userId" IS NULL`;
  const params = userId ? [userId] : [];

  const runsQ = await pool.query(
    `SELECT COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(r."totalDurationMs"), 0)::bigint AS "durationMs"
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}`,
    params
  );

  const sessQ = await pool.query(
    `SELECT COUNT(*)::int AS sessions FROM "QCoreSession" s WHERE ${userPredicate}`,
    params
  );

  const tokensQ = await pool.query(
    `SELECT COALESCE(SUM(m."tokensIn"), 0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"), 0)::bigint AS "tokensOut",
            COUNT(*)::int AS messages
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id" = m."runId"
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}`,
    params
  );

  const strategyQ = await pool.query(
    `SELECT COALESCE(r."strategy", 'sequential') AS strategy,
            COUNT(*)::int AS runs,
            COALESCE(SUM(r."totalCostUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(
              (SELECT COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)),0)
                 FROM "QCoreMessage" m WHERE m."runId" = r."id")
            ), 0)::bigint AS "tokens",
            COALESCE(AVG(r."totalDurationMs"), 0)::float8 AS "avgDurationMs"
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
      GROUP BY COALESCE(r."strategy", 'sequential')
      ORDER BY runs DESC`,
    params
  );

  const providerQ = await pool.query(
    `SELECT m."provider" AS provider,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(m."tokensIn"), 0)::bigint AS "tokensIn",
            COALESCE(SUM(m."tokensOut"), 0)::bigint AS "tokensOut"
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id" = m."runId"
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL
      GROUP BY m."provider"
      ORDER BY calls DESC`,
    params
  );

  const modelQ = await pool.query(
    `SELECT m."provider" AS provider,
            m."model" AS model,
            COUNT(*)::int AS calls,
            COALESCE(SUM(m."costUsd"), 0)::float8 AS "costUsd",
            COALESCE(SUM(COALESCE(m."tokensIn",0)+COALESCE(m."tokensOut",0)), 0)::bigint AS "tokens"
       FROM "QCoreMessage" m
       JOIN "QCoreRun" r ON r."id" = m."runId"
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate} AND m."provider" IS NOT NULL AND m."model" IS NOT NULL
      GROUP BY m."provider", m."model"
      ORDER BY calls DESC
      LIMIT 20`,
    params
  );

  const recentQ = await pool.query(
    `SELECT r."id" AS "runId",
            r."sessionId" AS "sessionId",
            r."strategy" AS strategy,
            r."totalCostUsd" AS "costUsd",
            r."totalDurationMs" AS "totalDurationMs",
            r."startedAt" AS "startedAt",
            s."title" AS title
       FROM "QCoreRun" r
       JOIN "QCoreSession" s ON s."id" = r."sessionId"
      WHERE ${userPredicate}
      ORDER BY r."startedAt" DESC
      LIMIT 10`,
    params
  );

  const tokensIn = Number(tokensQ.rows[0]?.tokensIn ?? 0);
  const tokensOut = Number(tokensQ.rows[0]?.tokensOut ?? 0);
  return {
    scope,
    runs: runsQ.rows[0]?.runs ?? 0,
    sessions: sessQ.rows[0]?.sessions ?? 0,
    messages: tokensQ.rows[0]?.messages ?? 0,
    totals: {
      tokensIn,
      tokensOut,
      costUsd: Number(runsQ.rows[0]?.costUsd ?? 0),
      durationMs: Number(runsQ.rows[0]?.durationMs ?? 0),
    },
    byStrategy: strategyQ.rows.map((r: any) => ({
      strategy: r.strategy,
      runs: r.runs,
      costUsd: Number(r.costUsd),
      tokens: Number(r.tokens),
      avgDurationMs: Number(r.avgDurationMs),
    })),
    byProvider: providerQ.rows.map((r: any) => ({
      provider: r.provider,
      calls: r.calls,
      costUsd: Number(r.costUsd),
      tokensIn: Number(r.tokensIn),
      tokensOut: Number(r.tokensOut),
    })),
    byModel: modelQ.rows.map((r: any) => ({
      provider: r.provider,
      model: r.model,
      calls: r.calls,
      costUsd: Number(r.costUsd),
      tokens: Number(r.tokens),
    })),
    recent: recentQ.rows.map((r: any) => ({
      runId: r.runId,
      sessionId: r.sessionId,
      strategy: r.strategy,
      costUsd: r.costUsd,
      totalDurationMs: r.totalDurationMs,
      startedAt: r.startedAt,
      title: r.title,
    })),
  };
}

/** Build a history context (user + final assistant messages) for follow-up runs. */
export async function buildHistoryContext(sessionId: string, maxTurns = 6): Promise<ChatMessage[]> {
  const runs = await listRuns(sessionId, maxTurns);
  const out: ChatMessage[] = [];
  for (const run of runs) {
    if (run.userInput) out.push({ role: "user", content: run.userInput });
    if (run.finalContent) out.push({ role: "assistant", content: run.finalContent });
  }
  return out;
}
