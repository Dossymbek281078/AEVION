/**
 * Бесплатная норма ДЕЙСТВИЙ, дальше — платно.
 *
 * ЗАЧЕМ. Замер 28.09.2026 гостём, без всякой оплаты: из девяти продаваемых
 * приложений закрыто ОДНО. DevHub, QSign, QRight, QSkyway, Биржа, QVenture и
 * Бюро отвечают гостю 200 — то есть человек платит за то, что и так открыто.
 * Это и есть причина, по которой лестница сроков не купилась ни разу: дело не
 * в товарах кассы, а в отсутствии повода платить.
 *
 * ПОЧЕМУ НЕ ОБЩАЯ СТЕНА МОДУЛЯ. `PAYWALL_MODULES` закрывает модуль ЦЕЛИКОМ, и
 * тогда исчезает то, ради чего человек вообще приходит: посмотреть, проверить
 * чужую подпись, увидеть витрину. Здесь закрывается ДЕЙСТВИЕ — подписать,
 * зарегистрировать, выдать сертификат, — а показ остаётся бесплатным.
 *
 * ТРИ ПРАВИЛА, ОТ КОТОРЫХ НЕ ОТСТУПАЕМ:
 *  1. Спит, пока действие не названо в PAID_ACTIONS. Выкатка ничего не меняет.
 *  2. Платящий проходит ВСЕГДА и без запроса к счётчику.
 *  3. Сбой базы НЕ запирает человека (§14: отказ, останавливающий работу, хуже
 *     пропуска) — но пишет в журнал слепоты, иначе мы не узнаем, что не считаем.
 */
import type { Request, Response } from "express";
import { getPool } from "./dbPool";
import { resolveUserPlan } from "./planGate";
import { clientIp } from "./rateLimit";
import { адресОтПроксиСайта } from "./siteProxyAddress";

