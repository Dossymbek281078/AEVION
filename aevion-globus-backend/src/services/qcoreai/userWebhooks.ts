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
/**
 * Адрес указывает внутрь нашей сети или на служебный адрес облака?
 *
 * 28.08.2026: прежний список пропускал СЕМЬ форм из двенадцати проверенных,
 * и две из них опасны по-настоящему — `169.254.169.254` и
 * `metadata.google.internal`. Это адреса метаданных облака: обращение туда
 * с нашего сервера отдаёт сведения об инстансе, включая учётные данные.
 * Остальные пять — варианты петли, которые прежний список не знал:
 * `0.0.0.0`, `127.0.0.2`, `[::ffff:127.0.0.1]`, `[0:0:0:0:0:0:0:1]`,
 * плюс диапазон `100.64/10` (адреса провайдера).
 *
 * Что прежняя проверка делала ВЕРНО и что здесь сохранено: `new URL()` сама
 * приводит `127.1` и `2130706433` к `127.0.0.1`, поэтому короткие и
 * десятичные формы петли ловились и ловятся.
 *
 * Граница, которую честно назвать: это проверка ИМЕНИ, а не адреса. Имя,
 * которое DNS разрешит в приватный адрес, она не поймает — от этого спасает
 * только проверка после разрешения имени, на уровне доставки.
 */
export function isInternalHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv6: петля в любой записи, плюс адреса, отображённые из IPv4
  if (host.includes(":")) {
    const compact = host.replace(/(^|:)0+(?=[0-9a-f])/g, "$1");
    if (compact === "::1" || /^(0:){7}1$/.test(host) || host === "::") return true;
    // Адрес, отображённый из IPv4, приходит В ДВУХ формах, и `new URL()`
    // приводит точечную к шестнадцатеричной:
    //   ::ffff:127.0.0.1  ->  hostname становится ::ffff:7f00:1
    // Первая версия этой проверки знала только точечную и пропускала петлю.
    const mapped = /^::ffff:(.+)$/.exec(host);
    if (mapped) {
      const tail = mapped[1];
      if (tail.includes(".")) return isInternalHost(tail);
      const hex = tail.split(":").map((g) => g.padStart(4, "0")).join("");
      if (hex.length === 8) {
        const b = [0, 2, 4, 6].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return isInternalHost(b.join("."));
      }
      return true; // непонятная форма отображённого адреса — не пропускаем
    }
    if (host.startsWith("fc") || host.startsWith("fd")) return true;   // уникальные локальные
    if (host.startsWith("fe80")) return true;                          // link-local
    return false;
  }

  const octets = host.split(".");
  if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return false;
  const [a, b] = octets.map(Number);
  if (a === 127 || a === 0) return true;                    // петля и «этот хост»
  if (a === 10) return true;                                // приватная сеть
  if (a === 192 && b === 168) return true;                  // приватная сеть
  if (a === 172 && b >= 16 && b <= 31) return true;         // приватная сеть
  if (a === 169 && b === 254) return true;                  // link-local, ЗДЕСЬ ЖЕ метаданные облака
  if (a === 100 && b >= 64 && b <= 127) return true;        // carrier-grade NAT
  return false;
}

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
    if (isInternalHost(parsed.hostname)) return null;
  }
  return parsed.toString();
}
