/**
 * Constitution — email waitlist for Pro launch + future newsletter.
 *
 *   POST /api/constitution/waitlist/subscribe   { email, source? }
 *   GET  /api/admin/constitution/waitlist/list  (admin only)
 *
 * Postgres `constitution_waitlist` (email UNIQUE, source, createdAt)
 * with in-memory fallback.
 *
 * Cron stub: schedule a weekly digest "top-5 scenarios of the week"
 * once Pro launches + transactional email provider wired up. For now
 * /api/admin/constitution/waitlist/list provides CSV-like export.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit, clientIp } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";
import { isAdminRequest } from "../lib/adminAuth";
import { validate, WaitlistSubscribeSchema } from "../lib/constitutionSchemas";
import { sendWaitlistConfirm, sendWeeklyDigestEmail as sendDigestEmail } from "../lib/constitutionBrevo";
import { makeServiceCapture } from "../lib/sentry/platform";
import { csvFromRows } from "../lib/csv";
import { unsubConfigured, unsubContact, verifyUnsubToken } from "../lib/waitlistUnsubToken";

const capture = makeServiceCapture("constitutionWaitlist");

type WaitlistRow = {
  email: string;
  source: string;
  createdAt: string;
};

const memList = new Map<string, WaitlistRow>();

/**
 * Склейка меток источника — та же логика, что в SQL при ON CONFLICT.
 *
 * Держать её здесь И в запросе — вынужденное повторение: SQL нельзя вызвать без
 * базы, а память обязана вести себя одинаково с ней, иначе запасной путь молча
 * теряет интерес подписчика. Правило одно, записано дважды, и оба места помечены
 * ссылкой друг на друга.
 *
 * Новая метка дописывается В КОНЕЦ (первый интерес остаётся первым), уже
 * существующая не дублируется, обрезка идёт по последней ЦЕЛОЙ метке: обрубленная
 * посередине не совпала бы ни с чем при отборе получателей.
 */
export function mergeSources(prev: string, next: string, limit = 250): string {
  const parts = String(prev || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const add = String(next || "").trim();
  if (!add) return parts.join(",");
  if (parts.some((p) => p.toLowerCase() === add.toLowerCase())) return parts.join(",");

  parts.push(add);
  let out = parts.join(",");
  while (out.length > limit && parts.length > 1) {
    // Выбрасываем самую позднюю метку, а не режем строку: у обрубка нет смысла.
    parts.pop();
    out = parts.join(",");
  }
  return out.slice(0, limit);
}
let tableReady = false;
let dbAvailable = false;

async function ensureWaitlistTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_waitlist (
        "email"     TEXT PRIMARY KEY,
        "source"    TEXT NOT NULL DEFAULT 'unknown',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_waitlist_created
        ON constitution_waitlist ("createdAt" DESC);
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

const ADMIN_ALLOWLIST = (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// Третья копия той же проверки — сведена 30.08 в lib/adminAuth. Найдена не
// сразу: при первом выносе я решил, что копий две, и внёс этот файл в список
// «своя политика». Ложная запись в таком списке не врёт в отчёте — она
// ВЫКЛЮЧАЕТ охрану для пункта. Подсказала соседняя вкладка: у неё 13 из 15
// прощённых оказались ложными.
function isAdmin(req: Request): boolean {
  return isAdminRequest(req);
}

// Формат email проверяется Zod-схемой WaitlistSubscribeSchema
// (z.string().email().max(120)) на входе в маршрут. Здесь раньше лежала
// вторая, НИКЕМ НЕ ВЫЗЫВАЕМАЯ регулярка: читающий видел её и считал, что
// есть ещё один слой проверки, которого не было. Убрана, чтобы код не
// обещал того, чего не делает.

export const constitutionWaitlistRouter = Router();
export const constitutionWaitlistAdminRouter = Router();

// Предел на публичную подписку: КАЖДЫЙ запрос шлёт письмо, а у Brevo потолок
// 300 писем в сутки. При «10 в минуту» один адрес выбирал суточную квоту за
// полчаса, после чего подтверждения не приходили НИКОМУ — и выглядело это как
// «письма задерживаются». Три в минуту человеку хватает с запасом (он подписывается
// один раз), а квоту так с одного адреса не выбрать.
// ⚠️ КЛЮЧ — ПОЧТА, а не адрес. Замер 28.08.2026 на живом проде: пять быстрых
// подписок дали 201, 201, 201, 429, 429 — предел работал. Но адрес посетителя до
// нас НЕ ДОХОДИТ: платформа подставляет один из ~7 своих внутренних, и «три в
// минуту» оказывалось три на ВСЕХ, кто пришёл через один узел. В день запуска,
// когда люди приходят пачкой по письму, большинство увидело бы «слишком много
// попыток» вместо подтверждения — то есть предел, задуманный против одного
// спамера, отказывал бы толпе, ровно в тот момент, ради которого всё делалось.
//
// Теперь по человеку: три в минуту на АДРЕС ПОЧТЫ (он в теле запроса). Один
// человек подписывается один раз, ему трёх хватает с запасом.
const writeLimit = rateLimit({
  windowMs: 60_000,
  max: 3,
  keyPrefix: "constitution-waitlist",
  keyFn: (req) => {
    const raw = (req as { body?: { email?: unknown } }).body?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    // Нет почты — считаем по адресу: тело ещё не проверено схемой, и пустой
    // ключ включил бы предупреждение лимитера о сломанном keyFn.
    return email ? `mail:${email}` : `ip:${clientIp(req)}`;
  },
});

// ОБЩИЙ потолок на всех сразу — чтобы суммарный расход писем не вырос.
// Сегодняшняя защита фактически даёт 3/мин на каждый из ~7 внутренних адресов,
// то есть до ~21 подписки в минуту на платформу. Ставим 20: суммарный предел
// остаётся прежним, но раздаётся по людям, а не по узлам. Суточную квоту писем
// это НЕ трогает — её считает brevoQuota, и трогать её здесь нельзя: она пока
// только предупреждает, а не останавливает.
const writeCeiling = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "constitution-waitlist-ceiling",
  keyFn: () => "all",
  message: "Слишком много подписок за минуту. Подождите немного и повторите.",
});
const readLimit  = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "constitution-waitlist-read" });

