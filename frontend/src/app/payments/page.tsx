import Link from "next/link";
import type { CSSProperties } from "react";

const btnPrimary: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 15,
  border: "none",
  boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
};

const btnGhost: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: 15,
  border: "1px solid rgba(255,255,255,0.35)",
};

const featureCards = [
  {
    slug: "links",
    title: "Payment Links",
    description:
      "Generate shareable payment links in seconds. Public /pay/[id] checkout works on any device — no integration required.",
    accent: "#0d9488",
    icon: "🔗",
  },
  {
    slug: "methods",
    title: "Payment Methods",
    description:
      "12 methods across cards, wallets, banks, crypto, and AEC. Unified checkout across every rail — single API surface.",
    accent: "#2563eb",
    icon: "💳",
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    description:
      "Real HMAC-SHA256 signed payloads with replay protection, automatic retries, and a full delivery audit log.",
    accent: "#7c3aed",
    icon: "⚡",
  },
  {
    slug: "settlements",
    title: "Settlements",
    description:
      "Daily or on-demand settlement to bank or AEC wallet. Royalty auto-split executes via AEVION Bank.",
    accent: "#059669",
    icon: "🏦",
  },
  {
    slug: "subscriptions",
    title: "Subscriptions",
    description:
      "Recurring billing with trials, smart-dunning retries (day 1/3/7), MRR + ARR tracking across 4 currencies.",
    accent: "#0ea5e9",
    icon: "🔁",
  },
  {
    slug: "fraud",
    title: "Fraud detection",
    description:
      "6-rule engine with QSign-stamped device fingerprint. Reviewer queue with one-click allow/block decisions.",
    accent: "#dc2626",
    icon: "🛡️",
  },
  {
    slug: "compliance",
    title: "Compliance",
    description:
      "KYC tier ladder, sanctions screening across 5 lists, multi-jurisdiction VAT/GST, downloadable Planet-anchored reports.",
    accent: "#4338ca",
    icon: "📋",
  },
  {
    slug: "api",
    title: "Developer API",
    description:
      "REST + JSON, idempotency keys, OpenAPI 3.1, Node + Python SDKs. Test/live API key management built in.",
    accent: "#4f46e5",
    icon: "⚙️",
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    description:
      "Live overview across every surface with sparklines — MRR, settlements, fraud, webhook health, links, and a unified activity feed.",
    accent: "#0d9488",
    icon: "📊",
  },
  {
    slug: "status",
    title: "Status",
    description:
      "Live health checks against /api/health and every public endpoint, refreshed every 30s. Uptime, latency, and surface counts.",
    accent: "#10b981",
    icon: "🟢",
  },
  {
    slug: "refunds",
    title: "Refunds",
    description:
      "Issue partial or full refunds against any paid link. payment.refunded webhook fans out via HMAC. Idempotent, audit-trailed.",
    accent: "#ea580c",
    icon: "↩",
  },
  {
    slug: "audit",
    title: "Audit log",
    description:
      "Append-only log of every state-changing API call — actor key prefix, IP, UA, target id. Filterable, KV-persisted, 5s auto-refresh.",
    accent: "#475569",
    icon: "🧾",
  },
  {
    slug: "disputes",
    title: "Disputes",
    description:
      "Open chargebacks against any paid link. 5-state lifecycle (needs_response → under_review → won/lost), 7-day SLA, webhook fanout via the retry queue.",
    accent: "#b91c1c",
    icon: "⚖",
  },
];

const roadmapItems = [
  { label: "Payment Links — create, share & public /pay/[id] checkout", status: "live" },
  { label: "Payment Methods — 12-rail unified checkout", status: "live" },
  { label: "Webhooks — HMAC-SHA256 signed event delivery", status: "live" },
  { label: "Settlements — bank + AEC wallet", status: "live" },
  { label: "Royalty auto-split on settlement (AEVION Bank)", status: "live" },
  { label: "Multi-currency support (USD / EUR / KZT / AEC)", status: "live" },
  { label: "Recurring billing & subscriptions with smart dunning", status: "live" },
  { label: "Fraud detection via 6-rule engine + QSign device fingerprint", status: "live" },
  { label: "Planet compliance reports (KYC / sanctions / VAT-GST)", status: "live" },
  { label: "Developer SDK + OpenAPI 3.1 + API key manager", status: "live" },
  { label: "Real /api/payments/v1 routes (links / checkout / subs / webhooks / settlements)", status: "live" },
  { label: "OpenAPI 3.1 spec served at /api/openapi.json", status: "live" },
  { label: "Cross-surface dashboard with live activity feed + sparklines", status: "live" },
  { label: "Cross-device payment links (server mirror + public /api/pay/[id])", status: "live" },
  { label: "Server-side webhook delivery via node:crypto HMAC", status: "live" },
  { label: "/api/health probe + live /payments/status monitor", status: "live" },
  { label: "Persistence adapter (Vercel KV-aware, memory fallback)", status: "live" },
  { label: "Refunds API + UI with webhook fanout (payment.refunded)", status: "live" },
  { label: "Printable receipts /r/[id] with method + last4 + print CSS", status: "live" },
  { label: "Rate limiter (60/min per API key) with X-RateLimit-* headers", status: "live" },
  { label: "Audit log with KV persistence + viewer (filter, autorefresh)", status: "live" },
  { label: "Webhook retry queue with exp backoff (10s→6h, 6 attempts) + Vercel cron", status: "live" },
  { label: "Disputes endpoint + UI surface (5-state lifecycle, webhook fanout)", status: "live" },
];

