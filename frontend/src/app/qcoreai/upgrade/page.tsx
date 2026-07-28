"use client";

import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

// Список того, что даёт покупка. Количественные обещания подтягиваются из
// реестра (tierFeatures): 28.07.2026 здесь стояло «Unlimited AI
// sessions», тогда как тариф даёт 2 000 000 токенов в месяц. Кнопка на этой
// странице ведёт в реальный чекаут, поэтому строка рядом с ней — обещание,
// а не украшение.
const PRO_BENEFITS = [
  "Access to GPT-4o, Claude Sonnet, Gemini 2.5 Flash",
  "Multi-agent pipeline builder",
  "Prompt optimizer & A/B testing",
  "Notebook collections & export",
  "Custom personas & memory",
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

type PayMethod = "card" | "paybox";

export default function QCoreUpgradePage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [plan, setPlan] = useState<"pro" | "enterprise">("pro");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; contactUrl?: string } | null>(null);

  // Цена берётся из живого прайса, а не из числа в компоненте. 28.07.2026 здесь
  // стояло $19 — цена тарифа Lite ДО повышения 22.07.2026; страница отстала и
  // просила у покупателя сумму, которой в реестре уже не было. Число на
  // денежном пути имеет право быть только из источника истины.
  const [tierPrice, setTierPrice] = useState<{ monthly: number; annual: number } | null>(null);
  // Что тариф даёт на самом деле — строками из реестра, без пересказа.
  const [tierFeatures, setTierFeatures] = useState<string[]>([]);
  // Локальный канал показываем, только когда он настроен на проде.
  const [payboxLive, setPayboxLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => r.json())
      .then((j) => {
        const lite = (j?.tiers ?? []).find((x: { id: string }) => x.id === "lite");
        if (!cancelled && lite) {
          setTierPrice({ monthly: lite.priceMonthly, annual: lite.priceAnnualTotal });
          if (Array.isArray(lite.features)) setTierFeatures(lite.features);
        }
      })
      .catch(() => {});
    fetch(apiUrl("/api/pricing/checkout/healthz"))
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setPayboxLive(Boolean(j?.providers?.paybox?.configured));
      })
      .catch(() => {
        if (!cancelled) setPayboxLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // QCoreAI как отдельная покупка = тариф Lite с выбранным продуктом — тот же
  // путь, что и кнопка модуля на /pricing. Второго способа купить один модуль
  // в платформе нет, и заводить его здесь незачем.
  const proPrice =
    tierPrice === null ? null : billing === "monthly" ? tierPrice.monthly : Math.round(tierPrice.annual / 12);

  async function upgrade() {
    if (plan === "enterprise") {
      window.location.href = "/pricing/contact?tier=enterprise";
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/checkout/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tierId: "lite",
          period: billing,
          seats: 1,
          modules: ["qcoreai"],
          currency: payMethod === "paybox" ? "KZT" : "USD",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      // Отказ показываем словами покупателя, а не молчанием: раньше кнопка
      // вообще не имела обработчика и на клик не отвечала ничем.
      setNotice({
        text: j.message ?? "Не удалось открыть оплату. Подписка не оформлена и деньги не списаны.",
        contactUrl: j.contactUrl ?? "/pricing/contact",
      });
    } catch {
      setNotice({
        text: "Не удалось связаться с платёжным сервисом. Деньги не списаны — попробуйте ещё раз или напишите нам.",
        contactUrl: "/pricing/contact",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Wave1Nav />
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

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, gap: 0 }}>
            <button
              onClick={() => setBilling("monthly")}
              style={{
                padding: "8px 24px",
                borderRadius: "8px 0 0 8px",
                border: "2px solid #0d9488",
                background: billing === "monthly" ? "#0d9488" : "#fff",
                color: billing === "monthly" ? "#fff" : "#0d9488",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              style={{
                padding: "8px 24px",
                borderRadius: "0 8px 8px 0",
                border: "2px solid #0d9488",
                borderLeft: "none",
                background: billing === "annual" ? "#0d9488" : "#fff",
                color: billing === "annual" ? "#fff" : "#0d9488",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Annual{" "}
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                Save 20%
              </span>
            </button>
          </div>

          {/* Plan cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {/* Pro card */}
            <div
              onClick={() => setPlan("pro")}
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
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>Pro</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>For individuals & teams</div>
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
                <span style={{ fontSize: 36, fontWeight: 800, color: "#0d9488" }}>
                  {proPrice === null ? "…" : `$${proPrice}`}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>/mo</span>
                {billing === "annual" && proPrice !== null && (
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                    Billed annually (${tierPrice?.annual}/yr)
                  </div>
                )}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {[...tierFeatures, ...PRO_BENEFITS].map((b) => (
                  <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                    <span style={{ color: "#0d9488", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise card */}
            <div
              onClick={() => setPlan("enterprise")}
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
                {/* У Enterprise в реестре priceMonthly = null: цена договорная.
                    До 28.07.2026 здесь стояло $99 — число, которого нет ни в
                    одном источнике, и заплатить его было нельзя: чекаут
                    Enterprise уводит на форму контакта. */}
                <span style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
                  On request
                </span>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  Scope-based pricing — we quote after a call.
                </div>
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

          {/* Payment method */}
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 16,
              padding: 28,
              border: "1px solid #e2e8f0",
              marginBottom: 28,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 16 }}>
              Payment method
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => setPayMethod("card")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: payMethod === "card" ? "2px solid #0d9488" : "2px solid #e2e8f0",
                  background: payMethod === "card" ? "#f0fdfa" : "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: payMethod === "card" ? "#0d9488" : "#374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>💳</span>
                Card
              </button>
              {payboxLive === true && (
              <button
                onClick={() => setPayMethod("paybox")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: payMethod === "paybox" ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                  background: payMethod === "paybox" ? "#faf5ff" : "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: payMethod === "paybox" ? "#7c3aed" : "#374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🇰🇿</span>
                PayBox KZ
              </button>
              )}
            </div>

            {payMethod === "card" && (
              /* До 28.07.2026 здесь стояли поля «Card number / MM YY / CVC» —
                 обычные input без состояния и без отправки. Кнопка оплаты при
                 этом не имела обработчика вовсе, так что введённые данные не
                 уходили никуда, но страница приглашала ввести номер карты и CVC
                 в поле на нашем домене. Реквизиты собирает процессинг на своей
                 стороне, поэтому здесь — только объяснение, что произойдёт. */
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 14,
                  color: "#334155",
                }}
              >
                Card details are entered on the processor&apos;s secure checkout page —
                we never handle them. Clicking below opens that page.
              </div>
            )}

            {payMethod === "paybox" && payboxLive === true && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 14,
                  color: "#166534",
                }}
              >
                You will be redirected to <strong>PayBox KZ</strong> to complete payment.
                Supports Kaspi, Halyk, and local KZ bank cards. Price in KZT at current rate.
              </div>
            )}
          </div>

          {/* CTA */}
          <button
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
              cursor: busy ? "wait" : "pointer",
              marginBottom: 16,
              opacity: busy ? 0.7 : 1,
            }}
            disabled={busy}
            onClick={upgrade}
          >
            {plan === "enterprise"
              ? "Talk to sales"
              : busy
                ? "Opening checkout…"
                : `Upgrade to Pro${proPrice === null ? "" : ` — $${proPrice}/mo`}`}
          </button>

          {notice && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: "#991b1b",
                marginBottom: 16,
              }}
            >
              {notice.text}{" "}
              {notice.contactUrl && (
                <a href={notice.contactUrl} style={{ color: "#991b1b", fontWeight: 700 }}>
                  Написать нам
                </a>
              )}
            </div>
          )}

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, margin: 0 }}>
            Cancel anytime. No hidden fees. Invoices available for KZ businesses.
          </p>
        </div>
      </ProductPageShell>
    </>
  );
}
