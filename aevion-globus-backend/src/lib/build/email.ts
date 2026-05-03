/**
 * QBuild transactional emails.
 * Uses nodemailer with SMTP (works with Gmail, Yandex, any provider).
 * All sends are fire-and-forget — never block the HTTP response.
 *
 * Required env vars (all optional — emails silently skipped if missing):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Gmail example:
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587
 *   SMTP_USER=you@gmail.com   SMTP_PASS=app-password
 *   SMTP_FROM="AEVION QBuild <you@gmail.com>"
 */
import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM || "AEVION QBuild <noreply@aevion.io>";
const BASE = process.env.FRONTEND_URL?.replace(/\/+$/, "") || "https://aevion.vercel.app";

/** Fire-and-forget send — never throws. */
async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    const transport = getTransport();
    if (!transport) return; // SMTP not configured — skip silently
    await transport.sendMail({ from: FROM, to, subject, html });
  } catch (e) {
    console.warn("[build/email] send failed:", (e as Error).message);
  }
}

function layout(body: string): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0f172a; color:#e2e8f0; margin:0; padding:24px; }
  .card { max-width:520px; margin:0 auto; background:#1e293b; border-radius:16px; padding:32px; border:1px solid rgba(255,255,255,0.1); }
  .logo { font-size:13px; font-weight:800; color:#10b981; letter-spacing:0.05em; margin-bottom:24px; }
  h2 { margin:0 0 12px; font-size:20px; color:#f8fafc; }
  p { margin:0 0 16px; line-height:1.6; color:#cbd5e1; font-size:14px; }
  .btn { display:inline-block; background:#10b981; color:#052e16; font-weight:700; font-size:14px; padding:12px 24px; border-radius:10px; text-decoration:none; margin-top:8px; }
  .muted { font-size:12px; color:#475569; margin-top:24px; }
</style>
</head>
<body><div class="card">
  <div class="logo">AEVION QBuild</div>
  ${body}
  <p class="muted">Это автоматическое уведомление от AEVION QBuild. Не отвечайте на это письмо.</p>
</div></body></html>`;
}

// ── Application events ────────────────────────────────────────────────

export function sendNewApplication(opts: {
  clientEmail: string;
  clientName: string;
  workerName: string;
  vacancyTitle: string;
  projectTitle: string;
  applicationId: string;
}): void {
  void send(
    opts.clientEmail,
    `Новый отклик на «${opts.vacancyTitle}»`,
    layout(`
      <h2>Новый отклик на вашу вакансию</h2>
      <p><strong>${opts.workerName}</strong> откликнулся на вакансию <strong>${opts.vacancyTitle}</strong> в проекте <strong>${opts.projectTitle}</strong>.</p>
      <a class="btn" href="${BASE}/build">Посмотреть отклики</a>
    `),
  );
}

export function sendApplicationAccepted(opts: {
  workerEmail: string;
  workerName: string;
  vacancyTitle: string;
  projectTitle: string;
  clientName: string;
  hireOrderAmount?: number;
  hireOrderCurrency?: string;
}): void {
  const feeNote = opts.hireOrderAmount && opts.hireOrderAmount > 0
    ? `<p>Hire fee: <strong>${opts.hireOrderAmount.toLocaleString()} ${opts.hireOrderCurrency || "RUB"}</strong> — оплатите в разделе «Мои заказы».</p>`
    : "";
  void send(
    opts.workerEmail,
    `✅ Ваш отклик принят — ${opts.vacancyTitle}`,
    layout(`
      <h2>Поздравляем! Ваш отклик принят</h2>
      <p>Работодатель <strong>${opts.clientName}</strong> принял ваш отклик на вакансию <strong>${opts.vacancyTitle}</strong> в проекте <strong>${opts.projectTitle}</strong>.</p>
      ${feeNote}
      <p>Свяжитесь с работодателем через встроенный чат и уточните детали.</p>
      <a class="btn" href="${BASE}/build/profile">Мои отклики</a>
    `),
  );
}

export function sendApplicationRejected(opts: {
  workerEmail: string;
  workerName: string;
  vacancyTitle: string;
  projectTitle: string;
}): void {
  void send(
    opts.workerEmail,
    `Отклик на «${opts.vacancyTitle}» — обновление`,
    layout(`
      <h2>К сожалению, отклик не принят</h2>
      <p>Работодатель не принял ваш отклик на вакансию <strong>${opts.vacancyTitle}</strong> в проекте <strong>${opts.projectTitle}</strong>.</p>
      <p>Не расстраивайтесь — новые вакансии появляются каждый день.</p>
      <a class="btn" href="${BASE}/build/vacancies">Смотреть вакансии</a>
    `),
  );
}

// ── Messaging ─────────────────────────────────────────────────────────

export function sendNewMessage(opts: {
  receiverEmail: string;
  senderName: string;
  preview: string;
}): void {
  const shortPreview = opts.preview.slice(0, 120) + (opts.preview.length > 120 ? "…" : "");
  void send(
    opts.receiverEmail,
    `Новое сообщение от ${opts.senderName}`,
    layout(`
      <h2>У вас новое сообщение</h2>
      <p><strong>${opts.senderName}</strong> написал вам:</p>
      <blockquote style="border-left:3px solid #10b981;margin:0 0 16px;padding:8px 16px;color:#94a3b8;font-style:italic">${shortPreview}</blockquote>
      <a class="btn" href="${BASE}/build/messages">Открыть чат</a>
    `),
  );
}

// ── Trial Tasks ───────────────────────────────────────────────────────

export function sendTrialTaskProposed(opts: {
  candidateEmail: string;
  recruiterName: string;
  taskTitle: string;
  paymentAmount: number;
  currency: string;
}): void {
  void send(
    opts.candidateEmail,
    `Вам предложено тестовое задание: ${opts.taskTitle}`,
    layout(`
      <h2>Новое тестовое задание</h2>
      <p>Работодатель <strong>${opts.recruiterName}</strong> предлагает вам выполнить оплачиваемое тестовое задание:</p>
      <p style="font-size:16px;color:#f8fafc"><strong>${opts.taskTitle}</strong></p>
      ${opts.paymentAmount > 0
        ? `<p>Оплата: <strong style="color:#10b981">${opts.paymentAmount.toLocaleString()} ${opts.currency}</strong></p>`
        : "<p>Без оплаты (ознакомительное)</p>"}
      <a class="btn" href="${BASE}/build/profile">Принять или отклонить</a>
    `),
  );
}

export function sendTrialTaskApproved(opts: {
  candidateEmail: string;
  taskTitle: string;
  paymentAmount: number;
  currency: string;
}): void {
  void send(
    opts.candidateEmail,
    `✅ Тестовое задание принято — ${opts.taskTitle}`,
    layout(`
      <h2>Ваша работа принята!</h2>
      <p>Работодатель одобрил выполнение задания <strong>${opts.taskTitle}</strong>.</p>
      ${opts.paymentAmount > 0
        ? `<p>Оплата <strong style="color:#10b981">${opts.paymentAmount.toLocaleString()} ${opts.currency}</strong> будет переведена согласно договорённости.</p>`
        : ""}
      <a class="btn" href="${BASE}/build/profile">Перейти в профиль</a>
    `),
  );
}

// ── Auth emails ──────────────────────────────────────────────────────

export function sendVerificationEmail(opts: {
  to: string;
  name: string;
  token: string;
}): void {
  const link = `${BASE}/build/verify-email?token=${encodeURIComponent(opts.token)}`;
  void send(
    opts.to,
    "Подтвердите email — AEVION QBuild",
    layout(`
      <h2>Подтвердите ваш email</h2>
      <p>Привет, <strong>${opts.name}</strong>! Для активации аккаунта нажмите кнопку ниже.</p>
      <p>Ссылка действует 24 часа.</p>
      <a class="btn" href="${link}">Подтвердить email</a>
      <p style="margin-top:24px;font-size:12px;color:#64748b">
        Если кнопка не работает, скопируйте ссылку:<br>${link}
      </p>
      <p style="font-size:12px;color:#64748b">Если вы не регистрировались — проигнорируйте это письмо.</p>
    `),
  );
}

export function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  token: string;
}): void {
  const link = `${BASE}/build/reset-password?token=${encodeURIComponent(opts.token)}&email=${encodeURIComponent(opts.to)}`;
  void send(
    opts.to,
    "Сброс пароля — AEVION QBuild",
    layout(`
      <h2>Сброс пароля</h2>
      <p>Привет, <strong>${opts.name}</strong>! Кто-то запросил сброс пароля для вашего аккаунта.</p>
      <p>Нажмите кнопку ниже — ссылка действует 1 час.</p>
      <a class="btn" href="${link}">Сбросить пароль</a>
      <p style="margin-top:24px;font-size:12px;color:#64748b">
        Если кнопка не работает, скопируйте ссылку:<br>${link}
      </p>
      <p style="font-size:12px;color:#64748b">Если вы не запрашивали сброс — просто проигнорируйте это письмо. Ваш пароль не изменится.</p>
    `),
  );
}

// ── Available Now ─────────────────────────────────────────────────────

export function sendAvailabilityExpiringSoon(opts: {
  workerEmail: string;
  workerName: string;
}): void {
  void send(
    opts.workerEmail,
    "⏰ Ваш статус «Готов сейчас» истекает через 30 минут",
    layout(`
      <h2>Скоро истечёт статус «Готов сейчас»</h2>
      <p>Привет, <strong>${opts.workerName}</strong>! Ваш статус доступности истекает через 30 минут.</p>
      <p>Если вы всё ещё готовы выйти на объект — продлите статус в приложении.</p>
      <a class="btn" href="${BASE}/build/available">Продлить статус</a>
    `),
  );
}
