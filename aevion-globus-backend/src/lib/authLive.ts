import type { Request } from "express";
import { verifyBearerOptional, type JwtPayload } from "./authJwt";
import { getPool } from "./dbPool";

/**
 * Проверка токена «по живому аккаунту» — для ручек, что отдают ЛИЧНЫЕ данные.
 *
 * Повод (замер на проде cde01b698, 20.10.2026): после DELETE /api/auth/account
 * (200) тот же Bearer-токен ещё 7 дней скачивал /api/pipeline/certificates/
 * export.zip со всеми записями. verifyBearerOptional смотрит только подпись и
 * tokenVersion; AEVIONUser.deletedAt и AuthSession.revokedAt не видит никто,
 * кроме /me и непубличного requireAuthStrict в auth.ts.
 *
 * Правило:
 *  - подпись/tokenVersion — как в verifyBearerOptional;
 *  - строки AEVIONUser нет или deletedAt стоит → null;
 *  - в токене есть sid: строки AuthSession (id, userId) нет или revokedAt
 *    стоит → null. Токен без sid (старые выпуски) — только проверка deletedAt;
 *  - ошибка базы → откат к прежней проверке (подпись + tokenVersion) И запись
 *    в журнал с маршрутом и причиной (§16: не молча). Не null и не throw:
 *    null дал бы 401 и фронт выкинул бы человека из сессии при сбое базы;
 *    throw повесил бы ручки, где помощник зовётся вне try (devhub /snippets/:id),
 *    и сломал бы публичное чтение с необязательным входом. Сама ручка при
 *    упавшей базе данных не отдаст — её запрос упадёт своей ошибкой. Удалённый
 *    аккаунт при этом всё равно отсечён tokenVersion (поднят при удалении).
 */
export async function verifyBearerLive(req: Request): Promise<JwtPayload | null> {
  const payload = verifyBearerOptional(req);
  if (!payload) return null;
  const route = `${req.method} ${req.baseUrl || ""}${req.path || ""}`;
  try {
    const pool = getPool();
    const u = await pool.query(
      `SELECT "deletedAt" FROM "AEVIONUser" WHERE "id" = $1 LIMIT 1`,
      [payload.sub],
    );
    const urow = u?.rows?.[0] as { deletedAt?: unknown } | undefined;
    if (!urow) return null;
    if (urow.deletedAt) return null;

    const sid = (payload as JwtPayload & { sid?: unknown }).sid;
    if (typeof sid === "string" && sid) {
      const s = await pool.query(
        `SELECT "revokedAt" FROM "AuthSession" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
        [sid, payload.sub],
      );
      const srow = s?.rows?.[0] as { revokedAt?: unknown } | undefined;
      if (!srow) return null;
      if (srow.revokedAt) return null;
    }
    return payload;
  } catch (err) {
    const why = String((err as Error)?.message ?? err).slice(0, 200);
    console.error(`[authLive] проверка аккаунта не выполнена (база), откат к проверке подписи: route=${route} причина=${why}`);
    return payload;
  }
}
