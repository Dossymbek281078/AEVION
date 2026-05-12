"use client";
import { useState } from "react";
import Link from "next/link";

// ── Fintech Quickstart — interactive curl examples
// Zone: aevion-core/main owns frontend/src/app/developers/fintech/**

const BASE = "https://api.aevion.app";

const STEPS = [
  {
    title: "1. Health check",
    desc: "Verify all 5 fintech modules are live.",
    curl: `curl ${BASE}/api/fintech/status`,
    response: `{ "modules": { "qgood": "ok", "qmaskcard": "ok", "veilnetx": "ok", "ztide": "ok", "qchaingov": "ok" } }`,
  },
  {
    title: "2. List QGood campaigns",
    desc: "Browse active charity campaigns — no auth required.",
    curl: `curl ${BASE}/api/qgood/campaigns`,
    response: `{ "campaigns": [{ "id": "...", "title": "...", "goal": 100000, "raised": 42000 }] }`,
  },
  {
    title: "3. VeilNetX latest block",
    desc: "Read the current chain head — verifiable by any observer.",
    curl: `curl ${BASE}/api/veilnetx-ledger/head`,
    response: `{ "hash": "a3f7b2...", "length": 1842, "timestamp": "..." }`,
  },
  {
    title: "4. Z-Tide leaderboard",
    desc: "Top reputation holders ranked by score.",
    curl: `curl ${BASE}/api/ztide/leaderboard`,
    response: `{ "entries": [{ "userId": "...", "score": 950, "rank": 1 }], "total": 128 }`,
  },
  {
    title: "5. QChainGov active proposals",
    desc: "Open governance proposals with vote counts.",
    curl: `curl ${BASE}/api/qchaingov/proposals?status=active`,
    response: `{ "proposals": [{ "id": "...", "title": "...", "votesFor": 12, "votesAgainst": 3 }] }`,
  },
  {
    title: "6. QMaskCard stats (auth required)",
    desc: "Aggregate mask stats — requires Bearer JWT.",
    curl: `curl -H "Authorization: Bearer YOUR_JWT" ${BASE}/api/qmaskcard/stats`,
    response: `{ "active_masks": 47, "total_charges": 1024, "blocked_merchants": 3 }`,
  },
];

export default function FintechQuickstartPage() {
  const [copied, setCopied] = useState<number | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());

  const copy = async (idx: number, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(idx); setTimeout(() => setCopied(null), 1800); } catch {}
  };

  return (
    <main style={{ background: "#0f172a", minHeight: "100vh", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 24 }}>
          <Link href="/developers/fintech" style={{ color: "#94a3b8", textDecoration: "none" }}>Fintech API</Link>
          {" / "}
          <span style={{ color: "#f1f5f9" }}>Quickstart</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Fintech API — Quickstart
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.65, marginBottom: 40, maxWidth: 600 }}>
          6 curl examples that cover the core read surface of all 5 fintech modules.
          No sign-up needed for the first 5 — just paste and run.
        </p>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {STEPS.map((s, i) => {
            const isShown = shown.has(i);
            return (
              <div key={i} style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 900, fontSize: 13, color: "#a78bfa" }}>{s.title}</span>
                  <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>{s.desc}</span>
                </div>
                {/* Curl block */}
                <div style={{ padding: "12px 20px", background: "#0f172a", position: "relative" }}>
                  <pre style={{ margin: 0, fontSize: 12, color: "#a5f3fc", fontFamily: "ui-monospace, monospace", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {s.curl}
                  </pre>
                  <button
                    onClick={() => copy(i, s.curl)}
                    style={{ position: "absolute", top: 10, right: 14, padding: "3px 10px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: copied === i ? "#34d399" : "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {copied === i ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                {/* Response toggle */}
                <div style={{ padding: "10px 20px", borderTop: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setShown(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {isShown ? "▼ Hide sample response" : "▶ Show sample response"}
                  </button>
                </div>
                {isShown && (
                  <div style={{ padding: "0 20px 14px" }}>
                    <pre style={{ margin: 0, fontSize: 11, color: "#86efac", fontFamily: "ui-monospace, monospace", background: "rgba(16,185,129,0.06)", borderRadius: 8, padding: "10px 12px", overflowX: "auto", border: "1px solid rgba(16,185,129,0.15)" }}>
                      {s.response}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Next steps */}
        <div style={{ marginTop: 40, padding: "20px 24px", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9", marginBottom: 12 }}>Next steps</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { href: "/developers/fintech", label: "Full API reference — all 33+ endpoints" },
              { href: "/fintech/status", label: "Live health dashboard — module uptime" },
              { href: "/fintech", label: "Fintech ecosystem overview" },
              { href: "https://github.com/Dossymbek281078/AEVION/issues", label: "GitHub Issues — report bugs or request endpoints" },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: 13, color: "#a78bfa", textDecoration: "none" }}>
                → {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: "#475569", textAlign: "center" }}>
          Base URL: <code style={{ color: "#94a3b8" }}>{BASE}</code> · All endpoints use JSON · Auth = Bearer JWT from /api/auth/login
        </div>
      </div>
    </main>
  );
}
