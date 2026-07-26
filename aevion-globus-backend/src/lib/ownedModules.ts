/**
 * «Что этот человек реально купил» — один читатель для ДВУХ сторов.
 *
 * У AEVION покупки живут в двух местах, и это не архитектурный выбор, а
 * история:
 *   1. `data/subscriptions.jsonl` — платформенные тарифы (Lite/Medium/Full/
 *      Universe) + модуль, выбранный на Lite. Пишет routes/provisioning.ts.
 *   2. таблица `AppSubscription` в Postgres — покупки одиночных приложений
 *      через LS-варианты `app_*` (9 штук: cyberchess, qventure, qpaynet,
 *      qcontract, constitution, ip_bureau, qrenew, smeta). Пишет
 *      routes/lemonSqueezyWebhook.ts, читает routes/appAccess.ts.
 *
 * Веерная скидка обязана видеть оба: она реагирует именно на поштучные
 * покупки. До 2026-07-26 `/api/pricing/fan/me` читал только первый стор и был
 * слеп ко второму — купивший CyberChess поштучно получал «веер включается после
 * первой покупки», то есть прямую неправду.
 *
 * DB-optional: нет базы → возвращаем то, что есть в JSONL, и честно помечаем
 * `appsSource: "unavailable"`, чтобы вызывающий не принял неполный список за
 * полный.
 */
import { getPool } from "./dbPool";
import { moduleForAppSlug } from "../data/lemonSqueezyVariants";
import { readLatestSubscription, fanAnchorOf } from "../routes/provisioning";
import type { TierId } from "../data/pricing";

export interface OwnedState {
  tierId: TierId;
  /** Модули из обоих сторов, без дублей. */
  modules: string[];
  /** Только из AppSubscription — чтобы было видно, что дал второй стор. */
  appModules: string[];
  /** Дата, от которой считать окно веера. */
  fanAnchorAt: string | null;
  subscriptionSince: string | null;
  appsSource: "db" | "unavailable";
}

async function activeAppModules(email: string): Promise<{ modules: string[]; source: "db" | "unavailable" }> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`,
      [email],
    );
    const rows = result.rows as Array<{ appSlug: string }>;
    const modules: string[] = [];
    for (const r of rows) {
      const id = moduleForAppSlug(r.appSlug);
      if (id) modules.push(id);
      else console.warn(`[ownedModules] неизвестный appSlug "${r.appSlug}" — нет в APP_SLUG_TO_MODULE`);
    }
    return { modules, source: "db" };
  } catch (e: any) {
    // База недоступна — не выдаём неполный список за полный.
    console.warn(`[ownedModules] AppSubscription недоступна: ${e?.message || e}`);
    return { modules: [], source: "unavailable" };
  }
}

export async function readOwnedModules(email: string): Promise<OwnedState> {
  const sub = readLatestSubscription(email);
  const apps = await activeAppModules(email.trim().toLowerCase());
  const merged = [...new Set([...(sub?.modules ?? []), ...apps.modules])];
  return {
    tierId: sub?.tierId ?? "free",
    modules: merged,
    appModules: apps.modules,
    fanAnchorAt: sub ? fanAnchorOf(sub) : null,
    subscriptionSince: sub?.ts ?? null,
    appsSource: apps.source,
  };
}
