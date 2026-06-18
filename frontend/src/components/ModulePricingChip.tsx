"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

// Compact pricing chip + direct-buy button for module pages. Shows the
// cheapest path to this module (solo) and a one-click "Купить" button that
// opens the live LemonSqueezy checkout for Lite+thisModule — без захода на
// общий /pricing (последняя миля). The "сравнить тарифы →" link still leads
// to /pricing?module=<id> with the product pre-selected.
//
// Wherever a visitor lands on /cyberchess, /qpaynet, /healthai, etc. they see
// "Купить $5/мес · Gaming bundle $19 · All-Access $59" and can pay in one click.
//
// Data: pulls /api/aevion/pricing once per page-load and caches the in-flight
// promise at module scope so N chips on one page = 1 request.

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BundleId = "fintech" | "build" | "ai" | "gaming";

interface SoloPrice {
  id: string;
  bundle: BundleId | null;
  monthly: Record<CurrencyCode, number>;
}
interface BundlePrice {
  id: BundleId;
  modules: string[];
  monthly: Record<CurrencyCode, number>;
}
interface AllAccessPrice {
  modules: number;
  monthly: Record<CurrencyCode, number>;
}
interface PricingResponse {
  solo: SoloPrice[];
  bundles: BundlePrice[];
  allAccess: AllAccessPrice;
}

const SYMBOL: Record<CurrencyCode, string> = { USD: "$", EUR: "€", KZT: "₸", RUB: "₽" };
const BUNDLE_NAME: Record<BundleId, string> = {
  fintech: "Fintech",
  build: "Build & IP",
  ai: "AI",
  gaming: "Gaming & UX",
};

// Module-scoped cache: first chip on the page triggers the fetch, every
// subsequent chip reuses the same promise. Survives chip-mount churn.
let pricingPromise: Promise<PricingResponse | null> | null = null;

function loadPricing(): Promise<PricingResponse | null> {
  if (!pricingPromise) {
    pricingPromise = fetch(apiUrl("/api/aevion/pricing"))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return pricingPromise;
}

function fmt(n: number, c: CurrencyCode): string {
  if (c === "USD" || c === "EUR") return `${SYMBOL[c]}${n}`;
  return `${n.toLocaleString("ru-RU")} ${SYMBOL[c]}`;
}

interface Props {
  moduleId: string;
  currency?: CurrencyCode;
  /** Optional dark/light theme (defaults to light). */
  theme?: "light" | "dark";
  /** Hide the one-click buy button (chip stays informational). Default false. */
  hideBuy?: boolean;
}

export default function ModulePricingChip({ moduleId, currency = "USD", theme = "light", hideBuy = false }: Props) {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPricing().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const solo = data.solo.find((s) => s.id === moduleId);
  if (!solo) return null;

  const bundle = solo.bundle ? data.bundles.find((b) => b.id === solo.bundle) : null;
  const palette = theme === "dark"
    ? { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "#e2e8f0", muted: "#94a3b8", accent: "#34d399" }
    : { bg: "#f8fafc", border: "rgba(15,23,42,0.08)", text: "#0f172a", muted: "#64748b", accent: "#0d9488" };

  // One-click checkout: Lite tier + this module → live LemonSqueezy hosted page.
  // The backend /checkout/session picks the processor (LS primary → Gumroad →
  // stub) and returns a ready checkout URL. Email is collected on the hosted
  // page, so we don't ask for it here.
  async function buyNow() {
    setBuying(true);
    setBuyError(false);
    try {
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId: "lite", period: "monthly", seats: 1, modules: [moduleId] }),
      });
      const j = await r.json();
      if (j?.url) {
        window.location.href = j.url;
        return; // keep the spinner while the browser navigates away
      }
      setBuyError(true);
      setBuying(false);
    } catch {
      setBuyError(true);
      setBuying(false);
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px 6px 12px",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontSize: 12,
        color: palette.text,
        lineHeight: 1.4,
      }}
    >
      <Link
        href={`/pricing?module=${encodeURIComponent(moduleId)}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette.text, textDecoration: "none" }}
        title="Сравнить тарифы — Solo, bundle, All-Access"
      >
        <span><strong style={{ fontWeight: 800 }}>{fmt(solo.monthly[currency], currency)}</strong>/мес solo</span>
        {bundle && (
          <>
            <span style={{ color: palette.muted }}>·</span>
            <span>{BUNDLE_NAME[bundle.id]} bundle <strong style={{ fontWeight: 800 }}>{fmt(bundle.monthly[currency], currency)}</strong> · {bundle.modules.length} mods</span>
          </>
        )}
        <span style={{ color: palette.muted }}>·</span>
        <span style={{ color: palette.accent, fontWeight: 700 }}>
          All-Access {fmt(data.allAccess.monthly[currency], currency)}
        </span>
      </Link>
      {!hideBuy && (
        <button
          type="button"
          onClick={buyNow}
          disabled={buying}
          title={buyError ? "Ошибка — попробуйте ещё раз" : `Купить ${fmt(solo.monthly[currency], currency)}/мес — оплата картой`}
          style={{
            border: "none",
            cursor: buying ? "wait" : "pointer",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            color: "#fff",
            background: buyError
              ? "#dc2626"
              : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            opacity: buying ? 0.7 : 1,
          }}
        >
          {buying ? "Открываем…" : buyError ? "Повторить" : "Купить"}
        </button>
      )}
    </span>
  );
}
