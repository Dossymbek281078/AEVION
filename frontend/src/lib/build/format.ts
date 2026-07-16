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
): string {
  if (!amount || amount <= 0) return "—";
  return `${currencySymbol(currency)}${amount.toLocaleString()}`;
}
