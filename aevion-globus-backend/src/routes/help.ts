/**
 * POST /api/help/contact — форма обратной связи со страницы /help.
 *
 * ЗАЧЕМ. Форма на /help существует и отправляет сюда с самого начала, но ручки
 * не было НИ ОДНОЙ: прод отвечал 404. У формы есть запасной путь — открыть
 * почтовый клиент, — и он вёл на адрес @aevion.app, у которого нет записи MX,
 * то есть письмо возвращалось отправителю. Вместе с мёртвыми ссылками на
 * GitHub Issues это означало, что 12.08.2026 у сайта не было НИ ОДНОГО
 * работающего канала связи. Ничего при этом не падало: форма просто «не
 * отправлялась».
 *
 * Сделано по образцу приёмных заявок в routes/pricing.ts, чтобы не заводить
 * второй способ делать то же самое: ограничение частоты по IP, проверка полей,
 * запись в jsonl, уведомление письмом.
 */

import { Router, type Request, type Response } from "express";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { sendEmail } from "./provisioning";

export const helpRouter = Router();

const CONTACT_FILE = process.env.HELP_CONTACT_FILE
  ? process.env.HELP_CONTACT_FILE
  : join(process.cwd(), "data", "help-contact.jsonl");

// Тот же адрес, что у приёмных заявок: домен aevion.io почту ПРИНИМАЕТ
// (MX на smtp.google.com), в отличие от aevion.app. Единый источник правды —
// переменная NOTIFY_EMAIL, отдельного адреса тут не заводим.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL?.trim() || "hello@aevion.io";

const RATE = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(ip);
  if (!cur || cur.reset < now) {
    RATE.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  cur.count += 1;
  return cur.count > 5;
}

const isValidEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

interface ContactMessage {
  id: string;
  ts: string;
  topic: string;
  subject: string;
  email: string | null;
  message: string;
  lang: string;
  page: string;
  ip: string;
}

helpRouter.post("/contact", (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "rate_limited", retryAfter: "10m" });
    return;
  }

  const body = req.body ?? {};
  const subject = str(body.subject, 200);
  const message = str(body.message, 5000);
  const emailRaw = str(body.email, 200).toLowerCase();

  if (!subject) { res.status(400).json({ error: "invalid_subject" }); return; }
  if (!message || message.length < 2) { res.status(400).json({ error: "invalid_message" }); return; }
  // Адрес НЕ обязателен — форма разрешает писать анонимно. Но если он указан и
  // при этом неверен, молча принять было бы хуже: человек будет ждать ответа,
  // которого мы физически не сможем отправить.
  if (emailRaw && !isValidEmail(emailRaw)) { res.status(400).json({ error: "invalid_email" }); return; }

  const msg: ContactMessage = {
    id: `help_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    topic: str(body.topic, 60) || "general",
    subject,
    email: emailRaw || null,
    message,
    lang: str(body.lang, 10) || "ru",
    page: str(body.page, 500) || "/help",
    ip,
  };

  // Сохраняем ПЕРВЫМ и только потом шлём письма. Обращение, дошедшее до нас, но
  // потерянное из-за сбоя почтового провайдера, — это потерянный клиент; запись
  // на диске переживёт и сбой Resend, и перезапуск.
  try {
    const dir = dirname(CONTACT_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(CONTACT_FILE, JSON.stringify(msg) + "\n", "utf8");
  } catch (e) {
    console.error("[help/contact] write failed", e);
    res.status(500).json({ error: "storage_error" });
    return;
  }

  const head = `[help/${msg.topic}] ${msg.subject}`;
  const bodyText =
    `Тема: ${msg.topic}\nОт: ${msg.email ?? "(без адреса)"}\nЯзык: ${msg.lang}\n` +
    `Страница: ${msg.page}\nID: ${msg.id}\n\n${msg.message}`;

  // Уведомление — best-effort: письмо не должно решать судьбу уже принятого
  // обращения. Ошибка попадает в лог, ответ клиенту остаётся успешным.
  sendEmail({ to: NOTIFY_EMAIL, subject: head, text: bodyText, html: `<pre>${escapeHtml(bodyText)}</pre>` })
    .catch((e: unknown) => console.error("[help/contact] notify failed", e));

  if (msg.email) {
    sendEmail({
      to: msg.email,
      subject: "AEVION — обращение получено",
      text: `Мы получили ваше сообщение и ответим на этот адрес.\n\nТема: ${msg.subject}\nНомер обращения: ${msg.id}\n\n— AEVION`,
      html: `<p>Мы получили ваше сообщение и ответим на этот адрес.</p><p><b>Тема:</b> ${escapeHtml(msg.subject)}<br><b>Номер обращения:</b> ${msg.id}</p><p>— AEVION</p>`,
    }).catch((e: unknown) => console.error("[help/contact] auto-reply failed", e));
  }

  res.status(201).json({ ok: true, id: msg.id });
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default helpRouter;
