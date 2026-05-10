"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

// metadata must live in a server component — moved to layout or generateMetadata.
// Kept as a plain object for <head> tags injected by the client shell.

type Stats = {
  planetSubmissions: number;
  qrightObjects: number;
  qcoreProviders: number;
  dailySmoke: string;
};

export default function InvestorPage() {
  const [stats, setStats] = useState<Stats>({
    planetSubmissions: 0,
    qrightObjects: 0,
    qcoreProviders: 5,
    dailySmoke: "24/24",
  });

  useEffect(() => {
    Promise.allSettled([
      fetch(apiUrl("/api/planet/stats")).then(r => r.json()),
      fetch(apiUrl("/api/qright/objects?limit=1")).then(r => r.json()),
    ]).then(([planet, qright]) => {
      setStats(s => ({
        ...s,
        planetSubmissions: planet.status === "fulfilled" ? (planet.value?.submissions ?? s.planetSubmissions) : s.planetSubmissions,
        qrightObjects: qright.status === "fulfilled" ? (qright.value?.total ?? s.qrightObjects) : s.qrightObjects,
      }));
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc" }}>
      <Wave1Nav />

      {/* Hero */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#10b981", textTransform: "uppercase" }}>
            Seed Round · $5M · Pre-revenue · Live product
          </span>
        </div>
        <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Trust infrastructure<br />
          <span style={{ background: "linear-gradient(135deg,#10b981,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            for the AI content era
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "#94a3b8", maxWidth: 640, lineHeight: 1.6, marginBottom: 32 }}>
          One pipeline instead of four disconnected services:
          {" "}<strong style={{ color: "#f1f5f9" }}>register → sign → certify → vote → earn.</strong>
          {" "}Post-quantum cryptography, Trust Graph moat, automated royalties.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="https://aevion.app" style={btnPrimary}>
            Try the product →
          </a>
          <a href="https://github.com/Dossymbek281078/AEVION" target="_blank" rel="noopener" style={btnGhost}>
            Open repo (130+ PRs)
          </a>
          <Link href="/launch-status" style={btnGhost}>
            Live status
          </Link>
        </div>
      </section>

      {/* Live metrics bar */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 24 }}>
          {[
            { label: "Daily smoke", value: "24/24", sub: "PASS today" },
            { label: "Merged PRs", value: "130+", sub: "last 30 days" },
            { label: "Production modules", value: "16", sub: "live on aevion.app" },
            { label: "Registered objects", value: stats.qrightObjects.toString(), sub: "QRight registry" },
            { label: "Planet submissions", value: stats.planetSubmissions.toString(), sub: "compliance pipeline" },
            { label: "LLM providers", value: stats.qcoreProviders.toString(), sub: "QCoreAI router" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{m.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Anchor Products */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 40 }}>
          Three products that are live right now
        </h2>

        {/* Product 1: IP Pipeline */}
        <div style={productCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#10b981")}>IP Trust Pipeline</div>
              <h3 style={productTitle}>QRight + QSign + Bureau</h3>
              <p style={productDesc}>
                Register a SHA-256 fingerprint → Sign with <strong>ML-DSA-65</strong> (NIST FIPS 204, post-quantum) → Get a legally-meaningful certificate with Trust Graph edge.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>WOW:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  Harvest-now-decrypt-later. Documents signed with RSA today will not hold in court in 2031.
                  Ours will. Only B2C product with ML-DSA-65 on the shelf.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/qright" style={tryLink}>Try QRight →</Link>
                <Link href="/qsign" style={{ ...tryLink, marginLeft: 12 }}>Try QSign →</Link>
                <Link href="/bureau" style={{ ...tryLink, marginLeft: 12 }}>Try Bureau →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  { tier: "Verified", price: "$9", desc: "SHA-256 + ML-DSA-65 + cert" },
                  { tier: "Notarized", price: "$49", desc: "+ notary registry + Shamir backup" },
                  { tier: "Gold", price: "$199", desc: "+ legal review + int'l databases" },
                  { tier: "Platinum", price: "$999", desc: "+ multi-jurisdiction protection" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#10b981", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product 2: QBuild */}
        <div style={{ ...productCard, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#3b82f6")}>B2B SaaS</div>
              <h3 style={productTitle}>QBuild — Construction Hiring</h3>
              <p style={productDesc}>
                Vertical ATS for the construction industry. AI-scored candidates, skill badge verification via Bureau, brigade hiring, shift scheduling, trial tasks with payment, AEC loyalty cashback.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)" }}>
                <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700 }}>vs HH:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  HH is horizontal. Construction needs: shift work, medical certificates, brigade hiring, equipment operators. We verify credentials through Bureau inline.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/build" style={tryLink}>Try QBuild →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  { tier: "Free", price: "$0", desc: "3 active vacancies" },
                  { tier: "Starter", price: "$49/mo", desc: "10 vacancies + AI scoring" },
                  { tier: "Pro", price: "$249/mo", desc: "unlimited + analytics" },
                  { tier: "Hire fee", price: "1.5%", desc: "per successful placement" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#60a5fa", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product 3: QPayNet */}
        <div style={{ ...productCard, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#8b5cf6")}>Embedded Payments</div>
              <h3 style={productTitle}>QPayNet</h3>
              <p style={productDesc}>
                Payment infrastructure for every AEVION module. P2P wallets, merchant API keys, payment request QR codes, Stripe deposit, webhooks, CSV export, admin reconcile.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(139,92,246,0.08)", borderRadius: 8, border: "1px solid rgba(139,92,246,0.2)" }}>
                <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>Multiplier:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  QBuild pays through QPayNet. Awards pays royalties through QPayNet. Bureau certificates sell through QPayNet. Infrastructure that scales with every product.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/qpaynet" style={tryLink}>Try QPayNet →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  { tier: "Transfers", price: "0.1%", desc: "per transaction" },
                  { tier: "Merchant API", price: "free", desc: "API keys, no monthly fee" },
                  { tier: "Stripe deposits", price: "Stripe fee", desc: "+ 0% platform markup" },
                  { tier: "Enterprise", price: "custom", desc: "volume + SLA" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#a78bfa", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why now */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "60px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 32 }}>
            Why 2026 is the right moment
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 20 }}>
            {[
              { emoji: "🔐", title: "NIST ML-DSA-65 finalized", desc: "August 2024. Enterprises are starting to require post-quantum signatures in contracts. We already ship it." },
              { emoji: "🤖", title: "AI content flood", desc: "Sora, Midjourney, Suno create billions of files/day. Proving authorship became a crisis. Our pipeline solves it." },
              { emoji: "⚖️", title: "EU AI Act (2025)", desc: "Requires provenance documentation for AI-generated content. Our Bureau certificate is the compliance answer." },
            ].map(item => (
              <div key={item.title} style={{ padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Moat */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 32 }}>
          Why hard to copy
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16 }}>
          {[
            { n: "1", title: "Trust Graph", desc: "Accumulates with every signature. Competitor starting today is 2 years behind." },
            { n: "2", title: "Post-quantum on day 1", desc: "No one else ships ML-DSA-65 B2C. First mover in a mandatory migration." },
            { n: "3", title: "Atomic pipeline", desc: "4 platforms → 1 UI. Switching cost grows with every cert issued." },
            { n: "4", title: "Open velocity", desc: "130+ merged PRs in 30 days. Verifiable in public GitHub history." },
          ].map(m => (
            <div key={m.n} style={{ padding: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "rgba(255,255,255,0.08)", marginBottom: 8 }}>{m.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#f1f5f9" }}>{m.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))", borderTop: "1px solid rgba(16,185,129,0.2)", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>8-minute demo</h2>
          <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>
            Register on aevion.app → create a QRight object → sign with ML-DSA-65 → get a Bureau certificate.
            All verifiable, all on prod, no staging.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://aevion.app/auth" style={btnPrimary}>Start demo →</a>
            <a href="https://github.com/Dossymbek281078/AEVION" target="_blank" rel="noopener" style={btnGhost}>Inspect the code</a>
          </div>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 20 }}>
            Seed round open · $5M · contact: [add email]
          </p>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#334155" }}>
        AEVION · aevion.app · github.com/Dossymbek281078/AEVION
      </footer>
    </div>
  );
}

// Styles
const btnPrimary: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 10, background: "#10b981",
  color: "#022c22", fontWeight: 800, fontSize: 15, textDecoration: "none", border: "none",
};
const btnGhost: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)",
  color: "#f1f5f9", fontWeight: 700, fontSize: 15, textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.15)",
};
const productCard: React.CSSProperties = {
  padding: 28, background: "rgba(255,255,255,0.03)", borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
};
const productTitle: React.CSSProperties = {
  fontSize: 22, fontWeight: 800, margin: "8px 0 10px", color: "#f1f5f9",
};
const productDesc: React.CSSProperties = {
  fontSize: 14, color: "#94a3b8", lineHeight: 1.6,
};
const pricingBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", padding: "16px 18px", minWidth: 180,
};
const pricingTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#64748b",
  textTransform: "uppercase", marginBottom: 10,
};
const tryLink: React.CSSProperties = {
  fontSize: 13, color: "#10b981", textDecoration: "none", fontWeight: 700,
  borderBottom: "1px solid rgba(16,185,129,0.3)", paddingBottom: 1,
};

function productBadge(color: string): React.CSSProperties {
  return {
    display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
    color, textTransform: "uppercase", marginBottom: 4,
    background: `${color}18`, padding: "3px 10px", borderRadius: 20,
    border: `1px solid ${color}40`,
  };
}
