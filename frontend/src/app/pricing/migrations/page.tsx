"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

interface Migration {
  id: string;
  fromName: string;
  fromColor: string;
  toModule: string;
  toName: string;
  estDays: string;
  costDelta: string;
  steps: number;
}

const MIGRATIONS: Migration[] = [
  { id: "docusign", fromName: "DocuSign", fromColor: "#ffcc00", toModule: "QSign", toName: "AEVION QSign", estDays: "5-14 дней", costDelta: "−73%", steps: 4 },
  { id: "openai", fromName: "OpenAI", fromColor: "#10a37f", toModule: "QCoreAI", toName: "AEVION QCoreAI", estDays: "3-7 дней", costDelta: "−45%", steps: 4 },
  { id: "stripe", fromName: "Stripe Connect", fromColor: "#635bff", toModule: "QPayNet", toName: "AEVION QPayNet", estDays: "14-30 дней", costDelta: "−42% на latency", steps: 4 },
  { id: "patently", fromName: "Patently", fromColor: "#1a1a1a", toModule: "IP Bureau", toName: "AEVION IP Bureau", estDays: "7-14 дней", costDelta: "−74% per registration", steps: 4 },
];

export default function PricingMigrationsPage() {
  const tp = usePricingT();
  const [active, setActive] = useState<string | null>("docusign");

  useEffect(() => {
    track({ type: "page_view", source: "pricing/migrations" });
  }, []);

  return (
    <ProductPageShell maxWidth={1080}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/pricing"
          style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          {tp("back.allTiers")}
        </Link>
      </div>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "32px 0 24px" }}>
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
          {tp("migrations.badge")}
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            margin: 0,
            marginBottom: 12,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("migrations.title")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#475569",
            maxWidth: 680,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {tp("migrations.subtitle")}
        </p>
      </section>

      {/* Migration tabs */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {MIGRATIONS.map((m) => (
          <button
            key={m.id}
            onClick={() => setActive(m.id)}
            style={{
              padding: "14px 16px",
              background: active === m.id ? "linear-gradient(180deg, #0f172a, #1e293b)" : "#fff",
              color: active === m.id ? "#f8fafc" : "#0f172a",
              border: active === m.id ? "none" : BORDER,
              borderRadius: 12,
              boxShadow: active === m.id ? "0 12px 40px rgba(15,23,42,0.25)" : CARD,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "transform 0.15s ease",
              transform: active === m.id ? "translateY(-3px)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: m.fromColor,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {m.fromName.slice(0, 2)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>
                {m.fromName} → {m.toModule}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: active === m.id ? "#5eead4" : "#0d9488",
                letterSpacing: "0.04em",
              }}
            >
              {m.costDelta} · {m.estDays}
            </div>
          </button>
        ))}
      </section>

      {/* Active migration content */}
      {MIGRATIONS.filter((m) => m.id === active).map((m) => (
        <article
          key={m.id}
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 16,
            padding: 28,
            boxShadow: CARD,
            marginBottom: 36,
          }}
        >
          {/* Top stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 28,
              padding: 18,
              background: "linear-gradient(135deg, rgba(13,148,136,0.05), rgba(14,165,233,0.05))",
              borderRadius: 12,
              border: "1px solid rgba(13,148,136,0.15)",
            }}
          >
            <Stat label={tp("migrations.stat.estDays")} value={m.estDays} />
            <Stat label={tp("migrations.stat.cost")} value={m.costDelta} />
            <Stat label={tp("migrations.stat.steps")} value={`${m.steps} ${tp("migrations.stat.stepsUnit")}`} />
            <Stat label={tp("migrations.stat.zeroDowntime")} value="✓" />
          </div>

          {/* What changes */}
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 14, letterSpacing: "-0.02em" }}>
            {tp("migrations.changes.title")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            <div
              style={{
                padding: 16,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#991b1b",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {tp("migrations.changes.before")} {m.fromName}
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
                {[1, 2, 3].map((i) => (
                  <li key={i}>{tp(`migrations.${m.id}.before.b${i}`)}</li>
                ))}
              </ul>
            </div>
            <div
              style={{
                padding: 16,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#065f46",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {tp("migrations.changes.after")} {m.toName}
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#065f46", lineHeight: 1.6 }}>
                {[1, 2, 3].map((i) => (
                  <li key={i}>{tp(`migrations.${m.id}.after.b${i}`)}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Steps */}
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 14, letterSpacing: "-0.02em" }}>
            {tp("migrations.steps.title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 14,
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: BORDER,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {s}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                    {tp(`migrations.${m.id}.step${s}.title`)}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
                    {tp(`migrations.${m.id}.step${s}.body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Outcome quote */}
          <blockquote
            style={{
              margin: 0,
              marginBottom: 24,
              padding: "16px 20px",
              background: "linear-gradient(135deg, rgba(13,148,136,0.04), rgba(14,165,233,0.04))",
              borderLeft: "4px solid #0d9488",
              borderRadius: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "#0f172a", lineHeight: 1.55, fontStyle: "italic" }}>
              «{tp(`migrations.${m.id}.quote`)}»
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontWeight: 700 }}>
              — {tp(`migrations.${m.id}.quoteBy`)}
            </div>
          </blockquote>

          {/* CTA row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/pricing/contact?source=migration-${m.id}`}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              {tp("migrations.cta.help")}
            </Link>
            <Link
              href="/pricing/cases"
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 10,
                background: "#f1f5f9",
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              {tp("migrations.cta.cases")}
            </Link>
          </div>
        </article>
      ))}

      {/* Final FAQ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 16, letterSpacing: "-0.02em" }}>
          {tp("migrations.faq.title")}
        </h2>
        <div>
          {[1, 2, 3, 4].map((n) => (
            <details
              key={n}
              style={{
                background: "#fff",
                border: BORDER,
                borderRadius: 10,
                marginBottom: 8,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              <summary style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", outline: "none", cursor: "pointer" }}>
                {tp(`migrations.faq.q${n}`)}
              </summary>
              <p style={{ margin: 0, marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                {tp(`migrations.faq.a${n}`)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </ProductPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0d9488", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}
