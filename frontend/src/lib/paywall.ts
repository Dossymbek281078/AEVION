/**
 * Paywall — shared types + fetch helpers for handling 402 upgrade_required
 * responses from the platform-wide module paywall gate (backend planGate.ts,
 * shipped in PR #434). Pairs with components/PaywallScreen.tsx for the UI.
 *
 * The 402 payload shape (from planGate.upgradeResponse):
 *   {
 *     error: "upgrade_required",
 *     module: "qcoreai",
 *     plan: "free",
 *     requiredTiers: ["medium", "full", "enterprise"],
 *     upgradeUrl: "https://aevion.app/pricing",
 *     message: "Модуль «qcoreai» доступен на тарифах: medium, full, enterprise. ..."
 *   }
 */

import { apiUrl } from "./apiBase";

export type CanonicalTier = "free" | "lite" | "medium" | "full" | "enterprise";

export interface PaywallPayload {
  error: "upgrade_required";
  module: string;
  plan: CanonicalTier;
  requiredTiers: CanonicalTier[];
  upgradeUrl: string;
  message: string;
}

export class PaywallError extends Error {
  readonly payload: PaywallPayload;
  constructor(payload: PaywallPayload) {
    super(payload.message);
    this.name = "PaywallError";
    this.payload = payload;
  }
}

function isPaywallPayload(x: unknown): x is PaywallPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.error === "upgrade_required" &&
    typeof o.module === "string" &&
    typeof o.plan === "string" &&
    Array.isArray(o.requiredTiers) &&
    typeof o.upgradeUrl === "string" &&
    typeof o.message === "string"
  );
}

/**
 * Server-side helper: fetch an API path and either return the parsed JSON,
 * or return `{ paywall: PaywallPayload }` if the gate blocked the request.
 *
 * Use in RSC pages so the page can render <PaywallScreen> instead of the
 * gated content without an exception:
 *
 *   const r = await fetchOrPaywall<MyData>("/api/qcoreai/chat");
 *   if ("paywall" in r) return <PaywallScreen payload={r.paywall} />;
 *   // ...render r.data
 *
 * ⚠️ ВАЖНО ПРО ВЫБОР РУЧКИ ДЛЯ ПРОБЫ. Ветка `"paywall" in r` срабатывает, только если
 * ОПРОШЕННАЯ ручка вернула 402. Гейт (`planGate.isExemptPath`) намеренно оставляет
 * открытыми `/health`, `/status`, `/providers`, `/me/plan`, `/me/entitlements` даже на
 * закрытом модуле — значит, проба в `/health` НИКОГДА не вернёт `{paywall}`, и стоящий
 * ниже `<PaywallScreen>` не отрисуется, сколько бы модулей ни было в `PAYWALL_MODULES`.
 *
 * Замерено 11.08.2026: с `PAYWALL_MODULES=healthai` API отдаёт 402, а страница
 * `/healthai` — 200 и обычный контент, потому что пробует `/api/healthai/health`.
 * Так сейчас у 10 из 14 страниц. Стену реально показывают три — `/qcoreai/playground`
 * (`/api/qcoreai/chat`), `/qmaskcard` (`/masks`), `/qmedia` (`/videos`); у `/veilnetx`
 * проба статически не определяется.
 *
 * Это не обязательно баг: лендинг модуля разумно оставить публичной витриной, а отказ
 * показывает глобальный `<PaywallModal>` при первом платном действии. Но если страница
 * ДОЛЖНА закрываться целиком — пробуй закрытую ручку, а не health. И не считай наличие
 * `<PaywallScreen>` в коде доказательством того, что страница закрыта.
 */
export async function fetchOrPaywall<T>(
  apiPath: string,
  init?: RequestInit,
): Promise<{ data: T } | { paywall: PaywallPayload }> {
  let res: Response;
  try {
    res = await fetch(apiUrl(apiPath), { cache: "no-store", ...init });
  } catch (err) {
    // Бэкенд недоступен целиком (ECONNREFUSED, DNS, оборванный сокет) — здесь
    // fetch не возвращает ответ, а БРОСАЕТ. Ниже разобран каждый статус, вплоть
    // до 503, с явным правилом «всё, кроме 402, — не пейволл, рендерим
    // страницу», но этот случай мимо него проходил: исключение улетало наверх и
    // сервер отдавал 500.
    //
    // Замерено 2026-08-11 на собранном приложении без бэкенда: /qrenew и
    // /longevity отдавали 500 за 60–80 мс, тогда как /apps, /shop, /go и
    // /pricing спокойно рендерились. Обе упавшие страницы продают PDF — то
    // есть при любой икоте бэкенда витрина гасла целиком, вместо того чтобы
    // показать себя без динамического блока.
    //
    // Политика та же, что и для 5xx: не гейт, данных нет, страница живёт.
    //
    // Но молча деградировать нельзя: страница отрисуется пустой, и без строки в
    // логе никто не поймёт, почему у блока пропали данные — он просто «иногда
    // пустой». `captureException` из lib/sentry здесь бесполезен, он выходит
    // сразу при `typeof window === "undefined"`, а этот хелпер серверный.
    // Поэтому console.warn: он попадает в лог Next-сервера.
    console.warn(
      `[paywall] бэкенд недоступен для ${apiPath} — страница рендерится без этих данных`,
      err,
    );
    return { data: null as unknown as T };
  }
  if (res.status === 402) {
    const body = await res.json().catch(() => null);
    if (isPaywallPayload(body)) return { paywall: body };
  }
  // Non-402 errors (401 auth-required, 404 missing endpoint, 503, etc.)
  // are treated as "not gated" — the page renders normally without a paywall.
  // Only a real 402 upgrade_required payload shows PaywallScreen.
  if (!res.ok) return { data: null as unknown as T };
  return { data: (await res.json()) as T };
}

