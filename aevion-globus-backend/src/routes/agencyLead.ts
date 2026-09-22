/**
 * Приём заявок агентства — POST /api/agency/lead
 *
 * 🔴 Зачем (замер 20.09.2026). Ролики и письма агентства обещают «пришлите три заявки»,
 * и человек доходит до блока контактов на сайте. Там форма НЕ отправляла данные нам:
 * она собирала письмо и открывала почтовую программу посетителя (`mailto:`), а рядом
 * стояла честная оговорка «не открылась — напишите на почту». Ролики смотрят с телефона,
 * где почтовая программа часто не настроена: нажатие не делает ничего. За неделю 800
 * просмотров и ноль заявок — и это объясняли слабым интересом.
 *
 * Принять заявку было НЕКУДА: из 24 POST-ручек бэкенда ни одна не про заявки.
 *
 * Что делает эта ручка:
 *   1) принимает контакт + текст, проверяет их ДО записи;
 *   2) пишет заявку в Postgres (`AgencyLead`), при недоступной базе — в память процесса;
 *   3) шлёт уведомление основателю письмом; отказ письма НЕ роняет приём заявки,
 *      но и не молчит — пишет в журнал и в ответе возвращает признак `notified`.
 *
 * Учёт: до сих пор мы не знали, сколько человек ПЫТАЛИСЬ написать. Теперь знаем.
 */

import { Router, type Request, type Response } from "express";
import { rateLimit, clientIp } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";
import { sendAgencyLeadNotice, sendAgencyLeadReceipt } from "../lib/constitutionBrevo";
import { makeServiceCapture } from "../lib/sentry/platform";

const capture = makeServiceCapture("agencyLead");

export const agencyLeadRouter = Router();

export type AgencyLeadInput = {
  contact: string;
  message: string;
  source?: string;
  name?: string;
};

const MAX_CONTACT = 200;
const MAX_MESSAGE = 5000;
const MAX_NAME = 120;
const MAX_SOURCE = 200;

/** Заявки, принятые без базы. Память процесса — запасной путь, не хранилище. */
const вПамяти: Array<AgencyLeadInput & { createdAt: string; ip: string }> = [];

/**
 * Проверка входа ДО записи. Контакт обязателен: заявка, по которой нельзя ответить,
 * бесполезна обеим сторонам. Принимаем и почту, и телефон — в Казахстане пишут и так, и так.
 */
export function проверитьЗаявку(вход: unknown): { ok: true; данные: AgencyLeadInput } | { ok: false; причина: string } {
  const b = (вход || {}) as Record<string, unknown>;
  const строка = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const contact = строка(b.contact);
  const message = строка(b.message);
  const name = строка(b.name);
  const source = строка(b.source);

  if (!contact) return { ok: false, причина: "contact_required" };
  if (contact.length > MAX_CONTACT) return { ok: false, причина: "contact_too_long" };

  const похожеНаПочту = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
  // Телефон: считаем цифры, а не формат — люди пишут +7 (777) 123-45-67 и 87771234567.
  const цифр = (contact.match(/[0-9]/g) || []).length;
  const похожеНаТелефон = цифр >= 10 && цифр <= 15;
  if (!похожеНаПочту && !похожеНаТелефон) return { ok: false, причина: "contact_invalid" };

  if (!message) return { ok: false, причина: "message_required" };
  if (message.length > MAX_MESSAGE) return { ok: false, причина: "message_too_long" };

  return {
    ok: true,
    данные: {
      contact,
      message,
      name: name.slice(0, MAX_NAME) || undefined,
      source: source.slice(0, MAX_SOURCE) || undefined,
    },
  };
}

async function записатьВБазу(з: AgencyLeadInput, ip: string): Promise<"db" | "memory"> {
  // getPool() возвращает пул ВСЕГДА, даже когда базы нет: проверка «если пула нет»
  // была бы мёртвым кодом, а заявка молча падала бы в исключение. Спрашиваем настройку.
  if (!process.env.DATABASE_URL) {
    вПамяти.push({ ...з, createdAt: new Date().toISOString(), ip });
    return "memory";
  }
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "AgencyLead" (
       id          BIGSERIAL PRIMARY KEY,
       contact     TEXT NOT NULL,
       message     TEXT NOT NULL,
       name        TEXT,
       source      TEXT,
       ip          TEXT,
       "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `INSERT INTO "AgencyLead" (contact, message, name, source, ip) VALUES ($1, $2, $3, $4, $5)`,
    [з.contact, з.message, з.name || null, з.source || null, ip],
  );
  return "db";
}

// Потолок: заявка — редкое событие, поэтому предел низкий. Он защищает и от
// случайного двойного нажатия, и от того, кто решит завалить ящик.
const лимитЗаявок = rateLimit({
  windowMs: 10 * 60_000,
  max: 5,
  keyPrefix: "agency:lead",
  message: "rate_limit_exceeded: слишком много заявок с одного адреса, напишите на почту",
});

agencyLeadRouter.post("/lead", лимитЗаявок, async (req: Request, res: Response) => {
  const разбор = проверитьЗаявку(req.body);
  if (!разбор.ok) {
    // 4xx — это ответ О ЗАПРОСЕ. 5xx поднял бы тревогу в Sentry на каждой опечатке.
    return res.status(400).json({ ok: false, error: разбор.причина });
  }

  const ip = clientIp(req) || "";
  let куда: "db" | "memory";
  try {
    куда = await записатьВБазу(разбор.данные, ip);
  } catch (e) {
    // Заявку терять нельзя: база упала — держим в памяти и говорим об этом честно.
    вПамяти.push({ ...разбор.данные, createdAt: new Date().toISOString(), ip });
    куда = "memory";
    capture(e, { where: "agencyLead.write" });
    console.error("[agencyLead] запись в базу не удалась, заявка в памяти процесса:", (e as Error).message);
  }

  let notified = false;
  try {
    notified = await sendAgencyLeadNotice(разбор.данные);
  } catch (e) {
    capture(e, { where: "agencyLead.notify" });
  }
  if (!notified) {
    // Молчаливый отказ здесь опаснее всего: заявка есть, а человек о ней не узнает.
    console.error("[agencyLead] УВЕДОМЛЕНИЕ НЕ УШЛО. Заявка от " + разбор.данные.contact + " сохранена (" + куда + ")");
  }

  // Подтверждение ОТПРАВИТЕЛЮ — отдельно и последним: заявка уже сохранена, и
  // её судьба не должна зависеть ни от нашего почтового провайдера, ни от того,
  // оставил ли человек почту (на телефон писать нечем — тогда просто false).
  let receipt = false;
  try {
    receipt = await sendAgencyLeadReceipt(разбор.данные);
  } catch (e) {
    capture(e, { where: "agencyLead.receipt" });
  }

  return res.status(201).json({ ok: true, stored: куда, notified, receipt });
});

/** Сколько заявок лежит только в памяти — для сводки и проверок. */
export function заявокВПамяти(): number {
  return вПамяти.length;
}
