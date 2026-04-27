"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BillingPeriod = "monthly" | "annual";
type TierId = "free" | "pro" | "business" | "enterprise";

interface TierLimits {
  modules: number | null;
  qrightObjectsPerMonth: number | null;
  qsignOpsPerDay: number | null;
  llmTokensPerMonth: number | null;
  seats: number | null;
  supportSlaHours: number | null;
}

interface PricingTier {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  priceAnnualTotal: number | null;
  features: string[];
  limits: TierLimits;
  ctaLabel: string;
  highlight?: boolean;
}

interface ModulePrice {
  id: string;
  name: string;
  code: string;
  addonMonthly: number | null;
  includedIn: TierId[];
  availability: "live" | "beta" | "soon" | "on_request";
  oneLiner: string;
}

interface PricingBundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
  priceMonthly: number;
  savingsPercent: number;
}

interface CurrencyMeta {
  rate: number;
  symbol: string;
  label: string;
}

interface PricingPayload {
  generatedAt: string;
  currency: string;
  annualDiscountPercent: number;
  tiers: PricingTier[];
  modules: ModulePrice[];
  bundles: PricingBundle[];
  currencies: Record<CurrencyCode, CurrencyMeta>;
  notes: string[];
}

interface QuoteLine {
  kind: "tier" | "addon" | "seat" | "bundle";
  label: string;
  unitPrice: number;
  qty: number;
  total: number;
}

interface Quote {
  tierId: TierId;
  period: BillingPeriod;
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string[];
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

function formatPrice(amount: number | null, symbol: string): string {
  if (amount === null) return "По запросу";
  if (amount === 0) return "Бесплатно";
  return `${symbol}${amount.toLocaleString("ru-RU")}`;
}

function availabilityBadge(a: ModulePrice["availability"]) {
  const map: Record<ModulePrice["availability"], { bg: string; fg: string; label: string }> = {
    live: { bg: "#d1fae5", fg: "#065f46", label: "LIVE" },
    beta: { bg: "#dbeafe", fg: "#1e40af", label: "BETA" },
    soon: { bg: "#fef3c7", fg: "#92400e", label: "SOON" },
    on_request: { bg: "#e9d5ff", fg: "#6b21a8", label: "BY REQUEST" },
  };
  const m = map[a];
  return (
    <span
      style={{
        background: m.bg,
        color: m.fg,
        fontSize: 10,
        fontWeight: 800,
        padding: "2px 6px",
        borderRadius: 4,
        letterSpacing: "0.04em",
      }}
    >
      {m.label}
    </span>
  );
}

export default function PricingPage() {
  const [data, setData] = useState<PricingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Калькулятор сметы
  const [calcTier, setCalcTier] = useState<TierId>("pro");
  const [calcModules, setCalcModules] = useState<string[]>([]);
  const [calcSeats, setCalcSeats] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(apiUrl("/api/pricing"));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: PricingPayload = await r.json();
        if (!cancelled) {
          setData(j);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const symbol = data?.currencies[currency].symbol ?? "$";
  const rate = data?.currencies[currency].rate ?? 1;

  const displayPrice = (usd: number | null): string => {
    if (usd === null) return "По запросу";
    if (usd === 0) return "Бесплатно";
    const v = Math.round(usd * rate);
    return `${symbol}${v.toLocaleString("ru-RU")}`;
  };

  async function recalc() {
    setQuoting(true);
    try {
      const r = await fetch(apiUrl("/api/pricing/quote"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tierId: calcTier,
          modules: calcModules,
          seats: calcSeats,
          period,
          currency,
        }),
      });
      const j: Quote = await r.json();
      setQuote(j);
    } catch (e) {
      console.error("[pricing] quote failed", e);
    } finally {
      setQuoting(false);
    }
  }

