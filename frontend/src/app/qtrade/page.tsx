"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import {
  ldPairs, svPairs, ldPositions, svPositions,
  ldLimits, svLimits, checkLimitFills, buildOrderBook,
  ldClosed, svClosed, buildClosed, checkBracketHit,
  tickPair, catchupPair, unrealizedPnl, unrealizedPct,
  fmtUsd, fmtPct, sparklinePath,
  type Pair, type Position, type PairId, type LimitOrder, type ClosedPosition,
} from "./marketSim";
import { ldWallet, svWallet, sellAev, buyAev, recordPlay, type AEVWallet } from "../aev/aevToken";

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
  const [limits, setLimits] = useState<LimitOrder[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [marketsReady, setMarketsReady] = useState(false);
  const [activePair, setActivePair] = useState<PairId | null>(null);
  const [orderQty, setOrderQty] = useState("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);
  const [bracketEditId, setBracketEditId] = useState<string | null>(null);
  const [bracketSL, setBracketSL] = useState("");
  const [bracketTP, setBracketTP] = useState("");

  // AEV wallet (for AEV/USD spot conversion)
  const [aevWallet, setAevWallet] = useState<AEVWallet | null>(null);
  const [aevSpotQty, setAevSpotQty] = useState("");
  useEffect(() => { setAevWallet(ldWallet()) }, []);
  useEffect(() => { if (aevWallet) svWallet(aevWallet) }, [aevWallet]);

  useEffect(() => {
    setPairs(ldPairs().map((p) => catchupPair(p)));
    setPositions(ldPositions());
    setLimits(ldLimits());
    setClosedPositions(ldClosed());
    setMarketsReady(true);
  }, []);

  // Tick price every 1000ms after markets are ready + auto-fill limit orders + SL/TP brackets
  useEffect(() => {
    if (!marketsReady) return;
    const id = setInterval(() => {
      setPairs((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.map(tickPair);
        svPairs(next);
        // After tick, check whether any limit orders have crossed.
        setLimits((prevLimits) => {
          if (prevLimits.length === 0) return prevLimits;
          const fillIds = new Set<string>();
          for (const p of next) {
            for (const id2 of checkLimitFills(prevLimits, p)) fillIds.add(id2);
          }
          if (fillIds.size === 0) return prevLimits;
          // Convert filled limit orders into positions
          const newPositions: Position[] = [];
          const remaining: LimitOrder[] = [];
          for (const o of prevLimits) {
            if (!fillIds.has(o.id)) { remaining.push(o); continue; }
            const pair = next.find((x) => x.id === o.pair);
            if (!pair) { remaining.push(o); continue; }
            newPositions.push({
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              pair: o.pair, side: o.side, qty: o.qty,
              entryPrice: pair.price, entryTs: Date.now(),
            });
          }
          if (newPositions.length > 0) {
            setPositions((pp) => [...newPositions, ...pp]);
            const f = newPositions[0];
            setTradeMsg(`⚡ Limit filled · ${f.side === "long" ? "Long" : "Short"} ${f.qty} ${f.pair.split("/")[0]} @ ${fmtUsd(f.entryPrice)}`);
            setTimeout(() => setTradeMsg(null), 3000);
          }
          svLimits(remaining);
          return remaining;
        });
        // Check SL/TP brackets on open positions
        setPositions((prevPos) => {
          if (prevPos.length === 0) return prevPos;
          const stillOpen: Position[] = [];
          const triggered: { pos: Position; reason: "tp" | "sl"; price: number }[] = [];
          for (const pos of prevPos) {
            const pair = next.find((x) => x.id === pos.pair);
            if (!pair) { stillOpen.push(pos); continue; }
            const hit = checkBracketHit(pos, pair.price);
            if (hit) triggered.push({ pos, reason: hit, price: pair.price });
            else stillOpen.push(pos);
          }
          if (triggered.length === 0) return prevPos;
          const newClosed: ClosedPosition[] = triggered.map(({ pos, price }) => buildClosed(pos, price));
          setClosedPositions((cs) => [...newClosed, ...cs].slice(0, 200));
          // Mint AEV per profitable bracket-close
          const profitableCount = newClosed.filter((c) => c.realizedPnl > 0).length;
          if (profitableCount > 0) {
            setAevWallet((w) => {
              if (!w) return w;
              let next2 = w;
              for (let i = 0; i < profitableCount; i++) {
                next2 = recordPlay(next2, "qtrade_close_winning", "qtrade");
              }
              return next2;
            });
          }
          const t = triggered[0];
          setTradeMsg(
            `${t.reason === "tp" ? "🎯 TP" : "🛑 SL"} hit · ${t.pos.side === "long" ? "Long" : "Short"} ${t.pos.qty} ${t.pos.pair.split("/")[0]} @ ${fmtUsd(t.price)}` +
            (newClosed[0].realizedPnl >= 0 ? ` · +${fmtUsd(newClosed[0].realizedPnl)}` : ` · ${fmtUsd(newClosed[0].realizedPnl)}`),
          );
          setTimeout(() => setTradeMsg(null), 3500);
          return stillOpen;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [marketsReady]);

  // Persist positions/limits/closed when they change
  useEffect(() => { if (marketsReady) svPositions(positions); }, [positions, marketsReady]);
  useEffect(() => { if (marketsReady) svLimits(limits); }, [limits, marketsReady]);
  useEffect(() => { if (marketsReady) svClosed(closedPositions); }, [closedPositions, marketsReady]);

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

  const submitOrder = (pid: PairId, side: "long" | "short") => {
    const cur = pairById.get(pid);
    if (!cur) return;
    const q = Number(orderQty);
    if (!Number.isFinite(q) || q <= 0) {
      setTradeMsg("Введи положительное количество");
      return;
    }
    if (orderType === "market") {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const pos: Position = { id, pair: pid, side, qty: q, entryPrice: cur.price, entryTs: Date.now() };
      setPositions((prev) => [pos, ...prev]);
      setTradeMsg(`✓ ${side === "long" ? "Long" : "Short"} ${q} ${cur.symbol} @ ${fmtUsd(cur.price)}`);
      setTimeout(() => setTradeMsg(null), 2400);
      return;
    }
    // Limit order
    const trigger = Number(limitPrice);
    if (!Number.isFinite(trigger) || trigger <= 0) {
      setTradeMsg("Введи цену исполнения");
      return;
    }
    // Sanity check: long limit should be below current price; short limit above.
    if (side === "long" && trigger >= cur.price) {
      setTradeMsg(`Long-limit должен быть ниже текущей ${fmtUsd(cur.price)} (иначе исполнится мгновенно)`);
      return;
    }
    if (side === "short" && trigger <= cur.price) {
      setTradeMsg(`Short-limit должен быть выше текущей ${fmtUsd(cur.price)}`);
      return;
    }
    const order: LimitOrder = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pair: pid, side, qty: q, triggerPrice: trigger, createdTs: Date.now(),
    };
    setLimits((prev) => [order, ...prev]);
    setTradeMsg(`📌 Limit ${side === "long" ? "long" : "short"} ${q} ${cur.symbol} @ ${fmtUsd(trigger)}`);
    setTimeout(() => setTradeMsg(null), 2400);
  };

  const cancelLimit = (id: string) => {
    setLimits((prev) => prev.filter((l) => l.id !== id));
    setTradeMsg("✓ Limit отменён");
    setTimeout(() => setTradeMsg(null), 1800);
  };

  const startEditBrackets = (pos: Position) => {
    setBracketEditId(pos.id);
    setBracketSL(pos.stopLoss !== undefined ? String(pos.stopLoss) : "");
    setBracketTP(pos.takeProfit !== undefined ? String(pos.takeProfit) : "");
  };

  const saveBrackets = (posId: string) => {
    const sl = bracketSL.trim() === "" ? undefined : Number(bracketSL);
    const tp = bracketTP.trim() === "" ? undefined : Number(bracketTP);
    if (sl !== undefined && (!Number.isFinite(sl) || sl <= 0)) { setTradeMsg("SL: положительная цена"); return; }
    if (tp !== undefined && (!Number.isFinite(tp) || tp <= 0)) { setTradeMsg("TP: положительная цена"); return; }
    setPositions((prev) => prev.map((p) => {
      if (p.id !== posId) return p;
      const cur = pairById.get(p.pair);
      const px = cur?.price ?? p.entryPrice;
      // Sanity: long → SL < px < TP; short → TP < px < SL
      if (p.side === "long") {
        if (sl !== undefined && sl >= px) { setTradeMsg(`SL должен быть ниже текущей ${fmtUsd(px)} для long`); return p; }
        if (tp !== undefined && tp <= px) { setTradeMsg(`TP должен быть выше текущей ${fmtUsd(px)} для long`); return p; }
      } else {
        if (sl !== undefined && sl <= px) { setTradeMsg(`SL должен быть выше текущей ${fmtUsd(px)} для short`); return p; }
        if (tp !== undefined && tp >= px) { setTradeMsg(`TP должен быть ниже текущей ${fmtUsd(px)} для short`); return p; }
      }
      return { ...p, stopLoss: sl, takeProfit: tp };
    }));
    setBracketEditId(null);
    setTradeMsg("✓ Brackets сохранены");
    setTimeout(() => setTradeMsg(null), 1800);
  };

  const clearBrackets = (posId: string) => {
    setPositions((prev) => prev.map((p) => p.id === posId ? { ...p, stopLoss: undefined, takeProfit: undefined } : p));
    setBracketEditId(null);
  };

  const closePosition = (posId: string) => {
    setPositions((prev) => {
      const target = prev.find((p) => p.id === posId);
      if (!target) return prev;
      const cur = pairById.get(target.pair);
      if (!cur) return prev;
      const closed = buildClosed(target, cur.price);
      setClosedPositions((cs) => [closed, ...cs].slice(0, 200));
      // Auto-mint AEV via Proof-of-Play when the trade was profitable.
      if (closed.realizedPnl > 0) {
        setAevWallet((w) => (w ? recordPlay(w, "qtrade_close_winning", "qtrade") : w));
      }
      const pnl = closed.realizedPnl;
      const aevHint = pnl > 0 ? " · +AEV в кошелёк" : "";
      setTradeMsg(`✓ Закрыто · P&L ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)} (${fmtPct(closed.realizedPct)})${aevHint}`);
      setTimeout(() => setTradeMsg(null), 3000);
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

        {/* Trade panel + Order book (responsive 2-column) */}
        {activePair && (() => {
          const p = pairById.get(activePair);
          if (!p) return null;
          const change24 = ((p.price - p.open24h) / p.open24h) * 100;
          const ob = buildOrderBook(p, 6);
          const maxBidSize = Math.max(...ob.bids.map((l) => l.size), 1);
          const maxAskSize = Math.max(...ob.asks.map((l) => l.size), 1);
          return (
            <div style={{
              padding: 12, borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 14,
            }}>
              {/* LEFT: trade panel */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 900 }}>{p.symbol}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 18 }}>{fmtUsd(p.price)}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: change24 >= 0 ? "#86efac" : "#fca5a5" }}>{fmtPct(change24)}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>· vol {p.vol >= 0.004 ? "high" : p.vol >= 0.003 ? "med" : "low"}</span>
                </div>
                {/* ──── AEV/USD SPOT — конвертация из/в кошелёк /aev ──── */}
                {p.id === "AEV/USD" && aevWallet && (
                  <div style={{
                    padding: "10px 12px", borderRadius: 8, marginBottom: 10,
                    background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.35)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "#67e8f9", textTransform: "uppercase" as const }}>
                        ◆ Spot · из/в кошелёк AEV
                      </span>
                      <a href="/aev" style={{ fontSize: 11, color: "#22d3ee", textDecoration: "none", fontWeight: 700 }}>
                        В кошельке: <strong>{aevWallet.balance.toFixed(4)} AEV</strong> →
                      </a>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        value={aevSpotQty}
                        onChange={(e) => setAevSpotQty(e.target.value)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder="qty AEV"
                        style={{
                          width: 130, padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #334155", background: "#0f172a", color: "#fff",
                          fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                        }}
                      />
                      <button
                        onClick={() => {
                          const q = Number(aevSpotQty);
                          if (!Number.isFinite(q) || q <= 0) { setTradeMsg("Введи qty"); return; }
                          if (!aevWallet || aevWallet.balance < q) { setTradeMsg("Недостаточно AEV в кошельке"); return; }
                          const next = sellAev(aevWallet, q, p.price);
                          if (next) {
                            setAevWallet(next); setAevSpotQty("");
                            setTradeMsg(`✓ Продано ${q} AEV @ ${fmtUsd(p.price)} ≈ ${fmtUsd(q * p.price)}`);
                            setTimeout(() => setTradeMsg(null), 2400);
                          }
                        }}
                        style={{
                          padding: "7px 14px", borderRadius: 6, border: "none",
                          background: "linear-gradient(135deg, #b45309, #d97706)", color: "#fff",
                          fontWeight: 800, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        💵 Sell spot
                      </button>
                      <button
                        onClick={() => {
                          const q = Number(aevSpotQty);
                          if (!Number.isFinite(q) || q <= 0) { setTradeMsg("Введи qty"); return; }
                          if (!aevWallet) return;
                          const next = buyAev(aevWallet, q, p.price);
                          setAevWallet(next); setAevSpotQty("");
                          setTradeMsg(`✓ Куплено ${q} AEV @ ${fmtUsd(p.price)} ≈ ${fmtUsd(q * p.price)}`);
                          setTimeout(() => setTradeMsg(null), 2400);
                        }}
                        style={{
                          padding: "7px 14px", borderRadius: 6, border: "none",
                          background: "linear-gradient(135deg, #166534, #16a34a)", color: "#fff",
                          fontWeight: 800, fontSize: 12, cursor: "pointer",
                        }}
                      >
                        🛒 Buy spot
                      </button>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        ≈ {Number(aevSpotQty) > 0 ? fmtUsd(Number(aevSpotQty) * p.price) : "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                      Spot касается твоего AEV-кошелька. Long/Short ниже — это derivatives, не трогают баланс.
                    </div>
                  </div>
                )}
                {/* Order type toggle */}
                <div style={{ display: "inline-flex", marginBottom: 10, borderRadius: 6, overflow: "hidden", border: "1px solid #334155" }}>
                  {(["market", "limit"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderType(t)}
                      style={{
                        padding: "5px 14px", border: "none",
                        background: orderType === t ? "#22d3ee" : "transparent",
                        color: orderType === t ? "#0f172a" : "#cbd5e1",
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      {t === "market" ? "Market" : "Limit"}
                    </button>
                  ))}
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
                  {orderType === "limit" && (
                    <>
                      <label style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700 }}>@</label>
                      <input
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        type="number"
                        min={0}
                        step="any"
                        placeholder={p.price.toFixed(p.price > 100 ? 2 : 4)}
                        style={{
                          width: 130, padding: "6px 10px", borderRadius: 6,
                          border: "1px solid #334155", background: "#0f172a", color: "#fff",
                          fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13,
                        }}
                      />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => submitOrder(p.id, "long")}
                    style={{
                      padding: "8px 16px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(34,197,94,0.25)",
                    }}
                  >
                    ▲ {orderType === "market" ? "LONG @ market" : "LONG @ limit"}
                  </button>
                  <button
                    onClick={() => submitOrder(p.id, "short")}
                    style={{
                      padding: "8px 16px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                    }}
                  >
                    ▼ {orderType === "market" ? "SHORT @ market" : "SHORT @ limit"}
                  </button>
                </div>
                {tradeMsg && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#86efac", fontWeight: 700 }}>{tradeMsg}</div>
                )}
              </div>
              {/* RIGHT: order book */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 6 }}>
                  Order Book · spread {fmtUsd(ob.spread, p.price > 100 ? 2 : 4)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                  {/* Asks reversed (top is highest ask, closest to mid) */}
                  {[...ob.asks].slice(0, 5).reverse().map((lvl, i) => {
                    const w = (lvl.size / maxAskSize) * 100;
                    return (
                      <div key={`ask-${i}`} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px 6px", borderRadius: 3 }}>
                        <div style={{ position: "absolute", inset: 0, right: "auto", width: `${w}%`, background: "rgba(220,38,38,0.18)", borderRadius: 3, pointerEvents: "none" }} />
                        <span style={{ color: "#fca5a5", position: "relative", fontWeight: 700 }}>{lvl.price.toFixed(p.price > 100 ? 2 : 4)}</span>
                        <span style={{ color: "#cbd5e1", textAlign: "right" as const, position: "relative" }}>{lvl.size}</span>
                      </div>
                    );
                  })}
                  {/* Mid */}
                  <div style={{ padding: "4px 6px", margin: "4px 0", textAlign: "center" as const, fontSize: 12, fontWeight: 900, color: "#22d3ee", background: "rgba(34,211,238,0.08)", borderRadius: 3, border: "1px solid rgba(34,211,238,0.25)" }}>
                    ◆ {fmtUsd(p.price, p.price > 100 ? 2 : 4)}
                  </div>
                  {/* Bids */}
                  {ob.bids.slice(0, 5).map((lvl, i) => {
                    const w = (lvl.size / maxBidSize) * 100;
                    return (
                      <div key={`bid-${i}`} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "2px 6px", borderRadius: 3 }}>
                        <div style={{ position: "absolute", inset: 0, right: "auto", width: `${w}%`, background: "rgba(34,197,94,0.18)", borderRadius: 3, pointerEvents: "none" }} />
                        <span style={{ color: "#86efac", position: "relative", fontWeight: 700 }}>{lvl.price.toFixed(p.price > 100 ? 2 : 4)}</span>
                        <span style={{ color: "#cbd5e1", textAlign: "right" as const, position: "relative" }}>{lvl.size}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pending limits */}
        {limits.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#fbbf24", marginBottom: 8 }}>
              📌 Ожидающие limit-ордера ({limits.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {limits.map((o) => {
                const cur = pairById.get(o.pair);
                const distance = cur ? ((o.triggerPrice - cur.price) / cur.price) * 100 : 0;
                return (
                  <div
                    key={o.id}
                    style={{
                      padding: "7px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.08)",
                      display: "grid", gridTemplateColumns: "auto 1fr auto auto",
                      gap: 12, alignItems: "center", fontSize: 13,
                    }}
                  >
                    <span style={{
                      padding: "2px 8px", borderRadius: 4,
                      background: o.side === "long" ? "rgba(34,197,94,0.18)" : "rgba(220,38,38,0.18)",
                      color: o.side === "long" ? "#86efac" : "#fca5a5",
                      fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                    }}>
                      {o.side === "long" ? "▲ Long" : "▼ Short"} limit
                    </span>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                      {o.qty} {o.pair.split("/")[0]} @ {fmtUsd(o.triggerPrice)}
                      {cur && (
                        <span style={{ marginLeft: 8, color: Math.abs(distance) < 0.5 ? "#fbbf24" : "#64748b", fontSize: 11, fontWeight: 700 }}>
                          ({distance >= 0 ? "+" : ""}{distance.toFixed(2)}% от рынка)
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      {Math.max(0, Math.round((Date.now() - o.createdTs) / 60000))}m ago
                    </span>
                    <button
                      onClick={() => cancelLimit(o.id)}
                      style={{
                        padding: "4px 10px", borderRadius: 5,
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)",
                        color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                const editing = bracketEditId === pos.id;
                const hasSL = pos.stopLoss !== undefined;
                const hasTP = pos.takeProfit !== undefined;
                return (
                  <div key={pos.id} style={{
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, alignItems: "center" as const }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4,
                        background: pos.side === "long" ? "rgba(34,197,94,0.2)" : "rgba(220,38,38,0.2)",
                        color: pos.side === "long" ? "#86efac" : "#fca5a5",
                        fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                      }}>
                        {pos.side === "long" ? "▲ Long" : "▼ Short"} {pos.pair.split("/")[0]}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                        {pos.qty} @ {fmtUsd(pos.entryPrice)} → {fmtUsd(price)}
                        <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11 }}>({ageMin}m ago)</span>
                      </span>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontWeight: 900,
                        color: pnl > 0 ? "#22c55e" : pnl < 0 ? "#f87171" : "#cbd5e1",
                      }}>
                        {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} ({fmtPct(pct)})
                      </span>
                      <button
                        onClick={() => editing ? setBracketEditId(null) : startEditBrackets(pos)}
                        style={{
                          padding: "5px 10px", borderRadius: 5,
                          background: editing ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${editing ? "#22d3ee" : "rgba(255,255,255,0.15)"}`,
                          color: editing ? "#67e8f9" : "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        {hasSL || hasTP ? "🎯 SL/TP" : "+ SL/TP"}
                      </button>
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
                    {/* SL/TP chips (display when set, not editing) */}
                    {!editing && (hasSL || hasTP) && (
                      <div style={{ display: "flex", gap: 6, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                        {hasSL && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(220,38,38,0.18)", color: "#fca5a5", fontWeight: 700 }}>
                            🛑 SL {fmtUsd(pos.stopLoss!)}
                          </span>
                        )}
                        {hasTP && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(34,197,94,0.18)", color: "#86efac", fontWeight: 700 }}>
                            🎯 TP {fmtUsd(pos.takeProfit!)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* SL/TP editor */}
                    {editing && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", borderRadius: 6, background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.25)" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", letterSpacing: 0.5, textTransform: "uppercase" as const }}>SL</span>
                        <input
                          value={bracketSL}
                          onChange={(e) => setBracketSL(e.target.value)}
                          type="number" min={0} step="any"
                          placeholder={pos.side === "long" ? `< ${fmtUsd(price)}` : `> ${fmtUsd(price)}`}
                          style={{
                            width: 110, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(220,38,38,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#86efac", letterSpacing: 0.5, textTransform: "uppercase" as const }}>TP</span>
                        <input
                          value={bracketTP}
                          onChange={(e) => setBracketTP(e.target.value)}
                          type="number" min={0} step="any"
                          placeholder={pos.side === "long" ? `> ${fmtUsd(price)}` : `< ${fmtUsd(price)}`}
                          style={{
                            width: 110, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid rgba(34,197,94,0.5)", background: "#0f172a", color: "#fff",
                            fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                          }}
                        />
                        <button onClick={() => saveBrackets(pos.id)}
                          style={{ padding: "5px 12px", borderRadius: 4, border: "none", background: "#22d3ee", color: "#0f172a", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
                          Save
                        </button>
                        {(hasSL || hasTP) && (
                          <button onClick={() => clearBrackets(pos.id)}
                            style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trade history + performance */}
        {closedPositions.length > 0 && (() => {
          const wins = closedPositions.filter((c) => c.realizedPnl > 0).length;
          const losses = closedPositions.filter((c) => c.realizedPnl < 0).length;
          const total = closedPositions.length;
          const realizedSum = closedPositions.reduce((s, c) => s + c.realizedPnl, 0);
          const winrate = total > 0 ? (wins / total) * 100 : 0;
          const best = closedPositions.reduce<ClosedPosition | null>((b, c) => (!b || c.realizedPnl > b.realizedPnl ? c : b), null);
          const worst = closedPositions.reduce<ClosedPosition | null>((b, c) => (!b || c.realizedPnl < b.realizedPnl ? c : b), null);
          return (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" as const, color: "#cbd5e1" }}>
                  📊 История сделок · performance
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#cbd5e1", flexWrap: "wrap" }}>
                  <span>Closed: <strong style={{ color: "#fff" }}>{total}</strong></span>
                  <span>Winrate: <strong style={{ color: winrate >= 55 ? "#22c55e" : winrate >= 40 ? "#fbbf24" : "#f87171" }}>{winrate.toFixed(1)}%</strong> ({wins}W {losses}L)</span>
                  <span>Realized P&L: <strong style={{ color: realizedSum > 0 ? "#22c55e" : realizedSum < 0 ? "#f87171" : "#cbd5e1" }}>{realizedSum >= 0 ? "+" : ""}{fmtUsd(realizedSum)}</strong></span>
                  {best && best.realizedPnl > 0 && <span style={{ color: "#86efac" }}>Best <strong>+{fmtUsd(best.realizedPnl)}</strong></span>}
                  {worst && worst.realizedPnl < 0 && <span style={{ color: "#fca5a5" }}>Worst <strong>{fmtUsd(worst.realizedPnl)}</strong></span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" as const }}>
                {closedPositions.slice(0, 30).map((c) => {
                  const dur = (() => {
                    const ms = c.exitTs - c.entryTs;
                    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
                    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
                    return `${Math.round(ms / 86400000)}d`;
                  })();
                  return (
                    <div key={c.id} style={{
                      padding: "6px 12px", borderRadius: 6,
                      background: c.realizedPnl >= 0 ? "rgba(34,197,94,0.07)" : "rgba(220,38,38,0.07)",
                      border: `1px solid ${c.realizedPnl >= 0 ? "rgba(34,197,94,0.18)" : "rgba(220,38,38,0.18)"}`,
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: 12, alignItems: "center" as const, fontSize: 12,
                    }}>
                      <span style={{
                        padding: "2px 7px", borderRadius: 4,
                        background: c.side === "long" ? "rgba(34,197,94,0.2)" : "rgba(220,38,38,0.2)",
                        color: c.side === "long" ? "#86efac" : "#fca5a5",
                        fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                      }}>
                        {c.side === "long" ? "▲L" : "▼S"} {c.pair.split("/")[0]}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
                        {c.qty} @ {fmtUsd(c.entryPrice)} → {fmtUsd(c.exitPrice)}
                        <span style={{ marginLeft: 8, color: "#64748b", fontSize: 11 }}>· {dur}</span>
                      </span>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontWeight: 900,
                        color: c.realizedPnl > 0 ? "#22c55e" : c.realizedPnl < 0 ? "#f87171" : "#cbd5e1",
                      }}>
                        {c.realizedPnl >= 0 ? "+" : ""}{fmtUsd(c.realizedPnl)}
                      </span>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 11,
                        color: c.realizedPct >= 0 ? "#86efac" : "#fca5a5",
                      }}>
                        {fmtPct(c.realizedPct)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {closedPositions.length > 0 && (
                <button
                  onClick={() => { if (confirm("Очистить всю историю сделок?")) setClosedPositions([]) }}
                  style={{
                    marginTop: 8, padding: "5px 12px", borderRadius: 5,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Очистить историю
                </button>
              )}
            </div>
          );
        })()}
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
