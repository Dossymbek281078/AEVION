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

export async function activeAppModules(email: string): Promise<AppModulesResult> {
  const target = email.trim().toLowerCase();
  if (!target) return { modules: [], source: "unavailable" };
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
    return { modules, source: "db" };
  } catch (e: any) {
    console.warn(`[appSubscriptions] AppSubscription недоступна: ${e?.message || e}`);
    return { modules: [], source: "unavailable" };
  }
}
