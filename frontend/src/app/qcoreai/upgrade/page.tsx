"use client";

import { useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";

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

type PayMethod = "card" | "paybox";

export default function QCoreUpgradePage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [plan, setPlan] = useState<"pro" | "enterprise">("pro");

  const proPrice = billing === "monthly" ? 19 : Math.round(19 * 0.8);
  const enterprisePrice = billing === "monthly" ? 99 : Math.round(99 * 0.8);

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
                  ${proPrice}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>/mo</span>
                {billing === "annual" && (
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                    Billed annually (${proPrice * 12}/yr)
                  </div>
                )}
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
                <span style={{ fontSize: 36, fontWeight: 800, color: "#7c3aed" }}>
                  ${enterprisePrice}
                </span>
                <span style={{ color: "#64748b", fontSize: 14 }}>/mo</span>
                {billing === "annual" && (
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                    Billed annually (${enterprisePrice * 12}/yr)
                  </div>
                )}
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
                Card via Stripe
              </button>
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
            </div>

            {payMethod === "card" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  placeholder="Card number"
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input
                    placeholder="MM / YY"
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <input
                    placeholder="CVC"
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            )}

            {payMethod === "paybox" && (
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
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            Upgrade to {plan === "pro" ? "Pro" : "Enterprise"} — $
            {plan === "pro" ? proPrice : enterprisePrice}/mo
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, margin: 0 }}>
            Cancel anytime. No hidden fees. Invoices available for KZ businesses.
          </p>
        </div>
      </ProductPageShell>
    </>
  );
}
