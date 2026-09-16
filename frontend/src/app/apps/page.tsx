"use client";

import { channelNow } from "@/lib/channelNow";
import { useEffect, useState } from "react";
import { keepChannel, withChannel } from "@/lib/products";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { productById } from "@/lib/products";
import { track } from "@/lib/track";
import { PageTracking } from "@/components/PageTracking";
import {
  PLANET_BASE_MONTHLY,
  TERM_MONTHS,
  TERM_NAME,
  TERM_TIERS,
  fromPricePerMonth,
  termPricePerMonth,
  termTotal,
} from "@/lib/termPricing";

/* ── Prices ─────────────────────────────────────────────────────────────────── */
// ⚠️ 15.09.2026 — новая ценовая политика (слово основателя). Прежняя карточка
// Planet с переключателем «помесячно / за год» и двумя прямыми ссылками Lemon
// Squeezy снята: месячной и годовой оплаты больше нет. Тариф — это СРОК доступа
// ко всей планете (1 / 3 / 6 / 9 / 12 месяцев), оплата за весь срок вперёд.
//
// Ни одного числа в этом файле: лестница, цены месяца и итоги — из
// @/lib/termPricing (копия реестра бэкенда под сторожем), карточки приложений —
// из @/lib/products. Прямой кассы на новую лестницу нет (товары ещё заводятся в
// магазине), поэтому кнопка ведёт на /pricing — к выбору срока и в кассу.

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

type App = AppDef & { price: number; checkoutUrl?: string; term: boolean };

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
    id: "multichat-engine",
    productId: "multichat",
    icon: "💬",
    name: "AEVION Multichat",
    tagline: "A council of models instead of one answer",
    href: "/multichat-engine",
    cat: "Developer",
    // Текст — с посадочной модуля (/multichat-engine/launch), не сочинён здесь.
    highlights: [
      "Answers from four independent providers side by side",
      "A map of where the models disagree",
      "A receipt you can verify by link",
    ],
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
    // Отдельно не продаётся с 15.09.2026 — входит в подписку AEVION.
    id: "qpaynet",
    icon: "💳",
    name: "QPayNet",
    tagline: "Embedded payment infrastructure",
    href: "/qpaynet",
    cat: "Finance",
    highlights: ["KZT · USD · multi-currency", "Payouts to card, Kaspi and bank transfer", "API + webhooks"],
  },
  /* ── Business & Legal ───────────────────────────────────────────────── */
  {
    // Отдельно не продаётся с 15.09.2026 — входит в подписку AEVION.
    id: "qcontract",
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
    // Constitution Pro / Team отдельными подписками сняты 15.09.2026 —
    // модуль входит в подписку AEVION.
    id: "constitution",
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
    // Единая цена везде: гайд Anti-Grey Protocol на Gumroad, разовая покупка
    // (та же ссылка, что на /qmelanin).
  },
  /* ── Education ──────────────────────────────────────────────────────── */
  {
    // Отдельно не продаётся с 15.09.2026 — входит в подписку AEVION.
    id: "smeta",
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
  return {
    ...a,
    price: product?.priceUsd ?? 0,
    checkoutUrl: product?.href,
    term: product?.billing === "term",
  };
});

const CATS = ["Developer", "Finance", "Business", "Health", "Education"];

const CAT_COLOR: Record<string, string> = {
  Developer: "#0d9488",
  Finance: "#7c3aed",
  Business: "#1d4ed8",
  Health: "#16a34a",
  Education: "#b45309",
};

/** Приложения, которые продаются отдельно на срок (пять по политике 15.09.2026). */
const TERM_APPS = APPS.filter((a) => a.term && a.price > 0);
/** Пять приложений по отдельности за 1 месяц — против всей планеты за тот же месяц. */
const RACK_RATE = TERM_APPS.reduce((s, a) => s + a.price, 0);
const PLANET_FROM = fromPricePerMonth(PLANET_BASE_MONTHLY);
/**
 * Приложения, которые были бесплатными и до политики 15.09.2026 (у карточек не
 * было цены). Всё остальное без товара в каталоге — прежние платные модули:
 * отдельно их больше не продают, они входят в подписку AEVION.
 */
const FREE_APP_IDS = new Set(["qcoreai", "tiktok-publisher"]);

