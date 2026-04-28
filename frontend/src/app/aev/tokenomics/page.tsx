"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import {
  ldWallet,
  RATE_CARD,
  fmtAev,
  type AEVWallet, type MiningEvent,
} from "../aevToken";
import {
  ENGINES, type EngineSlice,
  engineDistribution, supplyVelocity, networkEstimate,
  halvingSchedule, currentCycle,
  fmtBigAev, fmtSupplyPctPrecise,
} from "../tokenomics";

export default function TokenomicsPage() {
  const [wallet, setWallet] = useState<AEVWallet | null>(null);
  useEffect(() => { setWallet(ldWallet()); }, []);

  // Live tick — feeds the supply bar and ledger timestamp display
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2_000);
    return () => clearInterval(id);
  }, []);
  // Re-read wallet every 4s to catch mining events from other tabs
  useEffect(() => {
    const id = setInterval(() => setWallet(ldWallet()), 4_000);
    return () => clearInterval(id);
  }, []);

  if (!wallet) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <div style={{ padding: 40, textAlign: "center" as const, color: "#64748b" }}>Загружаю tokenomics…</div>
        </ProductPageShell>
      </main>
    );
  }

  const v = supplyVelocity(wallet);
  const dist = engineDistribution(wallet);
  const halvings = halvingSchedule();
  const cur = currentCycle();
  const net = networkEstimate(wallet);
  const recentMints = wallet.recent.filter((e) => e.amount > 0).slice(0, 30);

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        {/* ═══ HERO — supply card ════════════════════════════════════ */}
        <div style={{
          padding: 28, borderRadius: 16, marginBottom: 18,
          background: "radial-gradient(circle at 15% 0%, #312e81 0%, #1e293b 50%, #020617 100%)",
          color: "#fff", position: "relative" as const, overflow: "hidden" as const,
          boxShadow: "0 16px 48px rgba(15,23,42,0.4)",
        }}>
          <div style={{
            position: "absolute" as const, inset: 0,
            backgroundImage: "radial-gradient(circle at 85% 100%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(circle at 50% 30%, rgba(168,85,247,0.12), transparent 50%)",
            pointerEvents: "none" as const,
          }} />
          <div style={{ position: "relative" as const }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase" as const, color: "#a5b4fc", marginBottom: 6 }}>
                  AEV · tokenomics & emission policy
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>
                  Прозрачная эмиссия,<br/>
                  <span style={{ background: "linear-gradient(90deg, #67e8f9, #a78bfa, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    8 движков · хард-кап 21M
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, maxWidth: 600 }}>
                  AEV не печатается из воздуха. Каждый токен эмитится одним из 8 движков —
                  Play, Compute, Stewardship, Curation, Mentorship, Streak, Network, Insight.
                  4-летние халвинги уменьшают rate вдвое каждый цикл.
                </div>
              </div>
              <Link href="/aev" style={{
                padding: "8px 16px", borderRadius: 8,
                background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.45)",
                color: "#67e8f9", fontWeight: 800, fontSize: 13, textDecoration: "none",
                whiteSpace: "nowrap" as const,
              }}>
                ← Wallet
              </Link>
            </div>

            {/* Supply numbers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
              <Stat label="Hard cap" value={`${fmtBigAev(RATE_CARD.totalSupplyCap)}`} unit="AEV" color="#fbbf24" />
              <Stat label="Mined (your wallet)" value={wallet.lifetimeMined.toFixed(4)} unit="AEV" color="#67e8f9" />
              <Stat label="% of cap" value={fmtSupplyPctPrecise(wallet.lifetimeMined)} color="#a78bfa" />
              <Stat label="Velocity" value={v.perDay.toFixed(3)} unit="AEV/day" color="#86efac" />
              <Stat label="Wallet age" value={v.ageDays.toFixed(1)} unit="days" color="#fff" />
              <Stat label="ETA to cap (solo)" value={v.yearsToCap !== null && Number.isFinite(v.yearsToCap) ? `${v.yearsToCap.toFixed(0)}y` : "—"} color="#fda4af" />
            </div>

            {/* Supply progress bar */}
            <div style={{ marginBottom: 6, fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, display: "flex", justifyContent: "space-between" }}>
              <span>Supply прогресс</span>
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#fff" }}>
                {wallet.lifetimeMined.toFixed(4)} / {RATE_CARD.totalSupplyCap.toLocaleString()} AEV
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" as const, position: "relative" as const }}>
              <div style={{
                height: "100%", width: `${Math.max(0.05, Math.min(100, v.pct))}%`,
                background: "linear-gradient(90deg, #22d3ee 0%, #818cf8 50%, #f472b6 100%)",
                transition: "width 600ms ease",
                boxShadow: "0 0 12px rgba(129,140,248,0.5)",
              }} />
              {/* Halving cycle markers */}
              {halvings.slice(1, -1).map((h) => (
                <div key={h.cycle} style={{
                  position: "absolute" as const, top: 0, bottom: 0,
                  left: `${h.cumulativeShare * 100}%`, width: 1,
                  background: "rgba(255,255,255,0.25)",
                }} title={`Halving ${h.cycle} · ${h.year}`} />
              ))}
            </div>
          </div>
        </div>

        {/* ═══ DISTRIBUTION DONUT + LEGEND ═══════════════════════════ */}
        <section style={{
          padding: 18, borderRadius: 12, marginBottom: 14,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#e2e8f0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#a5b4fc" }}>
              📊 Распределение эмиссии · по движкам
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Из последних {wallet.recent.length} событий feed'а · {recentMints.length} mint'ов
            </div>
          </div>
          {recentMints.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" as const, color: "#64748b", fontSize: 13 }}>
              Пока нет mint'ов. Открой <Link href="/aev" style={{ color: "#67e8f9" }}>/aev</Link> и запусти движок — здесь появится распределение.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "center" as const }}>
              <DistributionDonut slices={dist} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dist.filter((s) => s.amount > 0).map((s) => (
                  <DistributionRow key={s.engine.id} slice={s} />
                ))}
                {dist.every((s) => s.amount === 0) && (
                  <div style={{ color: "#64748b", fontSize: 12 }}>Никаких mint'ов в feed'е</div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ═══ HALVING SCHEDULE ══════════════════════════════════════ */}
        <section style={{
          padding: 18, borderRadius: 12, marginBottom: 14,
          background: "#fff", border: "1px solid #e2e8f0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#7c3aed" }}>
              ⏳ Halving schedule · 4-year cycles
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Сейчас cycle <strong style={{ color: "#0f172a" }}>{cur.cycle}</strong> · следующий halving <strong style={{ color: "#0f172a" }}>{cur.nextHalvingYear}</strong> ({cur.daysToNext}d)
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {halvings.map((h) => {
              const active = h.cycle === cur.cycle;
              const past = h.year < cur.year;
              return (
                <div key={h.cycle} style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: active ? "linear-gradient(135deg, #ddd6fe, #fbcfe8)" : past ? "#f1f5f9" : "#f8fafc",
                  border: active ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
                  opacity: past ? 0.55 : 1,
                  position: "relative" as const,
                }}>
                  {active && (
                    <div style={{
                      position: "absolute" as const, top: -8, right: -8,
                      padding: "2px 7px", borderRadius: 999,
                      background: "#8b5cf6", color: "#fff",
                      fontSize: 9, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase" as const,
                    }}>NOW</div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.6, textTransform: "uppercase" as const }}>
                    Cycle {h.cycle}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", fontFamily: "ui-monospace, monospace", lineHeight: 1.1 }}>
                    {h.year}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    Rate ×<strong style={{ color: "#0f172a", fontFamily: "ui-monospace, monospace" }}>{h.multiplier.toFixed(4)}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 2, fontWeight: 700 }}>
                    Cum {(h.cumulativeShare * 100).toFixed(2)}% supply
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ ENGINE RATE CARD ══════════════════════════════════════ */}
        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#0f172a", marginBottom: 10 }}>
            ⚙ Issuance policy · все 8 движков
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {ENGINES.map((eng) => {
              const slice = dist.find((s) => s.engine.id === eng.id);
              const earned = slice?.amount ?? 0;
              return (
                <div key={eng.id} style={{
                  padding: 14, borderRadius: 10,
                  background: "#fff", border: `1px solid ${eng.color}33`,
                  borderLeft: `4px solid ${eng.color}`,
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{eng.emoji}</span>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" as const, color: eng.color }}>
                        {eng.id} · {eng.short}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{eng.label}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.4 }}>{eng.desc}</div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    paddingTop: 6, borderTop: "1px dashed #e2e8f0", marginTop: 2,
                  }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Rate</div>
                      <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", fontWeight: 800, color: eng.color }}>{eng.rate}</div>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Earned</div>
                      <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "#16a34a" }}>+{earned.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ NETWORK ESTIMATE (extrapolation) ══════════════════════ */}
        <section style={{
          padding: 18, borderRadius: 12, marginBottom: 14,
          background: "linear-gradient(135deg, #042f2e 0%, #134e4a 100%)",
          border: "1px solid rgba(94,234,212,0.25)",
          color: "#e2e8f0",
        }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#5eead4", marginBottom: 4 }}>
            🌍 Network projection · если масштабируется
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>
            Линейная экстраполяция твоей активности на {net.assumedUsers.toLocaleString()} активных юзеров. Грубо, но даёт ощущение протокола.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Stat label={`Total supply @ ${net.assumedUsers.toLocaleString()} users`} value={fmtBigAev(net.estTotalSupply)} unit="AEV" color="#5eead4" />
            <Stat label="Daily emission" value={fmtBigAev(net.estDailyEmission)} unit="AEV/day" color="#86efac" />
            <Stat label="ETA to cap" value={net.estCapHitYear ?? "—"} unit={net.estCapHitYear ? "год" : ""} color="#fbbf24" />
            <Stat label="Cap reached %" value={fmtSupplyPctPrecise(net.estTotalSupply)} color="#a78bfa" />
          </div>
        </section>

        {/* ═══ LIVE LEDGER ═══════════════════════════════════════════ */}
        <section style={{
          padding: 16, borderRadius: 12, marginBottom: 14,
          background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
          color: "#e2e8f0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" as const, gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "#67e8f9" }}>
              📜 Live ledger · последние эмиссии
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {recentMints.length} mint'ов в feed'е · обновление 4с
            </div>
          </div>
          {recentMints.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" as const, color: "#64748b", fontSize: 13 }}>
              Ledger пуст. Запусти движок на <Link href="/aev" style={{ color: "#67e8f9" }}>/aev</Link> или сыграй на <Link href="/cyberchess" style={{ color: "#67e8f9" }}>/cyberchess</Link>.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" as const }}>
              {recentMints.map((e) => (
                <LedgerRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ FOOTER NOTE ═══════════════════════════════════════════ */}
        <div style={{
          padding: "12px 16px", borderRadius: 10,
          background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)",
          fontSize: 11, color: "#475569", lineHeight: 1.6, marginBottom: 14,
        }}>
          <strong style={{ color: "#5b21b6" }}>Замечание о версии.</strong>{" "}
          В текущем MVP метрики computed по локальному кошельку (один юзер). На production
          replace localStorage→backend ledger, сохранив тот же shape. Halving — параметризован,
          не зашит. Рейт-карта меняется через issuance-policy proposals (Curation engine).
        </div>
      </ProductPageShell>
    </main>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────
function Stat({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color: string }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "ui-monospace, monospace", lineHeight: 1, display: "flex", alignItems: "baseline", gap: 4 }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{unit}</span>}
      </div>
    </div>
  );
}

function DistributionDonut({ slices }: { slices: EngineSlice[] }) {
  const filtered = slices.filter((s) => s.amount > 0);
  const total = filtered.reduce((s, x) => s + x.amount, 0) || 1;
  const R = 70;
  const r = 44;
  const C = 80;
  let acc = 0;
  return (
    <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 200, height: 200 }}>
      {/* Background ring */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={R - r} />
      {filtered.map((s) => {
        const frac = s.amount / total;
        const start = acc;
        const end = acc + frac;
        acc = end;
        // SVG arc path
        const a0 = -Math.PI / 2 + start * Math.PI * 2;
        const a1 = -Math.PI / 2 + end * Math.PI * 2;
        const large = frac > 0.5 ? 1 : 0;
        const xR0 = C + R * Math.cos(a0);
        const yR0 = C + R * Math.sin(a0);
        const xR1 = C + R * Math.cos(a1);
        const yR1 = C + R * Math.sin(a1);
        const xr0 = C + r * Math.cos(a0);
        const yr0 = C + r * Math.sin(a0);
        const xr1 = C + r * Math.cos(a1);
        const yr1 = C + r * Math.sin(a1);
        const path = [
          `M ${xR0} ${yR0}`,
          `A ${R} ${R} 0 ${large} 1 ${xR1} ${yR1}`,
          `L ${xr1} ${yr1}`,
          `A ${r} ${r} 0 ${large} 0 ${xr0} ${yr0}`,
          "Z",
        ].join(" ");
        return <path key={s.engine.id} d={path} fill={s.engine.color} opacity={0.92} />;
      })}
      {/* Center text */}
      <text x={C} y={C - 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={800} letterSpacing={0.6}>
        {filtered.length} engines
      </text>
      <text x={C} y={C + 10} textAnchor="middle" fill="#94a3b8" fontSize={8} letterSpacing={0.5}>
        active in feed
      </text>
    </svg>
  );
}

function DistributionRow({ slice }: { slice: EngineSlice }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center" as const, fontSize: 12 }}>
      <span style={{ fontSize: 16 }}>{slice.engine.emoji}</span>
      <div>
        <div style={{ fontWeight: 800, color: "#fff" }}>{slice.engine.label}</div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" as const, marginTop: 3 }}>
          <div style={{ height: "100%", width: `${Math.max(2, slice.pct)}%`, background: slice.engine.color }} />
        </div>
      </div>
      <span style={{ fontFamily: "ui-monospace, monospace", color: slice.engine.color, fontWeight: 800 }}>
        +{slice.amount.toFixed(4)}
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace", color: "#94a3b8", fontSize: 11, minWidth: 48, textAlign: "right" as const }}>
        {slice.pct.toFixed(1)}%
      </span>
    </div>
  );
}

function LedgerRow({ event }: { event: MiningEvent }) {
  const eng = ENGINES.find((e) => e.match(event));
  const ago = (() => {
    const ms = Date.now() - event.ts;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
    return `${Math.round(ms / 86_400_000)}d`;
  })();
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center" as const,
      padding: "6px 10px", borderRadius: 6,
      background: "rgba(255,255,255,0.03)", border: `1px solid ${eng?.color ?? "#334155"}22`,
      fontSize: 12,
    }}>
      <span style={{
        padding: "2px 8px", borderRadius: 999,
        background: `${eng?.color ?? "#64748b"}22`,
        color: eng?.color ?? "#94a3b8",
        fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
        whiteSpace: "nowrap" as const,
      }}>
        {eng?.emoji ?? "◆"} {eng?.id ?? "—"}
      </span>
      <span style={{ color: "#cbd5e1", overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
        {event.reason}
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace", color: "#86efac", fontWeight: 800 }}>
        {fmtAev(event.amount, 4)}
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace", color: "#64748b", fontSize: 10, minWidth: 32, textAlign: "right" as const }}>
        {ago}
      </span>
    </div>
  );
}
