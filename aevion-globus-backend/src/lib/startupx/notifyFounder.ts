/**
 * Письмо основателю: «по вашей заявке пришёл отклик».
 *
 * Зачем: до этого биржа молчала в сторону человека. Отклик ложился в таблицу,
 * а основатель узнавал о нём, только если сам вспоминал открыть личный кабинет
 * по ссылке, выданной один раз при публикации. Инвестор пишет — и тишина.
 *
 * Чего письмо НЕ делает:
 *  - не несёт ссылку на кабинет: токен у нас только в виде SHA-256, восстановить
 *    его нельзя даже нам, и это правильно. Письмо напоминает про сохранённую
 *    ссылку, а не выдаёт новую;
 *  - не несёт адрес инвестора и текст сообщения. Почта основателя не
 *    подтверждена (её ввели в форме), а чужой контакт — не то, что можно
 *    отправлять по непроверенному адресу. Условия отклика — можно: они и так
 *    публичная сторона сделки.
 *
 * Без SMTP в окружении просто ничего не отправляется — и это не ошибка:
 * публикация и отклик не должны падать из-за почты.
 */

import { getMailTransport, MAIL_FROM, FRONTEND_BASE } from "../mailTransport";
// Формат денег в модуле один — тот же, что на карточке и в разборе. Своя копия
// уже давала расхождение «$30K» против «$30.0K» между карточкой и заголовком.
import { fmt } from "./valuation";

export interface OfferNotice {
  founderEmail: string;
  listingId: number;
  listingTitle: string;
  ticketUsd: number | null;
  equityPct: number | null;
  intent: string | null;
}

const INTENT_RU: Record<string, string> = {
  raise: "вложение за долю",
  sell_stake: "покупка доли",
  sell_full: "покупка целиком",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Одна строка условий отклика — то, ради чего письмо вообще открывают. */
export function offerTerms(notice: OfferNotice): string {
  const parts: string[] = [];
  if (notice.ticketUsd) parts.push(`$${fmt(notice.ticketUsd)}`);
  if (notice.equityPct) parts.push(`за ${Number(notice.equityPct.toFixed(2))}%`);
  if (notice.intent && INTENT_RU[notice.intent]) parts.push(`— ${INTENT_RU[notice.intent]}`);
  return parts.length ? parts.join(" ") : "условия не указаны";
}

/**
 * Заголовок письма собирается из названия заявки, а его пишет пользователь.
 * Перевод строки в заголовке — это классическая подстановка чужих полей письма
 * (`Bcc:` и что угодно ещё), поэтому в тему не должно попасть ни `\r`, ни `\n`.
 */
function singleLine(s: string, max = 160): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

/** Чистая функция: письмо целиком, без отправки. Её и проверяют тесты. */
export function buildOfferEmail(notice: OfferNotice): { subject: string; text: string; html: string } {
  const terms = offerTerms(notice);
  const link = `${FRONTEND_BASE}/startup-exchange/${notice.listingId}`;
  const subject = singleLine(`Отклик по заявке «${notice.listingTitle}»: ${terms}`);
  const text = [
    `По вашей заявке «${notice.listingTitle}» пришёл отклик.`,
    ``,
    `Условия: ${terms}`,
    ``,
    `Кто написал и что именно — в вашем личном кабинете. Он открывается по ссылке,`,
    `которую вы сохранили при публикации (в ней есть ключ; у нас его нет и`,
    `восстановить мы его не можем).`,
    ``,
    `Сама заявка: ${link}`,
    ``,
    `AEVION — биржа стартапов. Письмо автоматическое, отвечать на него не нужно.`,
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">AEVION · Биржа стартапов</div>
  <h1 style="margin:14px 0 8px;font-size:20px;line-height:1.3">Отклик по заявке «${escapeHtml(notice.listingTitle)}»</h1>
  <p style="margin:0 0 18px;font-size:16px;font-weight:600">${escapeHtml(terms)}</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">
    Кто написал и что именно — в вашем личном кабинете. Он открывается по ссылке, которую вы
    сохранили при публикации: в ней есть ключ, у нас его нет и восстановить мы его не можем.
  </p>
  <p style="margin:0 0 6px"><a href="${link}" style="color:#0f172a;font-size:14px">Открыть заявку</a></p>
  <p style="margin:20px 0 0;font-size:12px;color:#64748b">Письмо автоматическое, отвечать на него не нужно.</p>
</div></body></html>`;
  return { subject, text, html };
}

/**
 * Отправка «в фоне»: ошибки почты не должны ронять отклик инвестора, поэтому
 * функция ничего не бросает и ничего не ждёт от вызывающего.
 */
export function sendOfferNotice(notice: OfferNotice): void {
  if (!notice.founderEmail) return;
  // Адрес пришёл из формы. Перевод строки в нём — та же подстановка чужих полей
  // письма, только со стороны получателя; такой адрес не отправляем вовсе.
  if (/[\r\n]/.test(notice.founderEmail)) {
    console.error("[StartupX] адрес основателя с переводом строки — письмо не отправлено");
    return;
  }
  const transport = getMailTransport();
  if (!transport) return; // SMTP не настроен — молча, это нормальный режим
  const { subject, text, html } = buildOfferEmail(notice);
  transport
    .sendMail({ from: MAIL_FROM, to: notice.founderEmail, subject, text, html })
    .catch((e: unknown) => console.error("[StartupX] offer notice not sent", e));
}
