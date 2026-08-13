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

/**
 * Записать/снять подписку на отдельный модуль.
 *
 * Живёт здесь, а не в вебхуке: её нужны ОБА рельса — Lemon Squeezy и Gumroad.
 * Копия в каждом вебхуке разошлась бы молча, а расхождение видно только при
 * сравнении, то есть там, куда никто не смотрит.
 */
export async function upsertAppSubscription(
  email: string,
  appSlug: string,
  status: "active" | "cancelled",
  externalSubId?: string,
): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO "AppSubscription" ("id","email","appSlug","lsSubId","status","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT ("email","appSlug") DO UPDATE
         SET "status"=$4, "lsSubId"=COALESCE($3,"AppSubscription"."lsSubId"), "updatedAt"=NOW()`,
      [email.trim().toLowerCase(), appSlug, externalSubId ?? null, status],
    );
  } catch (err) {
    console.error("[appEntitlements] upsert failed:", err instanceof Error ? err.message : err);
    // Не глотаем: молчаливый 200 при неудавшейся записи означает «заплатил,
    // доступа нет, следов нет».
    throw err;
  }
  // Кэш прав держит до минуты — после записи он обязан устареть немедленно,
  // иначе только что купивший упрётся в отказ.
  cache.delete(email.trim().toLowerCase());
}
