/**
 * Provisioning после оплаты: создание subscription + welcome-email.
 *
 * Хранение подписок: data/subscriptions.jsonl (append-only).
 * Email: Resend SDK с graceful stub-fallback (как Stripe).
 *
 * В реальном AEVION провайдинг должен вызывать AccountService и
 * QRightRegistry — но эти системы в отдельном scope. Здесь —
 * GTM-уровень: запись подписки + welcome-email.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import type { TierId, BillingPeriod } from "../data/pricing";
import { computeFan } from "../data/fanDiscounts";
import { makeServiceCapture } from "../lib/sentry/platform";
import { degraded } from "../lib/degradedResponse";

const capture = makeServiceCapture("provisioning");

const SUBS_FILE = process.env.SUBSCRIPTIONS_FILE
  ? process.env.SUBSCRIPTIONS_FILE
  : join(process.cwd(), "data", "subscriptions.jsonl");

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM_EMAIL = process.env.FROM_EMAIL?.trim() || "AEVION <hello@aevion.io>";
const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

export interface Subscription {
  id: string;
  ts: string;
  email: string;
  tierId: TierId;
  period: BillingPeriod;
  seats: number;
  modules: string[];
  trialDays: number;
  /** ISO дата окончания триала или подписки */
  validUntil?: string;
  amountUsd?: number;
  promoCode?: string;
  stripeSessionId?: string;
  source?: string;
}

