"use client";

import { useI18nOptional } from "@/lib/i18n";
import { useServerLang, языкКадра as frameLang } from "@/lib/serverLangContext";
import type { Lang } from "@/lib/i18n-data";

/**
 * Язык биржи для текущего кадра: провайдер определил язык — он; иначе язык,
 * выбранный сервером (layout.tsx кладёт его через ServerLangProvider); без
 * макета и провайдера — русский, как было до 2.11.2026.
 */
export function useSxLang(): Lang {
  return frameLang(useI18nOptional(), useServerLang(), "ru");
}
