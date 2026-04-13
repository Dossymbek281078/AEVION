"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Account = { id: string; owner: string; balance: number; createdAt: string };
type Operation = { id: string; kind: "topup" | "transfer"; amount: number; from: string | null; to: string; createdAt: string };
type Summary = { accounts: number; transfers: number; operations: number; totalBalance: number; totalTransferVolume: number; totalTopupVolume: number };

const typeStyles: Record<string, { icon: string; label: string; bg: string; fg: string; border: string }> = {
  topup: { icon: "↓", label: "Top-up", bg: "rgba(16,185,129,0.08)", fg: "#065f46", border: "rgba(16,185,129,0.25)" },
  transfer: { icon: "⇄", label: "Transfer", bg: "rgba(59,130,246,0.08)", fg: "#1e40af", border: "rgba(59,130,246,0.25)" },
};

function Sparkline({ data, width = 280, height = 56 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.05;
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const fill = `0,${height} ${points} ${width},${height}`;
  const lastY = height - ((data[data.length - 1] - min) / range) * height;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline points={fill} fill="rgba(13,148,136,0.1)" stroke="none" />
      <polyline points={points} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="4" fill="#0d9488" />
    </svg>
  );
}

export default function AevionBankPage() {
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  /* Transfer state */
  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  /* Top-up state */
  const [topupAccount, setTopupAccount] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);

  /* New account */
  const [newOwner, setNewOwner] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [tab, setTab] = useState<"overview" | "transfer" | "topup" | "accounts">("overview");

  /* ── Load data ── */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [accRes, opsRes, sumRes] = await Promise.all([
        fetch(apiUrl("/api/qtrade/accounts")),
        fetch(apiUrl("/api/qtrade/operations")),
        fetch(apiUrl("/api/qtrade/summary")),
      ]);

      let accs: Account[] = [];
      if (accRes.ok) {
        const d = await accRes.json();
        accs = d.items || [];
      }

      /* Auto-create demo accounts if empty */
      if (accs.length === 0) {
        const demoAccounts = [
          { owner: "Dosymbek (Main Wallet)" },
          { owner: "AEVION Royalties Pool" },
          { owner: "Creator Fund" },
        ];
        for (const da of demoAccounts) {
          const r = await fetch(apiUrl("/api/qtrade/accounts"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(da),
          });
          if (r.ok) {
            const newAcc = await r.json();
            accs.push(newAcc);
          }
        }
        /* Auto top-up main wallet */
        if (accs[0]) {
          await fetch(apiUrl("/api/qtrade/topup"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: accs[0].id, amount: 5000 }),
          });
          accs[0].balance = 5000;
        }
        if (accs[1]) {
          await fetch(apiUrl("/api/qtrade/topup"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: accs[1].id, amount: 12500 }),
          });
          accs[1].balance = 12500;
        }
        if (accs[2]) {
          await fetch(apiUrl("/api/qtrade/topup"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: accs[2].id, amount: 3200 }),
          });
          accs[2].balance = 3200;
        }

        /* Re-fetch after setup */
        const [a2, o2, s2] = await Promise.all([
          fetch(apiUrl("/api/qtrade/accounts")),
          fetch(apiUrl("/api/qtrade/operations")),
          fetch(apiUrl("/api/qtrade/summary")),
        ]);
        if (a2.ok) accs = (await a2.json()).items || [];
        if (o2.ok) setOperations((await o2.json()).items || []);
        if (s2.ok) setSummary(await s2.json());
        setAccounts(accs);
        if (accs[0]) { setSelectedAccount(accs[0]); setSendFrom(accs[0].id); setTopupAccount(accs[0].id); }
        setLoading(false);
        return;
      }

      setAccounts(accs);
      if (accs[0] && !selectedAccount) { setSelectedAccount(accs[0]); setSendFrom(accs[0].id); setTopupAccount(accs[0].id); }
      if (opsRes.ok) setOperations((await opsRes.json()).items || []);
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Actions ── */
  const handleTransfer = async () => {
    if (!sendFrom || !sendTo || sendFrom === sendTo) { showToast("Select different accounts", "error"); return; }
    const amt = parseFloat(sendAmount);
    if (!Number.isFinite(amt) || amt <= 0) { showToast("Enter a valid amount", "error"); return; }
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/qtrade/transfer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: sendFrom, to: sendTo, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      showToast(`Transferred ${amt.toFixed(2)} AEC`, "success");
      setSendAmount("");
      await loadAll();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  const handleTopup = async () => {
    if (!topupAccount) { showToast("Select account", "error"); return; }
    const amt = parseFloat(topupAmount);
    if (!Number.isFinite(amt) || amt <= 0) { showToast("Enter a valid amount", "error"); return; }
    setToppingUp(true);
    try {
      const res = await fetch(apiUrl("/api/qtrade/topup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: topupAccount, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Top-up failed");
      showToast(`Added ${amt.toFixed(2)} AEC`, "success");
      setTopupAmount("");
      await loadAll();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setToppingUp(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newOwner.trim()) { showToast("Enter owner name", "error"); return; }
    setCreatingAccount(true);
    try {
      const res = await fetch(apiUrl("/api/qtrade/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: newOwner.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create account");
      showToast("Account created!", "success");
      setNewOwner("");
      await loadAll();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setCreatingAccount(false);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const sparkData = operations.length > 1
    ? operations.slice(0, 14).reverse().reduce((acc: number[], op) => {
        const prev = acc.length ? acc[acc.length - 1] : 0;
        acc.push(prev + op.amount);
        return acc;
      }, [])
    : [0, totalBalance * 0.3, totalBalance * 0.5, totalBalance * 0.7, totalBalance];

  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, boxSizing: "border-box", outline: "none" };

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        {/* ── Hero Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)", padding: "32px 28px 28px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏦</div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>AEVION Bank</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Digital Finance Layer · Wallets · Transfers · Royalties</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.8, lineHeight: 1.6, maxWidth: 600 }}>
              Ecosystem digital bank for creators. P2P transfers, automatic royalties for content usage, and Awards payouts — all linked to Trust Graph.
            </p>
          </div>

          {/* Balance row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "20px 28px", background: "rgba(15,23,42,0.02)", borderTop: "1px solid rgba(15,23,42,0.06)", alignItems: "center" }}>
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>ACTIVITY (RECENT)</div>
              <Sparkline data={sparkData} width={280} height={50} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "2 1 400px" }}>
              {[
                { label: "Total Balance", value: `${totalBalance.toFixed(2)} AEC`, color: "#0f766e" },
                { label: "Accounts", value: String(accounts.length), color: "#3b82f6" },
                { label: "Operations", value: String(summary?.operations || operations.length), color: "#8b5cf6" },
                { label: "Transfer Volume", value: `${(summary?.totalTransferVolume || 0).toFixed(2)}`, color: "#f59e0b" },
              ].map((s) => (
                <div key={s.label} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", flex: "1 1 130px", minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {([
            { t: "overview" as const, label: "Overview", icon: "📊" },
            { t: "transfer" as const, label: "Transfer", icon: "⇄" },
            { t: "topup" as const, label: "Top-up", icon: "↓" },
            { t: "accounts" as const, label: "Accounts", icon: "👤" },
          ]).map((item) => (
            <button key={item.t} onClick={() => setTab(item.t)} style={{
              padding: "9px 16px", borderRadius: 10,
              border: tab === item.t ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.15)",
              background: tab === item.t ? "#0f172a" : "transparent",
              color: tab === item.t ? "#fff" : "#0f172a",
              fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
          <a href={apiUrl("/api/qtrade/operations.csv")} target="_blank" rel="noopener noreferrer" style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", color: "#475569", fontWeight: 700, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>📥 Export CSV</a>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading bank data...</div>}

        {/* ══ OVERVIEW ══ */}
        {!loading && tab === "overview" && (
          <div>
            {/* Account cards */}
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Wallets ({accounts.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
              {accounts.map((acc) => (
                <div key={acc.id} onClick={() => setSelectedAccount(acc)} style={{
                  padding: "18px 20px", borderRadius: 14,
                  border: selectedAccount?.id === acc.id ? "2px solid #0d9488" : "1px solid rgba(15,23,42,0.08)",
                  background: selectedAccount?.id === acc.id ? "rgba(13,148,136,0.04)" : "#fff",
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>{acc.owner}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>{acc.balance.toFixed(2)} <span style={{ fontSize: 14, color: "#64748b" }}>AEC</span></div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8", marginTop: 6 }}>{acc.id}</div>
                </div>
              ))}
            </div>

            {/* Operations */}
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Recent Operations ({operations.length})</div>
            {operations.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                No operations yet. Try a top-up or transfer!
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
                {operations.slice(0, 20).map((op) => {
                  const s = typeStyles[op.kind] || typeStyles.transfer;
                  const fromAcc = accounts.find((a) => a.id === op.from);
                  const toAcc = accounts.find((a) => a.id === op.to);
                  return (
                    <div key={op.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${s.border}`, background: s.bg }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, background: s.border, color: s.fg, flexShrink: 0 }}>{s.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                          {op.kind === "topup" ? `Top-up → ${toAcc?.owner || op.to}` : `${fromAcc?.owner || op.from} → ${toAcc?.owner || op.to}`}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                          {s.label} · {new Date(op.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 15, color: op.kind === "topup" ? "#059669" : "#3b82f6", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {op.kind === "topup" ? "+" : ""}{op.amount.toFixed(2)} AEC
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TRANSFER ══ */}
        {!loading && tab === "transfer" && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 24, background: "#fff", marginBottom: 24 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 16 }}>P2P Transfer</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>From</div>
                <select value={sendFrom} onChange={(e) => setSendFrom(e.target.value)} style={inp}>
                  <option value="">Select account...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.owner} ({a.balance.toFixed(2)} AEC)</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>To</div>
                <select value={sendTo} onChange={(e) => setSendTo(e.target.value)} style={inp}>
                  <option value="">Select recipient...</option>
                  {accounts.filter((a) => a.id !== sendFrom).map((a) => <option key={a.id} value={a.id}>{a.owner} ({a.balance.toFixed(2)} AEC)</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Amount (AEC)</div>
                <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" style={inp} />
              </div>
              <button onClick={handleTransfer} disabled={sending} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: sending ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 900, fontSize: 15, cursor: sending ? "default" : "pointer" }}>
                {sending ? "Sending..." : "⇄ Send Transfer"}
              </button>
              <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Instant · Fee: 0.1% · Linked to Trust Graph</div>
            </div>
          </div>
        )}

        {/* ══ TOP-UP ══ */}
        {!loading && tab === "topup" && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 24, background: "#fff", marginBottom: 24 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 16 }}>Top-up Wallet</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Account</div>
                <select value={topupAccount} onChange={(e) => setTopupAccount(e.target.value)} style={inp}>
                  <option value="">Select account...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.owner} ({a.balance.toFixed(2)} AEC)</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Amount (AEC)</div>
                <input value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" style={inp} />
              </div>
              <button onClick={handleTopup} disabled={toppingUp} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: toppingUp ? "#94a3b8" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: toppingUp ? "default" : "pointer" }}>
                {toppingUp ? "Processing..." : "↓ Add Funds"}
              </button>
              <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Demo mode · Instant credit · No real money</div>
            </div>
          </div>
        )}

        {/* ══ ACCOUNTS ══ */}
        {!loading && tab === "accounts" && (
          <div>
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              {accounts.map((acc) => (
                <div key={acc.id} style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{acc.owner}</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", marginTop: 4 }}>{acc.id}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Created: {new Date(acc.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{acc.balance.toFixed(2)} <span style={{ fontSize: 12, color: "#64748b" }}>AEC</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create new account */}
            <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20, background: "#fff", maxWidth: 400 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Create New Account</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Account owner name" onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()} style={{ ...inp, flex: 1 }} />
                <button onClick={handleCreateAccount} disabled={creatingAccount} style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: creatingAccount ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: creatingAccount ? "default" : "pointer", whiteSpace: "nowrap" }}>
                  {creatingAccount ? "..." : "+ Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── How Royalties Work ── */}
        <div style={{ marginTop: 28, border: "1px solid rgba(124,58,237,0.2)", borderRadius: 16, padding: 20, background: "rgba(124,58,237,0.04)", marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#4c1d95", marginBottom: 12 }}>How Automatic Royalties Work</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { n: "1", title: "Creator registers", desc: "Track, film, or code protected in QRight + Bureau" },
              { n: "2", title: "Someone uses it", desc: "License via marketplace or direct usage detected" },
              { n: "3", title: "Royalties credited", desc: "Bank automatically distributes % to creator wallet" },
              { n: "4", title: "Instant withdrawal", desc: "To card, crypto, or spend within ecosystem" },
            ].map((s) => (
              <div key={s.n} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(124,58,237,0.15)", background: "rgba(255,255,255,0.7)" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#7c3aed", marginBottom: 4 }}>{s.n}</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Security ── */}
        <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>Bank Security</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Quantum Shield Protected", "Trust Graph Linked", "Merkle Audit Trail", "Real-time Transactions", "CSV Export"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