/** Действия, за которые берём деньги. Пусто = механизм спит целиком. */
function платныеДействия(): Set<string> {
  return new Set(
    (process.env.PAID_ACTIONS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Факт о настройке: включён ли механизм платных действий и какие названы.
 *
 * 🔴 06.10.2026, повод. Я доложил оркестратору «у CyberChess товар есть: оплата снимает
 * норму коуча» — и сказал сильнее, чем знал. Норма СПИТ, пока действие не названо в
 * PAID_ACTIONS (пункт 1 в шапке этого файла), а значение переменной сервиса из окна
 * разработки не прочесть: railway CLI без привязки отвечает «No linked project found».
 * То есть снаружи нельзя было узнать, продаём мы снятие нормы или пустоту.
 *
 * Имена действий — наши собственные идентификаторы, не секрет: без них ответ
 * «включено: да» не отвечает на вопрос «а ЧТО включено».
 */
export function сводкаПлатныхДействий(): { configured: boolean; count: number; actions: string[]; pilotAccounts: number; pilotPerMonth: number } {
  const названные = [...платныеДействия()].sort();
  const пилотов = (process.env.FREE_QUOTA_PILOT_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean).length;
  return { configured: названные.length > 0, count: названные.length, actions: названные, pilotAccounts: пилотов, pilotPerMonth: пилотнаяНорма() };
}

/** Сколько раз в месяц можно бесплатно. Своё число на действие, иначе 3. */
/**
 * 🔴 Пилот бюро (19.10.2026, письма Продаж: «месяц, до 50 записей, бесплатно»). Адреса
 * пилотных аккаунтов — в FREE_QUOTA_PILOT_EMAILS (через запятую; запись «@домен.kz»
 * — весь домен), их норма — FREE_QUOTA_PILOT_PER_MONTH (по умолчанию 50) на каждое
 * действие. Заводится переменной, без выкатки. Платящий по-прежнему проходит всегда.
 */
export function пилотныйАккаунт(email: string | null | undefined): boolean {
  const адрес = String(email ?? "").trim().toLowerCase();
  if (!адрес) return false;
  const список = (process.env.FREE_QUOTA_PILOT_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return список.some((п) => (п.startsWith("@") ? адрес.endsWith(п) : адрес === п));
}
export function пилотнаяНорма(): number {
  const n = Number(process.env.FREE_QUOTA_PILOT_PER_MONTH ?? "50");
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

export function бесплатноВМесяц(действие: string): number {
  const имя = "FREE_" + действие.toUpperCase() + "_PER_MONTH";
  const raw = process.env[имя];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

/**
 * Кто совершает действие. Почта сильнее адреса: адрес меняется у одного
 * человека и совпадает у офиса, но при отсутствии входа другого ключа нет.
 */
function ктоЭто(req: Request): string {
  const план = resolveUserPlan(req);
  if (план.email) return "email:" + план.email.trim().toLowerCase();
  // Гость, пришедший через прокси сайта (/api-backend): адрес соединения —
  // общий адрес Vercel, поэтому адрес гостя кладёт сам прокси (middleware.ts)
  // и подтверждает общим секретом. Без верного секрета заголовку не верим:
  // иначе любой в обход сайта подставит чужой адрес.
  const сКрая = адресОтПроксиСайта(req);
  if (сКрая) return "ip:" + сКрая;
  // Прямой заход: Railway ПЕРЕЗАПИСЫВАЕТ X-Forwarded-For адресом соединения
  // (замер 13.10.2026, /api/veilnetx/inspect: поддельный заголовок не доходит),
  // так что левый элемент — настоящий адрес человека.
  const левый = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return "ip:" + (левый || clientIp(req) || "неизвестно");
}

// Адрес гостя от прокси сайта и его счёт — в ./siteProxyAddress (28.10.2026: нужен и
// ограничителю rateLimit.clientIp, а тот модуль импортируется отсюда — цикл).
export { сводкаАдресаГостя, адресОтПроксиСайта } from "./siteProxyAddress";

function текущийМесяц(): string {
  const d = new Date();
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

let таблицаГотова = false;
async function обеспечитьТаблицу(pool: ReturnType<typeof getPool>): Promise<void> {
  if (таблицаГотова) return;
  await pool.query(
    'CREATE TABLE IF NOT EXISTS "FreeActionUsage" (' +
      '"actor" TEXT NOT NULL, "action" TEXT NOT NULL, "ym" TEXT NOT NULL, ' +
      '"count" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), ' +
      'PRIMARY KEY ("actor", "action", "ym"))',
  );
  таблицаГотова = true;
}

/** Для тестов: повторить создание таблицы в следующем вызове. */
export function сброситьГотовностьТаблицы(): void {
  таблицаГотова = false;
}

export interface ИтогПроверки {
  заблокировано: boolean;
  причина: "спит" | "платящий" | "в норме" | "норма исчерпана" | "считать не удалось";
  использовано?: number;
  норма?: number;
}

/**
 * Проверить и ЗАСЧИТАТЬ действие. Возвращает итог; 402 отправляет вызывающий,
 * чтобы текст отказа был свой у каждого модуля.
 */
export async function учестьДействие(req: Request, действие: string): Promise<ИтогПроверки> {
  if (!платныеДействия().has(действие)) return { заблокировано: false, причина: "спит" };

  const план = resolveUserPlan(req);
  if (план.tier && план.tier !== "free") return { заблокировано: false, причина: "платящий" };

  const норма = пилотныйАккаунт(план.email) ? пилотнаяНорма() : бесплатноВМесяц(действие);
  const кто = ктоЭто(req);
  try {
    const pool = getPool();
    await обеспечитьТаблицу(pool);
    const r = await pool.query(
      'INSERT INTO "FreeActionUsage" ("actor","action","ym","count","updatedAt") VALUES ($1,$2,$3,1,NOW()) ' +
        'ON CONFLICT ("actor","action","ym") DO UPDATE SET "count" = "FreeActionUsage"."count" + 1, "updatedAt" = NOW() ' +
        'RETURNING "count"',
      [кто, действие, текущийМесяц()],
    );
    const использовано = Number(r.rows?.[0]?.count ?? 0);
    if (использовано > норма) {
      return { заблокировано: true, причина: "норма исчерпана", использовано, норма };
    }
    return { заблокировано: false, причина: "в норме", использовано, норма };
  } catch (err) {
    // НЕ запираем: наш сбой не должен останавливать человека. Но и молчать
    // нельзя — иначе счётчик перестанет считать, а мы узнаем об этом по нулю
    // выручки, а не по журналу.
    console.error(
      "[freeActionQuota] СЧЁТ НЕ ВЁЛСЯ для " + действие + ": " +
        (err instanceof Error ? err.message : String(err)),
    );
    return { заблокировано: false, причина: "считать не удалось" };
  }
}

/** Готовый ответ 402 — одинаковой формы с остальной платной стеной. */
export function отказПоНорме(res: Response, модуль: string, итог: ИтогПроверки): void {
  /*
   * 🔴 ПОЛЕ upgradeUrl — ТО, ЧТО ЧИТАЕТ ФРОНТ (12.10.2026, окно user-d7).
   *
   * Замер: страница `frontend/src/app/qventure/batch/page.tsx` при отказе
   * берёт `aj.upgradeUrl` и только по нему рисует ссылку «Посмотреть тарифы»;
   * в её собственном комментарии так и написано — «при включённой платной
   * стене здесь приходит 402 с полями message и upgradeUrl». А этот ответ
   * отдавал адрес только ВНУТРИ текста `message`. То есть включение нормы
   * дало бы человеку отказ без кнопки, куда идти платить, — ровно тот же
   * класс, что `intentId` против `session_id` на экране после оплаты: две
   * половины согласованы в комментариях и разошлись в поле.
   *
   * Поле добавлено, прежние не тронуты: читатели `message` не ломаются.
   */
  const адресТарифов = (process.env.PUBLIC_BASE_URL || "https://aevion.app") + "/pricing";
  res.status(402).json({
    error: "free_quota_exceeded",
    module: модуль,
    used: итог.использовано,
    freePerMonth: итог.норма,
    upgradeUrl: адресТарифов,
    message:
      "Бесплатная норма на этот месяц исчерпана (" + итог.норма + "). " +
      "Подписка снимает ограничение — оформить: " + адресТарифов,
  });
}
