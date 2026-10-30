/**
 * Партнёрский скрипт Lemon Squeezy (30.10.2026).
 *
 * Процент партнёру LS засчитывается только если на нашем сайте стоит их скрипт
 * affiliate.js: он по `?aff=<id>` регистрирует клик на стороне LS и кладёт cookie.
 * Подключение — в layout.tsx, значения — здесь, в одном месте.
 * Документация: https://docs.lemonsqueezy.com/help/affiliates-for-merchants/getting-referrals
 */
export const LS_STORE_SLUG = "aevion";
export const LS_AFFILIATE_SCRIPT = "https://lmsqueezy.com/affiliate.js";

/**
 * ЗАМЕР 30.10.2026 (Playwright, affiliate.js v на тот день, track-ответ подменён):
 * скрипт кладёт cookie `ls_aff_ref=<click id>` (path=/, срок из ответа LS), своих
 * ключей в localStorage не заводит, глобал — `window.LemonSqueezyAffiliate` (только
 * `Track`), а `window.LemonSqueezy.Affiliate/Url` (из lemon.js) НЕ появляются.
 * Ссылки <a> на хосты LS скрипт переписывает сам: `?aff_ref=<click id>`.
 */
export const LS_AFFILIATE_COOKIE = "ls_aff_ref";

const ДОПУСТИМЫЙ_ID = /^[A-Za-z0-9_-]{1,64}$/;

type ПартнёрскийApi = {
  Affiliate?: { GetId?: () => unknown };
  Url?: { Build?: (url: string) => unknown };
};

function прочитатьCookie(): string | null {
  try {
    for (const часть of document.cookie.split(";")) {
      const п = часть.trim();
      if (п.startsWith(LS_AFFILIATE_COOKIE + "=")) return п.slice(LS_AFFILIATE_COOKIE.length + 1);
    }
  } catch {
    /* cookie недоступны (песочница) — идём к следующему источнику */
  }
  return null;
}

function идПартнёра(url: string): string | null {
  const w = window as unknown as { LemonSqueezy?: ПартнёрскийApi };
  try {
    const a = w.LemonSqueezy?.Affiliate?.GetId?.();
    if (typeof a === "string" && ДОПУСТИМЫЙ_ID.test(a)) return a;
  } catch {
    /* API чужого скрипта не должен ронять кассу */
  }
  try {
    const b = w.LemonSqueezy?.Url?.Build?.(url);
    if (typeof b === "string") {
      const v = new URL(b, "https://x.invalid").searchParams.get("aff_ref");
      if (v && ДОПУСТИМЫЙ_ID.test(v)) return v;
    }
  } catch {
    /* см. выше */
  }
  const c = прочитатьCookie();
  return c && ДОПУСТИМЫЙ_ID.test(c) ? c : null;
}

/**
 * Дописывает `aff_ref` к адресу кассы LS, если в браузере есть партнёрский клик.
 * Без партнёра, без API, для чужого хоста, при уже стоящем aff_ref/aff — адрес
 * возвращается как есть.
 *
 * Подписанный адрес (`signature=`) `aff_ref` ПРИНИМАЕТ — замер 30.10.2026 живой кассой
 * (с cookie-банкой, следуя редиректам): адрес как есть 200; + `aff_ref=clk_…` 200;
 * + `foo=bar` 403; снова как есть 200. То есть LS пропускает именно aff_ref, а прочие
 * параметры по-прежнему ломают подпись (signedCheckoutUrlIsNotAmended.test.ts).
 */
export function сКассойПартнёра(url: string): string {
  if (typeof window === "undefined") return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== "lemonsqueezy.com" && !u.hostname.endsWith(".lemonsqueezy.com")) return url;
  if (u.searchParams.has("aff_ref") || u.searchParams.has("aff")) return url;
  const id = идПартнёра(url);
  if (!id) return url;
  u.searchParams.set("aff_ref", id);
  return u.toString();
}
