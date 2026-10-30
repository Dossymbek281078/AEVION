// Shared salary/currency formatting for QBuild.
//
// The DB stores an explicit `salaryCurrency` per vacancy (default 'RUB').
// Historically the UI hardcoded a `$` prefix everywhere, which rendered
// KZT/RUB amounts as dollars (e.g. "$3,661 RUB"). These helpers pick the
// correct symbol from the stored currency so displayed pay matches reality.

export function currencySymbol(currency?: string | null): string {
  switch ((currency || "RUB").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "KZT":
      return "₸";
    case "RUB":
    default:
      return "₽";
  }
}

/**
 * Format a salary amount with its currency symbol.
 * Returns an em-dash for missing/zero amounts (the platform's "not specified").
 */
export function formatSalary(
  amount?: number | null,
  currency?: string | null,
  lang?: string | null,
): string {
  if (!amount || amount <= 0) return "—";
  return `${currencySymbol(currency)}${amount.toLocaleString(lang ? localeOf(lang) : undefined)}`;
}

/**
 * Локаль чисел и дат по языку страницы (29.10.2026): на kk было «2026-10-29» и «$1,000»
 * (локаль браузера), на ru — «29.10.2026». Язык без своей локали → en-US.
 */
export function localeOf(lang: string | null | undefined): string {
  return lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
}