constitutionWaitlistRouter.post(
  "/subscribe",
  writeCeiling as unknown as (req: Request, res: Response, next: NextFunction) => void,
  writeLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  validate(WaitlistSubscribeSchema),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { email: string; source?: string };
      const emailRaw = body.email.trim().toLowerCase();
      const sourceRaw = (body.source ?? "unknown").slice(0, 60);

      const row: WaitlistRow = {
        email: emailRaw,
        source: sourceRaw,
        createdAt: new Date().toISOString(),
      };

      await ensureWaitlistTable();
      let storage: "postgres" | "memory" = "memory";
      // Новая ли это подписка. Нужно, чтобы не слать письмо второй раз тому,
      // кто нажал кнопку дважды: замер 21.08.2026 на проде — две подписки
      // подряд дали ДВА одинаковых письма за две секунды. Это раздражает
      // человека и жжёт суточный потолок Brevo (300 писем).
      let isNew = true;
      if (dbAvailable) {
        try {
          const pool = getPool();
          // xmax = 0 у строки, которая была ВСТАВЛЕНА; у обновлённой конфликтом
          // там номер транзакции. Штатный способ различить их в одном запросе.
          const ins = await pool.query(
            `INSERT INTO constitution_waitlist ("email","source","createdAt")
             VALUES ($1,$2,$3)
             ON CONFLICT ("email") DO UPDATE SET "source" =
               CASE
                 -- Метка уже в списке — оставляем как есть.
                 WHEN constitution_waitlist."source" = EXCLUDED."source" THEN constitution_waitlist."source"
                 WHEN string_to_array(constitution_waitlist."source", ',') @> ARRAY[EXCLUDED."source"] THEN constitution_waitlist."source"
                 -- Новая метка дописывается В КОНЕЦ: первый интерес остаётся
                 -- первым, и развилка письма, читающая начало строки, не меняет
                 -- поведения для тех, кто подписался на конституцию раньше.
                 -- Обрезка не по 60 символам, а по последней целой метке:
                 -- обрубленная посередине метка не совпала бы ни с чем при отборе.
                 ELSE left(
                        constitution_waitlist."source" || ',' || EXCLUDED."source",
                        greatest(
                          length(constitution_waitlist."source"),
                          length(left(constitution_waitlist."source" || ',' || EXCLUDED."source", 250))
                            - position(',' in reverse(left(constitution_waitlist."source" || ',' || EXCLUDED."source", 250)))
                        )
                      )
               END
             RETURNING (xmax = 0) AS inserted`,
            [row.email, row.source, row.createdAt],
          );
          isNew = ins.rows?.[0]?.inserted !== false;
          storage = "postgres";
        } catch (dbErr) {
          // Раньше тут стоял молчаливый провал в память. Человек получал
          // «вы записаны» и письмо-подтверждение, а запись жила в памяти
          // одного инстанса — до ближайшего перезапуска. Никто об этом не
          // узнавал: заявки просто испарялись. Запись в память оставляем
          // (в пределах жизни процесса это лучше, чем потерять сразу), но
          // теперь об этом кричим.
          capture(dbErr, {
            where: "waitlist.insert",
            route: "constitution/waitlist/subscribe",
            severity: "leads-at-risk",
            note: "запись в Postgres не удалась — заявка лежит только в памяти инстанса и будет потеряна при перезапуске",
          });
          console.error(
            "[Constitution] ЗАЯВКА НЕ СОХРАНЕНА В БАЗУ — только в памяти, будет потеряна при перезапуске.",
            dbErr instanceof Error ? dbErr.message : dbErr,
          );
        }
      }
      // Память ведёт себя КАК БАЗА: метка дописывается, а не игнорируется.
      //
      // Прежняя строка была `if (!memList.has(...))` — то есть повторная подписка
      // в памяти не меняла ничего, тогда как в Postgres источник (до 19.08)
      // перезаписывался. Два хранилища с разной семантикой: на запасном пути
      // интерес не накапливался вовсе, и никакой тест этого не показывал, потому
      // что в тестах база недоступна и работает как раз память.
      const prev = memList.get(row.email);
      memList.set(row.email, prev ? { ...prev, source: mergeSources(prev.source, row.source) } : row);

      // Письмо не задерживает ответ, но его провал обязан быть видимым: иначе
      // человек подписан, письма нет, и снаружи это неотличимо от задержки.
      //
      // Повторная подписка письма НЕ шлёт. Ответ при этом остаётся 201: с точки
      // зрения человека он подписан, и рассказывать ему про устройство базы
      // незачем. Если различить не удалось (база недоступна, isNew остаётся
      // true) — письмо шлём: лучше лишнее письмо, чем молчание в ответ на
      // первую подписку.
      if (isNew) void sendWaitlistConfirm(row.email, row.source)
        .then((sent) => {
          if (!sent) capture(new Error("waitlist confirm email not sent"), { where: "waitlist.confirmEmail" });
        })
        .catch((mailErr) => capture(mailErr, { where: "waitlist.confirmEmail" }));

      res.status(201).json({ ok: true, storage });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "subscribe_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

/**
 * GET /unsubscribe?email=…&t=… — отписка по ссылке из письма.
 *
 * До 21.08.2026 отписки не было ВООБЩЕ: письма звали на страницу
 * `aevion.app/constitution/waitlist/unsubscribe`, которой не существует (404,
 * наравне с выдуманным адресом), и ручки в API тоже не было. Рабочая отписка в
 * платформе есть только у других модулей, и смоук проверял именно её — поэтому
 * зелёная проверка соседствовала с мёртвой ссылкой у нас.
 *
 * Отвечаем СТРАНИЦЕЙ, а не JSON: по ссылке приходят из почты, и человек должен
 * увидеть человеческий ответ, а не фигурные скобки.
 *
 * Три исхода различаются намеренно: нет секрета — 503 и адрес для отписки вручную
 * (притворяться, что сработало, нельзя); нет или неверен токен — 400; всё верно —
 * удаляем и говорим об этом. Отсутствие адреса в списке тоже считается успехом:
 * человек просил не писать ему, и «вас тут и не было» — правильный ответ, а не ошибка.
 */
constitutionWaitlistRouter.get(
  "/unsubscribe",
  readLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response) => {
    const page = (title: string, body: string, code: number) => {
      res.status(code).type("html").send(
        `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<meta name="robots" content="noindex"><title>${title} — AEVION</title></head>` +
          `<body style="font-family:Georgia,'Times New Roman',serif;background:#f7f6f2;color:#16161a;margin:0;padding:40px 20px">` +
          `<div style="max-width:520px;margin:0 auto">` +
          `<div style="font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a9781a">AEVION</div>` +
          `<h1 style="font-size:24px;line-height:1.25;margin:10px 0 14px">${title}</h1>` +
          `<p style="font-size:15px;line-height:1.6;margin:0">${body}</p></div></body></html>`,
      );
    };

    if (!unsubConfigured()) {
      return page(
        "Отписка временно недоступна",
        `Мы не смогли обработать ссылку автоматически. Напишите на ` +
          `<a href="mailto:${unsubContact()}">${unsubContact()}</a> — отпишем руками в тот же день.`,
        503,
      );
    }

    const email = String(req.query.email ?? "").trim().toLowerCase();
    const token = req.query.t;
    if (!email || !token) {
      return page("Ссылка неполная", "В ссылке не хватает адреса или кода. Откройте её из письма целиком.", 400);
    }
    if (!verifyUnsubToken(email, token)) {
      return page(
        "Ссылка не подошла",
        `Код в ссылке не совпал с адресом. Так бывает, если ссылку изменили при пересылке. ` +
          `Напишите на <a href="mailto:${unsubContact()}">${unsubContact()}</a>, и мы отпишем вас руками.`,
        400,
      );
    }

    let removedFromDb = false;
    if (dbAvailable) {
      try {
        const pool = getPool();
        const r = await pool.query(`DELETE FROM constitution_waitlist WHERE "email" = $1`, [email]);
        removedFromDb = (r.rowCount ?? 0) > 0;
      } catch (dbErr) {
        // Молчать нельзя: человек увидит «готово», а письма продолжат приходить.
        capture(dbErr, {
          where: "waitlist.unsubscribe",
          route: "constitution/waitlist/unsubscribe",
          severity: "unsubscribe-failed",
          note: "не удалось удалить адрес из Postgres — человек просил не писать ему",
        });
        console.error("[Constitution] ОТПИСКА НЕ ВЫПОЛНЕНА в базе:", dbErr instanceof Error ? dbErr.message : dbErr);
        return page(
          "Не получилось прямо сейчас",
          `Мы не смогли завершить отписку из-за сбоя на нашей стороне. Напишите на ` +
            `<a href="mailto:${unsubContact()}">${unsubContact()}</a> — отпишем руками, это не займёт времени.`,
          500,
        );
      }
    }
    const removedFromMem = memList.delete(email);

    return page(
      "Готово — больше не напишем",
      `Адрес <b>${email}</b> удалён из списка${removedFromDb || removedFromMem ? "" : " (его там уже не было)"}. ` +
        `Если передумаете, форма подписки всегда на месте.`,
      200,
    );
  },
);

