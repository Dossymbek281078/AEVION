"use client";

import { useState } from "react";
import { activatable } from "@/lib/activatable";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { PageTracking } from "@/components/PageTracking";
import { PRICING_APP, PRICING_TERMS } from "@/lib/products";
import { PLANET_BASE_MONTHLY, fromPricePerMonth, standaloneApp } from "@/lib/termPricing";

// ⚠️ 15.09.2026 — новая ценовая политика (слово основателя). Карточки «Pro $19/mo»
// и «Enterprise $99/mo» с переключателем «помесячно / за год» сняты: помесячной и
// годовой оплаты больше нет, а этих цен не списывала ни одна касса. Теперь:
//   · подписка AEVION — срок доступа ко всей планете, 1–12 месяцев, оплата вперёд;
//   · Multichat — одно из пяти приложений, которые продаются и отдельно;
//   · Enterprise — по запросу.
// Числа — только из @/lib/termPricing.

const PLANET_FROM = fromPricePerMonth(PLANET_BASE_MONTHLY);
const MULTICHAT = standaloneApp("multichat");

const PRO_BENEFITS = [
  "Unlimited AI sessions & history",
  "Access to GPT-4o, Claude Sonnet, Gemini 2.5 Flash",
  "Multi-agent pipeline builder",
  "Prompt optimizer & A/B testing",
  "Notebook collections & export",
  "Custom personas & memory",
  "Priority response — < 1s P99",
  "API access + SDK (v0.9+)",
  "Webhook integrations",
  "50 MB file uploads per session",
];

const ENTERPRISE_BENEFITS = [
  "Everything in Pro",
  "Dedicated LLM capacity",
  "SSO / SAML 2.0",
  "Audit logs & compliance export",
  "Custom fine-tuned models",
  "SLA 99.9% uptime guarantee",
  "Dedicated account manager",
  "On-prem / private cloud deployment",
];


export default function QCoreUpgradePage() {
  const [plan, setPlan] = useState<"pro" | "enterprise">("pro");

  return (
    <>
      <Wave1Nav />
      {/* Замер посещения. Страница ведёт к оплате — кнопка уводит на /pricing#tiers,
          ссылка рядом на /pricing?app=multichat, — а посещение не считалось вовсе:
          заходы сюда не попадали в знаменатель воронки, и конверсия выглядела лучше,
          чем есть. Найдено 16.09.2026 сторожем trackingCoverage, когда он научился
          видеть внутренние ссылки на страницу цен как признак покупки (после
          лестницы сроков прямых ссылок в кассу в каталоге больше нет). */}
      <PageTracking page="qcoreai-upgrade" />
      <ProductPageShell>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                borderRadius: 8,
                padding: "4px 14px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                marginBottom: 16,
                textTransform: "uppercase",
              }}
            >
              Upgrade QCoreAI
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "#0f172a",
                margin: "0 0 12px",
                lineHeight: 1.2,
              }}
            >
              Unlock the full power of AI
            </h1>
            <p style={{ color: "#64748b", fontSize: 16, margin: 0 }}>
              Currently on <strong>Free plan</strong> — 50 messages/day, 1 provider
            </p>
          </div>

          {/* Plan cards */}
          <div
            style={{
              display: "grid",
              // Одна колонка на телефоне: две карточки по 1fr на 390px не читались.
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {/* Pro card */}
            <div
              {...activatable(() => setPlan("pro"))}
              role="radio"
              aria-checked={plan === "pro"}
              aria-label="Подписка AEVION"
              style={{
                border: plan === "pro" ? "2px solid #0d9488" : "2px solid #e2e8f0",
                borderRadius: 16,
                padding: 28,
                background: plan === "pro" ? "#f0fdfa" : "#fff",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>AEVION subscription</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>QCoreAI with every AEVION module</div>
                </div>
                {plan === "pro" && (
                  <span
                    style={{
                      background: "#0d9488",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "2px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Selected
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ color: "#64748b", fontSize: 14 }}>from </span>
                <span style={{ fontSize: 36, fontWeight: 800, color: "#0d9488" }}>
                  ${PLANET_FROM}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>/mo</span>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                  A term of 1 to 12 months, paid up front · ${PLANET_BASE_MONTHLY} for one month
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {PRO_BENEFITS.map((b) => (
                  <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                    <span style={{ color: "#0d9488", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise card */}
            <div
              {...activatable(() => setPlan("enterprise"))}
              role="radio"
              aria-checked={plan === "enterprise"}
              aria-label="Тариф Enterprise"
              style={{
                border: plan === "enterprise" ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                borderRadius: 16,
                padding: 28,
                background: plan === "enterprise" ? "#faf5ff" : "#fff",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>Enterprise</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>For organizations</div>
                </div>
                {plan === "enterprise" && (
                  <span
                    style={{
                      background: "#7c3aed",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "2px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Selected
                  </span>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#7c3aed" }}>
                  On request
                </span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {ENTERPRISE_BENEFITS.map((b) => (
                  <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                    <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Оплата происходит НЕ на этой странице.
              До 23.08.2026 здесь стояли поля «Card number», «MM / YY» и «CVC» —
              без value, без onChange, без формы и без единого вызова API во всём
              файле. Человек мог ввести настоящие данные карты, и они не уходили
              никуда: страница их даже не читала. Рядом обещалось «Card via
              Stripe» и «You will be redirected to PayBox KZ», хотя касса
              платформы работает через Lemon Squeezy (замер 23.08.2026:
              /api/pricing/checkout/healthz -> primaryProvider lemonsqueezy).
              Карту на своём домене мы не принимаем вообще — оплата идёт на
              стороне поставщика, и просить её здесь нельзя ни в каком виде. */}
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 16,
              padding: 28,
              border: "1px solid #e2e8f0",
              marginBottom: 28,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 8 }}>
              Payment
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              We never ask for card details on this site. Checkout opens on our payment
              provider&apos;s own secure page, and the current plans and prices live on the
              pricing page.
            </p>
          </div>

          {/* Multichat — одно из пяти приложений, которые продаются и отдельно. */}
          {MULTICHAT ? (
            <p style={{ textAlign: "center", color: "#475569", fontSize: 14, margin: "0 0 20px" }}>
              Need only the model council?{" "}
              <a href={PRICING_APP(MULTICHAT.slug)} style={{ color: "#0d9488", fontWeight: 700 }}>
                {MULTICHAT.name} on its own — from ${fromPricePerMonth(MULTICHAT.baseMonthly)}/mo →
              </a>
            </p>
          ) : null}

          {/* Кнопка ведёт на страницу тарифов — там выбор срока и настоящая касса.
              До 23.08.2026 у неё не было ни onClick, ни type="submit", ни формы
              вокруг: нажатие не делало ничего, при том что страница обещала
              переход к оплате. */}
          <button
            onClick={() => {
              window.location.href = plan === "pro" ? PRICING_TERMS : "/pricing";
            }}
            style={{
              width: "100%",
              padding: "16px 24px",
              borderRadius: 12,
              border: "none",
              background:
                plan === "pro"
                  ? "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            {plan === "pro" ? `Choose a term — from $${PLANET_FROM}/mo` : "Ask about Enterprise"}
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, margin: 0 }}>
            One payment for the whole term. No hidden fees. Invoices available for KZ businesses.
          </p>
        </div>
      </ProductPageShell>
    </>
  );
}
