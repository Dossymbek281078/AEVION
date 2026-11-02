/**
 * Письма при публикации заявки на бирже стартапов (POST /api/startupx/ideas).
 *
 * Зачем: до этого публикация проходила молча. Токен кабинета показывается
 * основателю один раз на экране; закрыл вкладку — потерял доступ к откликам
 * инвесторов (в базе лежит только хеш, восстановить нельзя). А команда не
 * узнавала о новой заявке, пока кто-то не открывал ленту.
 *
 * Два письма:
 *  1. основателю — ссылка на публичную страницу и на кабинет С токеном;
 *  2. команде (NOTIFY_EMAIL) — карточка заявки БЕЗ токена.
 *
 * Ничего не бросает и не ждёт: публикация не должна падать из-за почты.
 * Каждый неуспех — console.error с доменом получателя, без полного адреса.
 */

import { getMailTransport, MAIL_FROM, FRONTEND_BASE } from "../mailTransport";
import { send as sendViaAnyChannel, canSendEmail } from "../build/email";
import { fmt } from "./valuation";

export type PublishLang = "ru" | "en";

export interface PublishedEmailInput {
  listingId: number;
  listingTitle: string;
  manageToken: string;
  lang: PublishLang;
}

export interface TeamNoticeInput {
  listingId: number;
  listingTitle: string;
  tier?: string | null;
  sector?: string | null;
  geography?: string | null;
  intent?: string | null;
  askUsd?: number | null;
  equityPct?: number | null;
  founderEmail?: string | null;
  contactMethod?: string | null;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Перевод строки в теме — подстановка чужих полей письма; в тему он не попадает. */
function singleLine(s: string, max = 160): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

/** Язык письма по тексту заявки: есть кириллица — русский, иначе английский. */
export function detectLang(...parts: Array<string | null | undefined>): PublishLang {
  return /[А-Яа-яЁё]/.test(parts.map((p) => p ?? "").join(" ")) ? "ru" : "en";
}

export function publicListingUrl(listingId: number): string {
  return `${FRONTEND_BASE}/startup-exchange/${listingId}`;
}

/** Тот же адрес, что фронт показывает после публикации (ListingWizard.tsx). */
export function cabinetUrl(listingId: number, token: string): string {
  return `${FRONTEND_BASE}/startup-exchange/${listingId}/offers?token=${token}`;
}

/** Письмо основателю: заявка опубликована, вот ключ от кабинета. */
export function buildPublishedEmail(input: PublishedEmailInput): BuiltEmail {
  const { listingId, listingTitle, manageToken, lang } = input;
  const pub = publicListingUrl(listingId);
  const cab = cabinetUrl(listingId, manageToken);
  const ru = lang === "ru";
  const subject = singleLine(
    ru ? `Заявка опубликована: «${listingTitle}»` : `Listing published: "${listingTitle}"`,
  );
  const L = ru
    ? {
        head: "Заявка опубликована",
        lead: `Ваша заявка «${singleLine(listingTitle, 300)}» опубликована на бирже стартапов AEVION.`,
        pub: "Публичная страница заявки",
        cab: "Личный кабинет с откликами инвесторов",
        warn:
          "Эта ссылка на кабинет — единственный ключ к откликам инвесторов. " +
          "У нас хранится только её хеш, восстановить ссылку мы не сможем. Письмо стоит сохранить.",
        auto: "Письмо автоматическое, отвечать на него не нужно.",
        brand: "AEVION · Биржа стартапов",
      }
    : {
        head: "Listing published",
        lead: `Your listing "${singleLine(listingTitle, 300)}" is now live on the AEVION startup exchange.`,
        pub: "Public listing page",
        cab: "Your private dashboard with investor offers",
        warn:
          "The dashboard link is the only key to investor offers. " +
          "We store only its hash and cannot restore it, so please keep this email.",
        auto: "This is an automated message, no need to reply.",
        brand: "AEVION · Startup Exchange",
      };
  const text = [L.lead, ``, `${L.pub}: ${pub}`, `${L.cab}: ${cab}`, ``, L.warn, ``, L.auto].join("\n");
  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">${L.brand}</div>
  <h1 style="margin:14px 0 8px;font-size:20px;line-height:1.3">${L.head}</h1>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(L.lead)}</p>
  <p style="margin:0 0 8px"><a href="${escapeHtml(pub)}" style="color:#0f172a;font-size:14px">${L.pub}</a></p>
  <p style="margin:0 0 16px"><a href="${escapeHtml(cab)}" style="color:#0f172a;font-size:14px;font-weight:600">${L.cab}</a></p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#b45309">${escapeHtml(L.warn)}</p>
  <p style="margin:20px 0 0;font-size:12px;color:#64748b">${L.auto}</p>
</div></body></html>`;
  return { subject, text, html };
}

function dealLine(n: TeamNoticeInput): string {
  const parts: string[] = [];
  if (n.intent) parts.push(n.intent);
  if (n.askUsd) parts.push(`$${fmt(n.askUsd)}`);
  if (n.equityPct) parts.push(`${Number(n.equityPct.toFixed(2))}%`);
  return parts.length ? parts.join(", ") : "—";
}

/** Письмо команде: новая заявка. Токена кабинета здесь нет и быть не должно. */
export function buildTeamNoticeEmail(n: TeamNoticeInput): BuiltEmail {
  const pub = publicListingUrl(n.listingId);
  const rows: Array<[string, string]> = [
    ["Название", n.listingTitle],
    ["Уровень (tier)", n.tier || "—"],
    ["Сектор", n.sector || "—"],
    ["Гео", n.geography || "—"],
    ["Сделка", dealLine(n)],
    ["Почта основателя", n.founderEmail || "—"],
    ["Способ связи", n.contactMethod || "—"],
    ["Страница", pub],
  ];
  const subject = singleLine(`Новая заявка на бирже: ${n.listingTitle}`);
  const text = [
    `Новая заявка на бирже стартапов.`,
    ``,
    ...rows.map(([k, v]) => `${k}: ${singleLine(v, 500)}`),
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
  <h1 style="margin:0 0 14px;font-size:18px">Новая заявка на бирже</h1>
  <table style="border-collapse:collapse;font-size:14px">
${rows
  .map(
    ([k, v]) =>
      `    <tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(singleLine(v, 500))}</td></tr>`,
  )
  .join("\n")}
  </table>
  <p style="margin:16px 0 0"><a href="${escapeHtml(pub)}" style="color:#0f172a">Открыть заявку</a></p>
</div></body></html>`;
  return { subject, text, html };
}

