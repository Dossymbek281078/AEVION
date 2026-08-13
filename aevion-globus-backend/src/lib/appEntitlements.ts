/**
 * Права, купленные ОТДЕЛЬНОЙ подпиской на модуль (`AppSubscription`).
 *
 * Зачем это появилось. Замер 13.08.2026: девять модулей продаются отдельными
 * подписками ($19–$149/мес), вебхук честно пишет покупку в `AppSubscription` —
 * и дальше строка лежит мёртвым грузом. `planGate` брал права только из тарифа
 * (`data/subscriptions.jsonl`) и из JWT, про эту таблицу не знал. То есть при
 * включении платного доступа купивший модуль остался бы снаружи наравне с
 * гостем: заплатил и не пустили.
 *
 * ВАЖНО про сегодняшнее поведение: ни один из продаваемых модулей сейчас не
 * закрыт платным доступом, поэтому подключение этого источника прав НИЧЕГО не
 * меняет на проде — оно только добавляет права, никогда не отнимает. Это
 * недостающее звено, которое нужно при любом решении о витрине.
 *
 * Стоимость. Запрос к базе делается ТОЛЬКО тогда, когда проверка по тарифу уже
 * отказала, то есть для тех, кого вот-вот развернут. Обычный путь (доступ есть
 * либо пейволл выключен) в базу не ходит вовсе.
 */

import { getPool } from "./dbPool";
import { appSlugForModuleId } from "../data/lemonSqueezyVariants";

/** Короткий кэш: покупка применится не позже этого срока после оплаты. */
const TTL_MS = 60_000;

interface CacheEntry {
  apps: Set<string>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Для тестов: сбросить кэш между случаями. */
export function resetAppEntitlementsCache(): void {
  cache.clear();
}

async function activeAppsFor(email: string): Promise<Set<string> | null> {
  const key = email.trim().toLowerCase();
  if (!key) return new Set();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.apps;

  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`,
      [key],
    );
    const apps = new Set<string>(
      (r.rows as { appSlug: string }[]).map((row) => String(row.appSlug).trim().toLowerCase()),
    );
    cache.set(key, { apps, expiresAt: Date.now() + TTL_MS });
    return apps;
  } catch (err) {
    // Упавшее чтение НЕ становится фактом «подписки нет»: возвращаем null,
    // чтобы вызывающий отличал «проверено, не куплено» от «проверить не вышло».
    // Ответ пустым множеством молча лишил бы прав заплатившего человека.
    console.error("[appEntitlements] query failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Куплен ли этот модуль отдельной подпиской.
 *
 * Возвращает false и когда подписки нет, и когда проверить не удалось —
 * гейт обязан закрываться, а не открываться, на сбое. Но вызывающий видит
 * разницу в логе: тихо расширять доступ по ошибке базы нельзя.
 */
export async function hasActiveAppSubscription(email: string | null, moduleId: string): Promise<boolean> {
  if (!email) return false;
  const slug = appSlugForModuleId(moduleId);
  if (!slug) return false; // модуль не продаётся отдельно — и спрашивать нечего

  const apps = await activeAppsFor(email);
  if (apps === null) return false;
  return apps.has(slug);
}
