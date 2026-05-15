"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BillingPeriod = "monthly" | "annual";
type TierId = "free" | "pro" | "business" | "enterprise";

interface PricingTier {
  id: TierId;
  name: string;
  priceMonthly: number | null;
  priceAnnualPerMonth: number | null;
  highlight?: boolean;
}

interface ModulePrice {
  id: string;
  name?: string;
  code?: string;
  addonMonthly: number | null;
  includedIn: TierId[];
}

interface CurrencyMeta {
  rate: number;
  symbol: string;
}

interface PricingPayload {
  tiers: PricingTier[];
  modules: ModulePrice[];
  currencies: Record<CurrencyCode, CurrencyMeta>;
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

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.io";

export default function PricingCalculatorEmbedPage() {
  const [data, setData] = useState<PricingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<TierId>("pro");
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [seats, setSeats] = useState(1);
  const [modules, setModules] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read source from query for tracking
  const [source, setSource] = useState<string>("embed");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("source");
    if (s) setSource(`embed-${s.slice(0, 40)}`);
    track({ type: "page_view", source: `pricing/calculator/embed${s ? `?source=${s}` : ""}` });
    track({ type: "calculator_open", source: s ? `embed-${s}` : "embed" });
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/pricing"))
      .then((r) => r.json())
      .then((j: PricingPayload) => setData(j))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const symbol = data?.currencies[currency].symbol ?? "$";

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(apiUrl("/api/pricing/quote"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tierId: tier, modules, seats, period, currency }),
        });
        const j: Quote = await r.json();
        setQuote(j);
        track({ type: "calculator_quote", source, tier, value: j.total });
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, period, currency, seats, modules, data]);

  // PostMessage height для iframe-resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    function postHeight() {
      const h = containerRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent?.postMessage({ type: "aevion-calc-height", height: h }, "*");
    }
    postHeight();
    const obs = new ResizeObserver(postHeight);
    const node = containerRef.current;
    if (node) obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const moduleSelectable = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((m) => m.addonMonthly !== null && m.addonMonthly > 0);
  }, [data]);

  const snippet = `<iframe
  src="${SITE_ORIGIN}/pricing/calculator/embed?source=YOUR_SITE"
  width="100%"
  height="640"
  frameborder="0"
  style="border-radius:12px;max-width:680px;"
  title="AEVION pricing calculator"
></iframe>
<script>
  // Optional: dynamic resize
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'aevion-calc-height') {
      var iframe = document.querySelector('iframe[src*="aevion.io/pricing/calculator"]');
      if (iframe && e.data.height) iframe.style.height = (e.data.height + 20) + 'px';
    }
  });
</script>`;

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#991b1b" }}>
        Pricing API unavailable: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#64748b", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 16,
        background: "#fff",
        color: "#0f172a",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: 18,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#f8fafc",
          borderRadius: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em" }}>AEVION</div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.04em" }}>PRICING CALCULATOR</div>
            </div>
          </div>
          <a
            href={`${SITE_ORIGIN}/pricing?source=${source}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#5eead4",
              textDecoration: "none",
            }}
          >
            Открыть полностью →
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="ТАРИФ">
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {data.tiers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    style={{
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      background: tier === t.id ? "#0d9488" : "rgba(255,255,255,0.08)",
                      color: "#fff",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ПЕРИОД">
              <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: 2 }}>
                {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      background: period === p ? "#fff" : "transparent",
                      color: period === p ? "#0f172a" : "#cbd5e1",
                    }}
                  >
                    {p === "monthly" ? "Месяц" : "Год −16%"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="SEATS">
              <input
                type="number"
                min={1}
                max={1000}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value || "1", 10)))}
                style={{
                  width: 80,
                  padding: "5px 8px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f8fafc",
                }}
              />
            </Field>
            <Field label="ВАЛЮТА">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                style={{
                  padding: "5px 8px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f8fafc",
                }}
              >
                {Object.entries(data.currencies).map(([code, meta]) => (
                  <option key={code} value={code} style={{ color: "#0f172a" }}>
                    {meta.symbol} {code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="МОДУЛИ">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  maxHeight: 140,
                  overflowY: "auto",
                  padding: 4,
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 6,
                }}
              >
                {moduleSelectable.slice(0, 12).map((m) => {
                  const active = modules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setModules((prev) => (active ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                      }
                      style={{
                        padding: "3px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: active ? "#0d9488" : "rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                    >
                      {m.code ?? m.id} +{symbol}
                      {m.addonMonthly}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Quote */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              padding: 12,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8 }}>
              СМЕТА
            </div>
            {quote ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  {quote.lines.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 11 }}>Free tier — оплата не требуется</div>
                  ) : (
                    quote.lines.map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#34d399", paddingBottom: 6 }}>
                    <span>Скидка</span>
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
                    paddingTop: 8,
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.04em" }}>
                    {period === "annual" ? "ИТОГО / год" : "ИТОГО / мес"}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>
                    {symbol}
                    {quote.total.toLocaleString("ru-RU")}
                  </span>
                </div>
                {tier !== "free" && tier !== "enterprise" && (
                  <a
                    href={`${SITE_ORIGIN}/pricing?source=${source}#tier-${tier}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 10,
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 6,
                      background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                      color: "#fff",
                      textDecoration: "none",
                      textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  >
                    Купить на AEVION →
                  </a>
                )}
                {tier === "enterprise" && (
                  <a
                    href={`${SITE_ORIGIN}/pricing/contact?tier=enterprise&source=${source}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 10,
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 6,
                      background: "#0f172a",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.2)",
                      textDecoration: "none",
                      textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  >
                    Связаться с продажами →
                  </a>
                )}
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 11 }}>Загружаем…</div>
            )}
          </div>
        </div>
      </div>

      {/* Embed snippet (только когда не в iframe) */}
      <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 8 }}>
        <button
          onClick={() => setShowSnippet((s) => !s)}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#0d9488",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {showSnippet ? "Скрыть embed-код ↑" : "Получить embed-код для блога ↓"}
        </button>
      </div>
      {showSnippet && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 8,
            position: "relative",
          }}
        >
          <button
            onClick={() => {
              navigator.clipboard?.writeText(snippet).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 4,
              cursor: "pointer",
              background: copied ? "#0d9488" : "#fff",
              color: copied ? "#fff" : "#0d9488",
              border: copied ? "none" : "1px solid rgba(13,148,136,0.3)",
            }}
          >
            {copied ? "✓ Скопировано" : "Копировать"}
          </button>
          <pre
            style={{
              margin: 0,
              fontSize: 10,
              fontFamily: "ui-monospace, monospace",
              color: "#475569",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {snippet}
          </pre>
          <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8" }}>
            Замените <code>YOUR_SITE</code> на имя вашего блога — для трекинга. Скрипт ниже автоматически
            подгоняет высоту iframe под содержимое.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: "#94a3b8",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
