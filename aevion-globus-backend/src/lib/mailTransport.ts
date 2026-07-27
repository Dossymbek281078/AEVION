/**
 * Один транспорт SMTP на весь бэкенд.
 *
 * Договор по окружению тот же, что уже сложился в `planningEmail.ts` и
 * `build/email.ts`: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Те два модуля держат каждый свою копию `getTransport()` — переносить их сюда
 * из чужой зоны я не стал, но новые отправители должны брать транспорт отсюда,
 * иначе копий станет четыре.
 *
 * Без настроенного SMTP возвращается `null`: почта — не критический путь, и ни
 * одна ручка не должна падать из-за того, что письма в этом окружении не шлются.
 */

import nodemailer from "nodemailer";

export const MAIL_FROM = process.env.SMTP_FROM || "AEVION <noreply@aevion.app>";
export const FRONTEND_BASE = (process.env.FRONTEND_URL || "https://aevion.app").replace(/\/+$/, "");

export function getMailTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}
