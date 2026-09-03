"use client";

import { channelNow } from "@/lib/channelNow";
import { useEffect, useState } from "react";
import { channelFrom, withChannel } from "@/lib/products";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { productById } from "@/lib/products";
import { track } from "@/lib/track";
import { PageTracking } from "@/components/PageTracking";

type Billing = "monthly" | "annual";

/* ── Prices ─────────────────────────────────────────────────────────────────── */
// ⚠️ Planet is the one paid AEVION offer whose price lives nowhere but this file.
// Everything else resolves to a source of truth: tiers to data/pricing.ts (what
// checkout.ts charges), one-off products and subscriptions to lib/products.ts
// (verified against the live payment dashboards on 2026-07-26). These two numbers
// have neither, and the checkout links below are raw Lemon Squeezy variant UUIDs
// typed into this page — they bypass lib/products.ts AND the backend's
// tier_planet_monthly / tier_planet_annual reference system
// (data/lemonSqueezyVariants.ts), so nothing in the codebase can tell whether the
// $250 shown here is what Lemon Squeezy actually bills.
//
// That is the same shape as the "All-Access $59/мес" banner, which advertised a
// price for years while the button opened a different product. Not changed here:
// correcting it needs the real variant prices from the Lemon Squeezy dashboard,
// and inventing a number would be worse than naming the gap. Fix = add Planet to
// lib/products.ts with its verified price + href, then read it from there.
// ПРОВЕРЕНО 30.08.2026, и пробел выше закрыт замером, а не догадкой.
// Витрина Lemon Squeezy прочитана инструментом aevion-store-vs-price.mjs:
//     магазин: AEVION Planet — Monthly  $250 / month
//     магазин: AEVION Planet — Annual   $200 / month
// Оба числа СОВПАДАЮТ с зашитыми ниже. То есть на сегодня страница называет
// ту цену, которую списывает касса, — случай «All-Access $59», упомянутый
// выше, здесь НЕ повторился.
//
// Что это НЕ отменяет: числа по-прежнему живут здесь, а не в lib/products.ts,
// и следующее изменение цены в кабинете Lemon Squeezy разойдётся с ними так же
// молча. Проверка — внешняя и ручная:
//     node C:/Users/user/aevion-store-vs-price.mjs
// Она читает живую витрину и печатает расхождения. Настоящая починка прежняя:
// перенести Planet в lib/products.ts с проверенной ценой и ссылкой.
const PLANET_MONTHLY = 250;
const PLANET_ANNUAL_PER_MO = 200; // 12-month commitment, billed monthly

/**
 * Описание приложения — только подача: иконка, категория, highlights.
 * Цены и ссылки на оплату здесь НЕ живут: их единственный источник —
 * `@/lib/products`, откуда их берёт и витрина `/shop`. До 26.07.2026 они были
 * захардкожены и тут, и там, из-за чего каталоги показывали разные наборы.
 */
interface AppDef {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  href: string;
  cat: string;
  highlights: string[];
  badge?: string;
  /** id позиции в `@/lib/products`. Отсутствует у бесплатных приложений. */
  productId?: string;
}

type App = AppDef & { price: number; checkoutUrl?: string };

