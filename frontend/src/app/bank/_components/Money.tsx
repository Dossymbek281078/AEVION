"use client";

import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";

export function Money({
  aec,
  decimals,
  sign,
  compact,
  forceAec,
}: {
  aec: number;
  decimals?: number;
  sign?: boolean;
  compact?: boolean;
  forceAec?: boolean;
}) {
  const { code } = useCurrency();
  return <>{formatCurrency(aec, forceAec ? "AEC" : code, { decimals, sign, compact })}</>;
}

export function CurrencySwitcher() {
  const { code, setCode } = useCurrency();
  const opts: Array<{ key: "AEC" | "USD" | "EUR" | "KZT"; label: string }> = [
    { key: "AEC", label: "AEC" },
    { key: "USD", label: "USD" },
    { key: "EUR", label: "EUR" },
    { key: "KZT", label: "KZT" },
  ];
  return (
    <div
      role="group"
      aria-label="Display currency"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 3,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      {opts.map((o) => {
        const active = code === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setCode(o.key)}
            aria-pressed={active}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: active ? "#fff" : "transparent",
              color: active ? "#0f172a" : "rgba(255,255,255,0.85)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
