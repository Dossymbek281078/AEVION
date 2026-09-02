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
import { ensureAppSubscriptionTable } from "./ensureAppSubscriptionTable";
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
    await ensureAppSubscriptionTable(pool);
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
/**
 * Три состояния, а не два.
 *
 * ⚠️ ПОПРАВКА 02.09.2026. Прежняя функция возвращала `boolean` и на сбое
 * чтения базы отдавала `false` — «гейт обязан закрываться, а не
 * открываться». Направление верное и сохранено. Неверным было ДРУГОЕ:
 * вызывающий не мог отличить «проверено, не куплено» от «проверить не
 * удалось», и потому отвечал заплатившему `402 upgrade_required` —
 * «модуль доступен на тарифах…» — при обычном дрожании базы.
 *
 * Два последствия, и второе тише первого:
 *
 *   1. Человек, который УЖЕ заплатил, получает предложение купить снова.
 *   2. Каждый такой отказ шёл в `recordDeny` как сигнал спроса («every 402
 *      is someone who WANTED a paid module»). То есть сбой инфраструктуры
 *      попадал в цифру, по которой судят, что продавать.
 *
 * Направление отказа выбирается по цене, видимость отказа не выбирается.
 */
export type AppSubscriptionState = "active" | "none" | "unknown";

export async function appSubscriptionState(
  email: string | null,
  moduleId: string,
): Promise<AppSubscriptionState> {
  if (!email) return "none";
  const slug = appSlugForModuleId(moduleId);
  if (!slug) return "none"; // модуль не продаётся отдельно — и спрашивать нечего

  const apps = await activeAppsFor(email);
  if (apps === null) return "unknown"; // чтение не удалось, а не «не куплено»
  return apps.has(slug) ? "active" : "none";
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
    // Создание таблицы нужно и на ЗАПИСИ, а не только на чтении: покупка
    // приходит вебхуком, и он вполне может быть первым, кто трогает таблицу.
    await ensureAppSubscriptionTable(pool);
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