/** Доставка одного письма: SMTP, иначе Resend; каждый неуспех называется вслух. */
function deliver(to: string, mail: BuiltEmail, label: string): void {
  if (!to) return;
  const domain = to.split("@").pop() ?? "?";
  if (/[\r\n]/.test(to)) {
    console.error(`[StartupX] ${label}: адрес с переводом строки — письмо не отправлено`);
    return;
  }
  const transport = getMailTransport();
  if (transport) {
    transport
      .sendMail({ from: MAIL_FROM, to, subject: mail.subject, text: mail.text, html: mail.html })
      .catch((e: unknown) => console.error(`[StartupX] ${label} не отправлено (SMTP), получатель @${domain}`, e));
    return;
  }
  if (!canSendEmail()) {
    console.error(`[StartupX] ${label} НЕ доставлено: ни SMTP, ни Resend не настроены. Получатель @${domain}.`);
    return;
  }
  void sendViaAnyChannel(to, mail.subject, mail.html)
    .then((ok) => {
      if (!ok) console.error(`[StartupX] ${label} НЕ доставлено запасным каналом, получатель @${domain}.`);
    })
    .catch((e: unknown) => console.error(`[StartupX] ${label} ошибка запасного канала, получатель @${domain}`, e));
}

export interface PublishNotices extends TeamNoticeInput {
  manageToken: string;
  lang: PublishLang;
  /** Проба (smoke-): команде не пишем, основателю — пишем, чтобы проверить доставку. */
  isSmoke: boolean;
  /** Адрес команды; по умолчанию NOTIFY_EMAIL. */
  teamEmail?: string;
}

/** Оба письма «в фоне». Ничего не бросает и не ждёт. */
export function sendPublishNotices(p: PublishNotices): void {
  try {
    if (p.founderEmail) {
      deliver(
        p.founderEmail,
        buildPublishedEmail({
          listingId: p.listingId,
          listingTitle: p.listingTitle,
          manageToken: p.manageToken,
          lang: p.lang,
        }),
        "письмо основателю о публикации",
      );
    }
    if (p.isSmoke) return;
    const team = (p.teamEmail ?? process.env.NOTIFY_EMAIL ?? "").trim();
    if (!team) {
      console.warn("[StartupX] NOTIFY_EMAIL не задан — команда не узнает о новой заявке на бирже");
      return;
    }
    deliver(team, buildTeamNoticeEmail(p), "письмо команде о новой заявке");
  } catch (e) {
    console.error("[StartupX] sendPublishNotices failed", e);
  }
}
