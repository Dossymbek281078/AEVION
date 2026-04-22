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
  status: "pending" | "running" | "done" | "error";
  error: string | null;
  agentConfig: any;
  strategy: string | null;
  finalContent: string | null;
  totalDurationMs: number | null;
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
  status: "done" | "error",
  opts: { error?: string | null; finalContent?: string | null; totalDurationMs?: number | null }
): Promise<void> {
  await pool.query(
    `UPDATE "QCoreRun"
       SET "status"=$2,
           "error"=$3,
           "finalContent"=$4,
           "totalDurationMs"=$5,
           "finishedAt"=NOW()
     WHERE "id"=$1`,
    [runId, status, opts.error ?? null, opts.finalContent ?? null, opts.totalDurationMs ?? null]
  );
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
  ordering: number;
}): Promise<MessageRow> {
  const id = crypto.randomUUID();
  const r = await pool.query(
    `INSERT INTO "QCoreMessage"
      ("id","runId","role","stage","instance","provider","model","content","tokensIn","tokensOut","durationMs","ordering")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      opts.ordering,
    ]
  );
  return r.rows[0] as MessageRow;
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