/**
 * Client-side helper: fetch and either resolve with JSON, or throw a
 * PaywallError that the caller catches to render <PaywallScreen>.
 *
 *   try {
 *     const data = await apiFetchOrPaywall<MyData>("/api/qcoreai/...");
 *   } catch (e) {
 *     if (e instanceof PaywallError) setPaywall(e.payload);
 *     else throw e;
 *   }
 */
export async function apiFetchOrPaywall<T>(
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(apiPath), init);
  if (res.status === 402) {
    const body = await res.json().catch(() => null);
    if (isPaywallPayload(body)) throw new PaywallError(body);
  }
  if (!res.ok) {
    throw new Error(`apiFetchOrPaywall(${apiPath}) — HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const TIER_LABELS: Record<CanonicalTier, string> = {
  free: "Free",
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
};

/**
 * Подпись тарифа. Спрашиваем СВОЙ ключ, а не индексируем напрямую.
 *
 * Тип обещает `CanonicalTier`, но значение приезжает из ответа сервера и из
 * адреса, а типы во время исполнения не проверяются. У обычного объекта имя
 * `constructor` разрешается в наследство и даёт ФУНКЦИЮ, причём истинную —
 * поэтому страховка `?? t` не срабатывает, и на экран уходит
 * «function Object() { [native code] }». Ровно это 04.09.2026 показывалось
 * покупателю на экране после оплаты, в трёх местах сразу.
 *
 * Вероятность здесь ниже, чем там: сюда тарифы кладёт наш же сервер. Но
 * правка стоит одной строки, а класс за сутки нашёлся трижды.
 */
export function tierLabel(t: CanonicalTier): string {
  return Object.prototype.hasOwnProperty.call(TIER_LABELS, t) ? TIER_LABELS[t] : String(t);
}

/** Pretty tier list for display, e.g. ["full"] → "Full" (free is dropped). */
export function formatTiers(tiers: CanonicalTier[]): string {
  return tiers.filter((t) => t !== "free").map(tierLabel).join(" / ");
}

/* ───── Global fetch interceptor → window event ─────────────────────────────
 *
 * fetchOrPaywall()/apiFetchOrPaywall() above are opt-in per call (used by RSC
 * pages + PaywallScreen). To also catch 402s from modules that fetch directly,
 * we monkeypatch window.fetch ONCE so any upgrade_required answer raises a
 * window event. <PaywallModal/> (mounted once in ClientProviders) listens and
 * renders the overlay. The interceptor is transparent: it never alters the
 * response the caller receives — it only side-channels the event.
 */

export const PAYWALL_EVENT = "aevion:paywall";

/**
 * Detail of PAYWALL_EVENT — серверная полезная нагрузка плюс происхождение
 * запроса.
 *
 * `userInitiated: false` значит «запрос ушёл без жеста пользователя»: mount
 * компонента или фоновый опрос по таймеру. Различать это обязательно: у
 * /multichat-engine health-полоса опрашивала платную ручку раз в 30 секунд,
 * каждый 402 поднимал модалку заново, и гость физически не мог пользоваться
 * бесплатным демо — модалка возвращалась через полминуты после закрытия.
 */
export type PaywallEventDetail = PaywallPayload & { userInitiated?: boolean };

/**
 * Fire the global paywall event so <PaywallModal/> can surface.
 *
 * По умолчанию `userInitiated: true` — прямой вызов из кода модуля означает
 * намерение показать стену. Автоматически поднимает флаг только перехватчик.
 */
export function triggerPaywall(payload: PaywallPayload, userInitiated = true): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PaywallEventDetail>(PAYWALL_EVENT, { detail: { ...payload, userInitiated } }),
  );
}

/**
 * Был ли жест пользователя прямо сейчас.
 *
 * Снимать ОБЯЗАТЕЛЬНО до запроса: окно активации живёт несколько секунд, и к
 * моменту ответа медленного запроса обычный клик выглядел бы фоновым.
 * Нет API (Safari, Firefox) → считаем жестом: лишняя модалка лучше, чем молча
 * проглоченная платная стена.
 */
function isUserGesture(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = (navigator as Navigator & { userActivation?: { isActive?: boolean } }).userActivation;
  return typeof ua?.isActive === "boolean" ? ua.isActive : true;
}

const INSTALLED = Symbol.for("aevion.paywall.fetchPatched");

/** Monkeypatch window.fetch once. Idempotent and SSR-safe. */
export function installPaywallInterceptor(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<symbol, boolean> & { fetch: typeof fetch };
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const userInitiated = isUserGesture();
    const res = await original(input, init);
    // Only 402s are interesting; everything else passes straight through
    // untouched (no clone → no overhead, streaming responses unaffected).
    if (res.status !== 402) return res;
    try {
      const body = await res.clone().json();
      if (isPaywallPayload(body)) triggerPaywall(body, userInitiated);
    } catch {
      /* not a JSON upgrade_required body — leave it to the caller */
    }
    return res;
  };
}