function ensureDir() {
  const dir = dirname(SUBS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function writeSubscription(sub: Subscription): void {
  try {
    ensureDir();
    appendFileSync(SUBS_FILE, JSON.stringify(sub) + "\n", "utf8");
  } catch (e) {
    capture(e);
    console.error("[provisioning] writeSubscription failed", e);
  }
}

/**
 * Remove every subscription record matching this email (case-insensitive)
 * from the store. Rewrites the JSONL atomically via .tmp + rename so a crash
 * mid-rewrite can't leave a half-truncated file. Returns counts of removed
 * vs. kept records. No-op (0/0) when the file doesn't exist.
 *
 * Used by the admin purge endpoint for GDPR removal and to clear test
 * records left by verify pings.
 */
export function purgeSubscriptions(email: string): { removed: number; remaining: number } {
  const target = email.trim().toLowerCase();
  if (!target) return { removed: 0, remaining: 0 };
  if (!existsSync(SUBS_FILE)) return { removed: 0, remaining: 0 };
  const lines = readFileSync(SUBS_FILE, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    try {
      const sub = JSON.parse(line) as Subscription;
      if (sub.email?.toLowerCase() === target) {
        removed += 1;
        continue;
      }
    } catch {
      // keep malformed lines — they were already in the store and we don't
      // want to silently drop unparseable data during a purge by email
    }
    kept.push(line);
  }
  const tmp = SUBS_FILE + ".tmp";
  const out = kept.length === 0 ? "" : kept.join("\n") + "\n";
  ensureDir();
  writeFileSync(tmp, out, "utf8");
  renameSync(tmp, SUBS_FILE);
  return { removed, remaining: kept.length };
}

export function countSubscriptions(): number {
  try {
    if (!existsSync(SUBS_FILE)) return 0;
    const content = readFileSync(SUBS_FILE, "utf8");
    return content.split("\n").filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

/**
 * Latest subscription record for an email (case-insensitive). The store is
 * append-only and latest-wins, so a later "free" downgrade record (written by
 * the LS subscription webhook on cancel/expire) correctly supersedes an
 * earlier paid record. Returns null if the email has no records.
 */
export function readLatestSubscription(email: string): Subscription | null {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  try {
    if (!existsSync(SUBS_FILE)) return null;
    const lines = readFileSync(SUBS_FILE, "utf8").split("\n").filter((l) => l.trim().length > 0);
    let latest: Subscription | null = null;
    for (const line of lines) {
      try {
        const sub = JSON.parse(line) as Subscription;
        if (sub.email?.toLowerCase() === target) latest = sub;
      } catch {
        // skip malformed
      }
    }
    return latest;
  } catch {
    return null;
  }
}

export interface ActivePlan {
  /** Latest subscription tier for the email, or "free" if none/expired. */
  tierId: TierId;
  validUntil: string | null;
  /** true when tierId is a paid tier AND validUntil hasn't passed. */
  active: boolean;
  source: string | null;
}

/**
 * Resolves the effective plan for an email from the subscription store.
 * Single source of truth for "what has this user paid for" — used by the
 * pricing self-service endpoint and the Constitution Pro server gate.
 */
export function getActivePlan(email: string): ActivePlan {
  const sub = readLatestSubscription(email);
  if (!sub) return { tierId: "free", validUntil: null, active: false, source: null };
  const expired = sub.validUntil ? new Date(sub.validUntil).getTime() < Date.now() : false;
  const active = sub.tierId !== "free" && !expired;
  return { tierId: sub.tierId, validUntil: sub.validUntil ?? null, active, source: sub.source ?? null };
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; mode: "real" | "stub"; id?: string; error?: string; degraded?: boolean; degradedReason?: string }> {
  if (!RESEND_KEY) {
    console.log(`[email/STUB] To: ${payload.to} | Subject: ${payload.subject}`);
    return { ok: true, mode: "stub" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      return { ok: false, mode: "real", error: j.message ?? `HTTP ${r.status}` };
    }
    if (!j.id) {
      // Resend returned 2xx but no message id — not the documented success shape.
      // Report it as ok (HTTP-level it was) but flag it so callers don't silently
      // over-count "email sent" for a payment-confirmation email that may not
      // actually have been queued.
      const { degradedReason } = degraded("Resend returned 2xx with no message id — delivery not confirmed");
      capture(new Error(`sendEmail degraded: ${degradedReason}`), { route: "provisioning/sendEmail", to: payload.to });
      return { ok: true, mode: "real", degraded: true, degradedReason };
    }
    return { ok: true, mode: "real", id: j.id };
  } catch (e) {
    capture(e);
    return { ok: false, mode: "real", error: e instanceof Error ? e.message : String(e) };
  }
}

const TIER_DISPLAY: Record<TierId, string> = {
  free: "Free",
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
  // `pro` — это ЖИВОЙ флагман «Universe» ($249.99/мес, см. TIERS в
  // data/pricing.ts), а не legacy-алиас Lite. Пока стояло "Lite", покупатель
  // самого дорогого тарифа получал письмо «Добро пожаловать в AEVION Lite».
  // Тот же класс ошибки уже правили в lib/planGate.ts 2026-07-22 (там `pro`
  // гейтился как lite и 402-ил $249.99-подписчика); здесь он остался
  // незамеченным до 2026-07-26.
  pro: "Universe",
  // legacy alias без своего тарифа: старые Gumroad/LS-подписки → all-access.
  business: "Full",
};

/**
 * Веерный блок в welcome-письме.
 *
 * Окно веера — 14 дней от покупки (data/fanDiscounts.ts), но до сих пор оно
 * жило только в UI: человек, закрывший вкладку после оплаты, о нём не узнавал,
 * и окно истекало впустую. Письмо — единственный канал, который его догонит.
 *
 * Показываем максимум 4 предложения и только реальные (discountPercent > 0).
 * Если веер пуст (нечего предложить, всё уже в тарифе) — блока нет вовсе:
 * пустое «у вас открыт веер!» без списка хуже молчания.
 *
 * Цифры считает тот же движок, что применяет скидку в чекауте, — здесь ничего
 * не пересчитывается локально, иначе письмо начнёт обещать своё.
 */
function fanBlock(sub: Subscription): { html: string; text: string } {
  let fan;
  try {
    fan = computeFan({ tierId: sub.tierId, owned: sub.modules ?? [], lastPurchaseAt: sub.ts });
  } catch (e) {
    // Письмо о состоявшейся оплате важнее веера: если расчёт упал, отправляем
    // письмо без блока, а не роняем всё письмо.
    console.error("[provisioning] fanBlock failed", e);
    return { html: "", text: "" };
  }
  if (fan.status !== "active") return { html: "", text: "" };
  const offers = fan.offers.filter((o) => o.discountPercent > 0).slice(0, 4);
  if (offers.length === 0) return { html: "", text: "" };

  const until = fan.validUntil ? new Date(fan.validUntil).toLocaleDateString("ru-RU") : "";
  const rows = offers
    .map(
      (o) =>
        `<tr>
           <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:700">${o.module}</td>
           <td style="padding:6px 0;font-size:13px;color:#94a3b8;text-align:right;text-decoration:line-through">$${o.listMonthly}</td>
           <td style="padding:6px 0 6px 10px;font-size:15px;color:#0f766e;font-weight:900;text-align:right;white-space:nowrap">$${o.priceMonthly} <span style="font-size:11px">−${o.discountPercent}%</span></td>
         </tr>`,
    )
    .join("");

  const html = `
    <div style="margin:20px 0;padding:16px;background:#f0fdfa;border:1px solid #5eead4;border-radius:10px">
      <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#0f766e;margin-bottom:6px">ВЕЕРНАЯ СКИДКА ОТКРЫТА${until ? ` ДО ${until}` : ""}</div>
      <div style="font-size:14px;color:#134e4a;line-height:1.5;margin-bottom:10px">
        Ваша покупка открыла скидку на соседние модули. Каждая следующая покупка продлевает окно и увеличивает глубину скидки.
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      <div style="margin-top:12px">
        <a href="${FRONTEND_URL}/pricing" style="font-size:13px;font-weight:800;color:#0f766e;text-decoration:none">Посмотреть весь веер →</a>
      </div>
    </div>`;

  const text =
    `\nВЕЕРНАЯ СКИДКА ОТКРЫТА${until ? ` ДО ${until}` : ""}\n` +
    offers.map((o) => `  ${o.module}: $${o.listMonthly} → $${o.priceMonthly} (−${o.discountPercent}%)`).join("\n") +
    `\n  Весь веер: ${FRONTEND_URL}/pricing\n`;

  return { html, text };
}

function welcomeHtml(sub: Subscription): string {
  const tierName = TIER_DISPLAY[sub.tierId];
  const trialBlock = sub.trialDays > 0
    ? `<div style="margin:16px 0;padding:14px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;color:#78350f">
         <strong>Триал-период активен до ${new Date(Date.now() + sub.trialDays * 86400000).toLocaleDateString("ru-RU")}.</strong>
         Карта не списывается до окончания.
       </div>`
    : "";
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(15,23,42,0.06)">
        <tr><td>
          <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#0d9488;margin-bottom:8px">AEVION · WELCOME</div>
          <h1 style="font-size:28px;font-weight:900;color:#0f172a;margin:0 0 12px;letter-spacing:-0.02em">
            Добро пожаловать в AEVION ${tierName}!
          </h1>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 16px">
            Ваша подписка активна. Можете сразу зарегистрировать первую идею в QRight, подписать документ через QSign или открыть аналитику в Globus.
          </p>
          ${trialBlock}
          ${fanBlock(sub).html}
          <p style="font-size:13px;color:#64748b;line-height:1.5;margin:16px 0">
            <strong>Что входит:</strong><br/>
            ${sub.modules.length > 0 ? sub.modules.join(" · ") : "Все 27 модулей AEVION"}
          </p>
          <div style="margin:24px 0;text-align:center">
            <a href="${FRONTEND_URL}/qright" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0d9488,#0ea5e9);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px">
              Открыть QRight
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin:0">
            ID подписки: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${sub.id}</code><br/>
            Поддержка: <a href="mailto:hello@aevion.io" style="color:#0d9488">hello@aevion.io</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeText(sub: Subscription): string {
  const tierName = TIER_DISPLAY[sub.tierId];
  const trial = sub.trialDays > 0
    ? `\nТриал-период активен до ${new Date(Date.now() + sub.trialDays * 86400000).toLocaleDateString("ru-RU")}. Карта не списывается до окончания.\n`
    : "";
  return `Добро пожаловать в AEVION ${tierName}!

Ваша подписка активна.${trial}${fanBlock(sub).text}
Что входит:
${sub.modules.length > 0 ? sub.modules.join(" · ") : "Все 27 модулей AEVION"}

Открыть QRight: ${FRONTEND_URL}/qright

ID подписки: ${sub.id}
Поддержка: hello@aevion.io
`;
}

/**
 * Главная provisioning-функция: вызывается из webhook после успешной оплаты
 * и из stub-checkout (для smoke-теста UX без реального Stripe).
 */
export async function provisionSubscription(input: {
  email: string;
  tierId: TierId;
  period?: BillingPeriod;
  seats?: number;
  modules?: string[];
  trialDays?: number;
  amountUsd?: number;
  promoCode?: string;
  stripeSessionId?: string;
  paddleTransactionId?: string;
  source?: string;
}): Promise<{ subscription: Subscription; emailSent: boolean; emailMode: "real" | "stub"; emailError?: string; emailDegraded?: boolean }> {
  const trialDays = input.trialDays ?? 0;
  const period: BillingPeriod = input.period ?? "monthly";
  const validityDays = trialDays > 0 ? trialDays : period === "annual" ? 365 : 30;

  const subscription: Subscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    email: input.email.toLowerCase(),
    tierId: input.tierId,
    period,
    seats: input.seats ?? 1,
    modules: input.modules ?? [],
    trialDays,
    validUntil: new Date(Date.now() + validityDays * 86400000).toISOString(),
    amountUsd: input.amountUsd,
    promoCode: input.promoCode,
    stripeSessionId: input.stripeSessionId,
    source: input.source,
  };

  writeSubscription(subscription);

  const subjPrefix = trialDays > 0 ? "Триал активен" : "Подписка активна";
  const result = await sendEmail({
    to: subscription.email,
    subject: `[AEVION] ${subjPrefix} · ${TIER_DISPLAY[subscription.tierId]}`,
    html: welcomeHtml(subscription),
    text: welcomeText(subscription),
  });

  return {
    subscription,
    emailSent: result.ok,
    emailMode: result.mode,
    emailError: result.error,
    emailDegraded: result.degraded,
  };
}