export default function PaymentsPage() {
  return (
    <main style={{ padding: 0 }}>
      {/* Hero */}
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #134e4a 48%, #0d9488 100%)",
          color: "#fff",
          padding: "44px 24px 52px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Payments Rail · v1.4 · 13 surfaces · disputes + retry queue + cron
          </div>

          <h1
            style={{
              fontSize: "clamp(26px, 4.5vw, 42px)",
              fontWeight: 800,
              lineHeight: 1.12,
              margin: "18px 0 14px",
              maxWidth: 920,
              letterSpacing: "-0.03em",
            }}
          >
            Payments Rail
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              opacity: 0.93,
              maxWidth: 760,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            The AEVION Payments Rail connects creators, IP holders, and
            platforms through a single infrastructure layer — links,
            methods, webhooks, settlements, subscriptions, fraud,
            compliance, and a developer API, tied natively to the trust
            graph.
          </p>

          <div
            style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}
          >
            <Link href="/payments/dashboard" style={btnPrimary}>
              Open Dashboard →
            </Link>
            <Link href="/payments/links" style={btnGhost}>
              Create a link
            </Link>
            <Link href="/payments/api" style={btnGhost}>
              Developer API
            </Link>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {/* Feature cards */}
        <section style={{ marginBottom: 36 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#0d9488",
              marginBottom: 8,
            }}
          >
            Core surfaces
          </div>
          <h2
            style={{
              fontSize: "clamp(18px, 3vw, 26px)",
              fontWeight: 900,
              margin: "0 0 20px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            Everything you need to move money
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {featureCards.map((card) => (
              <Link
                key={card.slug}
                href={`/payments/${card.slug}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: 22,
                  borderRadius: 18,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "#fff",
                  boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
                  display: "block",
                  transition: "box-shadow 0.15s",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>{card.icon}</div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 17,
                    color: "#0f172a",
                    marginBottom: 8,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}
                >
                  {card.description}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    fontWeight: 800,
                    color: card.accent,
                    letterSpacing: "0.04em",
                  }}
                >
                  Explore →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* How the rail works */}
        <section
          style={{
            marginBottom: 32,
            padding: "28px 24px",
            borderRadius: 20,
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#5eead4",
              marginBottom: 8,
            }}
          >
            How the rail works
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 20px",
              letterSpacing: "-0.02em",
            }}
          >
            From link to settlement in 4 steps
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                step: "1",
                title: "Create",
                desc: "Generate a Payment Link or initiate a checkout session via API. Set amount, currency, and settlement target.",
                color: "#0d9488",
              },
              {
                step: "2",
                title: "Collect",
                desc: "Payer completes checkout using any supported method — card, wallet, AEC credit. Single unified flow.",
                color: "#2563eb",
              },
              {
                step: "3",
                title: "Notify",
                desc: "Webhooks fire HMAC-signed events at every state change. Your system stays in sync automatically.",
                color: "#7c3aed",
              },
              {
                step: "4",
                title: "Settle",
                desc: "Funds land in your bank account or AEC wallet. Royalty splits execute automatically via AEVION Bank.",
                color: "#059669",
              },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  padding: "18px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: s.color,
                    marginBottom: 4,
                  }}
                >
                  STEP {s.step}
                </div>
                <div
                  style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}
                >
                  {s.title}
                </div>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}
                >
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section
          style={{
            marginBottom: 32,
            padding: "24px",
            borderRadius: 20,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#7c3aed",
              marginBottom: 8,
            }}
          >
            Roadmap
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 18px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            What&apos;s coming to Payments Rail
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {roadmapItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background:
                      item.status === "live"
                        ? "rgba(5,150,105,0.14)"
                        : "rgba(124,58,237,0.10)",
                    color:
                      item.status === "live" ? "#047857" : "#6d28d9",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.status === "live" ? "live" : "planned"}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section
          style={{
            marginBottom: 32,
            padding: "22px 24px",
            borderRadius: 16,
            background:
              "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(99,102,241,0.06))",
            border: "1px solid rgba(13,148,136,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{ fontWeight: 900, fontSize: 17, color: "#0f172a" }}
            >
              Part of the AEVION trust infrastructure
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Payments Rail sits alongside QRight, QSign, IP Bureau, Planet,
              and AEVION Bank in the 27-node ecosystem.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/bank"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              AEVION Bank →
            </Link>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.2)",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              All modules →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
