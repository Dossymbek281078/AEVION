/**
 * Проверка платформенного ключа API — ОДНА на весь бэкенд.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. Механизм ключей (`routes/apiKeys.ts`) существует с
 * фазы B и умеет выдавать, перечислять и отзывать ключи. Его ручка
 * `GET /api/keys/verify` подписана комментарием «for downstream service auth»,
 * но замер 05.10.2026 показал: потребителей у неё НОЛЬ, таблицу
 * `PlatformApiKey` не читает ни один другой файл. То есть «ключи работают» —
 * это про выдачу, а не про вход: ни одна ручка платформы по ключу не пускала.
 *
 * QSign становится первым потребителем, и поэтому правило проверки вынесено
 * СЮДА, а не скопировано в роутер подписи. Скопированная проверка — это второй
 * способ делать одно и то же: завтра кто-то поправит отзыв ключа в одном месте
 * и не поправит в другом, и отозванный ключ продолжит открывать половину
 * платформы. Та же ручка `/verify` теперь зовёт эту функцию, так что
 * реализация ровно одна.
 *
 * Семантика сохранена дословно от `/verify` (05.10.2026):
 *   заголовок `x-api-key`; хеш `sha256(raw)`; строка ищется с
 *   `revokedAt IS NULL`; при успехе дёргается `lastUsedAt` и `callsMonth`.
 */

import crypto from "node:crypto";
import type { Request } from "express";
import { getPool } from "./dbPool";

const pool = getPool();

export type ApiKeyIdentity = {
  keyId: string;
  userId: string;
  tier: string;
  env: string;
};

/**
 * Три исхода, а не два, и это намеренно (правило §14 «сторож отказывает молча»):
 *   - ключа в запросе нет      → `null`, повод спросить другой способ входа;
 *   - ключ есть и он годен     → личность владельца;
 *   - ключ есть и он негоден   → `null`.
 *
 * Отличать «нет ключа» от «плохой ключ» вызывающему не нужно: оба случая ведут
 * к 401. Важно обратное — никогда не возвращать личность, когда ключ отозван
 * или неизвестен.
 */
export async function resolveApiKey(req: Request): Promise<ApiKeyIdentity | null> {
  const raw = req.headers["x-api-key"];
  if (typeof raw !== "string" || raw.length === 0) return null;

  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const r = await pool.query(
    `SELECT "id","userId","tier","env"
     FROM "PlatformApiKey"
     WHERE "keyHash" = $1 AND "revokedAt" IS NULL
     LIMIT 1`,
    [hash],
  );
  if (r.rowCount === 0) return null;

  const row = r.rows[0] as { id: string; userId: string; tier: string; env: string };

  /*
   * Учёт обращения — намеренно «выстрелил и забыл»: если учёт упал, работу
   * пользователя ронять нельзя. Это тот случай из §16, когда молчать МОЖНО:
   * проваливается подсобное действие, а не осмысленное.
   */
  pool
    .query(
      `UPDATE "PlatformApiKey"
       SET "lastUsedAt" = NOW(), "callsMonth" = "callsMonth" + 1
       WHERE "id" = $1`,
      [row.id],
    )
    .catch(() => {});

  return { keyId: row.id, userId: row.userId, tier: row.tier, env: row.env };
}
