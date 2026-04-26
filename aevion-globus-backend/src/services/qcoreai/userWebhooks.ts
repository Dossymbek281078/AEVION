import { getPool } from "../../lib/dbPool";
import { isDbReady } from "../../lib/ensureQCoreTables";

/**
 * Per-user webhook configuration. One row per JWT sub.
 *
 * Resolution order at run-completion time:
 *   1. If the run's session has a userId AND that user has a webhook row,
 *      fire to that URL (and use that user's secret for HMAC).
 *   2. Otherwise, fall back to env QCORE_WEBHOOK_URL / QCORE_WEBHOOK_SECRET
 *      so single-tenant deploys keep working unchanged.
 *   3. If neither is set, do nothing.
 *
 * In-memory store mode returns `null`/empty as if no row exists — callers
 * gracefully fall through to env.
 */

export type UserWebhookConfig = {
  userId: string;
  url: string;
  secret: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getUserWebhook(userId: string): Promise<UserWebhookConfig | null> {
  if (!userId || !isDbReady()) return null;
  const pool = getPool();
  const result = await pool.query(
    `SELECT "userId", "url", "secret", "createdAt", "updatedAt"
     FROM "QCoreUserWebhook"
     WHERE "userId" = $1`,
    [userId]
  );
  const row = (result.rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    userId: String(row.userId),
    url: String(row.url),
    secret: typeof row.secret === "string" ? row.secret : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : "",
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : "",
  };
}

/** Upsert. Returns the new row. */
export async function setUserWebhook(
  userId: string,
  url: string,
  secret: string | null
): Promise<UserWebhookConfig | null> {
  if (!userId || !isDbReady()) return null;
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO "QCoreUserWebhook" ("userId", "url", "secret")
     VALUES ($1, $2, $3)
     ON CONFLICT ("userId") DO UPDATE
       SET "url" = EXCLUDED."url",
           "secret" = EXCLUDED."secret",
           "updatedAt" = NOW()
     RETURNING "userId", "url", "secret", "createdAt", "updatedAt"`,
    [userId, url, secret]
  );
  const row = (result.rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    userId: String(row.userId),
    url: String(row.url),
    secret: typeof row.secret === "string" ? row.secret : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : "",
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : "",
  };
}

export async function deleteUserWebhook(userId: string): Promise<boolean> {
  if (!userId || !isDbReady()) return false;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM "QCoreUserWebhook" WHERE "userId" = $1`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Lightweight URL validator — must be HTTP(S), not loopback in non-dev envs. */
export function validateWebhookUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // Block obvious internal targets in production. Override with
  // QCORE_ALLOW_INTERNAL_WEBHOOKS=1 for local dev convenience.
  const allowInternal = process.env.QCORE_ALLOW_INTERNAL_WEBHOOKS === "1";
  if (!allowInternal) {
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return null;
    }
  }
  return parsed.toString();
}
