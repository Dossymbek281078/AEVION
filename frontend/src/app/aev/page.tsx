"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import {
  ldWallet, svWallet,
  recordPlay, recordCompute,
  stake, unstake, claimDividend, pendingDividend, totalStaked,
  setMode,
  fmtAev, fmtSupplyPct,
  RATE_CARD,
  type AEVWallet, type EmissionMode, type PlayAction, type PlayModule, type MiningEvent,
} from "./aevToken";

const MODE_META: Record<EmissionMode, { label: string; emoji: string; tagline: string; color: string; desc: string }> = {
  play: {
    label: "Proof-of-Play",
    emoji: "🎮",
    tagline: "А · действия в продуктах AEVION",
    color: "#22c55e",
    desc: "Токен начисляется за проверяемые человеческие действия в любом модуле AEVION (CyberChess партии, QSign подписи, QRight регистрации, Bureau проверки). Не нужны GPU — нужны мозги.",
  },
  compute: {
    label: "Proof-of-Useful-Compute",
    emoji: "🧠",
    tagline: "B · реальная AI-работа",
    color: "#3b82f6",
    desc: "Токен за реально выполненный compute-юнит — например, QCoreAI агент завершил run. Не пустой hash, а полезная работа. Имитируется кнопкой запуска job'а.",
  },
  stewardship: {
    label: "Proof-of-Stewardship",
    emoji: "🛡",
    tagline: "C · доход держателя",
    color: "#f59e0b",
    desc: "Никакого «майнинга» — только staking. Застейканный AEV получает дивиденд каждые 5 минут (≈ 7.2% APY). Долгосрочные держатели формируют base-load.",
  },
};

