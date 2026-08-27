/**
 * Отображаемое имя игрока — одно название ключа на всех.
 *
 * Было три названия для одной вещи, и ни одно из читающих не совпадало
 * с пишущим:
 *   пишет   matchmaking/page.tsx → "cyberchess.displayName"
 *   читает  tournaments/[id]     → "cc_display_name"        → всегда ""
 *   читает  cyberchess/page.tsx  → "aevion_user_display_name" → всегда "Anon"
 *
 * То есть игрок вводил имя в подборе соперника, а в турнирной таблице
 * оставался безымянным, на главной — «Anon». Ошибки при этом не возникало
 * ни разу: у ключа есть читатель и есть писатель, просто разные.
 *
 * Старые названия оставлены как запасные — у тех, кто играл раньше, имя
 * лежит под ними, и молча его потерять было бы хуже исходной поломки.
 */

/** Ключ, в который пишет подбор соперника. Единственный источник правды. */
export const DISPLAY_NAME_KEY = "cyberchess.displayName";

/** Названия, под которыми имя могло сохраниться в прошлых версиях. */
const LEGACY_KEYS = ["cc_display_name", "aevion_user_display_name"] as const;

/** Имя игрока или пустая строка. Читает актуальный ключ, затем старые. */
export function readDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(DISPLAY_NAME_KEY);
    if (v && v.trim()) return v.trim();
    for (const k of LEGACY_KEYS) {
      const legacy = window.localStorage.getItem(k);
      if (legacy && legacy.trim()) return legacy.trim();
    }
  } catch {
    // приватный режим — имени просто нет, это не ошибка
  }
  return "";
}
