"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

// Showcases the new 3-tier monetization design (Solo + Bundles + All-Access)
// from the live /api/aevion/pricing endpoint. Sits above the legacy Paddle
// tiers (Free/Pro/Business/Enterprise) until Phase 3, when Paddle products
// for the new structure are provisioned and the legacy tiers retire.

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type ComputeTier = "light" | "standard" | "heavy";
type BundleId = "fintech" | "build" | "ai" | "gaming";

interface SoloPrice {
  id: string;
  computeTier: ComputeTier;
  bundle: BundleId | null;
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
}

interface BundlePrice {
  id: BundleId;
  modules: string[];
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
  saveVsSolo: Record<CurrencyCode, number>;
}

interface AllAccessPrice {
  modules: number;
  monthly: Record<CurrencyCode, number>;
  annualPerMonth: Record<CurrencyCode, number>;
  saveVsAllSolo: Record<CurrencyCode, number>;
}

interface PricingResponse {
  solo: SoloPrice[];
  bundles: BundlePrice[];
  allAccess: AllAccessPrice;
  currencyRatesAt: string;
}

const SYMBOL: Record<CurrencyCode, string> = { USD: "$", EUR: "€", KZT: "₸", RUB: "₽" };

const BUNDLE_NAME: Record<BundleId, string> = {
  fintech: "Fintech",
  build: "Build & IP",
  ai: "AI",
  gaming: "Gaming & UX",
};

const BUNDLE_DESC: Record<BundleId, string> = {
  fintech: "QPayNet, QMaskCard, VeilNetX, Z-Tide, QChainGov, QGood",
  build: "QBuild, QSign, QRight, IP Bureau, QContract",
  ai: "QCoreAI, Multichat, QFusionAI, QPersona, HealthAI",
  gaming: "CyberChess, QLearn, QLife, QEvents, Kids-AI",
};

const BUNDLE_COLOR: Record<BundleId, string> = {
  fintech: "#10b981",
  build: "#6366f1",
  ai: "#a855f7",
  gaming: "#f59e0b",
};

function fmt(n: number, c: CurrencyCode): string {
  if (c === "USD" || c === "EUR") return `${SYMBOL[c]}${n}`;
  return `${n.toLocaleString("ru-RU")} ${SYMBOL[c]}`;
}

interface Props {
  currency: CurrencyCode;
  billingPeriod: "monthly" | "annual";
}

export default function NewStructureShowcase({ currency, billingPeriod }: Props) {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/aevion/pricing"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: PricingResponse) => {
        if (!cancelled) setData(j);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <section style={{ marginBottom: 32, padding: "16px 20px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#991b1b", fontSize: 13 }}>
        Failed to load /api/aevion/pricing: {err}. Showing legacy tiers below.
      </section>
    );
  }
  if (!data) {
    return (
      <section style={{ marginBottom: 32, padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>
        Loading new pricing structure…
      </section>
    );
  }

  const pick = (m: Record<CurrencyCode, number>) =>
    billingPeriod === "annual" ? m[currency] : m[currency];
  // Note: the "annual" view shows annualPerMonth (already discounted); when
  // billingPeriod=annual we substitute. We do this at call sites.
  const monthlyOrAnnual = (monthly: Record<CurrencyCode, number>, annualPerMonth: Record<CurrencyCode, number>) =>
    billingPeriod === "annual" ? pick(annualPerMonth) : pick(monthly);

  const allAccessPrice = monthlyOrAnnual(data.allAccess.monthly, data.allAccess.annualPerMonth);
  const allAccessSave = data.allAccess.saveVsAllSolo[currency];

  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
          Per-module, bundles, or all-access
        </h2>
        <p style={{ fontSize: 15, color: "#64748b", marginTop: 8, maxWidth: 640, marginInline: "auto", lineHeight: 1.5 }}>
          Только нужный модуль — от {fmt(monthlyOrAnnual(
            { USD: 5, EUR: 4.6, KZT: 2500, RUB: 450 },
            { USD: 4, EUR: 3.68, KZT: 2000, RUB: 360 },
          ), currency)}/мес. Или сразу вертикаль. Или всё — за цену двух solo.
        </p>
      </div>

      {/* Bundles row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
        {data.bundles.map((b) => {
          const price = monthlyOrAnnual(b.monthly, b.annualPerMonth);
          const save = b.saveVsSolo[currency];
          const color = BUNDLE_COLOR[b.id];
          return (
            <article
              key={b.id}
              style={{
                background: "#fff",
                border: `1px solid ${color}33`,
                borderTop: `4px solid ${color}`,
                borderRadius: 12,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{BUNDLE_NAME[b.id]}</h3>
                <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}14`, padding: "2px 8px", borderRadius: 5 }}>
                  {b.modules.length} mods
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.45, minHeight: 36 }}>
                {BUNDLE_DESC[b.id]}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{fmt(price, currency)}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>/мес{billingPeriod === "annual" ? " (annual)" : ""}</span>
              </div>
              <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>
                Saves {fmt(save, currency)}/мес vs solo
              </div>
              <a
                href="https://aevion.gumroad.com/l/xpxzam"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "8px 0",
                  borderRadius: 8,
                  background: color,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                  marginTop: "auto",
                }}
              >
                Get Access →
              </a>
            </article>
          );
        })}
      </div>

      {/* All-Access hero */}
      <article
        style={{
          background: "linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)",
          color: "#fff",
          borderRadius: 14,
          padding: "24px 28px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "inline-block", padding: "3px 10px", background: "rgba(255,255,255,0.18)", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Best value
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 4 }}>AEVION All-Access</h3>
          <p style={{ fontSize: 14, opacity: 0.92, margin: 0, lineHeight: 1.5 }}>
            Все {data.allAccess.modules} модулей сегодня + всё что выходит дальше. Никаких pick-a-tier раздумий.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 32, fontWeight: 900 }}>{fmt(allAccessPrice, currency)}</span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>/мес{billingPeriod === "annual" ? " (annual)" : ""}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            Saves {fmt(allAccessSave, currency)}/мес vs all-solo
          </div>
          <a
            href="https://aevion.gumroad.com/l/xpxzam"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "10px 24px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.18)",
              border: "2px solid rgba(255,255,255,0.5)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Get All-Access →
          </a>
        </div>
      </article>

      <p style={{ marginTop: 18, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        Source: <code>/api/aevion/pricing</code> · rates updated {new Date(data.currencyRatesAt).toLocaleDateString("ru-RU")} · Solo прайс по модулю — на странице самого модуля. Оплата через Gumroad.
      </p>
    </section>
  );
}
