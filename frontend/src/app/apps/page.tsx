"use client";

import { useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

type Billing = "monthly" | "annual";

/* ── Prices ─────────────────────────────────────────────────────────────────── */
const PLANET_MONTHLY = 250;
const PLANET_ANNUAL_PER_MO = 200; // 12-month commitment, billed monthly

interface App {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  price: number; // 0 = free
  href: string;
  cat: string;
  highlights: string[];
  badge?: string;
  checkoutUrl?: string;
}

const APPS: App[] = [
  /* ── Developer ──────────────────────────────────────────────────────── */
  {
    id: "devhub",
    icon: "🛠",
    name: "DevHub Studio Pro",
    tagline: "Full-stack browser IDE + AI + deploy",
    price: 149,
    href: "/devhub",
    cat: "Developer",
    highlights: [
      "Monaco IDE (VS Code engine)",
      "AI code generation",
      "Deploy: Railway · Vercel · Cloudflare Pages",
      "Free *.aevion.build subdomain",
      "50 AI videos · 200 images/mo",
      "Team collaborators",
    ],
    badge: "Most popular",
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/ab30b6f3-1d69-4db6-b7ab-86ef0d363a57",
  },
  {
    id: "qcoreai",
    icon: "🧠",
    name: "QCoreAI",
    tagline: "Multi-model AI assistant",
    price: 0,
    href: "/qcoreai",
    cat: "Developer",
    highlights: ["Claude · GPT · Gemini in one UI", "Unlimited usage", "Always free"],
    badge: "Free forever",
  },
  /* ── Finance ────────────────────────────────────────────────────────── */
  {
    id: "qventure",
    icon: "📈",
    name: "QVenture",
    tagline: "AI investment analyst · score 0–100",
    price: 39,
    href: "/qventure",
    cat: "Finance",
    highlights: ["4-role advice panel", "Market sizing & risk matrix", "PDF export"],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/79ca3e07-6c75-4de7-8052-0f3bb99277a2",
  },
  {
    id: "qpaynet",
    icon: "💳",
    name: "QPayNet",
    tagline: "Embedded payment infrastructure",
    price: 29,
    href: "/qpaynet",
    cat: "Finance",
    highlights: ["KZT · USD · multi-currency", "Virtual cards", "API + webhooks"],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/f0966b9a-6c3c-41ee-9b36-e2fd1a0a82a3",
  },
  /* ── Business & Legal ───────────────────────────────────────────────── */
  {
    id: "qcontract",
    icon: "💣",
    name: "QContract",
    tagline: "Self-destructing secure documents",
    price: 19,
    href: "/qcontract",
    cat: "Business",
    highlights: [
      "View-count & expiry limits",
      "Password & e-signature gates",
      "QRight IP timestamping",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/8175a6b2-f3fa-4b51-bed6-da993267701d",
  },
  {
    id: "constitution",
    icon: "📜",
    name: "Constitution Design Lab",
    tagline: "AI-powered IP registration",
    price: 29,
    href: "/constitution",
    cat: "Business",
    highlights: [
      "12-page IP constitution builder",
      "27+ filing endpoints",
      "QSign cryptographic proof",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/a3175f68-f454-4657-8714-65d93ef95b63",
  },
  {
    id: "bureau",
    icon: "🔐",
    name: "AEVION IP Bureau",
    tagline: "Proof-of-creation & authorship",
    price: 29,
    href: "/bureau",
    cat: "Business",
    highlights: [
      "Ed25519 signature + SHA-256 hash",
      "OpenTimestamps blockchain anchoring",
      "Tamper-evident certificates",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/be5cf241-159f-4f1c-9818-1e9634ba5fab",
  },
  /* ── Health ─────────────────────────────────────────────────────────── */
  {
    id: "qrenew",
    icon: "🌱",
    name: "QRenew / QMelanin",
    tagline: "Longevity & cellular renewal protocol",
    price: 29,
    href: "/qrenew",
    cat: "Health",
    highlights: [
      "Evidence-graded supplement stack (A/B/C)",
      "12-week protocol with biomarker tracking",
      "Zn:Cu 8–15:1 melanin support guide",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/e3ed4f3f-7653-4e68-bdfb-ebb8ed0dbc7f",
  },
  /* ── Education ──────────────────────────────────────────────────────── */
  {
    id: "smeta",
    icon: "🏗",
    name: "Smeta Trainer",
    tagline: "AI construction estimating (Kazakhstan)",
    price: 49,
    href: "/smeta-trainer",
    cat: "Education",
    highlights: [
      "ССЦ / ЭСН corpus RK 2026",
      "AI error detection on student estimates",
      "Form 1–3 · КС-2 · КС-3 output",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/91c430c8-74f8-46f2-9499-816c93533ef4",
  },
  {
    id: "cyberchess",
    icon: "♟",
    name: "CyberChess Pro",
    tagline: "AI chess coaching & tournament platform",
    price: 19,
    href: "/cyberchess",
    cat: "Education",
    highlights: [
      "Grandmaster opening theory (CC0 corpus)",
      "Real-time AI coaching during games",
      "Club & tournament management",
    ],
    checkoutUrl: "https://aevion.lemonsqueezy.com/checkout/buy/11a4bb2a-2549-4352-a87f-80a8bdad64bd",
  },
];

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
                href={billing === "annual"
                  ? "https://aevion.lemonsqueezy.com/checkout/buy/a6a35e07-9942-4089-aec3-0faa0ea9b722"
                  : "https://aevion.lemonsqueezy.com/checkout/buy/23fa912b-b6dc-4b42-8dd8-7498b6298b1b"}
                target="_blank"
                rel="noopener noreferrer"
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
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "8px 18px",
                            background: clr,
                            color: "#fff",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          Subscribe →
                        </a>
                      ) : (
                        <Link
                          href={app.href}
                          style={{
                            padding: "8px 18px",
                            background: clr,
                            color: "#fff",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
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

        {/* ── Comparison table ──────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 56,
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "22px 26px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
              Planet vs. Individual
            </h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th style={{ padding: "12px 20px", textAlign: "left", color: "#64748b", fontWeight: 600 }}>App</th>
                  <th style={{ padding: "12px 20px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>Individual</th>
                  <th style={{ padding: "12px 20px", textAlign: "right", color: "#0d9488", fontWeight: 700 }}>
                    Planet $250/mo
                  </th>
                </tr>
              </thead>
              <tbody>
                {APPS.map((app, i) => (
                  <tr
                    key={app.id}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <td style={{ padding: "12px 20px", color: "#e2e8f0" }}>
                      {app.icon} {app.name}
                    </td>
                    <td style={{ padding: "12px 20px", textAlign: "right", color: "#94a3b8" }}>
                      {app.price === 0 ? "Free" : `$${app.price}/mo`}
                    </td>
                    <td style={{ padding: "12px 20px", textAlign: "right" }}>
                      <span style={{ color: "#0d9488", fontWeight: 700 }}>✓ Included</span>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)", background: "rgba(13,148,136,0.08)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "#fff" }}>Total paid apps</td>
                  <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: 700 }}>
                    <span style={{ color: "#ef4444", textDecoration: "line-through" }}>${RACK_RATE}/mo</span>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <span style={{ color: "#0d9488", fontWeight: 900, fontSize: 18 }}>$250/mo</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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
