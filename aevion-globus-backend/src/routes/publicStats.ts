/**
 * Публичный счётчик зарегистрированных — ОДНО число, которым меряется цель.
 *
 * 🔴 ЗАЧЕМ. 28.09.2026 основатель поставил цель 100 000 пользователей к концу
 * года, а измерить её было НЕЧЕМ: у платформы нет ни одной ручки, которая
 * отвечает «сколько людей зарегистрировалось». Замер того дня: у DevHub на
 * проде 2 проекта и один «пользователь» anonymous — оба проекта наши пробы.
 * Цель без прибора превращается в спор, поэтому прибор идёт первым.
 *
 * ЧТО ОТДАЁТ И ЧЕГО НЕ ОТДАЁТ. Только числа: всего, за сегодня, за 7 дней.
 * Ни адресов, ни имён, ни идентификаторов — ручка публичная, и личным данным
 * в ней делать нечего.
 *
 * 🔴 НАШИ ПРОБЫ СЧИТАЮТСЯ ОТДЕЛЬНО. Мы сами заводим учётки вида smoke-…,
 * probe-… и anonymous, и если смешать их с людьми, счётчик будет показывать
 * рост, которого нет — ровно та ошибка, из-за которой воронка однажды на 91 %
 * состояла из нашей же автоматики. Поэтому у ответа два поля: `люди` и
 * `пробы`, и складывать их обязан читатель, а не ручка.
 *
 * 🔴 БАЗА НЕДОСТУПНА — ЭТО НЕ НОЛЬ. Ноль означает «никто не зарегистрировался»,
 * и отвечать им на неотвеченный вопрос значит врать в самую важную сторону.
 * При отказе базы поля равны null, а `измерено` равно false.
 */
import { Router, type Request, type Response } from "express";
import { getPool } from "../lib/dbPool";

export const publicStatsRouter = Router();

const pool = getPool();

/** Учётки, которые завели МЫ: их нельзя показывать как рост. */
const ПРОБА =
  `("email" ILIKE 'smoke%' OR "email" ILIKE 'probe%' OR "email" ILIKE 'test%'` +
  ` OR "email" ILIKE '%@example.com' OR "email" ILIKE '%@test%'` +
  ` OR "name" ILIKE 'anonymous%' OR "name" ILIKE 'smoke%' OR "name" ILIKE 'probe%')`;

export interface СчётПользователей {
  измерено: boolean;
  люди: { всего: number | null; заСегодня: number | null; за7дней: number | null };
  пробы: { всего: number | null };
  наМомент: string;
  почему?: string;
}

export async function счётЗарегистрированных(): Promise<СчётПользователей> {
  const наМомент = new Date().toISOString();
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT ${ПРОБА})::int                                            AS люди_всего,
         COUNT(*) FILTER (WHERE NOT ${ПРОБА} AND "createdAt" >= NOW() - INTERVAL '1 day')::int  AS люди_сутки,
         COUNT(*) FILTER (WHERE NOT ${ПРОБА} AND "createdAt" >= NOW() - INTERVAL '7 days')::int AS люди_неделя,
         COUNT(*) FILTER (WHERE ${ПРОБА})::int                                                AS пробы_всего
       FROM "AEVIONUser"
       WHERE "deletedAt" IS NULL`,
    );
    const r = rows[0] ?? {};
    return {
      измерено: true,
      люди: {
        всего: Number(r.люди_всего ?? 0),
        заСегодня: Number(r.люди_сутки ?? 0),
        за7дней: Number(r.люди_неделя ?? 0),
      },
      пробы: { всего: Number(r.пробы_всего ?? 0) },
      наМомент,
    };
  } catch (e) {
    // Молчать здесь нельзя: счётчик, отвечающий нулём на собственную поломку,
    // опаснее отсутствующего счётчика — по нему принимают решения.
    console.error("[stats/users] счёт не удался", e);
    return {
      измерено: false,
      люди: { всего: null, заСегодня: null, за7дней: null },
      пробы: { всего: null },
      наМомент,
      почему: "база не ответила",
    };
  }
}

/** GET /api/stats/users — публично, только числа. */
publicStatsRouter.get("/users", async (_req: Request, res: Response) => {
  const счёт = await счётЗарегистрированных();
  res.status(счёт.измерено ? 200 : 503).json(счёт);
});