constitutionWaitlistAdminRouter.get(
  "/list",
  readLimit as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "admin_required" });
    try {
      await ensureWaitlistTable();
      let rows: WaitlistRow[] = [];
      // Откуда список и не обрезан ли он. Без этого выгрузка при сбое базы
      // отдавала почти пустой список из памяти КАК ПОЛНЫЙ: владелец видел три
      // строки и делал вывод, что заявок нет. Решение принимается по этому
      // файлу, значит он обязан говорить о себе правду.
      const ROW_CAP = 5000;
      let source: "postgres" | "memory" = "memory";
      let dbQueryFailed = false;
      if (dbAvailable) {
        try {
          const pool = getPool();
          const r = await pool.query(
            `SELECT "email","source","createdAt"
             FROM constitution_waitlist
             ORDER BY "createdAt" DESC
             LIMIT ${ROW_CAP}`,
          );
          rows = r.rows.map((x: Record<string, unknown>) => ({
            email: String(x.email),
            source: String(x.source),
            createdAt: x.createdAt instanceof Date
              ? x.createdAt.toISOString()
              : String(x.createdAt),
          }));
          source = "postgres";
        } catch (dbErr) {
          dbQueryFailed = true;
          capture(dbErr, {
            where: "waitlist.list",
            route: "constitution/waitlist/list",
            note: "список заявок не прочитан из Postgres — выгрузка идёт из памяти и полной не является",
          });
          console.error(
            "[Constitution] ВЫГРУЗКА ЗАЯВОК ИЗ ПАМЯТИ, НЕ ИЗ БАЗЫ — список неполный:",
            dbErr instanceof Error ? dbErr.message : dbErr,
          );
        }
      }
      if (rows.length === 0) {
        rows = Array.from(memList.values());
        source = "memory";
      }
      const truncated = exportTruncated(source, rows.length, ROW_CAP);
      // Для CSV поля в тело не положить — поэтому признаки уходят заголовками:
      // файл сам по себе выглядит одинаково полным в любом случае.
      res.setHeader("X-Data-Source", source);
      res.setHeader("X-Data-Truncated", String(truncated));
      const fmt = String(req.query.format ?? "json");
      if (fmt === "csv") {
        // Экранирования тут не было ВООБЩЕ: поля клеились в строку как есть.
        // Запятая в source ломала разметку файла, а значение с ведущим = + - @
        // исполнялось как формула при открытии. Оба поля приходят из формы
        // подписки, то есть заполняются посторонним.
        const lines = [
          "email,source,createdAt",
          ...rows.map((r) => csvFromRows([[r.email, r.source, r.createdAt]])),
        ];
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="constitution-waitlist-${Date.now()}.csv"`);
        return res.send(lines.join("\n"));
      }
      res.json({
        total: rows.length,
        items: rows,
        ...aggregateBySource(rows),
        // `total` — это столько, сколько отдали, а не сколько есть. При
        // truncated=true или source="memory" по нему нельзя судить о размере
        // списка заявок.
        source,
        dbQueryFailed,
        truncated,
        rowCap: ROW_CAP,
      });
    } catch (err) {
      capture(err);
      res.status(500).json({
        error: "list_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

/**
 * Разбивка по источникам — по ОТДЕЛЬНЫМ меткам, а не по строке целиком.
 *
 * С 19.08 источник накапливается: у человека, подписавшегося на шахматах и потом
 * на DevHub, в поле стоит «cyberchess,devhub». Прежняя версия считала эту строку
 * отдельным источником, и отчёт распадался на НАБОРЫ интересов: «cyberchess» — 1,
 * «devhub» — 1, «cyberchess,devhub» — 1. Ответить «сколько людей ждёт шахматы» по
 * такой разбивке нельзя.
 *
 * Сумма по группам теперь МОЖЕТ БЫТЬ БОЛЬШЕ числа подписчиков — один человек
 * считается в каждой своей группе. Это правильно по смыслу и обязано быть
 * названо: иначе первый же отчёт, где 12 подписчиков дают 15 по группам,
 * прочитают как ошибку счёта. Поэтому рядом отдаётся `uniqueEmails`.
 */
/**
 * Обрезана ли выгрузка. Вынесено из обработчика, чтобы это можно было проверить.
 *
 * Замер 19.08.2026 мутациями: одиннадцать тестов «признаки честности выгрузки» НЕ
 * ловили ни `truncated = false` всегда, ни снижение предела до пяти строк. Тесты не
 * лгали — в них нет базы, поэтому путь `postgres` не проходится вовсе, а признак
 * обрезки считался только там. То есть свойство было непроверяемо по ОБСТОЯТЕЛЬСТВАМ,
 * а не по природе, и это отговорка: решение — чистое, три аргумента.
 *
 * Почему `>=`, а не `>`: запрос идёт с `LIMIT cap`, и ровно `cap` строк означает
 * «возможно, есть ещё» — при `>` последняя страница молча выдавалась бы за полную.
 */
export function exportTruncated(source: string, rowCount: number, cap: number): boolean {
  return source === "postgres" && rowCount >= cap;
}

function aggregateBySource(rows: WaitlistRow[]): {
  bySource: Array<{ source: string; count: number }>;
  uniqueEmails: number;
  note: string;
} {
  const m = new Map<string, number>();
  const emails = new Set<string>();
  for (const r of rows) {
    emails.add(String(r.email || "").trim().toLowerCase());
    const marks = String(r.source || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    // Пустой источник — тоже факт: «неизвестно» лучше молчания, иначе такие
    // записи просто исчезнут из отчёта.
    for (const mark of marks.length ? marks : ["unknown"]) {
      m.set(mark, (m.get(mark) ?? 0) + 1);
    }
  }
  return {
    bySource: Array.from(m.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    uniqueEmails: emails.size,
    note:
      "Счёт по МЕТКАМ: один адрес попадает в каждую свою группу, поэтому сумма по группам может превышать uniqueEmails.",
  };
}

/**
 * Недельный дайджест подписчикам конституции.
 *
 * ⚠️ ЭТО НЕ ЗАГЛУШКА. Комментарий здесь до 21.08.2026 гласил «For now just
 * no-op», хотя функция давно шлёт НАСТОЯЩИЕ письма через Brevo (см. вызов
 * sendDigestEmail ниже). Такая подпись опаснее отсутствия подписи: она
 * приглашает вызвать функцию «чтобы проверить», а проверка окажется
 * рассылкой по живому списку.
 *
 * Кто её зовёт: НИКТО. Проверено сплошным поиском по репозиторию 21.08.2026
 * — ни ручки, ни расписания, ни скрипта. То есть механизм собран и не
 * подключён; включать его — отдельное решение, потому что рассылка по
 * живым адресам необратима.
 *
 * Для письма НА ЗАПУСК модуля эта функция не годится: она собирает дайджест
 * артефактов конституции, а не анонс. Порядок отправки анонса —
 * Desktop\АЕВИОН-CyberChess6-08-19-письмо-на-запуск-черновик.md
 */
/**
 * `aborted` отличает «рассылать было некому» от «список не прочитался».
 * Без этого флага вызывающий видит одинаковый ноль в обоих случаях, а это
 * разные вещи: во втором подписчики есть, просто мы их не увидели.
 */
export async function sendWeeklyDigest(): Promise<{ sent: number; skipped: number; aborted?: boolean }> {
  try {
    // 1. Get top-5 artifacts by votes in last 7 days
    await ensureWaitlistTable();
    let topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }> = [];
    if (dbAvailable) {
      try {
        const pool = getPool();
        const rows = await pool.query(`
          SELECT a."title", a."regimeName",
                 COALESCE(SUM(CASE WHEN v."vote" = 1 THEN 1 ELSE 0 END), 0) AS up_votes
          FROM planet_constitution_artifacts a
          LEFT JOIN planet_constitution_votes v ON v."artifactId" = a."id"
          WHERE a."publishedAt" > NOW() - INTERVAL '7 days'
          GROUP BY a."id", a."title", a."regimeName"
          ORDER BY up_votes DESC
          LIMIT 5
        `);
        topArtifacts = rows.rows.map((r: Record<string, unknown>) => ({
          title: String(r.title),
          regimeName: String(r.regimeName),
          url: `https://aevion.app/constitution/leaderboard`,
          votes: Number(r.up_votes),
        }));
      } catch (dbErr) {
        // чтение артефактов не удалось — дайджест был бы пропущен как «нечего слать».
        capture(dbErr, { where: "digest.readTopArtifacts" });
        console.error("[waitlist] digest.readTopArtifacts:", dbErr);
      }
    }
    if (!topArtifacts.length) return { sent: 0, skipped: 1 };

    // 2. Get waitlist subscribers
    let subscribers: Array<{ email: string }> = Array.from(memList.values());
    if (dbAvailable) {
      try {
        const pool = getPool();
        const r = await pool.query(`SELECT "email" FROM constitution_waitlist ORDER BY "createdAt" ASC LIMIT 5000`);
        subscribers = r.rows.map((x: Record<string, unknown>) => ({ email: String(x.email) }));
      } catch (dbErr) {
        // Раньше при сбое базы дайджест уходил по списку из ПАМЯТИ — в проде
        // это почти пустой список, — и функция рапортовала об успехе. То есть
        // недельная рассылка считалась отправленной, не дойдя ни до кого.
        // Отправка по неполному списку хуже неотправки: письмо нельзя послать
        // второй раз «уже правильно», а отчёт врёт.
        capture(dbErr, {
          where: "digest.readSubscribers",
          route: "constitution/digest",
          severity: "digest-aborted",
          note: "список подписчиков не прочитан из Postgres — рассылка отменена, чтобы не уйти по неполному списку из памяти",
        });
        console.error(
          "[Constitution] ДАЙДЖЕСТ ОТМЕНЁН: список подписчиков не прочитан из базы.",
          dbErr instanceof Error ? dbErr.message : dbErr,
        );
        return { sent: 0, skipped: 0, aborted: true };
      }
    }
    if (!subscribers.length) return { sent: 0, skipped: 0 };

    const weekOf = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
    const { sent, errors } = await sendDigestEmail(subscribers, topArtifacts, weekOf);
    return { sent, skipped: errors };
  } catch {
    return { sent: 0, skipped: 0 };
  }
}
