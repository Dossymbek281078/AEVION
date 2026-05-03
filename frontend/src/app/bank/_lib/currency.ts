// Display currency conversion. Inputs stay AEC (backend native);
// only display values flow through formatCurrency.
//
// TODO backend: GET /api/qtrade/rates returning live { AEC: 1, USD, EUR, KZT, ... }.
// Until then, fixed demo rates below — calibrated so AEC feels like a "small but tradeable"
// unit: 1 AEC ≈ $0.45 ≈ €0.42 ≈ 215 ₸.

const STORAGE_KEY = "aevion_bank_display_currency_v1";

export type CurrencyCode = "AEC" | "USD" | "EUR" | "KZT";

export const CURRENCIES: CurrencyCode[] = ["AEC", "USD", "EUR", "KZT"];

const RATES: Record<CurrencyCode, number> = {
  AEC: 1,
  USD: 0.45,
  EUR: 0.42,
  KZT: 215,
};

const DEFAULT_DECIMALS: Record<CurrencyCode, number> = {
  AEC: 2,
  USD: 2,
  EUR: 2,
  KZT: 0,
};

export function isCurrencyCode(x: unknown): x is CurrencyCode {
  return typeof x === "string" && (CURRENCIES as string[]).includes(x);
}

export function loadCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "AEC";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isCurrencyCode(v)) return v;
  } catch {
    // ignore
  }
  return "AEC";
}

export function saveCurrency(c: CurrencyCode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, c);
  } catch {
    // ignore
  }
}

export function convertFromAec(aec: number, code: CurrencyCode): number {
  return aec * RATES[code];
}

export function formatCurrency(
  aec: number,
  code: CurrencyCode,
  opts?: { decimals?: number; sign?: boolean; compact?: boolean },
): string {
  const value = convertFromAec(aec, code);
  const decimals = opts?.decimals ?? DEFAULT_DECIMALS[code];
  const formatted = opts?.compact && Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  const signPrefix = opts?.sign && aec > 0 ? "+" : "";
  switch (code) {
    case "USD":
      return `${signPrefix}$${formatted}`;
    case "EUR":
      return `${signPrefix}€${formatted}`;
    case "KZT":
      return `${signPrefix}${formatted} ₸`;
    default:
      return `${signPrefix}${formatted} AEC`;
  }
}
