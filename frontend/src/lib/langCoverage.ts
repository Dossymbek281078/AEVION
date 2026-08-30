import { LANG_KEY_COUNT, LANGS, type Lang } from "@/lib/i18n-data";

/**
 * How much of the interface each language actually covers.
 *
 * The switcher used to offer eleven languages as equals. Measured 28.07.2026,
 * three of them carry the interface — ru 7222 keys, en 7221, kk 7221 — and the
 * other eight hold 94 each, about 1%. Someone choosing German got German menus
 * and Russian everything else, with nothing on screen admitting it.
 *
 * The share comes from LANG_KEY_COUNT, which scripts/splitI18n.mjs writes from
 * the dictionaries themselves — so it still cannot be written down wrong, and
 * drawing a percentage no longer costs the page eleven dictionaries. Regenerate
 * that map when a language grows and the number in the UI rises with it.
 */

/** Keys in the fullest language — the yardstick everything else is measured by. */
function referenceSize(): number {
  return Math.max(...LANGS.map((l) => LANG_KEY_COUNT[l] ?? 0));
}

/** Share of the interface available in `lang`, from 0 to 1. */
export function coverageOf(lang: Lang): number {
  const total = referenceSize();
  if (!total) return 0;
  return (LANG_KEY_COUNT[lang] ?? 0) / total;
}

/** Rounded percent, never rounded up to a promise: 0.9% shows as 0, not 1. */
export function coveragePercent(lang: Lang): number {
  return Math.floor(coverageOf(lang) * 100);
}

/**
 * A language counts as usable when nearly all of the interface exists in it.
 * The gap in the data is stark — 100% or 1% — so the exact threshold does not
 * decide anything today; it is here so a half-finished language stops being
 * presented as finished the moment one appears.
 */
export const USABLE_THRESHOLD = 0.9;

export function isUsable(lang: Lang): boolean {
  return coverageOf(lang) >= USABLE_THRESHOLD;
}

/** Usable languages first, each group keeping the order declared in LANGS. */
export function langsByCoverage(): { usable: Lang[]; partial: Lang[] } {
  return {
    usable: LANGS.filter(isUsable),
    partial: LANGS.filter((l) => !isUsable(l)),
  };
}
