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

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { Router } from "express";
import type { TierId, BillingPeriod } from "../data/pricing";

const SUBS_FILE = process.env.SUBSCRIPTIONS_FILE
  ? process.env.SUBSCRIPTIONS_FILE
  : join(process.cwd(), "data", "subscriptions.jsonl");

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
const FROM_EMAIL = process.env.FROM_EMAIL?.trim() || "AEVION <hello@aevion.app>";
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
    console.error("[provisioning] writeSubscription failed", e);
  }
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
 * Прочитать все подписки с диска (JSONL → массив). Тихо игнорируем мусорные строки.
 * Возвращает результат, отсортированный по убыванию ts (сначала новые).
 */
export function readSubscriptions(filter?: { email?: string; tierId?: TierId }): Subscription[] {
  if (!existsSync(SUBS_FILE)) return [];
  let content: string;
  try {
    content = readFileSync(SUBS_FILE, "utf8");
  } catch {
    return [];
  }
  const out: Subscription[] = [];
  const wantEmail = filter?.email?.toLowerCase().trim();
  const wantTier = filter?.tierId;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const sub = JSON.parse(line) as Subscription;
      if (wantEmail && sub.email?.toLowerCase() !== wantEmail) continue;
      if (wantTier && sub.tierId !== wantTier) continue;
      out.push(sub);
    } catch {
      // skip malformed line
    }
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return out;
}

/** Аггрегаты для observability/admin: total + by tier + last 7 days + sample. */
export function aggregateSubscriptions(): {
  total: number;
  byTier: Record<TierId, number>;
  last7d: number;
  trialsActive: number;
  recent: Array<{ id: string; ts: string; tierId: TierId; period: BillingPeriod; trial: boolean }>;
} {
  const all = readSubscriptions();
  const byTier: Record<TierId, number> = { free: 0, pro: 0, business: 0, enterprise: 0 };
  const cutoff7 = Date.now() - 7 * 86400000;
  const now = Date.now();
  let last7d = 0;
  let trialsActive = 0;
  for (const s of all) {
    byTier[s.tierId] = (byTier[s.tierId] ?? 0) + 1;
    const t = Date.parse(s.ts);
    if (!Number.isNaN(t) && t >= cutoff7) last7d++;
    if (s.trialDays > 0 && s.validUntil) {
      const v = Date.parse(s.validUntil);
      if (!Number.isNaN(v) && v >= now) trialsActive++;
    }
  }
  const recent = all.slice(0, 10).map((s) => ({
    id: s.id,
    ts: s.ts,
    tierId: s.tierId,
    period: s.period,
    trial: s.trialDays > 0,
  }));
  return { total: all.length, byTier, last7d, trialsActive, recent };
}

/** Маскируем email для публичного отображения: `joh***@example.com`. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  if (user.length <= 3) return `${user[0] ?? "*"}***@${domain}`;
  return `${user.slice(0, 3)}***@${domain}`;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; mode: "real" | "stub"; id?: string; error?: string }> {
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
    return { ok: true, mode: "real", id: j.id };
  } catch (e) {
    return { ok: false, mode: "real", error: e instanceof Error ? e.message : String(e) };
  }
}

const TIER_DISPLAY: Record<TierId, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

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
            Поддержка: <a href="mailto:hello@aevion.app" style="color:#0d9488">hello@aevion.app</a>
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

Ваша подписка активна.${trial}
Что входит:
${sub.modules.length > 0 ? sub.modules.join(" · ") : "Все 27 модулей AEVION"}

Открыть QRight: ${FRONTEND_URL}/qright

ID подписки: ${sub.id}
Поддержка: hello@aevion.app
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
  source?: string;
}): Promise<{ subscription: Subscription; emailSent: boolean; emailMode: "real" | "stub"; emailError?: string }> {
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
  };
}

/**
 * Router публичных эндпоинтов provisioning'а.
 * Монтируется в index.ts под /api/pricing/provisioning.
 *
 * История подписок (по email) — нужна:
 *   - UI «мой кабинет» после оплаты (понять, что подписка реально записалась);
 *   - саппорту — быстрый lookup без доступа к БД;
 *   - smoke-тестам после stub-checkout.
 *
 * Защита: PII (email) обязан совпадать в query, иначе только агрегаты без id/email.
 * История ограничена 100 последними записями (защита от слишком длинного JSONL).
 */
export const provisioningRouter = Router();

const HISTORY_LIMIT = 100;

provisioningRouter.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    storage: SUBS_FILE,
    storageExists: existsSync(SUBS_FILE),
    emailMode: RESEND_KEY ? "real" : "stub",
  });
});

provisioningRouter.get("/stats", (_req, res) => {
  try {
    const agg = aggregateSubscriptions();
    res.json(agg);
  } catch (e) {
    console.error("[provisioning/stats] failed", e);
    res.status(500).json({ error: "stats_failed" });
  }
});

provisioningRouter.get("/history", (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.trim();
    if (!email) {
      return res.status(400).json({ error: "missing_email", hint: "use ?email=..." });
    }
    // Очень базовая валидация: должен содержать @ и хотя бы 5 символов.
    if (!email.includes("@") || email.length < 5) {
      return res.status(400).json({ error: "invalid_email" });
    }
    const items = readSubscriptions({ email }).slice(0, HISTORY_LIMIT);
    const now = Date.now();
    const enriched = items.map((s) => {
      const validTs = s.validUntil ? Date.parse(s.validUntil) : null;
      const daysLeft =
        validTs && !Number.isNaN(validTs) ? Math.max(0, Math.ceil((validTs - now) / 86400000)) : null;
      const active = validTs ? validTs >= now : true;
      const status =
        !active ? "expired" : s.trialDays > 0 && validTs && validTs >= now ? "trial" : "active";
      return {
        id: s.id,
        ts: s.ts,
        tierId: s.tierId,
        period: s.period,
        seats: s.seats,
        modules: s.modules,
        trialDays: s.trialDays,
        validUntil: s.validUntil ?? null,
        amountUsd: s.amountUsd ?? null,
        promoCode: s.promoCode ?? null,
        source: s.source ?? null,
        // НЕ возвращаем stripeSessionId по умолчанию — пусть это будет admin-only.
        daysLeft,
        status,
        emailMasked: maskEmail(s.email),
      };
    });
    res.json({
      email: maskEmail(email),
      count: enriched.length,
      truncated: items.length >= HISTORY_LIMIT,
      items: enriched,
    });
  } catch (e) {
    console.error("[provisioning/history] failed", e);
    res.status(500).json({ error: "history_failed" });
  }
});
