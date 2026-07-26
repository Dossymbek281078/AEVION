/**
 * Чтение активных покупок одиночных приложений (таблица `AppSubscription`).
 *
 * Отдельный модуль намеренно: этим читателем пользуются и `lib/ownedModules.ts`,
 * и `routes/provisioning.ts` (веерный блок welcome-письма). Если бы provisioning
 * тянул ownedModules, получился бы цикл — ownedModules сам читает подписки из
 * provisioning. Здесь зависимости только вниз: dbPool + словарь слагов.
 *
 * DB-optional: нет доступной базы → пустой список и `source: "unavailable"`.
 * Неполный список НЕ выдаётся за полный — вызывающий обязан различать.
 */
import { getPool } from "./dbPool";
import { moduleForAppSlug } from "../data/lemonSqueezyVariants";

export interface AppModulesResult {
  modules: string[];
  source: "db" | "unavailable";
}

/**
 * Одна повторная попытка на холодный пул.
 *
 * Замерено 2026-07-26 в живом прогоне: ПЕРВЫЙ запрос после старта процесса
 * падает (пул ещё не поднял соединение), и без ретрая покупатель, открывший
 * страницу сразу после редеплоя, получал `appsSource: "unavailable"` — то есть
 * пустой веер при купленных модулях. Пробовать бесконечно нельзя (это путь
 * рендера страницы), поэтому ровно одна вторая попытка через 150 мс.
 */
const RETRY_DELAY_MS = 150;

/**
 * Пока база лежит — не платим 150 мс за ретрай на КАЖДОМ вызове.
 *
 * Ретрай выше лечит холодный пул: первая попытка после старта падает, вторая
 * проходит. Но если база недоступна по-настоящему, тот же ретрай превращается
 * в +150 мс к каждому рендеру страницы, где спрашивают о покупках, — и чем
 * хуже дела у базы, тем медленнее отвечает сайт. За холодный старт платим
 * один раз: после неудачной пары попыток ретрай подавляется на кулдаун, и
 * вызовы идут в один заход, отдавая честный `source: "unavailable"` сразу.
 * Первый же успех кулдаун снимает — восстановление ничем не задерживается.
 */
const RETRY_SUPPRESS_MS = 30_000;
let lastFailureAt = 0;

/** Только для тестов: забыть, что база недавно падала. */
export function __resetAppSubscriptionsBackoff(): void {
  lastFailureAt = 0;
}

export async function activeAppModules(email: string): Promise<AppModulesResult> {
  const target = email.trim().toLowerCase();
  if (!target) return { modules: [], source: "unavailable" };

  const suppressRetry = lastFailureAt > 0 && Date.now() - lastFailureAt < RETRY_SUPPRESS_MS;
  const maxAttempts = suppressRetry ? 1 : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`,
        [target],
      );
      const rows = result.rows as Array<{ appSlug: string }>;
      const modules: string[] = [];
      for (const r of rows) {
        const id = moduleForAppSlug(r.appSlug);
        if (id) modules.push(id);
        else console.warn(`[appSubscriptions] неизвестный appSlug "${r.appSlug}" — нет в APP_SLUG_TO_MODULE`);
      }
      if (attempt > 1) console.warn("[appSubscriptions] со второй попытки успешно (холодный пул)");
      lastFailureAt = 0; // база жива — следующему вызову ретрай снова доступен
      return { modules, source: "db" };
    } catch (e: any) {
      const msg = e?.message || e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      lastFailureAt = Date.now();
      console.warn(
        `[appSubscriptions] AppSubscription недоступна после ${maxAttempts} ` +
          `попыт${maxAttempts === 1 ? "ки" : "ок"}${suppressRetry ? " (ретрай подавлен кулдауном)" : ""}: ${msg}`,
      );
    }
  }
  return { modules: [], source: "unavailable" };
}