  // Авто-пересчёт при изменении параметров
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(recalc, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcTier, calcModules, calcSeats, period, currency, data]);

  const moduleSelectable = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((m) => m.addonMonthly !== null && m.addonMonthly > 0);
  }, [data]);

  if (loading) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          Загружаем прайс...
        </div>
      </ProductPageShell>
    );
  }

  if (error || !data) {
    return (
      <ProductPageShell>
        <div
          style={{
            padding: 24,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 12,
            color: "#991b1b",
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 8 }}>Прайс недоступен</h2>
          <p style={{ margin: 0 }}>
            Не удалось загрузить /api/pricing. {error ? `Ошибка: ${error}` : ""}
          </p>
          <p style={{ margin: 0, marginTop: 8, fontSize: 13 }}>
            Проверь, что бэкенд запущен (npm run dev в aevion-globus-backend).
          </p>
        </div>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={1280}>
      {/* Hero */}
      <section style={{ textAlign: "center", padding: "40px 0 32px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          AEVION GTM · ПРАЙС-ЛИСТ
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: "-0.025em",
            margin: 0,
            marginBottom: 12,
            color: "#0f172a",
          }}
        >
          Цены AEVION
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "#475569",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          Единая платформа: цифровая собственность, AI, финтех, потребительские продукты — 27
          модулей под одним аккаунтом.
        </p>
      </section>

      {/* Period / Currency switch */}
      <section
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 4,
            gap: 4,
          }}
        >
          {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: period === p ? "#fff" : "transparent",
                color: period === p ? "#0f172a" : "#64748b",
                boxShadow: period === p ? "0 2px 6px rgba(15,23,42,0.08)" : "none",
              }}
            >
              {p === "monthly" ? "Месяц" : "Год (-16%)"}
            </button>
          ))}
        </div>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: BORDER,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {Object.entries(data.currencies).map(([code, meta]) => (
            <option key={code} value={code}>
              {meta.symbol} {code}
            </option>
          ))}
        </select>
      </section>

      {/* Tier cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 56,
        }}
      >
        {data.tiers.map((tier) => {
          const isHighlight = !!tier.highlight;
          const showPrice =
            period === "annual" ? tier.priceAnnualPerMonth : tier.priceMonthly;
          return (
            <div
              key={tier.id}
              style={{
                position: "relative",
                background: isHighlight
                  ? "linear-gradient(180deg, #0f172a, #1e293b)"
                  : "#fff",
                color: isHighlight ? "#f8fafc" : "#0f172a",
                border: isHighlight ? "none" : BORDER,
                borderRadius: 16,
                padding: 24,
                boxShadow: isHighlight ? "0 12px 40px rgba(15,23,42,0.25)" : CARD,
                transform: isHighlight ? "translateY(-4px)" : "none",
              }}
            >
              {isHighlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 16,
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    padding: "3px 10px",
                    borderRadius: 999,
                  }}
                >
                  ПОПУЛЯРНЫЙ
                </div>
              )}
              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  margin: 0,
                  marginBottom: 4,
                  letterSpacing: "-0.02em",
                }}
              >
                <Link
                  href={`/pricing/${tier.id}`}
                  style={{
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  {tier.name}
                </Link>
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: isHighlight ? "#94a3b8" : "#64748b",
                  margin: 0,
                  marginBottom: 16,
                  minHeight: 32,
                }}
              >
                {tier.tagline}
              </p>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em" }}>
                  {displayPrice(showPrice)}
                </span>
                {showPrice !== null && showPrice > 0 && (
                  <span
                    style={{
                      fontSize: 13,
                      color: isHighlight ? "#94a3b8" : "#64748b",
                      marginLeft: 4,
                    }}
                  >
                    /мес
                  </span>
                )}
                {period === "annual" && tier.priceAnnualTotal !== null && tier.priceAnnualTotal > 0 && (
                  <div style={{ fontSize: 11, color: isHighlight ? "#94a3b8" : "#64748b", marginTop: 4 }}>
                    {displayPrice(tier.priceAnnualTotal)} в год
                  </div>
                )}
              </div>
              <button
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: isHighlight
                    ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                    : tier.id === "enterprise"
                      ? "#0f172a"
                      : "#f1f5f9",
                  color: isHighlight || tier.id === "enterprise" ? "#fff" : "#0f172a",
                  marginBottom: 20,
                }}
                onClick={() => {
                  setCalcTier(tier.id);
                  document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {tier.ctaLabel}
              </button>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {tier.features.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "6px 0",
                      borderTop: isHighlight
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(15,23,42,0.05)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: isHighlight ? "#34d399" : "#0d9488", fontWeight: 800 }}>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/pricing/${tier.id}`}
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  fontSize: 12,
                  fontWeight: 700,
                  color: isHighlight ? "#5eead4" : "#0d9488",
                  textDecoration: "none",
                }}
              >
                Подробнее о {tier.name} →
              </Link>
            </div>
          );
        })}
      </section>

      {/* Bundles */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Готовые сборки
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          Несколько модулей со скидкой — берите целевой контур одной кнопкой.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {data.bundles.map((b) => (
            <div
              key={b.id}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 14,
                padding: 20,
                boxShadow: CARD,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{b.name}</h3>
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  −{b.savingsPercent}%
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, marginBottom: 12 }}>
                {b.description}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: 12,
                }}
              >
                {b.modules.map((mid) => (
                  <span
                    key={mid}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      background: "#f1f5f9",
                      color: "#475569",
                      borderRadius: 4,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {mid}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {displayPrice(b.priceMonthly)}
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}> /мес</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Module matrix */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Все модули
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          27 продуктов AEVION. Покупаются отдельно или входят в тарифы.
        </p>
        <div
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: CARD,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Модуль
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Описание
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    Статус
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#475569" }}>
                    Add-on / мес
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    Включено в
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.modules.map((m, i) => (
                  <tr
                    key={m.id}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                      {m.name}
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
                        {m.code}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569", maxWidth: 360 }}>
                      {m.oneLiner}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      {availabilityBadge(m.availability)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>
                      {m.addonMonthly === null ? (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      ) : m.addonMonthly === 0 ? (
                        <span style={{ color: "#0d9488" }}>Free</span>
                      ) : (
                        displayPrice(m.addonMonthly)
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.includedIn.length === 0 ? (
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
                        ) : (
                          m.includedIn.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 6px",
                                background: "#e0f2fe",
                                color: "#075985",
                                borderRadius: 4,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {t.toUpperCase()}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section
        id="calculator"
        style={{
          marginBottom: 56,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 20,
          padding: 32,
          color: "#f8fafc",
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Калькулятор
        </h2>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 24 }}>
          Соберите свою конфигурацию — смета пересчитывается на лету.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                ТАРИФ
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.tiers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCalcTier(t.id)}
                    style={{
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      background: calcTier === t.id ? "#0d9488" : "rgba(255,255,255,0.06)",
                      color: "#fff",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                ПОЛЬЗОВАТЕЛИ (SEATS)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={calcSeats}
                onChange={(e) => setCalcSeats(Math.max(1, parseInt(e.target.value || "1", 10)))}
                style={{
                  width: 120,
                  padding: "8px 10px",
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f8fafc",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                ДОПОЛНИТЕЛЬНЫЕ МОДУЛИ
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  maxHeight: 200,
                  overflowY: "auto",
                  padding: 6,
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 8,
                }}
              >
                {moduleSelectable.map((m) => {
                  const active = calcModules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setCalcModules((prev) =>
                          active ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: active ? "#0d9488" : "rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                    >
                      {m.code} · {symbol}
                      {Math.round((m.addonMonthly ?? 0) * rate)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Quote */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: 20,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#94a3b8",
                letterSpacing: "0.06em",
                marginBottom: 12,
              }}
            >
              СМЕТА {quoting && "· пересчёт..."}
            </div>
            {quote ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  {quote.lines.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>
                      Бесплатный тариф — оплата не требуется.
                    </div>
                  ) : (
                    quote.lines.map((l, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          fontSize: 13,
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span style={{ color: "#cbd5e1" }}>{l.label}</span>
                        <span style={{ fontWeight: 700 }}>
                          {symbol}
                          {l.total.toLocaleString("ru-RU")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {quote.discount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: "#34d399",
                      paddingBottom: 8,
                    }}
                  >
                    <span>Годовая скидка</span>
                    <span>
                      −{symbol}
                      {quote.discount.toLocaleString("ru-RU")}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
                    ИТОГО {period === "annual" ? "/ год" : "/ месяц"}
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
                    {symbol}
                    {quote.total.toLocaleString("ru-RU")}
                  </span>
                </div>
                {quote.notes.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "#fbbf24",
                    }}
                  >
                    {quote.notes.map((n, i) => (
                      <div key={i}>· {n}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Выбери параметры слева...</div>
            )}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Для вашей индустрии
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          Кейсы и рекомендованный стек для вашей вертикали.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { id: "banks", name: "Банки и финтех", grad: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
            { id: "startups", name: "Стартапы", grad: "linear-gradient(135deg, #7c3aed, #a78bfa)" },
            { id: "government", name: "Госсектор", grad: "linear-gradient(135deg, #065f46, #10b981)" },
            { id: "creators", name: "Создатели контента", grad: "linear-gradient(135deg, #be185d, #ec4899)" },
            { id: "law-firms", name: "Юр. фирмы", grad: "linear-gradient(135deg, #92400e, #f59e0b)" },
          ].map((ind) => (
            <Link
              key={ind.id}
              href={`/pricing/for/${ind.id}`}
              style={{
                padding: "20px 18px",
                background: ind.grad,
                color: "#fff",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 4px 14px rgba(15,23,42,0.1)",
              }}
            >
              <span>{ind.name}</span>
              <span style={{ fontSize: 18, opacity: 0.7 }}>→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          AEVION vs альтернативы
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          Что обычно собирают по кускам — у нас под одним аккаунтом и одной подпиской.
        </p>
        <div
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: CARD,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#475569", width: "26%" }}>
                    Что нужно
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#0d9488" }}>
                    AEVION
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    DocuSign
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    Stripe
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    OpenAI
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    Patently
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Регистрация цифровой собственности", "✓", "—", "—", "—", "✓"],
                  ["Цифровая подпись и проверка целостности", "✓", "✓", "—", "—", "—"],
                  ["AI-движок (LLM, агенты)", "✓", "—", "—", "✓", "—"],
                  ["Платёжное ядро / off-line сделки", "✓", "—", "✓", "—", "—"],
                  ["Электронное патентное бюро", "✓", "—", "—", "—", "✓"],
                  ["Карта мира и реестр объектов", "✓", "—", "—", "—", "—"],
                  ["Единая подписка на всё", "✓", "—", "—", "—", "—"],
                  ["Открытое API + OpenAPI", "✓", "✓", "✓", "✓", "—"],
                  [
                    "Сравнимая цена (Pro)",
                    "$19/мес",
                    "$25/мес",
                    "%/транз",
                    "$20/мес",
                    "$59/мес",
                  ],
                ].map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td
                        key={j}
                        style={{
                          padding: "10px 14px",
                          textAlign: "center",
                          fontWeight: cell === "✓" ? 800 : 600,
                          color:
                            j === 0 && cell === "✓"
                              ? "#0d9488"
                              : cell === "✓"
                                ? "#475569"
                                : cell === "—"
                                  ? "#cbd5e1"
                                  : "#0f172a",
                          fontSize: cell === "✓" || cell === "—" ? 16 : 12,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              padding: "10px 14px",
              fontSize: 11,
              color: "#94a3b8",
              borderTop: "1px solid rgba(15,23,42,0.05)",
              background: "#f8fafc",
            }}
          >
            Цены конкурентов — публичные тарифы базовой подписки на момент публикации; могут отличаться в вашем регионе.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Вопросы и ответы
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          Самое частое — здесь. Если нет ответа, напишите{" "}
          <a href="mailto:hello@aevion.io" style={{ color: "#0d9488", fontWeight: 700 }}>
            hello@aevion.io
          </a>
          .
        </p>
        <div>
          {[
            {
              q: "Как считается биллинг при смене тарифа?",
              a: "Пропорционально дням. При апгрейде — кредит за неиспользованное на старом тарифе автоматически зачитывается. При даунгрейде — кредит остаётся на счёте до следующего цикла.",
            },
            {
              q: "Можно ли купить только один модуль без тарифа?",
              a: "Любой add-on модуль покупается поверх Free тарифа. Получаете нужный модуль без переплаты за все остальные.",
            },
            {
              q: "Что если хочется AI Suite + IP Suite вместе?",
              a: "Берите Business — там оба контура включены без отдельных бандлов. Сэкономите ~$20/мес против покупки бандлов поверх Pro.",
            },
            {
              q: "Поддерживается ли on-premise установка?",
              a: "Только для Enterprise. Включает Docker / Kubernetes артефакты, runbook, аудит. Минимальный контракт — 12 мес.",
            },
            {
              q: "Где хранятся данные?",
              a: "По умолчанию — EU (Frankfurt) + RU/KZ зеркала для локализации. Для Enterprise — выбор региона или ваш VPC.",
            },
            {
              q: "Есть ли образовательный тариф?",
              a: "Free покрывает 95% студенческих сценариев. Для университетов и хакатонов — связывайтесь, делаем sponsorship-аккаунты.",
            },
            {
              q: "Можно ли отменить и забрать данные?",
              a: "Да. Экспорт всех ваших QRight-объектов и QSign-подписей в JSON/PDF — кнопка в личном кабинете. После отмены — 30 дней grace period, затем soft-delete с возможностью восстановления ещё 60 дней.",
            },
            {
              q: "Чем AEVION лучше связки DocuSign + OpenAI + Stripe?",
              a: "Единый аккаунт, единый биллинг, единый аудит. Одна подпись = одна запись в реестре, одна оплата — связана. Модули знают друг про друга: AI-агент видит подпись, подпись видит платёж, реестр видит всё.",
            },
          ].map((f, i) => (
            <details
              key={i}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 10,
                marginBottom: 8,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              <summary
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {f.q}
              </summary>
              <p
                style={{
                  margin: 0,
                  marginTop: 10,
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.6,
                }}
              >
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Notes / FAQ light */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 12 }}>Условия</h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "#475569",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {data.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <div style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>
          Документация API:{" "}
          <Link href="/" style={{ color: "#0d9488", fontWeight: 700 }}>
            /api/openapi.json
          </Link>
          . Прайс-эндпоинт:{" "}
          <code
            style={{
              background: "#f1f5f9",
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            GET /api/pricing
          </code>
          .
        </div>
      </section>
    </ProductPageShell>
  );
}
