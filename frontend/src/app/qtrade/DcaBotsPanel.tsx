"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ldBots, svBots, makeBot, tickBot, botUnrealizedPnl, botUnrealizedPct,
  fmtUsd, fmtPct,
  type Pair, type PairId, type DcaBot,
} from "./marketSim";

type Props = {
  pairs: Pair[];
  // AEV Proof-of-Play mint — implemented in the parent (the AEV wallet is
  // shared with the rest of qtrade: spot conversion, bracket closes, etc.),
  // not owned here.
  mintAev: (kind: "qtrade_close_winning" | "qtrade_dca_run", times: number) => void;
};

// DCA Auto-Trader panel — extracted out of qtrade/page.tsx (issue #765). It
// owns its own `bots` state and its own 2000ms tick effect, so a tick here
// only re-renders this small component instead of forcing the whole (very
// large) QTrade page to re-render every 2s.
export default function DcaBotsPanel({ pairs, mintAev }: Props) {
  // ─── DCA Auto-Trader (Bots) ──────────────────────────────────────
  const [bots, setBots] = useState<DcaBot[]>([]);
  const [botPair, setBotPair] = useState<PairId>("AEV/USD");
  const [botInterval, setBotInterval] = useState("30");
  const [botAmount, setBotAmount] = useState("25");
  const [botBudget, setBotBudget] = useState("500");
  const [botMsg, setBotMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const pairById = useMemo(() => {
    const m = new Map<PairId, Pair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

  useEffect(() => {
    setBots(ldBots());
    setReady(true);
  }, []);

  useEffect(() => { if (ready) svBots(bots); }, [bots, ready]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "aevion_qtrade_bots_v1") setBots(ldBots());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // DCA Bot tick every 2s — lives in its own component (not the qtrade page
  // body) so this setState only re-renders DcaBotsPanel, not the whole
  // QTrade page (see issue #765).
  useEffect(() => {
    if (!ready) return;
    if (bots.length === 0) return;
    const id = setInterval(() => {
      setBots((prevBots) => {
        if (prevBots.length === 0) return prevBots;
        let changed = false;
        let totalRuns = 0;
        const next = prevBots.map((b) => {
          const pair = pairs.find((p) => p.id === b.pair);
          if (!pair) return b;
          const r = tickBot(b, pair.price);
          if (r.ran) { changed = true; totalRuns += 1; }
          else if (r.bot !== b) { changed = true; }
          return r.bot;
        });
        if (!changed) return prevBots;
        // Mint AEV каждые 5 ботных ранов суммарно за один tick (cumulative across bots)
        if (totalRuns > 0) {
          mintAev("qtrade_dca_run", totalRuns);
          // Show toast for last run
          const lastRun = next.find((b) => b.lastRunTs >= Date.now() - 1500);
          if (lastRun && lastRun.recent.length > 0) {
            const r = lastRun.recent[0];
            setBotMsg(`🤖 ${lastRun.pair} · DCA buy ${r.qty.toFixed(4)} @ ${fmtUsd(r.price)} · ${fmtUsd(r.spent)}`);
            setTimeout(() => setBotMsg(null), 2800);
          }
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [ready, bots.length, pairs, mintAev]);
        const intv = Math.max(5, Math.floor(Number(botInterval) || 0));
        const amt = Math.max(0, Number(botAmount) || 0);
        const bud = Math.max(0, Number(botBudget) || 0);
        const validBot = intv >= 5 && amt > 0;

        const createBot = () => {
          if (!validBot) return;
          const b = makeBot({ pair: botPair, intervalSec: intv, amountUsd: amt, budgetUsd: bud });
          setBots((bs) => [b, ...bs]);
          setBotMsg(`🤖 Bot создан · ${b.pair} ${fmtUsd(amt)}/${intv}s${bud > 0 ? ` budget ${fmtUsd(bud)}` : " · ∞"}`);
          setTimeout(() => setBotMsg(null), 2800);
        };
        const toggleBot = (id: string) => {
          setBots((bs) => bs.map((b) => b.id === id
            ? { ...b, status: b.status === "active" ? "paused" : (b.status === "paused" ? "active" : b.status) }
            : b));
        };
        const deleteBot = (id: string) => {
          setBots((bs) => bs.filter((b) => b.id !== id));
        };

        const totalSpent = bots.reduce((s, b) => s + b.spentUsd, 0);
        const totalRuns = bots.reduce((s, b) => s + b.runsCount, 0);
        const totalPnl = bots.reduce((s, b) => {
          const pair = pairById.get(b.pair);
          if (!pair) return s;
          return s + botUnrealizedPnl(b, pair.price);
        }, 0);
        const activeCount = bots.filter((b) => b.status === "active").length;

        return (
          <section style={{
            marginBottom: 18, padding: 16, borderRadius: 12,
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(49,46,129,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#a5b4fc" }}>
                🤖 DCA Auto-Trader
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 5,
                background: activeCount > 0 ? "rgba(134,239,172,0.18)" : "rgba(255,255,255,0.10)",
                color: activeCount > 0 ? "#86efac" : "#cbd5e1",
                fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const,
              }}>
                {activeCount > 0 ? `● ${activeCount} active` : `${bots.length} total`}
              </span>
              <span style={{ fontSize: 10, color: "#cbd5e1", marginLeft: "auto" as const }}>
                покупает фиксированную сумму USD каждые N секунд · +0.05 AEV / tick
              </span>
            </div>

            {/* Stats */}
            {bots.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const }}>Bot runs</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{totalRuns}</div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const }}>USD spent</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{fmtUsd(totalSpent)}</div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const }}>Aggregate PnL</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: totalPnl >= 0 ? "#86efac" : "#fca5a5" }}>
                    {totalPnl >= 0 ? "+" : ""}{fmtUsd(totalPnl)}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const }}>AEV mined</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#fde68a" }}>
                    +{(totalRuns * 0.05).toFixed(3)}
                  </div>
                </div>
              </div>
            )}

            {/* Create form */}
            <div style={{
              padding: 10, borderRadius: 8,
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.10)",
              marginBottom: 10,
              display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "flex-end" as const,
            }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>
                Pair
                <select value={botPair} onChange={(e) => setBotPair(e.target.value as PairId)}
                  style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid #4338ca", background: "#1e1b4b", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {(["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"] as PairId[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>
                Interval (sec, ≥5)
                <input type="number" min={5} step={1} value={botInterval} onChange={(e) => setBotInterval(e.target.value)}
                  style={{ width: 90, padding: "6px 10px", borderRadius: 5, border: "1px solid #4338ca", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>
                Amount per buy ($)
                <input type="number" min={1} step="any" value={botAmount} onChange={(e) => setBotAmount(e.target.value)}
                  style={{ width: 110, padding: "6px 10px", borderRadius: 5, border: "1px solid #4338ca", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>
                Total budget ($, 0=∞)
                <input type="number" min={0} step="any" value={botBudget} onChange={(e) => setBotBudget(e.target.value)}
                  style={{ width: 130, padding: "6px 10px", borderRadius: 5, border: "1px solid #4338ca", background: "#1e1b4b", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <button onClick={createBot} disabled={!validBot}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: validBot ? "linear-gradient(135deg, #6366f1, #818cf8)" : "rgba(255,255,255,0.15)",
                  color: validBot ? "#fff" : "#94a3b8",
                  fontWeight: 800, fontSize: 13,
                  cursor: validBot ? "pointer" : "default",
                  boxShadow: validBot ? "0 2px 8px rgba(99,102,241,0.4)" : "none",
                }}>
                ▶ Запустить bot
              </button>
            </div>

            {botMsg && (
              <div style={{
                padding: "7px 12px", borderRadius: 6, marginBottom: 10,
                background: "rgba(134,239,172,0.15)", border: "1px solid rgba(134,239,172,0.35)",
                color: "#86efac", fontSize: 12, fontWeight: 700,
              }}>{botMsg}</div>
            )}

            {/* Bots list */}
            {bots.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center" as const, fontSize: 12, color: "#a5b4fc", background: "rgba(0,0,0,0.20)", borderRadius: 8 }}>
                Ботов нет. Настрой DCA-стратегию и запусти — bot будет покупать фиксированную сумму каждые N секунд по текущей цене.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {bots.map((b) => {
                  const pair = pairById.get(b.pair);
                  const cur = pair?.price ?? b.avgEntry;
                  const pnl = pair ? botUnrealizedPnl(b, pair.price) : 0;
                  const pct = pair ? botUnrealizedPct(b, pair.price) : 0;
                  const nextRunSec = b.lastRunTs > 0
                    ? Math.max(0, b.intervalSec - Math.floor((Date.now() - b.lastRunTs) / 1000))
                    : 0;
                  const ageMin = Math.max(0, Math.floor((Date.now() - b.createdTs) / 60000));
                  const budgetPct = b.budgetUsd > 0 ? Math.min(100, (b.spentUsd / b.budgetUsd) * 100) : 0;
                  const statusColor = b.status === "active" ? "#86efac" : b.status === "paused" ? "#fde68a" : "#94a3b8";
                  return (
                    <div key={b.id} style={{
                      padding: "10px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.30)", border: `1px solid ${statusColor}33`,
                      borderLeft: `3px solid ${statusColor}`,
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 10, alignItems: "center" as const, fontSize: 12 }}>
                        <span style={{ fontSize: 18 }}>{b.status === "active" ? "🤖" : b.status === "paused" ? "⏸" : "✓"}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 13, color: "#fff", fontFamily: "ui-monospace, monospace" }}>
                            {b.pair} · {fmtUsd(b.amountUsd)} / {b.intervalSec}s
                          </div>
                          <div style={{ fontSize: 10, color: "#cbd5e1", display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 2 }}>
                            <span>{b.runsCount} runs</span>
                            <span>· spent {fmtUsd(b.spentUsd)}{b.budgetUsd > 0 ? ` / ${fmtUsd(b.budgetUsd)}` : " · ∞"}</span>
                            {b.totalQty > 0 && <span>· {b.totalQty.toFixed(4)} {b.pair.split("/")[0]} @ avg {fmtUsd(b.avgEntry)}</span>}
                            <span>· age {ageMin}m</span>
                            {b.status === "active" && b.lastRunTs > 0 && (
                              <span style={{ color: "#a5b4fc" }}>· next in ~{nextRunSec}s</span>
                            )}
                          </div>
                          {b.budgetUsd > 0 && (
                            <div style={{ height: 4, marginTop: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" as const }}>
                              <div style={{ height: "100%", width: `${budgetPct}%`, background: "linear-gradient(90deg, #6366f1, #818cf8)", transition: "width 0.3s" }} />
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" as const, minWidth: 70 }}>
                          <div style={{ fontSize: 9, color: "#a5b4fc", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Last</div>
                          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{fmtUsd(cur)}</div>
                        </div>
                        <div style={{ textAlign: "right" as const, minWidth: 80 }}>
                          <div style={{ fontSize: 9, color: "#a5b4fc", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const }}>PnL</div>
                          <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: pnl >= 0 ? "#86efac" : "#fca5a5" }}>
                            {pnl >= 0 ? "+" : ""}{fmtUsd(pnl)}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: pct >= 0 ? "#86efac" : "#fca5a5" }}>
                            {pct >= 0 ? "+" : ""}{fmtPct(pct)}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleBot(b.id)}
                          disabled={b.status === "exhausted"}
                          title={b.status === "active" ? "Пауза" : b.status === "paused" ? "Продолжить" : "Бюджет исчерпан"}
                          style={{
                            padding: "6px 10px", borderRadius: 5,
                            border: "1px solid " + (b.status === "exhausted" ? "rgba(255,255,255,0.1)" : "rgba(165,180,252,0.5)"),
                            background: "rgba(99,102,241,0.15)",
                            color: b.status === "exhausted" ? "#64748b" : "#a5b4fc",
                            fontSize: 11, fontWeight: 800,
                            cursor: b.status === "exhausted" ? "default" : "pointer",
                            whiteSpace: "nowrap" as const,
                          }}>
                          {b.status === "active" ? "⏸ Pause" : b.status === "paused" ? "▶ Resume" : "✓ Done"}
                        </button>
                        <button onClick={() => deleteBot(b.id)} title="Удалить bot" aria-label={`Удалить DCA bot ${b.pair}`}
                          style={{
                            padding: "6px 10px", borderRadius: 5,
                            border: "1px solid rgba(252,165,165,0.4)", background: "rgba(252,165,165,0.10)",
                            color: "#fca5a5", fontSize: 11, fontWeight: 800, cursor: "pointer",
                          }}>
                          ✕
                        </button>
                      </div>
                      {b.recent.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.08)", display: "flex", gap: 6, flexWrap: "wrap" as const, maxHeight: 38, overflow: "hidden" as const }}>
                          {b.recent.slice(0, 8).map((r, i) => (
                            <span key={i} style={{
                              padding: "3px 8px", borderRadius: 4,
                              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                              fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#cbd5e1",
                            }}>
                              @{fmtUsd(r.price)} · {r.qty.toFixed(4)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 10, color: "#a5b4fc", marginTop: 10, lineHeight: 1.5 }}>
              DCA = Dollar-Cost Averaging. Bot покупает фиксированную сумму каждые N секунд по текущей рыночной цене,
              сглаживая среднюю точку входа. Stops automatically когда исчерпан budget. AEV mintit'ся за каждый успешный tick.
            </div>
          </section>
        );
}
