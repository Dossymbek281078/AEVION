"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Wallet = {
  balance: number;
  currency: string;
  frozen: number;
  pendingRoyalties: number;
};

type Transaction = {
  id: string;
  type: "topup" | "transfer" | "royalty" | "award" | "withdrawal";
  amount: number;
  from?: string;
  to?: string;
  description: string;
  timestamp: string;
};

const DEMO_WALLET: Wallet = {
  balance: 2847.50,
  currency: "AEC",
  frozen: 120.00,
  pendingRoyalties: 340.25,
};

const DEMO_TX: Transaction[] = [
  { id: "tx1", type: "royalty", amount: 45.00, from: "Planet License #4821", to: "you", description: "Music track royalty (AI remix used in film)", timestamp: "2026-03-28T14:30:00Z" },
  { id: "tx2", type: "award", amount: 500.00, from: "AEVION Music Awards", to: "you", description: "Best AI Production — Season 2026-S1", timestamp: "2026-03-27T18:00:00Z" },
  { id: "tx3", type: "transfer", amount: -80.00, from: "you", to: "creator_0x8f2a", description: "P2P transfer to collaborator", timestamp: "2026-03-27T10:15:00Z" },
  { id: "tx4", type: "topup", amount: 1000.00, from: "External card", to: "you", description: "Wallet top-up via card", timestamp: "2026-03-26T09:00:00Z" },
  { id: "tx5", type: "royalty", amount: 12.50, from: "Planet License #3192", to: "you", description: "Code module usage royalty", timestamp: "2026-03-25T22:45:00Z" },
  { id: "tx6", type: "withdrawal", amount: -200.00, from: "you", to: "Bank account ***4523", description: "Withdrawal to external bank", timestamp: "2026-03-24T16:00:00Z" },
  { id: "tx7", type: "royalty", amount: 89.75, from: "Planet License #5501", to: "you", description: "Film clip royalty (3 uses this week)", timestamp: "2026-03-23T11:20:00Z" },
  { id: "tx8", type: "royalty", amount: 23.40, from: "Planet License #2847", to: "you", description: "Design template licensing fee", timestamp: "2026-03-22T08:10:00Z" },
  { id: "tx9", type: "transfer", amount: -35.00, from: "you", to: "creator_0x3d1b", description: "Split royalty with co-author", timestamp: "2026-03-21T15:30:00Z" },
  { id: "tx10", type: "award", amount: 150.00, from: "AEVION Film Awards", to: "you", description: "Best Short Film nomination prize", timestamp: "2026-03-20T20:00:00Z" },
  { id: "tx11", type: "topup", amount: 500.00, from: "Crypto wallet", to: "you", description: "AEC purchase via USDT", timestamp: "2026-03-19T12:00:00Z" },
  { id: "tx12", type: "royalty", amount: 67.30, from: "Planet License #6102", to: "you", description: "Algorithm usage in fintech app", timestamp: "2026-03-18T17:45:00Z" },
];

// Sparkline data: daily balance for last 14 days
const SPARKLINE = [1200, 1250, 1400, 1380, 1500, 1520, 1680, 1750, 1900, 2100, 2050, 2350, 2600, 2847];

const typeIcon: Record<string, string> = {
  topup: "+",
  transfer: "⇄",
  royalty: "♫",
  award: "★",
  withdrawal: "↑",
};

const typeColor: Record<string, { bg: string; fg: string; border: string }> = {
  topup: { bg: "rgba(16,185,129,0.08)", fg: "#065f46", border: "rgba(16,185,129,0.25)" },
  transfer: { bg: "rgba(59,130,246,0.08)", fg: "#1e40af", border: "rgba(59,130,246,0.25)" },
  royalty: { bg: "rgba(124,58,237,0.08)", fg: "#4c1d95", border: "rgba(124,58,237,0.25)" },
  award: { bg: "rgba(245,158,11,0.08)", fg: "#92400e", border: "rgba(245,158,11,0.3)" },
  withdrawal: { bg: "rgba(220,38,38,0.06)", fg: "#991b1b", border: "rgba(220,38,38,0.2)" },
};

const typeLabel: Record<string, string> = {
  topup: "Top-up",
  transfer: "Transfer",
  royalty: "Royalty",
  award: "Award",
  withdrawal: "Withdrawal",
};

