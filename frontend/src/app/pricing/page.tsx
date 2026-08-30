"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { CustomerLogosRow } from "@/components/CustomerLogosRow";
import { apiUrl } from "@/lib/apiBase";
import { fetchAiSavings } from "@/lib/aiSavings";
import { gumroadCheckoutUrl } from "@/lib/gumroad";
import { channelFrom, withChannel } from "@/lib/products";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";
import { useABVariant, getAllVariants } from "@/lib/abVariant";
import AskAi from "@/components/AskAi";

type CurrencyCode = "USD" | "EUR" | "KZT" | "RUB";
type BillingPeriod = "monthly" | "annual";
type TierId = "free" | "lite" | "medium" | "full" | "pro" | "enterprise";

// Все тиры идут через бэкенд /api/pricing/checkout/session — он сам выбирает
// процессинг (LemonSqueezy primary → Gumroad fallback → stub).

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

interface Testimonial {
  id: string;
  author: string;
  role: string;
  company: string;
  quote: string;
  module?: string;
  industry?: string;
  avatarColor?: string;
  rating?: number;
}

interface TrustNumber {
  label: string;
  value: string;
  hint?: string;
}

interface TrustBadge {
  id: string;
  label: string;
  status?: string;
  category: string;
}

interface TrustPayload {
  numbers: TrustNumber[];
  badges: TrustBadge[];
}

interface QuoteLine {
  kind: "tier" | "addon" | "seat" | "bundle";
  label: string;
  unitPrice: number;
  qty: number;
  total: number;
}

interface AppliedPromo {
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  description: string;
  applied: number;
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
  promo: AppliedPromo | null;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

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
  const tp = usePricingT();
  const { t } = useI18n();
  const heroVariant = useABVariant("hero");
  const heroPrefix = heroVariant === "A" ? "" : `${heroVariant}.`;
  const tierCardsVariant = useABVariant("tierCards");
  const [data, setData] = useState<PricingPayload | null>(null);
  const [activePromos, setActivePromos] = useState<
    Array<{ code: string; description: string; kind: string; amount: number }>
  >([]);
  const [copiedPromo, setCopiedPromo] = useState<string | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [trust, setTrust] = useState<TrustPayload | null>(null);
  const [aiSavings, setAiSavings] = useState<{
    runs: number; totalCostUsd: number; estAlwaysCouncilUsd: number; savedUsd: number; savedPct: number;
  } | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  // Метка канала для ссылок в кассу. Держится в состоянии, а не читается прямо
  // при отрисовке: на сервере адреса ещё нет, и чтение из window разошлось бы с
  // серверной разметкой. Заполняется в том же эффекте, что module и period.
  const [channel, setChannel] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Калькулятор сметы
  // Lite = 1 продукт на выбор: выбранный модуль для чекаута Lite
  const [liteModule, setLiteModule] = useState<string>("");
  // Модуль из deep-link (?module=) — для prominent hero-баннера «Купить <модуль>».
  const [heroModule, setHeroModule] = useState<string>("");