export default function AppsPage() {
  // Метка канала для ссылок в кассу. Витрина модулей — клиентская
  // страница, поэтому метка берётся после отрисовки: на сервере адреса
  // ещё нет, и сборка ссылки при отрисовке разошлась бы с разметкой.
  const [channel, setChannel] = useState<string | null>(null);
  useEffect(() => {
    setChannel(channelNow());
  }, []);
  const planetHref = keepChannel("/pricing#tiers", channel);

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
            Five apps are sold on their own. The subscription opens every module for a term of 1 to 12 months.
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
                  <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: "#fff" }}>AEVION subscription</h2>
                  <p style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontSize: 14 }}>
                    Every module · a term of 1 to 12 months · paid up front
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Every module — no per-module charge",
                  "Modules released during your term are included",
                  "The longer the term, the cheaper the month",
                ].map((f) => (
                  <span key={f} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#fff" }}>
                    ✓ {f}
                  </span>
                ))}
              </div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 16 }}>
                The five apps bought separately: ${RACK_RATE} for one month. The whole planet:
                ${PLANET_BASE_MONTHLY} for one month, or ${PLANET_FROM}/mo on a 12-month term.
              </p>
            </div>

            {/* right — term ladder */}
            <div style={{ textAlign: "center", minWidth: 220, flex: "0 1 280px" }}>
              <div style={{ color: "#fff" }}>
                <span style={{ fontSize: 15, opacity: 0.8 }}>from </span>
                <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1 }}>${PLANET_FROM}</span>
                <span style={{ fontSize: 15, opacity: 0.7 }}>/mo</span>
              </div>
              {/* Лестница сроков целиком: человек видит и цену месяца, и платёж
                  за срок вперёд — до перехода к кассе, а не после. */}
              <table style={{ width: "100%", marginTop: 14, borderCollapse: "collapse", fontSize: 13, color: "#fff" }}>
                <tbody>
                  {TERM_TIERS.map((t) => (
                    <tr key={t} style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                      <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 700 }} translate="no">{TERM_NAME[t]}</td>
                      <td style={{ padding: "5px 4px", textAlign: "left", opacity: 0.8 }}>
                        {TERM_MONTHS[t]} mo
                      </td>
                      <td style={{ padding: "5px 4px", textAlign: "right" }}>
                        ${termPricePerMonth(PLANET_BASE_MONTHLY, t)}/mo
                      </td>
                      <td style={{ padding: "5px 4px", textAlign: "right", opacity: 0.8 }}>
                        ${termTotal(PLANET_BASE_MONTHLY, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <a
                href={planetHref}
                onClick={() =>
                  // Намерение, а не начало оплаты: оплата начнётся на /pricing,
                  // и там своё checkout_start — иначе покупка считалась бы дважды.
                  track({
                    type: "cta_click",
                    tier: "planet",
                    source: "apps/planet",
                    meta: { target: "pricing" },
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
                Choose a term →
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
            Five apps are sold on their own, on the same term ladder. Every other module comes with the AEVION subscription.
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
                        {app.term ? (
                          <>
                            <span style={{ fontSize: 13, color: "#64748b" }}>from </span>
                            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
                              ${fromPricePerMonth(app.price)}
                            </span>
                            <span style={{ fontSize: 13, color: "#64748b" }}>/mo</span>
                          </>
                        ) : app.price > 0 ? (
                          <>
                            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>${app.price}</span>
                            <span style={{ fontSize: 13, color: "#64748b" }}> one-time</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8" }}>
                            {FREE_APP_IDS.has(app.id) ? "Free" : "In the subscription"}
                          </span>
                        )}
                      </div>
                      {app.checkoutUrl && app.term ? (
                        <a
                          href={keepChannel(app.checkoutUrl, channel)}
                          aria-label={`Выбрать срок: ${app.name}`}
                          onClick={() =>
                            track({
                              type: "cta_click",
                              source: `apps/${app.id}`,
                              meta: { module: app.id, target: "pricing" },
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
                          Choose a term →
                        </a>
                      ) : app.checkoutUrl ? (
                        <a
                          href={withChannel(app.checkoutUrl, channel, "apps")}
                          aria-label={`Купить: ${app.name}`}
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
                          Buy →
                        </a>
                      ) : (
                        <Link
                          href={app.href}
                          aria-label={`${app.price === 0 ? "Открыть" : "Получить доступ"}: ${app.name}`}
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
                          {app.price === 0 ? "Open →" : "Get access →"}
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
                q: "How is it billed?",
                a: "You choose a term — 1, 3, 6, 9 or 12 months — and pay for the whole term up front, in one payment. There is no monthly or annual billing. The longer the term, the cheaper the month.",
              },
              {
                q: "Does the subscription include future apps?",
                a: "Yes — every new AEVION module released while your paid term is active is included at no extra cost.",
              },
              {
                q: "Which apps can I buy on their own?",
                a: "Five: CyberChess, Multichat, QVenture, IP Bureau and DevHub — on the same term ladder. Every other module comes only with the AEVION subscription.",
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
