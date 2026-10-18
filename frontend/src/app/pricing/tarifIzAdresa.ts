import { TERM_TIERS, type TermTier } from "@/lib/termPricing";

/**
 * 🔴 154 (18.10.2026). Тариф из адреса для калькулятора сметы.
 *
 * Продажи 18.10 на проде f857f941: «Выбрать Lite» на /pricing/lite вела на /pricing#calculator БЕЗ тарифа,
 * смета всегда показывала Medium — $1 050 за 3 месяца; покупатель Lite ($400) видел цену в 2,6 раза выше,
 * покупатель Max ($2 400) — в 2,3 раза ниже. Страницы тарифов теперь передают `?tier=<id>`, калькулятор
 * читает его при монтировании этой функцией. Незнакомое или пустое значение → null: калькулятор остаётся
 * на своём умолчании (medium), ничего не ломается.
 */
export function тарифИзАдреса(значение: string | null | undefined): TermTier | null {
  const v = (значение ?? "").trim().toLowerCase();
  return (TERM_TIERS as readonly string[]).includes(v) ? (v as TermTier) : null;
}