  const [calcTier, setCalcTier] = useState<TierId>("medium");
  const [calcModules, setCalcModules] = useState<string[]>([]);
  const [calcSeats, setCalcSeats] = useState(1);
  const [calcPromo, setCalcPromo] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  async function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterStatus("submitting");
    setNewsletterError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/newsletter"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail.trim(), source: "pricing" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setNewsletterStatus("ok");
      setNewsletterEmail("");
    } catch (e) {
      setNewsletterStatus("error");
      setNewsletterError(e instanceof Error ? e.message : String(e));
    }
  }

  async function startCheckout(opts: {
    tierId: TierId;
    modules?: string[];
    seats?: number;
    period?: BillingPeriod;
    promoCode?: string;
    trial?: boolean;
  }) {
    setCheckingOut(opts.tierId);
    setCheckoutNotice(null);
    track({
      type: "checkout_start",
      tier: opts.tierId,
      source: "pricing",
      meta: {
        period: opts.period ?? "monthly",
        seats: opts.seats ?? 1,
        modules: (opts.modules ?? []).length,
        variant_hero: heroVariant,
        variant_tierCards: tierCardsVariant,
      },
    });
    try {
      // Единая точка: backend /checkout/session сам выбирает процессинг.
      // Прокидываем выбранную валюту: currency=KZT → backend ведёт на PayBox
      // (локальные карты КЗ + Kaspi), иначе USD → LemonSqueezy → Gumroad → stub.
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...opts, currency }),
      });
      const j = await r.json();
      if (j.url) {
        window.location.href = j.url;
      } else {
        console.error("[checkout] no url returned", j);
        setCheckoutNotice(t("pricing.home.notice.checkoutError"));
        setCheckingOut(null);
      }
    } catch (e) {
      console.error("[checkout] failed", e);
      setCheckoutNotice(t("pricing.home.notice.connectionError"));
      setCheckingOut(null);
    }
  }

  // Настроен ли PayBox НА САМОМ ДЕЛЕ. null = ещё не спросили.
  //
  // Подпись под ценой обещала «KZT -> локальные карты КЗ + Kaspi (PayBox)», и
  // это было неправдой: 18.08.2026 проверено запросом — paybox configured=false,
  // а запрос чекаута с currency=KZT молча возвращает долларовую ссылку
  // LemonSqueezy. Покупатель из Казахстана читал про Kaspi и попадал на оплату
  // в долларах. Обещание теперь следует за фактом, а не наоборот.
  const [payboxLive, setPayboxLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/pricing/checkout/healthz"));
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setPayboxLive(Boolean(j?.providers?.paybox?.configured));
      } catch {
        // Не спросили - значит не знаем. Оставляем null: обещать нельзя,
        // но и пугать «не работает» на основании сетевого сбоя тоже нельзя.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    fetch(apiUrl("/api/pricing/promo"))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j.items)) setActivePromos(j.items);
      })
      .catch(() => {});
    fetch(apiUrl("/api/pricing/testimonials"))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j.items)) setTestimonials(j.items);
      })
      .catch(() => {});
    fetch(apiUrl("/api/pricing/trust"))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j) setTrust(j);
      })
      .catch(() => {});
    // Тот же счётчик уже просит виджет в шапке (PlatformAiSavings). Через
    // общий загрузчик оба получают одно значение за один запрос — issue #1016.
    fetchAiSavings()
      .then((j) => {
        if (!cancelled && j && j.runs > 0) setAiSavings(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Зависимостей нет намеренно: ни один из этих запросов не зависит от
    // A/B-варианта. Раньше здесь стояло [heroVariant, tierCardsVariant], а
    // useABVariant отдаёт заглушку "A" на первом рендере и настоящее значение
    // из куки после mount — то есть у каждого, кому выпал НЕ дефолтный
    // вариант, весь блок выполнялся дважды (замерено на проде: pricing×2,
    // promo×2, testimonials×2, trust×2 — issue #1016).
  }, []);

  // Аналитика отдельным эффектом и ровно один раз за загрузку.
  //
  // Она единственная тут действительно зависит от варианта — но брать его надо
  // не из состояния, а синхронно из куки: состояние приходит вторым рендером и
  // вместе с ним раньше уезжала ВТОРАЯ копия всех трёх событий. Воронка
  // /pricing показывала вдвое больше просмотров, чем было на самом деле.
  useEffect(() => {
    const v = getAllVariants();
    track({
      type: "page_view",
      source: "pricing",
      meta: { variant_hero: v.hero, variant_tierCards: v.tierCards },
    });
    track({ type: "ab_assigned", source: "pricing", meta: { key: "hero", value: v.hero } });
    track({ type: "ab_assigned", source: "pricing", meta: { key: "tierCards", value: v.tierCards } });
  }, []);

  // Deep-link c модульной страницы: /pricing?module=<id> предвыбирает продукт
  // для тарифа Lite (последняя миля — посетитель приходит с /cyberchess,
  // /healthai и т.п. и сразу видит свой продукт в Lite, не ищет в дропдауне).
  // ?period=annual переключает на годовой период. Без useSearchParams, чтобы
  // не плодить Suspense-boundary в этом большом client-компоненте.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("module");
    if (mod && data?.modules?.some((m) => m.id === mod)) {
      setLiteModule(mod);
      setHeroModule(mod);
    }
    if (params.get("period") === "annual") {
      setPeriod("annual");
    }
    // Без метки покупка приходит в отчёт как пришедшая ниоткуда: обработчик
    // оплаты читает url_params[channel], но эта ссылка его не передавала.
    setChannel(channelFrom(params.get("c") ?? undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const symbol = data?.currencies[currency].symbol ?? "$";
  const rate = data?.currencies[currency].rate ?? 1;

  const displayPrice = (usd: number | null): string => {
    if (usd === null) return t("pricing.home.price.onRequest");
    if (usd === 0) return t("pricing.home.price.free");
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
          promoCode: calcPromo || undefined,
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
    const t = setTimeout(recalc, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcTier, calcModules, calcSeats, period, currency, calcPromo, data]);

  const moduleSelectable = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((m) => m.addonMonthly !== null && m.addonMonthly > 0);
  }, [data]);

  if (loading) {
    return (
      <ProductPageShell>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          {tp("loading.pricing")}
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
          <h2 style={{ margin: 0, marginBottom: 8 }}>{tp("error.unavailable")}</h2>
          <p style={{ margin: 0 }}>
            /api/pricing. {error ? `${error}` : ""}
          </p>
          <p style={{ margin: 0, marginTop: 8, fontSize: 13 }}>
            {tp("error.checkBackend")}
          </p>
        </div>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={1280}>
      {/* Module deep-link hero — prominent «Купить <модуль>» когда пришли с
          страницы продукта (/pricing?module=<id>). Закрывает последнюю милю:
          заметная кнопка покупки именно этого продукта, валюта (вкл. KZT/PayBox)
          берётся из общего тумблера ниже. */}
      {heroModule && (() => {
        const m = data.modules.find((x) => x.id === heroModule);
        const lite = data.tiers.find((t) => t.id === "lite");
        if (!m) return null;
        const litePrice = period === "annual" ? (lite?.priceAnnualTotal ?? null) : (lite?.priceMonthly ?? null);
        return (
          <section
            style={{
              margin: "24px auto 0",
              maxWidth: 760,
              padding: "20px 24px",
              borderRadius: 18,
              background: "linear-gradient(135deg, rgba(13,148,136,0.10), rgba(14,165,233,0.10))",
              border: "1px solid rgba(13,148,136,0.30)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {t("pricing.home.heroModule.badge")}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "4px 0 2px" }}>
                {m.name}
                {litePrice !== null && (
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 16 }}>
                    {" "}— {displayPrice(litePrice)}/{period === "annual" ? t("pricing.home.heroModule.perYear") : t("pricing.home.heroModule.perMonth")}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {t("pricing.home.heroModule.paymentCard")}{" "}
                {currency === "KZT"
                  ? (payboxLive ? t("pricing.home.heroModule.kztNote") : t("pricing.home.heroModule.kztFallbackNote"))
                  : t("pricing.home.heroModule.usdNote")}
              </div>
            </div>
            <button
              type="button"
              disabled={checkingOut === "lite"}
              onClick={() => startCheckout({ tierId: "lite", period, seats: 1, modules: [heroModule] })}
              style={{
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 900,
                borderRadius: 12,
                border: "none",
                cursor: checkingOut === "lite" ? "wait" : "pointer",
                color: "#fff",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                whiteSpace: "nowrap",
                opacity: checkingOut === "lite" ? 0.7 : 1,
              }}
            >
              {checkingOut === "lite" ? t("pricing.home.heroModule.openingCheckout") : t("pricing.home.heroModule.buyButton", { name: m.name })}
            </button>
          </section>
        );
      })()}
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
          {tp(`hero.${heroPrefix}badge`)}
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
          {tp(`hero.${heroPrefix}title`)}
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
          {tp(`hero.${heroPrefix}subtitle`)}
        </p>
      </section>

      {/* Trust numbers row */}
      {trust && trust.numbers.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
            gap: 8,
            marginBottom: 32,
            padding: "16px 12px",
            background: "rgba(13,148,136,0.04)",
            borderRadius: 14,
            border: "1px solid rgba(13,148,136,0.12)",
          }}
        >
          {trust.numbers.slice(0, 6).map((n, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                padding: "8px 6px",
              }}
              title={n.hint}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "#0d9488",
                }}
              >
                {n.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: 700,
                  marginTop: 2,
                  letterSpacing: "0.02em",
                }}
              >
                {n.label}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Live AI-cost rationality strip — real routed-savings tally, shown
          where the buying decision happens. Numbers come from the shared
          /api/qcoreai/smart/savings counter, not marketing copy. */}
      {aiSavings && (
        <section
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, marginBottom: 32, padding: "14px 18px",
            background: "rgba(16,185,129,0.06)", borderRadius: 14,
            border: "1px solid rgba(16,185,129,0.25)",
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#065f46", marginBottom: 2 }}>
              ⚡ AI spend optimizes itself: {aiSavings.savedUsd >= 0.005 ? `$${aiSavings.savedUsd.toFixed(2)}` : "<$0.01"} saved across {aiSavings.runs} smart call{aiSavings.runs === 1 ? "" : "s"}
            </div>
            <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
              Every module routes AI calls to the cheapest tier that can do the job — {Math.round(aiSavings.savedPct)}%
              below always running the full council. Your plan price buys features, not wasted tokens.
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0d9488" }}>${aiSavings.totalCostUsd.toFixed(2)}</div>
              <div style={{ fontSize: 9.5, color: "#64748b", fontWeight: 700 }}>ACTUAL</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#94a3b8", textDecoration: "line-through" }}>${aiSavings.estAlwaysCouncilUsd.toFixed(2)}</div>
              <div style={{ fontSize: 9.5, color: "#64748b", fontWeight: 700 }}>UNROUTED</div>
            </div>
          </div>
        </section>
      )}

      {/* Active promo banner */}
      {activePromos.length > 0 && (
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              letterSpacing: "0.06em",
              alignSelf: "center",
              marginRight: 4,
            }}
          >
            {tp("promo.activeBanner")}
          </div>
          {activePromos.map((p) => (
            <button
              key={p.code}
              onClick={() => {
                setCalcPromo(p.code);
                navigator.clipboard?.writeText(p.code).catch(() => {});
                setCopiedPromo(p.code);
                setTimeout(() => setCopiedPromo(null), 1500);
              }}
              title={p.description}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.04em",
                borderRadius: 6,
                border: "1px dashed rgba(13,148,136,0.4)",
                cursor: "pointer",
                background: copiedPromo === p.code ? "#0d9488" : "rgba(13,148,136,0.08)",
                color: copiedPromo === p.code ? "#fff" : "#0d9488",
              }}
            >
              {copiedPromo === p.code ? tp("promo.copied") : p.code} ·{" "}
              <span style={{ opacity: 0.7 }}>
                {p.kind === "percent" ? `−${p.amount}%` : `${tp("promo.upTo")} −$${p.amount}`}
              </span>
              {/* Потолок виден СРАЗУ, а не только во всплывающей подсказке.
                  Замер 19.08.2026: TEAM100 обещает «до −$100», но общий потолок
                  скидок — 50% заказа, и на одном месте тарифа Full ($49) он даёт
                  $24.50, на двадцати — $53. До ста доходит примерно с сорока
                  мест. Подсказка `title` на телефоне не показывается вовсе, а
                  именно туда мы ведём трафик. Показываем только у кодов с
                  фиксированной суммой: у процентных потолок ни на что не влияет
                  (максимальный — 50%, и он же предел). */}
              {p.kind !== "percent" && (
                <span style={{ opacity: 0.55, fontWeight: 600 }}>{" "}{tp("promo.capNote")}</span>
              )}
            </button>
          ))}
        </section>
      )}

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
              {p === "monthly" ? tp("period.monthly") : tp("period.annual")}
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

      {/* Checkout notice */}
      {checkoutNotice && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 10,
            color: "#d97706",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {checkoutNotice}
          <button
            onClick={() => setCheckoutNotice(null)}
            style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#d97706", fontWeight: 700, fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

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
          // A/B/C variant for tier-cards:
          //   A — no highlight (control)
          //   B — highlight Medium (popular)
          //   C — highlight Full
          const isHighlight =
            tierCardsVariant === "A"
              ? false
              : tierCardsVariant === "B"
                ? tier.id === "medium"
                : tier.id === "full";
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
                  {tp("tier.popular")}
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
                    {tp("tier.perMonth")}
                  </span>
                )}
                {period === "annual" && tier.priceAnnualTotal !== null && tier.priceAnnualTotal > 0 && (
                  <div style={{ fontSize: 11, color: isHighlight ? "#94a3b8" : "#64748b", marginTop: 4 }}>
                    {displayPrice(tier.priceAnnualTotal)} {tp("tier.perYear")}
                  </div>
                )}
              </div>
              {tier.id === "enterprise" ? (
                <Link
                  href="/pricing/contact?tier=enterprise"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: "#0f172a",
                    color: "#fff",
                    marginBottom: 20,
                    textAlign: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  {tier.ctaLabel}
                </Link>
              ) : (
                <>
                {tier.id === "lite" && (
                  <select
                    value={liteModule}
                    onChange={(e) => setLiteModule(e.target.value)}
                    aria-label={t("pricing.home.tier.selectProductAria")}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 10,
                      border: isHighlight ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(13,148,136,0.4)",
                      marginBottom: 8,
                      background: isHighlight ? "rgba(255,255,255,0.06)" : "#fff",
                      color: isHighlight ? "#e2e8f0" : "#0f172a",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">{t("pricing.home.tier.selectProductOption")}</option>
                    {(data?.modules ?? []).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
                <button
                  disabled={checkingOut === tier.id}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    border: "none",
                    cursor: checkingOut === tier.id ? "wait" : "pointer",
                    background: isHighlight
                      ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                      : tier.id === "free"
                        ? "#f1f5f9"
                        : "#0d9488",
                    color: isHighlight || tier.id !== "free" ? "#fff" : "#0f172a",
                    marginBottom: 8,
                    opacity: checkingOut === tier.id ? 0.7 : 1,
                  }}
                  onClick={() => {
                    if (tier.id === "lite") {
                      if (!liteModule) {
                        setCheckoutNotice(t("pricing.home.notice.selectLiteModule"));
                        return;
                      }
                      startCheckout({ tierId: tier.id, period, seats: 1, modules: [liteModule] });
                    } else {
                      startCheckout({ tierId: tier.id, period, seats: 1 });
                    }
                  }}
                >
                  {checkingOut === tier.id ? t("pricing.home.tier.openingCheckout") : tier.ctaLabel}
                </button>
                </>
              )}
              {tier.id !== "enterprise" && tier.id !== "free" && (
                <>
                  <button
                    style={{
                      width: "100%",
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: isHighlight
                        ? "1px solid rgba(255,255,255,0.2)"
                        : "1px solid rgba(13,148,136,0.4)",
                      cursor: "pointer",
                      background: "transparent",
                      color: isHighlight ? "#5eead4" : "#0d9488",
                      marginBottom: 6,
                    }}
                    onClick={() =>
                      startCheckout(
                        tier.id === "lite" && liteModule
                          ? { tierId: tier.id, period, seats: 1, trial: true, modules: [liteModule] }
                          : { tierId: tier.id, period, seats: 1, trial: true },
                      )
                    }
                  >
                    {tp("tier.tryTrial")}
                  </button>
                  <button
                    style={{
                      width: "100%",
                      padding: "6px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      background: "transparent",
                      color: isHighlight ? "#94a3b8" : "#64748b",
                      marginBottom: 12,
                    }}
                    onClick={() => {
                      setCalcTier(tier.id);
                      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {tp("tier.openCalc")}
                  </button>
                </>
              )}
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
                {tp("tier.detailsLink", { name: tier.name })}
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
          {tp("bundles.title")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tp("bundles.subtitle")}
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
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>
                {displayPrice(b.priceMonthly)}
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}> {t("pricing.home.bundles.perMonth")}</span>
              </div>
              <a
                href={withChannel(gumroadCheckoutUrl({ key: b.id }), channel, "pricing")}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0d9488, #0891b2)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Get Access →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Customer logos row */}
      <CustomerLogosRow label={tp("logos.label")} />

      {/* Testimonials */}
      {testimonials.length > 0 && (
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
            {tp("testimonials.title")}
          </h2>
          <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
            {tp("testimonials.subtitle")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {testimonials.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  border: BORDER,
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: CARD,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {t.rating && (
                  <div style={{ fontSize: 12, color: "#f59e0b" }}>
                    {"★".repeat(t.rating)}
                    <span style={{ color: "#cbd5e1" }}>{"★".repeat(5 - t.rating)}</span>
                  </div>
                )}
                <p
                  style={{
                    fontSize: 14,
                    color: "#0f172a",
                    lineHeight: 1.5,
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  «{t.quote}»
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: t.avatarColor ?? "#475569",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {t.author
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t.author}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {t.role} · {t.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
          {tp("modules.title")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tp("modules.subtitle")}
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
                    {tp("modules.colModule")}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    {tp("modules.colDescription")}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#475569" }}>
                    {tp("modules.colStatus")}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#475569" }}>
                    {tp("modules.colAddon")}
                  </th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, color: "#475569" }}>
                    {tp("modules.colIncluded")}
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
          {tp("calc.title")}
        </h2>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 24 }}>
          {tp("calc.subtitle")}
        </p>
        <div
          style={{
            display: "grid",
            // На телефоне «1fr 1fr» не спасает: у элементов сетки min-width:auto,
            // и первая колонка распирается до ширины своего содержимого (замер:
            // 200px), выталкивая вторую за экран — документ 432 при экране 375.
            // auto-fit складывает калькулятор в одну колонку на узком экране и
            // оставляет две на широком (замер: 576/576 до и после).
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
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
                {tp("calc.tier")}
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
                {tp("calc.seats")}
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
                {tp("calc.promo")}
              </label>
              <input
                value={calcPromo}
                onChange={(e) => setCalcPromo(e.target.value.toUpperCase())}
                placeholder="AEVION20 / STARTUP50"
                style={{
                  width: 200,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  borderRadius: 8,
                  border: quote?.promo
                    ? "1px solid #34d399"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f8fafc",
                  fontFamily: "ui-monospace, monospace",
                  textTransform: "uppercase",
                }}
              />
              {quote?.promo && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#34d399" }}>
                  ✓ {quote.promo.description}
                </div>
              )}
              {calcPromo && !quote?.promo && quote?.notes.some((n) => n.toLowerCase().includes("промо")) && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#fca5a5" }}>
                  ✗ {quote.notes.find((n) => n.toLowerCase().includes("промо"))}
                </div>
              )}
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
                {tp("calc.modules")}
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
              {tp("calc.estimate")} {quoting && `· ${tp("calc.recalc")}`}
            </div>
            {quote ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  {quote.lines.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>
                      {tp("calc.freeBilling")}
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
                    <span>{tp("calc.annualDiscount")}</span>
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
                    {period === "annual" ? tp("calc.totalYear") : tp("calc.totalMonth")}
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
                    {symbol}
                    {quote.total.toLocaleString("ru-RU")}
                  </span>
                </div>
                {calcTier !== "free" && calcTier !== "enterprise" && (
                  <button
                    disabled={checkingOut === calcTier}
                    onClick={() =>
                      startCheckout({
                        tierId: calcTier,
                        modules: calcModules,
                        seats: calcSeats,
                        period,
                        promoCode: calcPromo || undefined,
                      })
                    }
                    style={{
                      width: "100%",
                      marginTop: 16,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 800,
                      borderRadius: 10,
                      border: "none",
                      cursor: checkingOut === calcTier ? "wait" : "pointer",
                      background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                      color: "#fff",
                      opacity: checkingOut === calcTier ? 0.7 : 1,
                    }}
                  >
                    {checkingOut === calcTier
                      ? tp("calc.opening")
                      : `${tp("calc.payQuote")} · ${symbol}${quote.total.toLocaleString("ru-RU")}`}
                  </button>
                )}
                {calcTier === "enterprise" && (
                  <Link
                    href="/pricing/contact?tier=enterprise"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 16,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 800,
                      borderRadius: 10,
                      background: "#0f172a",
                      color: "#fff",
                      textAlign: "center",
                      textDecoration: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    {tp("calc.contactSales")}
                  </Link>
                )}
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
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{tp("calc.empty")}</div>
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
          {tp("industries.title")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tp("industries.subtitle")}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { id: "banks", name: tp("industries.banks"), grad: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
            { id: "startups", name: tp("industries.startups"), grad: "linear-gradient(135deg, #7c3aed, #a78bfa)" },
            { id: "government", name: tp("industries.government"), grad: "linear-gradient(135deg, #065f46, #10b981)" },
            { id: "creators", name: tp("industries.creators"), grad: "linear-gradient(135deg, #be185d, #ec4899)" },
            { id: "law-firms", name: tp("industries.lawFirms"), grad: "linear-gradient(135deg, #92400e, #f59e0b)" },
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
          {tp("compare.title")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tp("compare.subtitle")}
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
                    {t("pricing.home.compare.colNeed")}
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
                  [t("pricing.home.compare.row.digitalPropertyReg"), "✓", "—", "—", "—", "✓"],
                  [t("pricing.home.compare.row.digitalSignature"), "✓", "✓", "—", "—", "—"],
                  [t("pricing.home.compare.row.aiEngine"), "✓", "—", "—", "✓", "—"],
                  [t("pricing.home.compare.row.paymentCore"), "✓", "—", "✓", "—", "—"],
                  [t("pricing.home.compare.row.authorshipBureau"), "✓", "—", "—", "—", "✓"],
                  [t("pricing.home.compare.row.worldMap"), "✓", "—", "—", "—", "—"],
                  [t("pricing.home.compare.row.unifiedSub"), "✓", "—", "—", "—", "—"],
                  [t("pricing.home.compare.row.openApi"), "✓", "✓", "✓", "✓", "—"],
                  [
                    t("pricing.home.compare.row.comparablePrice"),
                    t("pricing.home.compare.priceAevion"),
                    t("pricing.home.compare.priceDocusign"),
                    t("pricing.home.compare.priceStripe"),
                    t("pricing.home.compare.priceOpenai"),
                    t("pricing.home.compare.pricePatently"),
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
            {t("pricing.home.compare.footerNote")}
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
          {tp("faq.title")}
        </h2>
        <p style={{ color: "#64748b", margin: 0, marginBottom: 20 }}>
          {tp("faq.subtitle")}{" "}
          <a href="mailto:hello@aevion.app" style={{ color: "#0d9488", fontWeight: 700 }}>
            hello@aevion.app
          </a>
          .
        </p>
        <div>
          {[
            {
              q: t("pricing.home.faq.billingChange.q"),
              a: t("pricing.home.faq.billingChange.a"),
            },
            {
              q: t("pricing.home.faq.singleModule.q"),
              a: t("pricing.home.faq.singleModule.a"),
            },
            {
              q: t("pricing.home.faq.bothSuites.q"),
              a: t("pricing.home.faq.bothSuites.a"),
            },
            {
              q: t("pricing.home.faq.onPremise.q"),
              a: t("pricing.home.faq.onPremise.a"),
            },
            {
              q: t("pricing.home.faq.dataResidency.q"),
              a: t("pricing.home.faq.dataResidency.a"),
            },
            {
              q: t("pricing.home.faq.eduPlan.q"),
              a: t("pricing.home.faq.eduPlan.a"),
            },
            {
              q: t("pricing.home.faq.cancelExport.q"),
              a: t("pricing.home.faq.cancelExport.a"),
            },
            {
              q: t("pricing.home.faq.vsCompetitors.q"),
              a: t("pricing.home.faq.vsCompetitors.a"),
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

      {/* Compliance badges */}
      {trust && trust.badges.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 12, color: "#475569" }}>
            {tp("compliance.title")}
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {trust.badges.map((b) => {
              const live = b.status === "live";
              return (
                <div
                  key={b.id}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: live
                      ? "1px solid rgba(13,148,136,0.3)"
                      : "1px dashed rgba(15,23,42,0.15)",
                    background: live ? "#ecfdf5" : "#f8fafc",
                    color: live ? "#065f46" : "#475569",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ color: live ? "#10b981" : "#94a3b8", fontSize: 14 }}>
                    {live ? "✓" : "○"}
                  </span>
                  <span>{b.label}</span>
                  {b.status && b.status !== "live" && (
                    <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 11 }}>
                      · {b.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Newsletter signup */}
      <section
        style={{
          marginBottom: 40,
          padding: 28,
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 16,
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {tp("newsletter.title")}
        </h3>
        <p style={{ color: "#94a3b8", margin: 0, marginBottom: 20, fontSize: 14 }}>
          {tp("newsletter.subtitle")}
        </p>
        {newsletterStatus === "ok" ? (
          <div
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(52,211,153,0.16)",
              border: "1px solid rgba(52,211,153,0.4)",
              borderRadius: 10,
              color: "#34d399",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {tp("newsletter.success")}
          </div>
        ) : (
          <form
            onSubmit={submitNewsletter}
            style={{
              display: "inline-flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: "100%",
            }}
          >
            <input
              type="email"
              required
              placeholder={tp("newsletter.placeholder")}
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              disabled={newsletterStatus === "submitting"}
              style={{
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#f8fafc",
                width: 280,
                maxWidth: "100%",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={newsletterStatus === "submitting" || !newsletterEmail.trim()}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                border: "none",
                cursor: newsletterStatus === "submitting" ? "wait" : "pointer",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
              }}
            >
              {newsletterStatus === "submitting" ? tp("newsletter.submitting") : tp("newsletter.submit")}
            </button>
          </form>
        )}
        {newsletterStatus === "error" && newsletterError && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "#fca5a5",
            }}
          >
            {tp("newsletter.error")} {newsletterError}
          </div>
        )}
      </section>

      {/* Notes / FAQ light */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 12 }}>{tp("notes.title")}</h3>
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
          <Link
            href="/pricing/compare"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.fullMatrixLink")}
          </Link>
          <Link
            href="/pricing/cases"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.caseStudiesLink")}
          </Link>
          <Link
            href="/pricing/roadmap"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            Public roadmap →
          </Link>
          <Link
            href="/pricing/security"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            Security &amp; Compliance →
          </Link>
          <Link
            href="/pricing/refund-policy"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            Refund policy →
          </Link>
          <Link
            href="/pricing/changelog"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            Changelog →
          </Link>
          <Link
            href="/pricing/api-pricing"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            API pricing →
          </Link>
          <Link
            href="/pricing/affiliate"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.affiliateLink")}
          </Link>
          <Link
            href="/pricing/edu"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.eduLink")}
          </Link>
          <Link
            href="/pricing/partners"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.partnersLink")}
          </Link>
          <Link
            href="/pricing/integrations"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.integrationsLink")}
          </Link>
          <Link
            href="/pricing/migrations"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.migrationLink")}
          </Link>
          <Link
            href="/pricing/glossary"
            style={{ color: "#0d9488", fontWeight: 700, marginRight: 12 }}
          >
            {t("pricing.home.notes.glossaryLink")}
          </Link>
          {tp("notes.docsApi")}{" "}
          <Link href="/" style={{ color: "#0d9488", fontWeight: 700 }}>
            /api/openapi.json
          </Link>
          . {tp("notes.endpoint")}{" "}
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

      <section style={{ margin: "28px auto 0", maxWidth: 760, textAlign: "left" }}>
        <AskAi
          module="pricing"
          title="Ask about plans"
          placeholder="e.g. What's the difference between Lite and Full?"
        />
      </section>
    </ProductPageShell>
  );
}
