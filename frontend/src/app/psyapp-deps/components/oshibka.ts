/*
 * 28.10.2026 (окно «Приложения-2»). Ошибки сервера PsyApp — человеческим текстом.
 * Прежде компоненты показывали d.error как есть: «alias_owned_by_another_user»,
 * «intensity_1_10 must be 1..10», а при обрыве сети — «Failed to fetch».
 * Здесь код сервера → ключ словаря (../i18n.ts, ru/en/kk). Неизвестный код сырым
 * не показываем: компонент берёт свой запасной ключ.
 */
import type { Key } from "../i18n";

const ПОНЯТНО: Array<[RegExp, Key]> = [
  [/^alias_owned_by_another_user$/, "err.taken"],
  [/^alias (must|invalid)/, "err.alias"],
  [/^user_not_found$/, "err.notFound"],
  [/^addiction must/, "err.addiction"],
  [/^trigger_type must/, "err.triggerType"],
  [/^intensity_1_10 must/, "err.intensity"],
  [/^message required$/, "err.message"],
  [/^invalid_json$/, "err.json"],
];

export function ключОшибки(raw: unknown, запасной: Key): Key {
  const код = typeof raw === "string" ? raw.trim() : "";
  for (const [re, ключ] of ПОНЯТНО) if (re.test(код)) return ключ;
  return запасной;
}
