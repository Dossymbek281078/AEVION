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

import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import type { TierId, BillingPeriod } from "../data/pricing";
import { projects } from "../data/projects";
import { makeServiceCapture } from "../lib/sentry/platform";
import { degraded } from "../lib/degradedResponse";
import { rateLimit } from "../lib/rateLimit";

const capture = makeServiceCapture("provisioning");

/**
 * Файл-хранилище подписок. Считается ПРИ КАЖДОМ обращении, а не один раз при
 * импорте, и привязан к каталогу пакета, а не к текущему каталогу процесса.
 *
 * Обе поправки закрывают один инцидент (10.08.2026). Было
 * `join(process.cwd(), "data", ...)`, вычисленное на импорте:
 *
 *  • Из-за cwd прогон тестов НЕ из каталога бэкенда писал подписки в
 *    `data/subscriptions.jsonl` в КОРНЕ репозитория. Корневой путь не покрыт
 *    `.gitignore` (там закрыт `data/subscriptions.jsonl` внутри пакета — как
 *    PII), поэтому записи попадали в коммиты: 3 строки в 0ff550de6 и ещё 6 в
 *    7b292af6e. Здесь это оказались синтетические адреса `@test.aevion.dev`,
 *    но защита от PII не должна зависеть от того, из какой папки запустили.
 *  • Из-за вычисления на импорте `SUBSCRIPTIONS_FILE`, выставленный тестом до
 *    импорта, применялся только если тест успевал импортировать модуль ПЕРВЫМ
 *    в своём воркере. Иначе тест читал и писал общий файл, накопивший записи
 *    прошлых прогонов, — и `paywallProvisionFlow` падал на «покупатель должен
 *    быть отклонён ДО покупки»: он уже был оплачен, неделю назад, чужим
 *    прогоном. Это числилось хронической нестабильностью набора.
 *
 * В проде поведение не меняется: сервис стартует из каталога пакета, то есть
 * тот же `aevion-globus-backend/data/subscriptions.jsonl`.
 */
const PACKAGE_ROOT = join(__dirname, "..", "..");

/**
 * Единственное место, где вычисляется путь к хранилищу подписок.
 *
 * Экспортируется намеренно: 30.08.2026 нашлась ВТОРАЯ реализация — ручка
 * «моя подписка» в routes/pricing.ts считала путь сама и брала за основу
 * `process.cwd()`, тогда как записи платежей идут от каталога ПАКЕТА. Совпадут
 * они или нет, зависит от того, откуда запущен процесс: запусти сервис из
 * корня репозитория — и человек, только что заплативший, спросит свою
 * подписку и получит «нет».
 *
 * Тот же класс, что копия записи прав в вебхуке: две реализации одного,
 * расходятся молча, и разницу видно только при сравнении.
 */
export function subsFile(): string {
  const fromEnv = process.env.SUBSCRIPTIONS_FILE?.trim();
  if (fromEnv) return fromEnv;
  return join(PACKAGE_ROOT, "data", "subscriptions.jsonl");
}

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
// ⚠️ 19.08.2026: запасным стоял "AEVION <hello@aevion.io>" — ЧУЖОЙ домен
// (aevion.io принадлежит другой компании с тем же названием). Переменная
// FROM_EMAIL на проде не задана, то есть письма о покупке уходили от их имени;
// /health показывал ровно это: from "AEVION <hello@aevion.io>", mode "real".
// Отправитель теперь наш. Домен нужно верифицировать в Resend — если он там
// не подтверждён, отправка отвергается, и это видно по ok:false из sendEmail.
const FROM_EMAIL = process.env.FROM_EMAIL?.trim() || "AEVION <noreply@aevion.app>";
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
  /** Кто провёл платёж: "gumroad" | "lemonsqueezy" | "stripe" и т.п. */
  source?: string;
  /**
   * Маркетинговый канал покупки — метка из ссылки (`/go?c=ig`).
   *
   * Отдельным полем, а не суффиксом к `source`: это разные оси. `source`
   * отвечает «через какую кассу прошли деньги» и по нему уже сравнивают
   * дословно (страница /revenue рисует бейдж провайдера через
   * `s.source === "gumroad"`). Подмешать туда канал значило бы сломать
   * чужой экран ради своей метки — тот же дефект, что «две оси в одной
   * таблице». Добавлено 19.08.2026.
   */
  channel?: string;
}

