"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ldGridBots, svGridBots, makeGridBot, tickGridBot, gridInventoryValue, gridFilledCount,
  fmtUsd,
  type Pair, type PairId, type GridBot,
} from "./marketSim";

type Props = {
  pairs: Pair[];
  // Bracket close / grid sell mint AEV via Proof-of-Play — implemented in the
  // parent (TradingWorkspace-level state) since the AEV wallet is shared with
  // the rest of qtrade (spot conversion, bracket closes, etc.), not owned here.
  mintAev: (kind: "qtrade_close_winning" | "qtrade_dca_run", times: number) => void;
};

// Grid Bot panel — extracted out of qtrade/page.tsx (issue #765). It owns its
// own `gridBots` state and its own 1500ms tick effect, so a tick here only
// re-renders this small component instead of forcing the whole (very large)
// QTrade page to re-render every 1.5s.
export default function GridBotsPanel({ pairs, mintAev }: Props) {
  // ─── Grid Bot ────────────────────────────────────────────────────
  const [gridBots, setGridBots] = useState<GridBot[]>([]);
  const [gridPair, setGridPair] = useState<PairId>("BTC/USD");
  const [gridLow, setGridLow] = useState("");
  const [gridHigh, setGridHigh] = useState("");
  const [gridCount, setGridCount] = useState("8");
  const [gridAmount, setGridAmount] = useState("25");
  const [gridMsg, setGridMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const pairById = useMemo(() => {
    const m = new Map<PairId, Pair>();
    for (const p of pairs) m.set(p.id, p);
    return m;
  }, [pairs]);

  useEffect(() => {
    setGridBots(ldGridBots());
    setReady(true);
  }, []);

  useEffect(() => { if (ready) svGridBots(gridBots); }, [gridBots, ready]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "aevion_qtrade_grid_bots_v1") setGridBots(ldGridBots());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Grid Bot tick every 1.5s — lives in its own component (not the qtrade
  // page body) so this setState only re-renders GridBotsPanel, not the
  // whole QTrade page (see issue #765).
  useEffect(() => {
    if (!ready) return;
    if (gridBots.length === 0) return;
    const id = setInterval(() => {
      setGridBots((prev) => {
        if (prev.length === 0) return prev;
        let changed = false;
        let totalNewBuys = 0;
        let totalNewSells = 0;
        const next = prev.map((g) => {
          const pair = pairs.find((p) => p.id === g.pair);
          if (!pair) return g;
          const r = tickGridBot(g, pair.price);
          if (r.buys > 0 || r.sells > 0) {
            changed = true;
            totalNewBuys += r.buys;
            totalNewSells += r.sells;
            return r.bot;
          }
          if (r.bot.lastPrice !== g.lastPrice) {
            return r.bot;
          }
          return g;
        });
        if (totalNewBuys > 0 || totalNewSells > 0) {
          if (totalNewSells > 0) mintAev("qtrade_close_winning", totalNewSells);
          const lastEvent = totalNewSells > 0
            ? `🎯 Grid sell ×${totalNewSells} +profit`
            : `🤖 Grid buy ×${totalNewBuys}`;
          setGridMsg(lastEvent);
          setTimeout(() => setGridMsg(null), 2500);
        }
        return changed || next.some((b, i) => b !== prev[i]) ? next : prev;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [ready, gridBots.length, pairs, mintAev]);
        const gridLowN = Number(gridLow);
        const gridHighN = Number(gridHigh);
        const gridCountN = Math.max(2, Math.min(30, Math.floor(Number(gridCount) || 0)));
        const gridAmountN = Math.max(1, Number(gridAmount) || 0);
        const validGrid = Number.isFinite(gridLowN) && Number.isFinite(gridHighN)
          && gridLowN > 0 && gridHighN > gridLowN
          && gridCountN >= 2 && gridAmountN > 0;

        const createGrid = () => {
          if (!validGrid) return;
          const pair = pairById.get(gridPair);
          if (!pair) return;
          const bot = makeGridBot({
            pair: gridPair,
            lowPrice: gridLowN,
            highPrice: gridHighN,
            gridCount: gridCountN,
            amountUsdPerLevel: gridAmountN,
            startPrice: pair.price,
          });
          if (!bot) return;
          setGridBots((bs) => [bot, ...bs]);
          setGridMsg(`🎯 Grid bot создан · ${gridPair} ${gridCountN} levels [$${gridLowN}—$${gridHighN}]`);
          setTimeout(() => setGridMsg(null), 2800);
        };
        const toggleGrid = (id: string) => {
          setGridBots((bs) => bs.map((b) => b.id === id
            ? { ...b, status: b.status === "active" ? "paused" : (b.status === "paused" ? "active" : b.status) }
            : b));
        };
        const stopGrid = (id: string) => {
          setGridBots((bs) => bs.map((b) => b.id === id ? { ...b, status: "stopped" } : b));
        };
        const deleteGrid = (id: string) => {
          setGridBots((bs) => bs.filter((b) => b.id !== id));
        };

        // Helper для prefilling с текущей цены
        const fillFromCurrent = (deviationPct = 5) => {
          const pair = pairById.get(gridPair);
          if (!pair) return;
          const lo = pair.price * (1 - deviationPct / 100);
          const hi = pair.price * (1 + deviationPct / 100);
          setGridLow(lo.toFixed(pair.price < 1 ? 4 : 2));
          setGridHigh(hi.toFixed(pair.price < 1 ? 4 : 2));
        };

        const totalGridProfit = gridBots.reduce((s, g) => s + g.totalProfit, 0);
        const totalGridFilled = gridBots.reduce((s, g) => s + gridFilledCount(g), 0);
        const totalGridCycles = gridBots.reduce((s, g) => s + Math.min(g.totalBuys, g.totalSells), 0);
        const activeGrids = gridBots.filter((g) => g.status === "active").length;

        return (
          <section style={{
            marginBottom: 18, padding: 16, borderRadius: 12,
            background: "linear-gradient(135deg, #042f2e 0%, #115e59 60%, #0d9488 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(13,148,136,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" as const }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#5eead4" }}>
                🎯 Grid Bot
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 5,
                background: activeGrids > 0 ? "rgba(94,234,212,0.18)" : "rgba(255,255,255,0.10)",
                color: activeGrids > 0 ? "#5eead4" : "#cbd5e1",
                fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as const,
              }}>
                {activeGrids > 0 ? `● ${activeGrids} active` : `${gridBots.length} total`}
              </span>
              <span style={{ fontSize: 10, color: "#cbd5e1", marginLeft: "auto" as const }}>
                buy низко · sell высоко по сетке · profit per cycle
              </span>
            </div>

            {/* Stats */}
            {gridBots.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#5eead4", textTransform: "uppercase" as const }}>Realized profit</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: totalGridProfit >= 0 ? "#86efac" : "#fca5a5" }}>
                    {totalGridProfit >= 0 ? "+" : ""}{fmtUsd(totalGridProfit)}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#5eead4", textTransform: "uppercase" as const }}>Cycles</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{totalGridCycles}</div>
                </div>
                <div style={{ padding: 9, borderRadius: 7, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#5eead4", textTransform: "uppercase" as const }}>Active inventory</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{totalGridFilled}</div>
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
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#5eead4", fontWeight: 700 }}>
                Pair
                <select value={gridPair} onChange={(e) => setGridPair(e.target.value as PairId)}
                  style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid #115e59", background: "#042f2e", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {(["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"] as PairId[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#5eead4", fontWeight: 700 }}>
                Low ($)
                <input type="number" min={0} step="any" value={gridLow} onChange={(e) => setGridLow(e.target.value)}
                  placeholder={pairById.get(gridPair) ? fmtUsd(pairById.get(gridPair)!.price * 0.95) : "—"}
                  style={{ width: 110, padding: "6px 10px", borderRadius: 5, border: "1px solid #115e59", background: "#042f2e", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#5eead4", fontWeight: 700 }}>
                High ($)
                <input type="number" min={0} step="any" value={gridHigh} onChange={(e) => setGridHigh(e.target.value)}
                  placeholder={pairById.get(gridPair) ? fmtUsd(pairById.get(gridPair)!.price * 1.05) : "—"}
                  style={{ width: 110, padding: "6px 10px", borderRadius: 5, border: "1px solid #115e59", background: "#042f2e", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#5eead4", fontWeight: 700 }}>
                Levels (2-30)
                <input type="number" min={2} max={30} step={1} value={gridCount} onChange={(e) => setGridCount(e.target.value)}
                  style={{ width: 80, padding: "6px 10px", borderRadius: 5, border: "1px solid #115e59", background: "#042f2e", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#5eead4", fontWeight: 700 }}>
                $ per level
                <input type="number" min={1} step="any" value={gridAmount} onChange={(e) => setGridAmount(e.target.value)}
                  style={{ width: 100, padding: "6px 10px", borderRadius: 5, border: "1px solid #115e59", background: "#042f2e", color: "#fff", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13 }} />
              </label>
              <button onClick={() => fillFromCurrent(5)} title="Заполни ±5% от текущей цены"
                style={{
                  padding: "6px 10px", borderRadius: 5,
                  border: "1px solid rgba(94,234,212,0.40)", background: "rgba(94,234,212,0.12)",
                  color: "#5eead4", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>
                ±5%
              </button>
              <button onClick={createGrid} disabled={!validGrid}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: validGrid ? "linear-gradient(135deg, #14b8a6, #5eead4)" : "rgba(255,255,255,0.15)",
                  color: validGrid ? "#042f2e" : "#94a3b8",
                  fontWeight: 800, fontSize: 13,
                  cursor: validGrid ? "pointer" : "default",
                  boxShadow: validGrid ? "0 2px 8px rgba(20,184,166,0.4)" : "none",
                }}>
                ▶ Запустить grid
              </button>
            </div>

            {gridMsg && (
              <div style={{
                padding: "7px 12px", borderRadius: 6, marginBottom: 10,
                background: "rgba(94,234,212,0.15)", border: "1px solid rgba(94,234,212,0.35)",
                color: "#5eead4", fontSize: 12, fontWeight: 700,
              }}>{gridMsg}</div>
            )}

            {/* Grid bots list */}
            {gridBots.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center" as const, fontSize: 12, color: "#5eead4", background: "rgba(0,0,0,0.20)", borderRadius: 8 }}>
                Grid bot'ов нет. Задай диапазон, число уровней — bot будет автоматически buy на падении и sell на росте по каждой ступени.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {gridBots.map((g) => {
                  const pair = pairById.get(g.pair);
                  const cur = pair?.price ?? g.lastPrice;
                  const filledCount = gridFilledCount(g);
                  const inventory = gridInventoryValue(g, cur);
                  const cycles = Math.min(g.totalBuys, g.totalSells);
                  const ageMin = Math.max(0, Math.floor((Date.now() - g.createdTs) / 60000));
                  const inRange = cur >= g.lowPrice && cur <= g.highPrice;
                  const statusColor = g.status === "active" ? "#5eead4" : g.status === "paused" ? "#fde68a" : "#94a3b8";
                  // Visual ladder: each level dot + price marker
                  return (
                    <div key={g.id} style={{
                      padding: "10px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.30)", border: `1px solid ${statusColor}33`,
                      borderLeft: `3px solid ${statusColor}`,
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 10, alignItems: "center" as const, fontSize: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{g.status === "active" ? "🎯" : g.status === "paused" ? "⏸" : "⏹"}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 13, color: "#fff", fontFamily: "ui-monospace, monospace" }}>
                            {g.pair} · {g.levels.length} levels · {fmtUsd(g.amountUsdPerLevel)}/lvl
                          </div>
                          <div style={{ fontSize: 10, color: "#cbd5e1", display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 2 }}>
                            <span>range [{fmtUsd(g.lowPrice)}—{fmtUsd(g.highPrice)}]</span>
                            <span>· {filledCount} filled</span>
                            <span>· {g.totalBuys}B {g.totalSells}S</span>
                            <span>· {cycles} cycles</span>
                            <span>· age {ageMin}m</span>
                            {!inRange && <span style={{ color: "#fde68a" }}>⚠ price out of range</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" as const, minWidth: 80 }}>
                          <div style={{ fontSize: 9, color: "#5eead4", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Now</div>
                          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#fff" }}>{fmtUsd(cur)}</div>
                        </div>
                        <div style={{ textAlign: "right" as const, minWidth: 90 }}>
                          <div style={{ fontSize: 9, color: "#5eead4", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const }}>Realized</div>
                          <div style={{ fontSize: 13, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: g.totalProfit >= 0 ? "#86efac" : "#fca5a5" }}>
                            {g.totalProfit >= 0 ? "+" : ""}{fmtUsd(g.totalProfit)}
                          </div>
                          {inventory > 0 && (
                            <div style={{ fontSize: 9, color: "#fde68a", fontFamily: "ui-monospace, monospace" }}>
                              + {fmtUsd(inventory)} inv
                            </div>
                          )}
                        </div>
                        <button onClick={() => toggleGrid(g.id)}
                          disabled={g.status === "stopped"}
                          title={g.status === "active" ? "Пауза" : g.status === "paused" ? "Продолжить" : "Остановлен"}
                          style={{
                            padding: "6px 10px", borderRadius: 5,
                            border: `1px solid ${g.status === "stopped" ? "rgba(255,255,255,0.10)" : "rgba(94,234,212,0.50)"}`,
                            background: "rgba(20,184,166,0.15)",
                            color: g.status === "stopped" ? "#64748b" : "#5eead4",
                            fontSize: 11, fontWeight: 800,
                            cursor: g.status === "stopped" ? "default" : "pointer",
                            whiteSpace: "nowrap" as const,
                          }}>
                          {g.status === "active" ? "⏸ Pause" : g.status === "paused" ? "▶ Resume" : "⏹ Stopped"}
                        </button>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => stopGrid(g.id)}
                            disabled={g.status === "stopped"}
                            title="Остановить (без удаления)"
                            aria-label={`Остановить grid bot ${g.pair}`}
                            style={{
                              padding: "6px 8px", borderRadius: 5,
                              border: "1px solid rgba(253,224,71,0.40)", background: "rgba(253,224,71,0.10)",
                              color: g.status === "stopped" ? "#64748b" : "#fde68a",
                              fontSize: 11, fontWeight: 800, cursor: g.status === "stopped" ? "default" : "pointer",
                            }}>⏹</button>
                          <button onClick={() => deleteGrid(g.id)} title="Удалить grid bot" aria-label={`Удалить grid bot ${g.pair}`}
                            style={{
                              padding: "6px 8px", borderRadius: 5,
                              border: "1px solid rgba(252,165,165,0.40)", background: "rgba(252,165,165,0.10)",
                              color: "#fca5a5", fontSize: 11, fontWeight: 800, cursor: "pointer",
                            }}>✕</button>
                        </div>
                      </div>

                      {/* Visual ladder — каждый level как точка с filled/empty состоянием */}
                      <div style={{ position: "relative" as const, height: 28, marginTop: 6, padding: "0 4px" }}>
                        <div style={{
                          position: "absolute" as const, top: 13, left: 4, right: 4, height: 2,
                          background: "rgba(255,255,255,0.10)",
                        }} />
                        {/* Current price marker */}
                        {(() => {
                          const range = g.highPrice - g.lowPrice;
                          if (range <= 0) return null;
                          const pos = ((cur - g.lowPrice) / range) * 100;
                          const clamped = Math.max(0, Math.min(100, pos));
                          return (
                            <div style={{
                              position: "absolute" as const,
                              left: `calc(${clamped}% + 4px)`,
                              top: 0, bottom: 0, width: 2,
                              background: "#fff",
                              transform: "translateX(-1px)",
                              boxShadow: "0 0 6px rgba(255,255,255,0.5)",
                            }} title={`Now: ${fmtUsd(cur)}`} />
                          );
                        })()}
                        {/* Level dots */}
                        {g.levels.map((lvl, i) => {
                          const range = g.highPrice - g.lowPrice;
                          if (range <= 0) return null;
                          const pos = ((lvl.price - g.lowPrice) / range) * 100;
                          return (
                            <div key={i} title={`L${i + 1}: ${fmtUsd(lvl.price)}${lvl.state === "filled" ? ` · ${lvl.qty.toFixed(4)}` : ""}`}
                              style={{
                                position: "absolute" as const,
                                left: `calc(${pos}% + 4px)`,
                                top: 8,
                                width: 12, height: 12, borderRadius: "50%",
                                transform: "translateX(-6px)",
                                background: lvl.state === "filled" ? "#86efac" : "rgba(255,255,255,0.15)",
                                border: lvl.state === "filled" ? "2px solid #16a34a" : "2px solid rgba(255,255,255,0.30)",
                                boxShadow: lvl.state === "filled" ? "0 0 8px rgba(134,239,172,0.5)" : "none",
                                cursor: "default",
                              }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 10, color: "#5eead4", marginTop: 10, lineHeight: 1.5 }}>
              Grid bot работает в боковом тренде: задаёшь [low, high] и N уровней. На падении через level → buy.
              На подъёме через level выше → sell, +profit. Realized profit копит'ся за каждый buy-sell cycle.
              Active inventory = AEV-эквивалент filled levels по current price (mark-to-market).
            </div>
          </section>
        );
}
