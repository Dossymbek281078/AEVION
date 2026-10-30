// Серверная половина первого кадра /auth (30.10.2026).
//
// ЗАЧЕМ. Страница /auth — клиентская и говорит словарём auth.*; I18nProvider
// стартует с "en" (так требует гидрация) и русский словарь догружает отдельным
// куском. Без этого файла первый кадр входа — денежного экрана основного,
// русского канала — был английским и перерисовывался через секунду.
//
// КАК. Макет auth/layout.tsx на сервере решает язык первого кадра
// (lib/serverLang.ts: путь → кука → Accept-Language → ru) и отдаёт странице
// ТОЛЬКО ключи auth.* этого языка (~80 строк, а не словарь целиком). Страница
// рисует их до готовности провайдера, поэтому SSR-HTML, первый кадр и гидрация
// совпадают.
//
// Этот модуль — серверный: он тянет i18n-all (все языки). Из клиентского кода
// («use client») его импортировать нельзя — сторож i18n-split это держит.
import type { Lang } from "@/lib/i18n-data";
import { translations } from "@/lib/i18n-all";

const ПРЕФИКС = "auth.";

/** Все ключи auth.* словаря `lang` (чего нет — из en, как делает t()). */
export function строкиAuth(lang: Lang): Record<string, string> {
  const en = translations.en;
  const свой = translations[lang] ?? en;
  const out: Record<string, string> = {};
  for (const k of Object.keys(en)) {
    if (k.startsWith(ПРЕФИКС)) out[k] = свой[k] ?? en[k];
  }
  return out;
}