function ensureDir(file: string) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function writeSubscription(sub: Subscription): void {
  try {
    const file = subsFile();
    ensureDir(file);
    appendFileSync(file, JSON.stringify(sub) + "\n", "utf8");
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
  const file = subsFile();
  if (!existsSync(file)) return { removed: 0, remaining: 0 };
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
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
  const tmp = file + ".tmp";
  const out = kept.length === 0 ? "" : kept.join("\n") + "\n";
  ensureDir(file);
  writeFileSync(tmp, out, "utf8");
  renameSync(tmp, file);
  return { removed, remaining: kept.length };
}

export function countSubscriptions(): number {
  try {
    const file = subsFile();
    if (!existsSync(file)) return 0;
    const content = readFileSync(file, "utf8");
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
/**
 * Не удалось ПРОЧИТАТЬ хранилище подписок — в отличие от «записей нет».
 *
 * Разные вещи, а отвечали одинаково: и то и другое давало `null`, а выше по
 * стеку превращалось в «tierId: free». То есть при пропаже или порче файла
 * каждый заплативший тихо становился бесплатным, и снаружи это неотличимо от
 * «человек не платил»: ни строки в журнале, ни признака в ответе.
 *
 * Три исхода вместо двух (правило из разбора сторожей 18.08):
 *   файла нет вовсе      — честный ноль, до первой покупки он законно отсутствует;
 *   файл прочитан        — настоящее значение;
 *   файл есть, но не читается — НЕ ЗНАЮ, и об этом должно быть слышно.
 *
 * Поведение намеренно НЕ меняется: отказ чтения по-прежнему не роняет запрос и
 * даёт «free». Меняется одно — он перестаёт быть невидимым.
 */
let warnedUnreadableStore = false;

/** Видел ли процесс нечитаемое хранилище подписок. Для ручек состояния. */
export function subscriptionStoreUnreadable(): boolean {
  return warnedUnreadableStore;
}

/** Только для тестов: вернуть признак в исходное состояние. */
export function resetSubscriptionStoreWarning(): void {
  warnedUnreadableStore = false;
}

export function readLatestSubscription(email: string): Subscription | null {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const file = subsFile();
  // Отсутствие файла — законный ноль: до первой покупки его нет. Шуметь тут
  // нельзя, иначе журнал забьётся на пустой системе и предупреждение ниже
  // потеряется среди него.
  if (!existsSync(file)) return null;
  try {
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
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
  } catch (err) {
    // Файл ЕСТЬ, а прочитать не вышло: права, порча, диск. Один раз на процесс —
    // на каждый вызов кричать незачем, а один громкий след обязателен: без него
    // «все стали бесплатными» выглядит как обычный день.
    if (!warnedUnreadableStore) {
      warnedUnreadableStore = true;
      console.error(
        `[provisioning] хранилище подписок НЕ ЧИТАЕТСЯ (${file}): ${
          err instanceof Error ? err.message : String(err)
        }. Пока так, каждый заплативший отвечает как бесплатный.`,
      );
    }
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

/**
 * Состояние отправки писем — для `/api/health`, без секретов.
 *
 * Зачем. Без `RESEND_API_KEY` функция ниже возвращает `{ok: true, mode:"stub"}`
 * и просто пишет в лог: провижининг «успешен», а покупатель не получает от нас
 * НИЧЕГО — ни что он купил, ни как этим пользоваться. Снаружи это неотличимо
 * от исправной отправки: тот же 200, та же запись в журнале подписок.
 *
 * Отдаём только признак и адрес отправителя (он и так виден в любом письме).
 * Ключ не покидает процесс.
 */
export function emailSenderStatus(): { configured: boolean; from: string; mode: "real" | "stub" } {
  return { configured: Boolean(RESEND_KEY), from: FROM_EMAIL, mode: RESEND_KEY ? "real" : "stub" };
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

/**
 * Сколько модулей мы реально отдаём — СЧИТАЕТСЯ из реестра, не пишется рукой.
 *
 * В письме покупателю стояло «Все 27 модулей AEVION». Число пришло из
 * документации апреля 2026 и с тех пор устарело: в `data/projects.ts` сейчас
 * 41 запись, из них 36 со статусом live. То есть письмо, которое человек
 * получает СРАЗУ ПОСЛЕ ОПЛАТЫ, занижало продукт на девять живых модулей.
 *
 * Занижение опаснее завышения ровно тем, что его никто не поймает: на
 * завышение приходит жалоба, на заниженное обещание — тишина.
 */
export const LIVE_MODULE_COUNT = projects.filter((p) => String(p.status) === "live").length;

/**
 * Что написать в блоке «Что входит».
 *
 * Пустой `modules` значит РАЗНОЕ у разных тарифов, и прежний текст этого не
 * различал: у `full` пустой список это «всё», а у `lite` — «модуль ещё не
 * выбран». Подписчику Lite уходило «Все N модулей», то есть обещание,
 * которого его тариф не даёт.
 */
export function includedLine(sub: Subscription): string {
  if (sub.modules.length > 0) return sub.modules.join(" · ");
  if (sub.tierId === "lite") {
    return "Один модуль на ваш выбор — выберите его в кабинете";
  }
  if (sub.tierId === "free") return "Бесплатный доступ к открытым модулям";
  return `Все модули AEVION (сейчас ${LIVE_MODULE_COUNT} в работе)`;
}

/**
 * Куда вести из письма.
 *
 * Раньше здесь был зашитый QRight — и кнопку «Открыть QRight» получал каждый,
 * включая того, кто только что купил CyberChess. Ведём в купленный модуль,
 * когда он один и известен, иначе в кабинет, где человек видит свою подписку.
 */
export function ctaFor(sub: Subscription): { href: string; label: string } {
  if (sub.modules.length === 1 && isKnownModule(sub.modules[0])) {
    return { href: `/${sub.modules[0]}`, label: "Открыть модуль" };
  }
  return { href: "/account", label: "Открыть кабинет" };
}

/**
 * Слаг модуля — из реестра, а не «любая строка».
 *
 * Нашёл вычиткой СВОЕЙ ЖЕ правки, зелёные тесты этого не показывали. У тарифа
 * Lite покупатель выбирает один продукт, и слаг приезжает так:
 *
 *   webhook -> payload.meta.custom_data.module -> sub.modules[0] -> ссылка
 *
 * Подпись вебхука доказывает, что данные пришли от Lemon Squeezy, но НЕ то,
 * что значение осмысленно: адрес чекаута с `checkout[custom][module]=…`
 * собирается на стороне покупателя. То есть в письмо попадала бы любая
 * строка, а мой же `href="${FRONTEND_URL}/${slug}"` превращал бы её в ссылку —
 * `//чужой-сайт` увёл бы человека наружу прямо из нашего письма о покупке.
 *
 * Сверяем с реестром: неизвестный слаг ведёт в кабинет, где человек видит,
 * что у него на самом деле есть. Ссылка в письме о покупке обязана вести
 * туда, куда мы намеревались, а не туда, что прислали.
 */
function isKnownModule(slug: string): boolean {
  if (typeof slug !== "string" || slug.length === 0) return false;
  return projects.some((p) => String((p as { id?: unknown }).id ?? "") === slug);
}

const TIER_DISPLAY: Record<TierId, string> = {
  free: "Free",
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
  // `pro` is NOT a legacy alias — it is the live Universe tier ($249.99 in
  // data/pricing.ts), and lib/planGate.ts normalizes it to `full` access.
  // This map still called it "Lite", so someone who had just paid for Universe
  // got a welcome email headlined "Добро пожаловать в AEVION Lite". Same
  // mistaken assumption that once gated a Universe customer at Lite access
  // (fixed in planGate on 2026-07-22); this was the last copy of it.
  pro: "Universe",
  // business — genuinely deprecated, kept so old Gumroad webhooks resolve.
  business: "Full",
};


/**
 * Экранирование для HTML-версии письма.
 *
 * В блок «Что входит» попадает слаг модуля из `custom_data` чекаута, то есть
 * строка, которую собрал покупатель. В текстовой версии это безвредно, а в
 * HTML — вставка в разметку письма, которое мы же и отправляем. Экранируем в
 * МЕСТЕ ВСТАВКИ, а не внутри includedLine: тогда текстовая версия остаётся
 * читаемой, без &amp; вместо амперсанда.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function welcomeHtml(sub: Subscription): string {
  const tierName = TIER_DISPLAY[sub.tierId];
  const cta = ctaFor(sub);
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
            ${escapeHtml(includedLine(sub))}
          </p>
          <div style="margin:24px 0;text-align:center">
            <a href="${FRONTEND_URL}${cta.href}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0d9488,#0ea5e9);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px">
              ${cta.label}
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
${includedLine(sub)}

${ctaFor(sub).label}: ${FRONTEND_URL}${ctaFor(sub).href}

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
  paddleTransactionId?: string;
  source?: string;
  channel?: string;
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
    channel: input.channel,
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

/* ── Ручки провижининга ────────────────────────────────────────────────────
 *
 * Возвращены 12.08.2026. Они были сделаны 14.05 вместе со страницей
 * `/pricing/provisioning`, а 15.05 коммит `e0f5a2327` — тот самый, чьей целью
 * было ВЕРНУТЬ два роутера, потерянных при squash-мерже, — заодно снял импорт
 * и монтирование этого:
 *     -import { provisioningRouter } from "./routes/provisioning";
 *     -app.use("/api/pricing/provisioning", provisioningRouter);
 *
 * Три месяца страница открывалась на проде (200) и молча ничего не показывала:
 * обе ручки, которые она зовёт, отдавали 404. Ошибки на экране нет, поэтому
 * никто и не заметил. Описание в openapi при этом продолжало их рекламировать.
 *
 * Что изменено против оригинала — намеренно, а не по невнимательности:
 *   - путь к хранилищу берётся из `subsFile()`, а не из константы `SUBS_FILE`:
 *     файл стал функцией, чтобы тесты могли подменить его через env;
 *   - `byTier` перечисляет ВСЕ семь текущих тарифов. В оригинале их было
 *     четыре (free/pro/business/enterprise) — с тех пор появились lite, medium
 *     и full. Дословный перенос дал бы сводку, молча теряющую три тарифа;
 *     `Record<TierId, number>` этого бы не простил, и tsc поймал бы, но
 *     проговариваю, потому что молчаливая потеря строки в отчёте о деньгах —
 *     ровно тот класс дефектов, ради которого страница и нужна.
 */

/** Все подписки с диска (JSONL → массив), новые первыми. Мусорные строки молча
 *  пропускаются: одна битая запись не должна прятать остальные. */
export function readSubscriptions(filter?: { email?: string; tierId?: TierId }): Subscription[] {
  const file = subsFile();
  if (!existsSync(file)) return [];
  let content: string;
  try {
    content = readFileSync(file, "utf8");
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
      // битая строка — пропускаем
    }
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return out;
}

/** Сводка для страницы и для наблюдения: сколько всего, по тарифам, за 7 дней. */
export function aggregateSubscriptions(): {
  total: number;
  byTier: Record<TierId, number>;
  last7d: number;
  trialsActive: number;
  recent: Array<{ id: string; ts: string; tierId: TierId; period: BillingPeriod; trial: boolean }>;
} {
  const all = readSubscriptions();
  // Все семь тарифов перечислены явно: пропущенный ключ дал бы NaN в сводке.
  const byTier: Record<TierId, number> = {
    free: 0, lite: 0, medium: 0, full: 0, enterprise: 0, pro: 0, business: 0,
  };
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

/** `joh***@example.com` — email наружу не отдаём целиком даже в своём кабинете. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  if (user.length <= 3) return `${user[0] ?? "*"}***@${domain}`;
  return `${user.slice(0, 3)}***@${domain}`;
}

export const provisioningRouter = Router();

/**
 * GET /api/pricing/provisioning/subscriptions/by-channel?hours=720
 *
 * Сколько денег ФАКТИЧЕСКИ пришло по каждому каналу привлечения.
 *
 * ЗАЧЕМ. Панель выручки до сих пор считает сумму из АДРЕСА ВОЗВРАТА — нашу
 * ожидаемую, а не списанную. Пока сверки не было, разница выглядела
 * теоретической; 01.09.2026 выяснилось, что кассы не смотрели на сумму вовсе, и
 * заплатить могли не столько, сколько обещала страница. Фактическая сумма
 * теперь пишется в запись подписки, эта ручка её складывает.
 *
 * ФОРМА ОТВЕТА ЗАДАНА ЧИТАТЕЛЕМ — окном, которое строит панель. Так поле не
 * окажется тем, что удобно отдать, вместо того, что нужно показать. Доводы
 * читателя, каждый со своей ценой ошибки:
 *
 *   amountUsdSum считается ТОЛЬКО по записям с суммой, и рядом обязателен
 *   withAmount — иначе частичная сумма прочтётся как полная выручка;
 *
 *   withChannel отдаётся ОТДЕЛЬНО от withAmount: у PayBox в адрес возврата
 *   уходит ссылка, а не сумма, а канал может быть неизвестен у другой покупки.
 *   Это разные пробелы, и одно число их смешает;
 *
 *   записи без канала идут в ключ "direct", а не выбрасываются: иначе сумма по
 *   каналам не сойдётся с общей и это будет выглядеть потерей денег;
 *
 *   ноль не выдумывается нигде — покупка без суммы в amountUsdSum просто не
 *   участвует, а не добавляет 0.
 *
 * ⚠️ ОТКАЗ В ЗАКРЫТУЮ, и это отличие от соседних админ-ручек намеренное. В
 * events.ts проверка вида `if (required) {...}` оставляет ручку ОТКРЫТОЙ, когда
 * ADMIN_TOKEN не задан. Для счётчиков событий это терпимо; здесь нет: у нас уже
 * был случай, когда /api/metrics оказался открыт на проде ровно потому, что
 * переменную не задали. Незаданный токен значит «закрыто», а не «свободно».
 *
 * ПЕРСОНАЛЬНЫХ ДАННЫХ НЕТ: только агрегаты. Адреса покупателей не уходят наружу
 * даже под админ-токеном — для вопроса «что окупилось» они не нужны, а утечь
 * могут.
 */
provisioningRouter.get("/subscriptions/by-channel", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(503).json({
      error: "admin_token_not_configured",
      hint: "ADMIN_TOKEN не задан — ручка закрыта намеренно: здесь деньги, а не счётчики",
    });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) return res.status(401).json({ error: "unauthorized" });

  const hoursRaw = Number(req.query.hours);
  // Мусор в параметре не должен становиться пустым окном: NaN проходит сквозь
  // Math.min/Math.max и молча обнуляет выборку. Умолчание — 30 суток.
  const windowHours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 24 * 365) : 720;
  const since = Date.now() - windowHours * 3600_000;

  const subs = readSubscriptions().filter((s) => {
    const t = Date.parse(s.ts);
    return Number.isFinite(t) && t >= since;
  });

  const byChannel: Record<string, { count: number; amountUsdSum: number; withAmount: number }> = {};
  for (const s of subs) {
    const key = s.channel?.trim() || "direct";
    const row = (byChannel[key] ??= { count: 0, amountUsdSum: 0, withAmount: 0 });
    row.count += 1;
    if (typeof s.amountUsd === "number" && Number.isFinite(s.amountUsd)) {
      row.withAmount += 1;
      row.amountUsdSum = Math.round((row.amountUsdSum + s.amountUsd) * 100) / 100;
    }
  }

  return res.json({
    byChannel,
    total: subs.length,
    withAmount: subs.filter((s) => typeof s.amountUsd === "number" && Number.isFinite(s.amountUsd)).length,
    withChannel: subs.filter((s) => Boolean(s.channel?.trim())).length,
    windowHours,
  });
});

const HISTORY_LIMIT = 100;

provisioningRouter.get("/healthz", (_req, res) => {
  const file = subsFile();
  res.json({
    ok: true,
    storage: file,
    storageExists: existsSync(file),
    emailMode: RESEND_KEY ? "real" : "stub",
  });
});

provisioningRouter.get("/stats", (_req, res) => {
  try {
    res.json(aggregateSubscriptions());
  } catch (e) {
    console.error("[provisioning/stats] failed", e);
    res.status(500).json({ error: "stats_failed" });
  }
});


/**
 * Ограничитель на публичный поиск подписки по адресу.
 *
 * Ручка `/history` намеренно открыта: страница /pricing/provisioning даёт
 * человеку посмотреть свою подписку без входа. Цена этого решения в том, что
 * тем же запросом можно спросить про ЧУЖОЙ адрес и увидеть тариф, сумму
 * оплаты, промокод и модули (замер 28.08.2026 на проде: 200 без токена).
 *
 * Требовать вход здесь — значит убрать работающую функцию, и это решение
 * основателя, а не моё. Что можно сделать, ничего не ломая: сделать НЕВОЗМОЖНЫМ
 * перебор. Свой человек смотрит свою подписку раз-другой; тому, кто проверяет
 * список адресов, нужны тысячи запросов.
 *
 * keyPrefix задан явно: без него шесть вызовов этого помощника делили один
 * счётчик, и каждый сравнивал общую сумму со своим пределом.
 */
const historyLookupLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "provisioning-history-lookup",
  message: "Слишком много запросов. Подождите минуту и попробуйте снова.",
});

provisioningRouter.get("/history", historyLookupLimiter, (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.trim();
    if (!email) return res.status(400).json({ error: "missing_email", hint: "use ?email=..." });
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
      const status = !active
        ? "expired"
        : s.trialDays > 0 && validTs && validTs >= now
          ? "trial"
          : "active";
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
