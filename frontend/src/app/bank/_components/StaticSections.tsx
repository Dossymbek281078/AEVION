"use client";

import Link from "next/link";

export function QuickActions() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
      <Link
        href="/qright"
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          background: "linear-gradient(135deg,#0d9488,#0ea5e9)",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          textDecoration: "none",
          boxShadow: "0 4px 14px rgba(13,148,136,0.3)",
        }}
      >
        Register IP → Start earning
      </Link>
      <Link
        href="/planet"
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          background: "#0f766e",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Earn via Planet →
      </Link>
      <Link
        href="/awards"
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          border: "1px solid rgba(124,58,237,0.3)",
          color: "#4c1d95",
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Awards
      </Link>
    </div>
  );
}

export function RoyaltiesExplainer() {
  const steps = [
    { step: "1", title: "Creator makes", desc: "Track, film or code is registered in QRight + Planet" },
    { step: "2", title: "Someone uses it", desc: "License via marketplace or direct usage" },
    { step: "3", title: "Royalties credited", desc: "AEVION Bank automatically distributes % to creator" },
    { step: "4", title: "Instant withdrawal", desc: "To card, crypto wallet or spend within ecosystem" },
  ];
  return (
    <section
      style={{
        border: "1px solid rgba(124,58,237,0.2)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "rgba(124,58,237,0.04)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, color: "#4c1d95", marginBottom: 10 }}>
        How automatic royalties will work
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {steps.map((s) => (
          <div
            key={s.step}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(124,58,237,0.15)",
              background: "rgba(255,255,255,0.7)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>
              {s.step}
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SecurityRoadmap() {
  const items = [
    { title: "Quantum Shield", desc: "Ed25519 + Shamir Secret Sharing. Every transaction signed with three shards." },
    { title: "Trust Graph", desc: "Wallet reputation = verification history. Fraud visible before transaction." },
    { title: "Merkle Audit", desc: "Every transaction block fixed in Merkle tree. Impossible to forge history." },
    { title: "Planet Compliance", desc: "Automatic AML/KYC check via Planet smart contracts." },
  ];
  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: "linear-gradient(135deg, rgba(15,23,42,0.03), rgba(15,118,110,0.04))",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>
        AEVION Bank security roadmap
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {items.map((s) => (
          <div
            key={s.title}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.6)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: "#0f766e" }}>
              {s.title}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