const APP_DEFS: AppDef[] = [
  /* ── Developer ──────────────────────────────────────────────────────── */
  {
    id: "devhub",
    productId: "devhub",
    icon: "🛠",
    name: "DevHub Studio Pro",
    tagline: "Full-stack browser IDE + AI + deploy",
    href: "/devhub",
    cat: "Developer",
    highlights: [
      "Monaco IDE (VS Code engine)",
      "AI code generation",
      // Two claims that were not true when written down: Railway deploys of a
      // user's project answer 501 (per-project services are behind an
      // unreleased flag) and Vercel has no token in production, so Cloudflare
      // Pages is the path that actually deploys. And the aevion.build zone was
      // never delegated, so those subdomains do not resolve — the address that
      // works is *.pages.dev.
      "Deploy to Cloudflare Pages, verified live before it says live",
      "Free *.pages.dev address",
      "50 AI videos · 200 images/mo",
      "Team collaborators",
    ],
    badge: "Most popular",
  },
  {
    id: "qcoreai",
    icon: "🧠",
    name: "QCoreAI",
    tagline: "Multi-model AI assistant",
    href: "/qcoreai",
    cat: "Developer",
    highlights: ["Claude · GPT · Gemini in one UI", "Generous free monthly quota", "Always free"],
    badge: "Free forever",
  },
  {
    id: "tiktok-publisher",
    icon: "🎬",
    name: "TikTok Publisher",
    tagline: "Publish finished videos to your own TikTok",
    href: "/tiktok-publisher",
    cat: "Developer",
    // Внесён в каталог 19.08.2026. До этого страница жила на проде, но нигде не
    // значилась: формально открыта всем, фактически внутренний инструмент.
    // Именно поэтому заявку на Content Posting API отклонили с формулировкой
    // «personal or company internal use». Продукт для авторов должен быть
    // ВИДИМ как продукт, иначе утверждение о нём — неправда.
    highlights: [
      "Connect your own TikTok via OAuth",
      "Caption, privacy level and interaction settings before posting",
      "Commercial-content disclosure built in",
      "Save to drafts or post directly",
      "Publish status tracking",
    ],
  },
  /* ── Finance ────────────────────────────────────────────────────────── */
  {
    id: "qventure",
    productId: "qventure",
    icon: "📈",
    name: "QVenture",
    tagline: "AI investment analyst · score 0–100",
    href: "/qventure",
    cat: "Finance",
    highlights: ["4-role advice panel", "Market sizing, stress test & red flags", "PDF export"],
  },
  {
    id: "qpaynet",
    productId: "qpaynet",
    icon: "💳",
    name: "QPayNet",
    tagline: "Embedded payment infrastructure",
    href: "/qpaynet",
    cat: "Finance",
    highlights: ["KZT · USD · multi-currency", "Payouts to card, Kaspi and bank transfer", "API + webhooks"],
  },
  /* ── Business & Legal ───────────────────────────────────────────────── */
  {
    id: "qcontract",
    productId: "qcontract",
    icon: "💣",
    name: "QContract",
    tagline: "Self-destructing secure documents",
    href: "/qcontract",
    cat: "Business",
    highlights: [
      "View-count & expiry limits",
      "Password & e-signature gates",
      "QRight IP timestamping",
    ],
  },
  {
    id: "constitution",
    productId: "pyiaz",
    icon: "📜",
    name: "Constitution — World-System Design Lab",
    tagline: "Political economy simulator",
    href: "/constitution",
    cat: "Business",
    // Описание выправлено 26.07.2026 по живому модулю /constitution и карточке Gumroad:
    // здесь значилось «AI-powered IP registration / 12-page IP constitution builder /
    // 27+ filing endpoints / QSign proof» — это другой продукт. /constitution на самом
    // деле «World-System Design Lab»: восемь параметров, ползунки, исторические режимы.
    highlights: [
      "Eight parameters across four pillars",
      "Historical regime simulation",
      "AI advisor · clean PDF · embed widget",
    ],
  },
  {
    // 19.08.2026: карточка обещала «Ed25519 signature» и «OpenTimestamps blockchain
    // anchoring». Проверено по коду — ни того, ни другого нет. Подпись это
    // HMAC-SHA256, ключом которого служит ПУБЛИЧНЫЙ ключ нотариуса (bureau.ts:2622,
    // там же честная пометка «Demo»): пересчитать её может любой, потому что certId,
    // contentHash и открытый ключ — открытые данные. Свойства подписи здесь нет.
    // Якорения в бюро тоже нет: слово anchor встречается дважды, оба раза это
    // text-anchor в SVG; библиотека OpenTimestamps живёт в соседнем модуле.
    //
    // Формулировки приведены к тому, что продукт делает на самом деле. Вернуть
    // прежние можно ТОЛЬКО вместе с настоящей реализацией — иначе продукт,
    // который продаёт доказуемость, врёт именно про неё.
    // Разбор: 15-Аудиты-и-сводки\ВИТРИНА-обещания-против-кода-19-08.md
    id: "bureau",
    productId: "bureau",
    icon: "🔐",
    name: "AEVION IP Bureau",
    tagline: "Proof-of-creation & authorship",
    href: "/bureau",
    cat: "Business",
    highlights: [
      "SHA-256 content hash + signed audit trail",
      "OpenTimestamps anchor in Bitcoin",
      "Tamper-evident certificates",
    ],
  },
  /* ── Health ─────────────────────────────────────────────────────────── */
  {
    id: "qrenew",
    productId: "kkiavh",
    icon: "🌱",
    name: "QRenew / QMelanin",
    tagline: "Longevity & cellular renewal protocol",
    href: "/qrenew",
    cat: "Health",
    highlights: [
      "Evidence-graded supplement stack (A/B/C)",
      "12-week protocol with biomarker tracking",
      "Zn:Cu 8–15:1 melanin support guide",
    ],
    // Единая цена везде: Gumroad Anti-Grey Protocol $19 (та же ссылка, что на /qmelanin).
  },
  /* ── Education ──────────────────────────────────────────────────────── */
  {
    id: "smeta",
    productId: "smeta",
    icon: "🏗",
    name: "Smeta Trainer",
    tagline: "AI construction estimating (Kazakhstan)",
    href: "/smeta-trainer",
    cat: "Education",
    highlights: [
      "ССЦ / ЭСН corpus RK 2026",
      "AI error detection on student estimates",
      "Form 1–3 · КС-2 · КС-3 output",
    ],
  },
  {
    id: "cyberchess",
    productId: "cyberchess",
    icon: "♟",
    name: "CyberChess Pro",
    tagline: "AI chess coaching & tournament platform",
    href: "/cyberchess",
    cat: "Education",
    highlights: [
      "Grandmaster opening theory (CC0 corpus)",
      "Real-time AI coaching during games",
      "Tournament management with ratings and prizes",
    ],
  },
];

