/**
 * Язык подписей глобуса.
 *
 * Читалось из `aevion:locale` — ключа, в который НИКТО никогда не писал.
 * Переключатель языка сайта (I18nProvider, src/lib/i18n.tsx) сохраняет выбор
 * в `aevion_lang_v1` и в куку, а глобус про этот ключ не знал и каждый раз
 * падал в язык браузера. То есть посетитель переключал сайт на русский, а
 * названия стран на главной оставались английскими — и ошибки при этом не
 * возникало, потому что запасной путь отрабатывал штатно.
 *
 * Порядок: выбор пользователя → устаревший ключ (у кого-то мог сохраниться)
 * → язык браузера. Сайт знает 11 языков, глобус переведён на три, поэтому
 * всё, кроме ru/kk, показывается по-английски — как и было.
 *
 * Отдельный файл, а не пара функций внутри Globus3D.tsx: тест на них
 * импортировал бы весь трёхмерный компонент и падал по таймауту в полном
 * прогоне (5 с не хватает на загрузку three.js). Лечить это поднятием
 * таймаута значит оставить в наборе тест, который ждёт секунды ради двух
 * строк логики.
 */

export type GlobeLocale = "en" | "ru" | "kk";

const SITE_LANG_KEY = "aevion_lang_v1";
const LEGACY_KEY = "aevion:locale";

/** Любой код языка сайта → один из трёх, на которых есть названия стран. */
export function toGlobeLocale(raw: string | null | undefined): GlobeLocale | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.startsWith("ru")) return "ru";
  if (v.startsWith("kk") || v.startsWith("kz")) return "kk";
  // Остальные восемь языков сайта подписей стран не имеют — англ. по умолчанию.
  return "en";
}

export function detectLocale(): GlobeLocale {
  if (typeof window === "undefined") return "en";
  try {
    const chosen = toGlobeLocale(window.localStorage.getItem(SITE_LANG_KEY));
    if (chosen) return chosen;
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy === "ru" || legacy === "kk" || legacy === "en") return legacy;
  } catch {
    // приватный режим — выбора просто нет, дальше по языку браузера
  }
  return toGlobeLocale(typeof navigator !== "undefined" ? navigator.language : null) ?? "en";
}