function formatAmount(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} AEC`;
}

function Sparkline({ data, width = 280, height = 60 }: { data: number[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data) * 0.95;
  const max = Math.max(...data) * 1.02;
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline points={fillPoints} fill="rgba(13,148,136,0.12)" stroke="none" />
      <polyline points={points} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="4" fill="#0d9488" />
    </svg>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
        flex: "1 1 150px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || "#0f172a", letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}

export default function AevionBankPage() {
  const { showToast } = useToast();
  const [wallet] = useState<Wallet>(DEMO_WALLET);
  const [transactions] = useState<Transaction[]>(DEMO_TX);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    try { setToken(localStorage.getItem(TOKEN_KEY) || ""); } catch {}
  }, []);

  const handleSend = async () => {
    if (!sendTo.trim() || !sendAmount.trim()) {
      showToast("Enter recipient and amount", "error");
      return;
    }
    const amount = parseFloat(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Invalid amount", "error");
      return;
    }
    if (amount > wallet.balance - wallet.frozen) {
      showToast("Insufficient available funds", "error");
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    showToast(`Transfer ${amount.toFixed(2)} AEC → ${sendTo} sent`, "success");
    setSendTo("");
    setSendAmount("");
    setSending(false);
  };

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        {/* Hero header */}
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)",
              padding: "32px 28px 28px",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                marginBottom: 14,
              }}
            >
              AEVION Bank · digital finance layer
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
              Ecosystem digital bank
            </h1>
            <p style={{ margin: 0, fontSize: 15, opacity: 0.88, lineHeight: 1.6, maxWidth: 600 }}>
              Wallet, P2P transfers between creators, automatic royalties for content usage, 
              Awards payouts. Every transaction linked to Trust Graph.
            </p>
          </div>

          {/* Balance cards */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              padding: "20px 28px 12px",
              background: "rgba(15,23,42,0.02)",
              borderTop: "1px solid rgba(15,23,42,0.06)",
              alignItems: "center",
            }}
          >
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>BALANCE GROWTH (14 DAYS)</div>
              <Sparkline data={SPARKLINE} width={280} height={50} />
              <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>+137% this month</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "2 1 400px" }}>
              <StatCard label="Balance" value={`${wallet.balance.toFixed(2)} AEC`} accent="#0f766e" />
              <StatCard label="Available" value={`${(wallet.balance - wallet.frozen).toFixed(2)} AEC`} />
              <StatCard label="Frozen" value={`${wallet.frozen.toFixed(2)} AEC`} accent="#b45309" />
              <StatCard label="Pending royalties" value={`${wallet.pendingRoyalties.toFixed(2)} AEC`} accent="#7c3aed" />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/qright"
            style={{ padding: "10px 16px", borderRadius: 12, background: "linear-gradient(135deg,#0d9488,#0ea5e9)", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none", boxShadow: "0 4px 14px rgba(13,148,136,0.3)" }}>
            Register IP → Start earning
          </Link>
          <Link href="/planet"
            style={{ padding: "10px 16px", borderRadius: 12, background: "#0f766e", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
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
          <Link
            href="/qright"
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.15)",
              color: "#334155",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Register IP
          </Link>
        </div>

        {/* P2P Transfer */}
        <section
          style={{
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>P2P Transfer</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>Recipient</div>
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="Creator ID or email"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: "0 1 140px" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>Amount AEC</div>
              <input
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 14,
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: sending ? "#94a3b8" : "#0f172a",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: sending ? "default" : "pointer",
                whiteSpace: "nowrap" as const,
              }}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
            Fee: 0.1% · Instant transfer · Linked to Trust Graph
          </div>
        </section>

        {/* How royalties work */}
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
            How automatic royalties work
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { step: "1", title: "Creator makes", desc: "Track, film or code is registered in QRight + Planet" },
              { step: "2", title: "Someone uses it", desc: "License via marketplace or direct usage" },
              { step: "3", title: "Royalties credited", desc: "AEVION Bank automatically distributes % to creator" },
              { step: "4", title: "Instant withdrawal", desc: "To card, crypto wallet or spend within ecosystem" },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(124,58,237,0.15)",
                  background: "rgba(255,255,255,0.7)",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>{s.step}</div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transaction history */}
        <section
          style={{
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 16,
            padding: 20,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>
            Transaction history
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {transactions.map((tx) => {
              const colors = typeColor[tx.type] || typeColor.transfer;
              const isPositive = tx.amount >= 0;
              return (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      background: colors.border,
                      color: colors.fg,
                      flexShrink: 0,
                    }}
                  >
                    {typeIcon[tx.type] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {typeLabel[tx.type]} · {new Date(tx.timestamp).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 15,
                      color: isPositive ? "#059669" : "#dc2626",
                      whiteSpace: "nowrap" as const,
                      flexShrink: 0,
                    }}
                  >
                    {formatAmount(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Security section */}
        <section
          style={{
            marginTop: 24,
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 16,
            padding: 20,
            background: "linear-gradient(135deg, rgba(15,23,42,0.03), rgba(15,118,110,0.04))",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>AEVION Bank security</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { title: "Quantum Shield", desc: "Ed25519 signatures + SHA-256 integrity chain on every transaction." },
              { title: "Trust Graph", desc: "Wallet reputation = verification history. Fraud visible before transaction." },
              { title: "Merkle Audit", desc: "Every transaction block fixed in Merkle tree. Impossible to forge history." },
              { title: "Planet Compliance", desc: "Automatic AML/KYC check via Planet smart contracts." },
            ].map((s) => (
              <div
                key={s.title}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "rgba(255,255,255,0.6)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: "#0f766e" }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </ProductPageShell>
    </main>
  );
}