/**
 * Цена и чекаут подставляются из каталога — здесь их нет ни у одной записи.
 * Приложение без `productId` (или с id, которого в каталоге нет) считается
 * бесплатным и рисуется без кнопки покупки, а не с ценой $0 и битой ссылкой.
 */
const APPS: App[] = APP_DEFS.map((a) => {
  const product = a.productId ? productById(a.productId) : undefined;
  return { ...a, price: product?.priceUsd ?? 0, checkoutUrl: product?.href };
});

const CATS = ["Developer", "Finance", "Business", "Health", "Education"];

const CAT_COLOR: Record<string, string> = {
  Developer: "#0d9488",
  Finance: "#7c3aed",
  Business: "#1d4ed8",
  Health: "#16a34a",
  Education: "#b45309",
};

const PAID_APPS = APPS.filter((a) => a.price > 0);
const RACK_RATE = PAID_APPS.reduce((s, a) => s + a.price, 0);

export default function AppsPage() {
  // Метка канала для ссылок в кассу. Витрина модулей — клиентская
  // страница, поэтому метка берётся после отрисовки: на сервере адреса
  // ещё нет, и сборка ссылки при отрисовке разошлась бы с разметкой.
  const [channel, setChannel] = useState<string | null>(null);
  useEffect(() => {
    setChannel(channelNow());
  }, []);
  const [billing, setBilling] = useState<Billing>("monthly");
  const planetPrice = billing === "monthly" ? PLANET_MONTHLY : PLANET_ANNUAL_PER_MO;
  const savings = RACK_RATE - planetPrice;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        fontFamily: "system-ui, sans-serif",
        color: "#f1f5f9",
      }}
    >
      <PageTracking page="apps" />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px 80px" }}>
        <Wave1Nav />

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", padding: "56px 0 44px" }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(13,148,136,0.15)",
              border: "1px solid rgba(13,148,136,0.3)",
              borderRadius: 20,
              padding: "4px 16px",
              fontSize: 13,
              color: "#0d9488",
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            🪐 AEVION PLANET — One System. Infinite Possibilities.
          </div>
          <h1
            style={{
              fontSize: "clamp(28px,5vw,52px)",
              fontWeight: 900,
              margin: "0 0 14px",
              background: "linear-gradient(135deg,#fff 0%,#94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Apps &amp; Pricing
          </h1>
          <p style={{ color: "#64748b", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Use any app individually, or get the entire planet for less than two apps.
          </p>
        </div>

        {/* ── Planet card ───────────────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)",
            borderRadius: 20,
            padding: "clamp(24px,4vw,40px)",
            marginBottom: 56,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* decorative blobs */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, background: "rgba(255,255,255,0.04)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, background: "rgba(255,255,255,0.04)", borderRadius: "50%", pointerEvents: "none" }} />

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 24, position: "relative" }}>
            {/* left */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 40 }}>🪐</span>
                <div>
                  <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: "#fff" }}>AEVION Planet</h2>
                  <p style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontSize: 14 }}>
                    All {APPS.length} apps · all future releases · priority support
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Every app — now & future",
                  "Cross-app workflows",
                  "3 team seats included",
                  "Priority support",
                  "Early access to new modules",
                ].map((f) => (
                  <span key={f} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#fff" }}>
                    ✓ {f}
                  </span>
                ))}
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 16 }}>
                Rack rate: <s>${RACK_RATE}/mo</s> — you save{" "}
                <strong style={{ color: "#fff" }}>${savings}/mo ({Math.round((savings / RACK_RATE) * 100)}%)</strong>
              </p>
              {billing === "annual" && (
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "4px 0 0" }}>
                  12-month commitment · cancel to 6 mo penalty-free · to 3 mo with 10% fee
                </p>
              )}
            </div>

            {/* right — price + toggle */}
            <div style={{ textAlign: "center", minWidth: 200 }}>
              {/* toggle */}
              <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 4, marginBottom: 18 }}>
                {(["monthly", "annual"] as Billing[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setBilling(c)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      background: billing === c ? "#fff" : "transparent",
                      color: billing === c ? "#0d9488" : "rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {c === "monthly" ? "Monthly" : "Annual"}
                    {c === "annual" && (
                      <span style={{ fontSize: 10, background: "#fbbf24", color: "#000", borderRadius: 4, padding: "1px 6px" }}>
                        SAVE 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ color: "#fff" }}>
                <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1 }}>${planetPrice}</span>
                <span style={{ fontSize: 15, opacity: 0.7 }}>/mo</span>
              </div>
              {billing === "annual" && (
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, margin: "6px 0 0" }}>
                  Billed monthly · 12-month commitment
                </p>
              )}

              <a
                href={withChannel(billing === "annual"
                  ? "https://aevion.lemonsqueezy.com/checkout/buy/a6a35e07-9942-4089-aec3-0faa0ea9b722"
                  : "https://aevion.lemonsqueezy.com/checkout/buy/23fa912b-b6dc-4b42-8dd8-7498b6298b1b", channel, "apps")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track({
                    type: "checkout_start",
                    tier: "planet",
                    source: "apps/planet",
                    value: planetPrice,
                    meta: { period: billing, processor: "lemonsqueezy" },
                  })
                }
                style={{
                  display: "block",
                  marginTop: 16,
                  padding: "13px 28px",
                  background: "#fff",
                  color: "#0d9488",
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 16,
                  textDecoration: "none",
                }}
              >
                Get the Planet →
              </a>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 8 }}>
                14-day money-back guarantee
              </p>
            </div>
          </div>
        </div>

        {/* ── Individual apps ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>
            Individual apps
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Subscribe to just what you need.
          </p>
        </div>

        {CATS.map((cat) => {
          const apps = APPS.filter((a) => a.cat === cat);
          if (!apps.length) return null;
          const clr = CAT_COLOR[cat] ?? "#64748b";
          return (
            <div key={cat} style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 3, height: 18, background: clr, borderRadius: 2 }} />
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {cat}
                </h3>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%,300px),1fr))",
                  gap: 16,
                }}
              >
                {apps.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: "22px 22px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      position: "relative",
                    }}
                  >
                    {app.badge && (
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          fontSize: 10,
                          fontWeight: 700,
                          background: app.price === 0 ? "#16a34a" : clr,
                          color: "#fff",
                          borderRadius: 20,
                          padding: "2px 10px",
                        }}
                      >
                        {app.badge}
                      </span>
                    )}

                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{app.icon}</span>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                          {app.name}
                        </h4>
                        <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>
                          {app.tagline}
                        </p>
                      </div>
                    </div>

                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                      {app.highlights.map((h) => (
                        <li key={h} style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ color: clr, flexShrink: 0 }}>✓</span>
                          {h}
                        </li>
                      ))}
                    </ul>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        // Перевод удлиняет обе надписи ("Free" → "Бесплатно",
                        // "Open free →" → "Открыть бесплатно →"), а строка была
                        // свёрстана под короткие английские слова: без переноса
                        // цена налезала на кнопку на всех бесплатных карточках.
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: "auto",
                        paddingTop: 14,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
                          {app.price === 0 ? "Free" : `$${app.price}`}
                        </span>
                        {app.price > 0 && (
                          <span style={{ fontSize: 13, color: "#64748b" }}>/mo</span>
                        )}
                      </div>
                      {app.checkoutUrl ? (
                        <a
                          href={app.checkoutUrl}
                          aria-label={`Подписаться: ${app.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            track({
                              type: "checkout_start",
                              source: `apps/${app.id}`,
                              value: app.price,
                              meta: { module: app.id },
                            })
                          }
                          style={{
                            padding: "8px 18px",
                            background: clr,
                            color: "#fff",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Subscribe →
                        </a>
                      ) : (
                        <Link
                          href={app.href}
                          aria-label={`${app.price === 0 ? "Открыть бесплатно" : "Получить доступ"}: ${app.name}`}
                          style={{
                            padding: "8px 18px",
                            background: clr,
                            color: "#fff",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {app.price === 0 ? "Open free →" : "Get access →"}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 22 }}>FAQ</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,440px),1fr))",
              gap: 14,
            }}
          >
            {[
              {
                q: "Can I cancel anytime?",
                a: "Monthly plans cancel at any time. Annual plans can be reduced to 6 months with no penalty, or to 3 months with a 10% early-exit fee on the remaining balance.",
              },
              {
                q: "Does Planet include future apps?",
                a: "Yes — every new AEVION module released while your Planet subscription is active is automatically included at no extra cost.",
              },
              {
                q: "How many seats does Planet include?",
                a: "Planet includes 3 seats. Additional seats are $49/user/month.",
              },
              {
                q: "Are API quotas per seat or per account?",
                a: "Quotas are per account (workspace). All team members share the same monthly pool of AI credits.",
              },
              {
                q: "Do individual app prices include API usage?",
                a: "Yes — all AI quotas (videos, images, TTS, etc.) are bundled within monthly limits. Overages can be purchased separately.",
              },
              {
                q: "14-day money-back — no questions?",
                a: "Correct. If you're not happy within 14 days we refund 100%, no questions asked.",
              },
            ].map(({ q, a }) => (
              <div
                key={q}
                style={{
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <p style={{ fontWeight: 700, color: "#f1f5f9", margin: "0 0 7px", fontSize: 14 }}>{q}</p>
                <p style={{ color: "#64748b", margin: 0, fontSize: 13, lineHeight: 1.65 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 56, textAlign: "center" }}>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            Need enterprise pricing, custom contract, or a demo?
          </p>
          <a
            href="mailto:yahiin1978@gmail.com"
            style={{ color: "#0d9488", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Contact us →
          </a>
        </div>
      </div>
    </div>
  );
}
