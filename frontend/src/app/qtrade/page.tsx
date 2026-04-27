"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import {
  ldPairs, svPairs, ldPositions, svPositions,
  tickPair, catchupPair, unrealizedPnl, unrealizedPct,
  fmtUsd, fmtPct, sparklinePath,
  type Pair, type Position, type PairId,
} from "./marketSim";

type Account = {
  id: string;
  owner: string;
  balance: number;
  createdAt: string;
};

type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
};

type Operation = {
  id: string;
  kind: "topup" | "transfer";
  amount: number;
  from: string | null;
  to: string;
  createdAt: string;
};

type Summary = {
  accounts: number;
  transfers: number;
  operations: number;
  totalBalance: number;
  totalTransferVolume: number;
  totalTopupVolume: number;
};

export default function QTradePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [owner, setOwner] = useState("");
  const [topupAccount, setTopupAccount] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0");

  // ─── Live Markets ────────────────────────────────────────────────
  // Lazy-load from localStorage post-mount to avoid SSR hydration mismatch.
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [marketsReady, setMarketsReady] = useState(false);
  const [activePair, setActivePair] = useState<PairId | null>(null);
  const [orderQty, setOrderQty] = useState("1");
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);

  useEffect(() => {
    setPairs(ldPairs().map((p) => catchupPair(p)));
    setPositions(ldPositions());
    setMarketsReady(true);
  }, []);

  // Tick price every 1000ms after markets are ready
  useEffect(() => {
    if (!marketsReady) return;
    const id = setInterval(() => {
      setPairs((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map(tickPair);
        svPairs(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [marketsReady]);

  // Persist positions when they change
  useEffect(() => {
    if (!marketsReady) return;
    svPositions(positions);
  }, [positions, marketsReady]);

  const pairById = useMemo(() => {
    const m = new Map<PairId, Pair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

  const totalUnrealized = useMemo(() => {
    let sum = 0;
    for (const pos of positions) {
      const cur = pairById.get(pos.pair);
      if (cur) sum += unrealizedPnl(pos, cur.price);
    }
    return sum;
  }, [positions, pairById]);

  const openPosition = (pid: PairId, side: "long" | "short") => {
    const cur = pairById.get(pid);
    if (!cur) return;
    const q = Number(orderQty);
    if (!Number.isFinite(q) || q <= 0) {
      setTradeMsg("Введи положительное количество");
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const pos: Position = { id, pair: pid, side, qty: q, entryPrice: cur.price, entryTs: Date.now() };
    setPositions((prev) => [pos, ...prev]);
    setTradeMsg(`✓ ${side === "long" ? "Long" : "Short"} ${q} ${cur.symbol} @ ${fmtUsd(cur.price)}`);
    setTimeout(() => setTradeMsg(null), 2400);
  };

  const closePosition = (posId: string) => {
    setPositions((prev) => {
      const target = prev.find((p) => p.id === posId);
      if (!target) return prev;
      const cur = pairById.get(target.pair);
      const pnl = cur ? unrealizedPnl(target, cur.price) : 0;
      setTradeMsg(`✓ Закрыто · P&L ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`);
      setTimeout(() => setTradeMsg(null), 2400);
      return prev.filter((p) => p.id !== posId);
    });
  };
  // ─────────────────────────────────────────────────────────────────

  const accountLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, `${a.owner} (${a.balance})`);
    return (id: string) => m.get(id) ?? id;
  }, [accounts]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [accRes, txRes, opRes, sumRes] = await Promise.all([
        fetch(apiUrl("/api/qtrade/accounts")),
        fetch(apiUrl("/api/qtrade/transfers")),
        fetch(apiUrl("/api/qtrade/operations")),
        fetch(apiUrl("/api/qtrade/summary")),
      ]);
      const failed: string[] = [];
      if (accRes.ok) {
        const accData = await accRes.json().catch(() => ({}));
        setAccounts(accData.items || []);
      } else {
        setAccounts([]);
        failed.push("accounts");
      }
      if (txRes.ok) {
        const txData = await txRes.json().catch(() => ({}));
        setTransfers(txData.items || []);
      } else {
        setTransfers([]);
        failed.push("transfers");
      }
      if (opRes.ok) {
        const opData = await opRes.json().catch(() => ({}));
        setOperations(opData.items || []);
      } else {
        setOperations([]);
        failed.push("operations");
      }
      if (sumRes.ok) {
        const sumData = await sumRes.json().catch(() => null);
        setSummary(sumData);
      } else {
        setSummary(null);
        failed.push("metrics");
      }
      if (failed.length) {
        setErr(`Failed to load: ${failed.join(" and ")}. Start backend (4001).`);
      }
    } catch {
      setAccounts([]);
      setTransfers([]);
      setOperations([]);
      setSummary(null);
      setErr("Network: backend unavailable or not running");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!owner.trim()) {
      setErr("owner is required");
      return;
    }
    setErr(null);

    const res = await fetch(apiUrl("/api/qtrade/accounts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner }),
    });

    if (!res.ok) {
      setErr("Error creating account");
      return;
    }

    setOwner("");
    await load();
  };

  const topup = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const a = Number(topupAmount);
    if (!topupAccount || !Number.isFinite(a) || a <= 0) {
      setErr("Select account and amount > 0");
      return;
    }

    const res = await fetch(apiUrl("/api/qtrade/topup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: topupAccount, amount: a }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setErr(data?.error || "Top-up error");
      return;
    }

    setTopupAmount("");
    await load();
  };

  const transfer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const a = Number(amount);
    if (!from || !to || !Number.isFinite(a) || a <= 0) {
      setErr("Fill from/to and amount > 0");
      return;
    }

    const res = await fetch(apiUrl("/api/qtrade/transfer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, amount: a }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setErr(data?.error || "Transfer error");
      return;
    }

    await load();
  };

  return (
    <main>
      <ProductPageShell maxWidth={1000}>
      <Wave1Nav />
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QTrade</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Live Markets с симулированной ценой и торговый ledger. Данные ledger'а — backend disk (
        <code style={{ fontSize: 13 }}>.aevion-data/qtrade.json</code>); цены и позиции
        — клиентский localStorage.
      </div>

      {/* ═══ LIVE MARKETS ══════════════════════════════════════════ */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 12,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(15,23,42,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#22d3ee" }}>📊 Live Markets</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 999,
              background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.45)",
              fontSize: 10, fontWeight: 800, color: "#86efac",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "#22c55e", animation: "qt-pulse 1.4s ease-in-out infinite" }} />
              SIMULATED · 1s tick
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>
            Открытые позиции: <strong style={{ color: "#fff" }}>{positions.length}</strong>
            <span style={{ margin: "0 8px", color: "#475569" }}>·</span>
            Unrealized P&L: <strong style={{ color: totalUnrealized > 0 ? "#22c55e" : totalUnrealized < 0 ? "#f87171" : "#cbd5e1" }}>
              {totalUnrealized >= 0 ? "+" : ""}{fmtUsd(totalUnrealized)}
            </strong>
          </div>
        </div>

        {/* Pair cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
          {pairs.map((p) => {
            const change24 = ((p.price - p.open24h) / p.open24h) * 100;
            const tickUp = p.price >= p.prevPrice;
            const isActive = activePair === p.id;
            const sparkColor = change24 >= 0 ? "#22c55e" : "#f87171";
            return (
              <button
                key={p.id}
                onClick={() => setActivePair((cur) => (cur === p.id ? null : p.id))}
                style={{
                  textAlign: "left",
                  background: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "#22d3ee" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10,
                  padding: 12,
                  cursor: "pointer",
                  color: "#fff",
                  transition: "background 0.2s, border 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.4 }}>{p.symbol}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{p.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontWeight: 900,
                    fontSize: 19,
                    color: tickUp ? "#86efac" : "#fca5a5",
                    transition: "color 0.4s",
                  }}>
                    {fmtUsd(p.price)}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: change24 >= 0 ? "#22c55e" : "#f87171",
                  }}>
                    {fmtPct(change24)}
                  </span>
                </div>
                <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block" }}>
                  <path d={sparklinePath(p.history, 100, 30)} stroke={sparkColor} strokeWidth={1.4} fill="none" opacity={0.85} />
                </svg>
                <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.4, fontWeight: 700 }}>
                  {isActive ? "▼ свернуть" : "▶ торговать"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Trade panel */}
        {activePair && (() => {
          const p = pairById.get(activePair);
          if (!p) return null;
          const change24 = ((p.price - p.open24h) / p.open24h) * 100;
          return (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{p.symbol}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 18 }}>{fmtUsd(p.price)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: change24 >= 0 ? "#86efac" : "#fca5a5" }}>{fmtPct(change24)}</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>· 24h vol {p.vol >= 0.004 ? "high" : p.vol >= 0.003 ? "med" : "low"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>Qty</label>
                <input
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  type="number"
                  min={0}
                  step="any"
                  style={{
                    width: 110, padding: "6px 10px", borderRadius: 6,
                    border: "1px solid #334155", background: "#0f172a", color: "#fff",
                    fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                  }}
                />
                <button
                  onClick={() => openPosition(p.id, "long")}
                  style={{
                    padding: "8px 16px", borderRadius: 6, border: "none",
                    background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff",
                    fontWeight: 800, fontSize: 13, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(34,197,94,0.25)",
                  }}
                >
                  ▲ LONG @ market
                </button>
                <button
                  onClick={() => openPosition(p.id, "short")}
                  style={{
                    padding: "8px 16px", borderRadius: 6, border: "none",
                    background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
                    fontWeight: 800, fontSize: 13, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                  }}
                >
                  ▼ SHORT @ market
                </button>
                {tradeMsg && (
                  <span style={{ fontSize: 12, color: "#86efac", fontWeight: 700 }}>{tradeMsg}</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Open positions */}
        {positions.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#cbd5e1", marginBottom: 8 }}>Открытые позиции</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {positions.map((pos) => {
                const cur = pairById.get(pos.pair);
                const price = cur?.price ?? pos.entryPrice;
                const pnl = cur ? unrealizedPnl(pos, price) : 0;
                const pct = cur ? unrealizedPct(pos, price) : 0;
                const ageMin = Math.max(0, Math.round((Date.now() - pos.entryTs) / 60000));
                return (
                  <div
                    key={pos.id}
                    style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: 12, alignItems: "center", fontSize: 13,
                    }}
                  >
                    <span style={{
                      padding: "2px 8px", borderRadius: 4,
                      background: pos.side === "long" ? "rgba(34,197,94,0.2)" : "rgba(220,38,38,0.2)",
                      color: pos.side === "long" ? "#86efac" : "#fca5a5",
                      fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase",
                    }}>
                      {pos.side === "long" ? "▲ Long" : "▼ Short"} {pos.pair.split("/")[0]}
                    </span>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                      {pos.qty} @ {fmtUsd(pos.entryPrice)} → {fmtUsd(price)}
                      <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11 }}>({ageMin}m ago)</span>
                    </span>
                    <span style={{
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 900,
                      color: pnl > 0 ? "#22c55e" : pnl < 0 ? "#f87171" : "#cbd5e1",
                    }}>
                      {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} ({fmtPct(pct)})
                    </span>
                    <button
                      onClick={() => closePosition(pos.id)}
                      style={{
                        padding: "5px 11px", borderRadius: 5,
                        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
                        color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      <style>{`@keyframes qt-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {[
          { href: "/api/qtrade/accounts.csv", label: "Accounts CSV" },
          { href: "/api/qtrade/transfers.csv", label: "Transfers CSV" },
          { href: "/api/qtrade/operations.csv", label: "Operations CSV" },
        ].map((x) => (
          <a
            key={x.href}
            href={apiUrl(x.href)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #334155",
              color: "#334155",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
              background: "#fff",
            }}
          >
            {x.label}
          </a>
        ))}
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

      {summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Total balance</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalBalance}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Topup volume</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalTopupVolume}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Transfer volume</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalTransferVolume}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Operations</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.operations}</div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Create account</h2>
          <form onSubmit={createAccount} style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="Owner (e.g. AEVION Test)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                width: 180,
              }}
            >
              Create
            </button>
          </form>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Top up</h2>
          <form onSubmit={topup} style={{ display: "grid", gap: 10 }}>
            <select
              value={topupAccount}
              onChange={(e) => setTopupAccount(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} — {a.balance} [{a.id}]
                </option>
              ))}
            </select>
            <input
              placeholder="Amount"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              type="number"
              min={0}
              step="any"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #0369a1",
                background: "#0369a1",
                color: "#fff",
                width: 180,
              }}
            >
              Top up
            </button>
          </form>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Transfer</h2>
          <form onSubmit={transfer} style={{ display: "grid", gap: 10 }}>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">From account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} ({a.balance}) [{a.id}]
                </option>
              ))}
            </select>

            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">To account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} ({a.balance}) [{a.id}]
                </option>
              ))}
            </select>

            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />

            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #0a5",
                background: "#0a5",
                color: "#fff",
                width: 180,
              }}
            >
              Transfer
            </button>
          </form>
        </section>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Accounts ({accounts.length})
      </h2>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {accounts.map((a) => (
            <div
              key={a.id}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                {new Date(a.createdAt).toLocaleString()}
              </div>
              <div style={{ fontWeight: 700 }}>{a.owner}</div>
              <div>balance: {a.balance}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{a.id}</div>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Transferы ({transfers.length})
      </h2>

      {loading ? null : transfers.length === 0 ? (
        <div style={{ color: "#888" }}>Пока нет переводов.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {transfers.map((t) => (
            <div
              key={t.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 16px",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: "#666", fontSize: 12 }}>
                {new Date(t.createdAt).toLocaleString()}
              </span>
              <span>
                <strong>{accountLabel(t.from)}</strong>
                <span style={{ color: "#888", margin: "0 6px" }}>→</span>
                <strong>{accountLabel(t.to)}</strong>
              </span>
              <span style={{ fontWeight: 700 }}>{t.amount}</span>
              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                {t.id}
              </span>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Операции ({operations.length})
      </h2>

      {loading ? null : operations.length === 0 ? (
        <div style={{ color: "#888" }}>Пока нет операций.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {operations.map((op) => (
            <div
              key={op.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 16px",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: "#666", fontSize: 12 }}>
                {new Date(op.createdAt).toLocaleString()}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: op.kind === "topup" ? "#0369a1" : "#166534",
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                {op.kind}
              </span>
              <span>
                {op.kind === "topup" ? (
                  <>
                    + в <strong>{accountLabel(op.to)}</strong>
                  </>
                ) : (
                  <>
                    <strong>{accountLabel(op.from || "")}</strong>
                    <span style={{ color: "#888", margin: "0 6px" }}>→</span>
                    <strong>{accountLabel(op.to)}</strong>
                  </>
                )}
              </span>
              <span style={{ fontWeight: 700 }}>{op.amount}</span>
              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                {op.id}
              </span>
            </div>
          ))}
        </div>
      )}
      </ProductPageShell>
    </main>
  );
}