export default function AEVPage() {
  // Lazy-init avoids SSR hydration mismatch.
  const [wallet, setWallet] = useState<AEVWallet | null>(null);
  useEffect(() => { setWallet(ldWallet()) }, []);

  // Persist on every change
  useEffect(() => { if (wallet) svWallet(wallet) }, [wallet]);

  // Live tick: refresh pending dividend display every second
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id) }, []);

  // Auto-claim on epoch boundaries (every 5 minutes when stewardship enabled and stake > 0)
  const lastAutoClaimRef = useRef<number>(0);
  useEffect(() => {
    if (!wallet) return;
    if (!wallet.modes.stewardship) return;
    if (wallet.stake.length === 0) return;
    const id = setInterval(() => {
      setWallet((w) => {
        if (!w) return w;
        const due = pendingDividend(w);
        // Only auto-claim if at least 1 epoch worth has accrued
        if (due < (totalStaked(w) * RATE_CARD.stewardship.apyAnnual / (365 * 24 * 12))) return w;
        const now = Date.now();
        if (now - lastAutoClaimRef.current < RATE_CARD.stewardship.epochSeconds * 1000) return w;
        lastAutoClaimRef.current = now;
        return claimDividend(w, now);
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [wallet]);

  // Mode B simulated job state
  const [computeRunning, setComputeRunning] = useState(false);
  const [computeProgress, setComputeProgress] = useState(0);
  const [computeAgent, setComputeAgent] = useState("aevion-classify-v1");
  const [computeSize, setComputeSize] = useState(20); // units
  const startCompute = useCallback(() => {
    if (!wallet || !wallet.modes.compute || computeRunning) return;
    setComputeRunning(true);
    setComputeProgress(0);
    const total = computeSize;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += 1;
      setComputeProgress(Math.min(total, elapsed));
      if (elapsed >= total) {
        clearInterval(id);
        setWallet((w) => (w ? recordCompute(w, computeAgent, total) : w));
        setComputeRunning(false);
      }
    }, 100); // 100ms per unit → 20 units = 2s of "compute"
  }, [wallet, computeRunning, computeAgent, computeSize]);

  // Mode C: stake input
  const [stakeAmt, setStakeAmt] = useState("");
  const doStake = () => {
    if (!wallet) return;
    const amt = Number(stakeAmt);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const next = stake(wallet, amt);
    if (next) { setWallet(next); setStakeAmt("") }
  };

  // Toggle helper
  const toggleMode = (mode: EmissionMode) => {
    setWallet((w) => (w ? setMode(w, mode, !w.modes[mode]) : w));
  };

  // Play simulator buttons — list a few canonical actions per module
  const playSamples: { key: PlayAction; module: PlayModule }[] = [
    { key: "cyberchess_win_easy", module: "cyberchess" },
    { key: "cyberchess_win_med", module: "cyberchess" },
    { key: "cyberchess_win_hard", module: "cyberchess" },
    { key: "cyberchess_puzzle", module: "cyberchess" },
    { key: "cyberchess_puzzle_rush", module: "cyberchess" },
    { key: "cyberchess_brilliant", module: "cyberchess" },
    { key: "cyberchess_blunder_fix", module: "cyberchess" },
    { key: "qsign_sign", module: "qsign" },
    { key: "qright_register", module: "qright" },
    { key: "bureau_verify", module: "bureau" },
    { key: "qtrade_close_winning", module: "qtrade" },
    { key: "qcore_run_complete", module: "qcoreai" },
  ];

  const due = wallet ? pendingDividend(wallet) : 0;
  const staked = wallet ? totalStaked(wallet) : 0;
  const supplyPct = wallet ? (wallet.globalSupplyMined / RATE_CARD.totalSupplyCap) * 100 : 0;
  const ageDays = wallet ? Math.max(1, Math.floor((Date.now() - wallet.startTs) / 86400000)) : 1;
  const dailyRate = wallet ? wallet.lifetimeMined / ageDays : 0;

  if (!wallet) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <div style={{ padding: 40, textAlign: "center" as const, color: "#64748b" }}>Загружаю кошелёк…</div>
        </ProductPageShell>
      </main>
    );
  }

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        {/* ═══ HERO ════════════════════════════════════════════════ */}
        <div style={{
          padding: 24, borderRadius: 14,
          background: "radial-gradient(circle at 20% 0%, #1e3a8a, #0f172a 50%, #020617 100%)",
          color: "#fff", marginBottom: 18,
          boxShadow: "0 12px 40px rgba(15,23,42,0.35)",
          position: "relative" as const, overflow: "hidden" as const,
        }}>
          <div style={{
            position: "absolute" as const, inset: 0,
            backgroundImage: "radial-gradient(circle at 80% 100%, rgba(34,211,238,0.18), transparent 50%)",
            pointerEvents: "none" as const,
          }} />
          <div style={{ position: "relative" as const }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.5)",
                fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#67e8f9", textTransform: "uppercase" as const,
              }}>
                AEV · нативный токен AEVION
              </span>
              <span style={{
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)",
                fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: "#fbbf24", textTransform: "uppercase" as const,
              }}>
                Hard cap 21M · {fmtSupplyPct(wallet)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 0.5, fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 4 }}>
              Балланс
            </div>
            <div style={{ fontSize: 56, fontWeight: 900, fontFamily: "ui-monospace, monospace", lineHeight: 1, color: "#fff", marginBottom: 6 }}>
              {wallet.balance.toFixed(4)} <span style={{ fontSize: 24, color: "#67e8f9", fontWeight: 800 }}>AEV</span>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13, color: "#cbd5e1", flexWrap: "wrap" }}>
              <span>Намайнено всего: <strong style={{ color: "#fff" }}>{wallet.lifetimeMined.toFixed(4)}</strong></span>
              <span>Потрачено: <strong style={{ color: "#fff" }}>{wallet.lifetimeSpent.toFixed(4)}</strong></span>
              <span>Стейк: <strong style={{ color: "#fbbf24" }}>{staked.toFixed(4)}</strong></span>
              <span>Дивиденд накоплен: <strong style={{ color: "#86efac" }}>+{due.toFixed(6)}</strong></span>
              <span>Возраст кошелька: <strong style={{ color: "#fff" }}>{ageDays}d</strong></span>
              <span>Скорость: <strong style={{ color: "#fff" }}>{dailyRate.toFixed(3)} AEV/день</strong></span>
            </div>
            {/* Supply bar */}
            <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" as const }}>
              <div style={{
                height: "100%",
                width: `${Math.max(0.001, Math.min(100, supplyPct))}%`,
                background: "linear-gradient(90deg, #22d3ee, #818cf8, #f472b6)",
                transition: "width 600ms ease",
              }} />
            </div>
          </div>
        </div>

        {/* ═══ MODE TOGGLES ═════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 18 }}>
          {(Object.keys(MODE_META) as EmissionMode[]).map((mode) => {
            const meta = MODE_META[mode];
            const on = wallet.modes[mode];
            return (
              <div key={mode} style={{
                padding: 16, borderRadius: 12,
                background: on ? "#fff" : "#f8fafc",
                border: on ? `2px solid ${meta.color}` : "1px solid #e2e8f0",
                opacity: on ? 1 : 0.65,
                boxShadow: on ? `0 6px 18px ${meta.color}22` : "none",
                transition: "all 0.25s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>{meta.emoji}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.6, textTransform: "uppercase" as const }}>{meta.tagline}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{meta.label}</div>
                  </div>
                  <button onClick={() => toggleMode(mode)} aria-pressed={on}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: on ? meta.color : "#cbd5e1",
                      border: "none", cursor: "pointer",
                      position: "relative" as const, transition: "background 0.2s",
                    }}>
                    <span style={{
                      position: "absolute" as const, top: 2, left: on ? 22 : 2,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                    }} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{meta.desc}</div>
              </div>
            );
          })}
        </div>

        {/* ═══ A. PROOF-OF-PLAY ════════════════════════════════════ */}
        {wallet.modes.play && (
          <section style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🎮</span>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>Proof-of-Play · симулятор действий</h2>
              <span style={{ fontSize: 11, color: "#64748b" }}>в продакшне эти ивенты придут с других модулей AEVION</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
              {playSamples.map(({ key, module }) => {
                const card = RATE_CARD.play[key];
                return (
                  <button key={key}
                    onClick={() => setWallet((w) => (w ? recordPlay(w, key, module) : w))}
                    style={{
                      padding: "10px 12px", borderRadius: 8,
                      border: "1px solid #cbd5e1", background: "#f8fafc",
                      textAlign: "left" as const, cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: 2,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ecfdf5"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#86efac" }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{card.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a" }}>+{card.aev} AEV</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ B. PROOF-OF-USEFUL-COMPUTE ══════════════════════════ */}
        {wallet.modes.compute && (
          <section style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🧠</span>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>Proof-of-Useful-Compute</h2>
              <span style={{ fontSize: 11, color: "#64748b" }}>{RATE_CARD.compute.perUnit} AEV / unit</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Agent</label>
              <input value={computeAgent} onChange={(e) => setComputeAgent(e.target.value)} disabled={computeRunning}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "ui-monospace, monospace", width: 200 }} />
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Units</label>
              <input type="number" min={RATE_CARD.compute.minBatch} max={RATE_CARD.compute.maxBatch}
                value={computeSize} onChange={(e) => setComputeSize(Number(e.target.value))} disabled={computeRunning}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, width: 90, fontFamily: "ui-monospace, monospace" }} />
              <button onClick={startCompute} disabled={computeRunning}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: computeRunning ? "#94a3b8" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                  color: "#fff", fontWeight: 800, fontSize: 13, cursor: computeRunning ? "default" : "pointer",
                  boxShadow: computeRunning ? "none" : "0 2px 8px rgba(37,99,235,0.3)",
                }}>
                {computeRunning ? "⏳ Running…" : `▶ Запустить · +${(computeSize * RATE_CARD.compute.perUnit).toFixed(2)} AEV`}
              </button>
            </div>
            {computeRunning && (
              <div style={{ height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" as const }}>
                <div style={{
                  height: "100%",
                  width: `${(computeProgress / Math.max(1, computeSize)) * 100}%`,
                  background: "linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)",
                  transition: "width 100ms linear",
                }} />
              </div>
            )}
          </section>
        )}

        {/* ═══ C. PROOF-OF-STEWARDSHIP ═════════════════════════════ */}
        {wallet.modes.stewardship && (
          <section style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18 }}>🛡</span>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>Proof-of-Stewardship</h2>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {(RATE_CARD.stewardship.apyAnnual * 100).toFixed(1)}% APY · epoch {RATE_CARD.stewardship.epochSeconds}s
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 10, borderRadius: 8, background: "#fffbeb", border: "1px solid #fcd34d" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Застейкано</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#78350f" }}>{staked.toFixed(4)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: "#ecfdf5", border: "1px solid #86efac" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#14532d", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Pending dividend</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#15803d" }}>+{due.toFixed(6)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: "#f1f5f9", border: "1px solid #cbd5e1" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Всего получено</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>{wallet.dividendsClaimed.toFixed(4)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: "#eff6ff", border: "1px solid #93c5fd", display: "flex", flexDirection: "column", justifyContent: "space-between" as const }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#1e40af", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Действия</div>
                <button onClick={() => setWallet((w) => (w ? claimDividend(w) : w))} disabled={due <= 0}
                  style={{
                    padding: "6px 12px", borderRadius: 5, border: "none",
                    background: due > 0 ? "#16a34a" : "#cbd5e1",
                    color: "#fff", fontSize: 12, fontWeight: 800,
                    cursor: due > 0 ? "pointer" : "default",
                  }}>
                  Claim {due > 0 ? `+${due.toFixed(6)}` : "—"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <input type="number" min={RATE_CARD.stewardship.minStake} step="any"
                placeholder={`Сколько застейкать (мин. ${RATE_CARD.stewardship.minStake})`}
                value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, width: 240, fontFamily: "ui-monospace, monospace" }} />
              <button onClick={doStake}
                disabled={!stakeAmt || Number(stakeAmt) <= 0 || Number(stakeAmt) > wallet.balance}
                style={{
                  padding: "8px 18px", borderRadius: 6, border: "none",
                  background: "linear-gradient(135deg, #d97706, #f59e0b)",
                  color: "#fff", fontWeight: 800, fontSize: 13,
                  cursor: "pointer", opacity: !stakeAmt || Number(stakeAmt) <= 0 || Number(stakeAmt) > wallet.balance ? 0.55 : 1,
                  boxShadow: "0 2px 8px rgba(217,119,6,0.3)",
                }}>
                Lock в stewardship
              </button>
              <button onClick={() => setStakeAmt(String(Math.floor(wallet.balance * 100) / 100))}
                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                MAX ({wallet.balance.toFixed(2)})
              </button>
            </div>
            {wallet.stake.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {wallet.stake.map((s) => {
                  const ageH = Math.max(0, Math.floor((Date.now() - s.startTs) / 3600000));
                  return (
                    <div key={s.id} style={{
                      padding: "7px 12px", borderRadius: 6, background: "#fef3c7",
                      border: "1px solid #fde68a",
                      display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center" as const, fontSize: 13,
                    }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#78350f" }}>
                        🛡 <strong>{s.amount.toFixed(4)} AEV</strong>
                      </span>
                      <span style={{ fontSize: 11, color: "#92400e" }}>возраст {ageH}h</span>
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                        +{((Date.now() - s.lastDividendTs) / 1000 * s.amount * RATE_CARD.stewardship.apyAnnual / (365 * 24 * 3600)).toFixed(8)} pending
                      </span>
                      <button onClick={() => setWallet((w) => (w ? unstake(w, s.id) : w))}
                        style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #92400e", background: "#fff", color: "#92400e", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                        Unlock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═══ ACTIVITY FEED ═══════════════════════════════════════ */}
        <section style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" as const, marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>📜 Активность</h2>
            <span style={{ fontSize: 11, color: "#64748b" }}>последние {wallet.recent.length} событий</span>
          </div>
          {wallet.recent.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" as const, color: "#94a3b8", fontSize: 13 }}>
              Пока нет активности. Включи режим выше и нажми кнопку — первый AEV намайнится.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" as const }}>
              {wallet.recent.map((ev) => <ActivityRow key={ev.id} ev={ev} />)}
            </div>
          )}
        </section>

        {/* ═══ FOOTER LINKS ════════════════════════════════════════ */}
        <div style={{
          padding: 14, borderRadius: 10,
          background: "#f1f5f9", border: "1px solid #e2e8f0",
          fontSize: 12, color: "#475569", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#0f172a" }}>Tokenomics в одной строке:</strong> один кошелёк, три параллельных движка эмиссии,
          хард-кап 21M, балланс persist в localStorage. Продай AEV в <a href="/qtrade" style={{ color: "#2563eb", fontWeight: 700 }}>QTrade</a> по
          симулированной паре AEV/USD (random-walk price feed). В продакшне Proof-of-Play хуки добавятся в каждый Wave1-модуль и в QCoreAI run-trace.
        </div>
      </ProductPageShell>
    </main>
  );
}

// ─── Activity row ──────────────────────────────────────────────────
function ActivityRow({ ev }: { ev: MiningEvent }) {
  const ago = (() => {
    const dt = (Date.now() - ev.ts) / 1000;
    if (dt < 60) return `${Math.round(dt)}s назад`;
    if (dt < 3600) return `${Math.round(dt / 60)}m назад`;
    if (dt < 86400) return `${Math.round(dt / 3600)}h назад`;
    return `${Math.round(dt / 86400)}d назад`;
  })();
  let icon = "•";
  let color = "#64748b";
  switch (ev.source.kind) {
    case "play":         icon = "🎮"; color = "#16a34a"; break;
    case "compute":      icon = "🧠"; color = "#2563eb"; break;
    case "stewardship":  icon = "🛡"; color = "#d97706"; break;
    case "trade":        icon = ev.source.side === "buy" ? "🛒" : "💵"; color = ev.source.side === "buy" ? "#16a34a" : "#dc2626"; break;
    case "spend":        icon = "↘"; color = "#dc2626"; break;
    case "stake":        icon = ev.source.verb === "lock" ? "🔒" : "🔓"; color = "#d97706"; break;
    case "custom":       icon = "✨"; color = "#7c3aed"; break;
  }
  const sign = ev.amount >= 0 ? "+" : "";
  return (
    <div style={{
      padding: "7px 12px", borderRadius: 6,
      background: "#f8fafc", border: "1px solid #e2e8f0",
      display: "grid", gridTemplateColumns: "32px 1fr auto auto", gap: 10, alignItems: "center" as const, fontSize: 12,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ color: "#0f172a" }}>{ev.reason}</span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color }}>{sign}{ev.amount.toFixed(4)} AEV</span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>{ago}</span>
    </div>
  );
}
