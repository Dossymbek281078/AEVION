"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import {
  ldWallet, svWallet,
  recordPlay, recordCompute,
  stake, unstake, claimDividend, pendingDividend, totalStaked,
  recordDailyVisit, previewStreakReward,
  setMode,
  fmtSupplyPct,
  RATE_CARD,
  ldPins, svPins, pinsToday, recordPin, removePin, simulateUpvote,
  CURATION,
  ldNetwork, svNetwork, simulateInviteJoin, simulateNetworkTick, removeInvited,
  NETWORK,
  type AEVWallet, type EmissionMode, type PlayAction, type PlayModule, type MiningEvent,
  type PinnedItem, type PinKind,
  type NetworkState,
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
  const [pins, setPins] = useState<PinnedItem[] | null>(null);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  const [streakClaimed, setStreakClaimed] = useState<{ amount: number; day: number } | null>(null);
  useEffect(() => {
    const w = ldWallet();
    setPins(ldPins());
    setNetwork(ldNetwork());
    // Auto-claim daily streak on mount if eligible
    const updated = recordDailyVisit(w);
    if (updated) {
      const day = updated.streak?.current ?? 0;
      const amount = updated.balance - w.balance;
      setWallet(updated);
      setStreakClaimed({ amount, day });
      setTimeout(() => setStreakClaimed(null), 6000);
    } else {
      setWallet(w);
    }
  }, []);

  // Persist on every change
  useEffect(() => { if (wallet) svWallet(wallet) }, [wallet]);
  useEffect(() => { if (pins) svPins(pins) }, [pins]);
  useEffect(() => { if (network) svNetwork(network) }, [network]);

  // Refs для cross-state autotick (network → wallet) без race conditions
  const walletRef = useRef<AEVWallet | null>(null);
  const networkRef = useRef<NetworkState | null>(null);
  useEffect(() => { walletRef.current = wallet }, [wallet]);
  useEffect(() => { networkRef.current = network }, [network]);

  // Network auto-tick: каждые 18-32s случайный приглашённый совершает quality
  // action, тебе капает royalty в wallet.
  const networkInviteCount = network?.invited.length ?? 0;
  useEffect(() => {
    if (networkInviteCount === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (cancelled) return;
      const w = walletRef.current;
      const n = networkRef.current;
      if (w && n && n.invited.length > 0) {
        const r = simulateNetworkTick(w, n);
        setWallet(r.wallet);
        setNetwork(r.network);
      }
      timer = setTimeout(tick, 18000 + Math.random() * 14000);
    };
    timer = setTimeout(tick, 18000 + Math.random() * 14000);
    return () => { cancelled = true; if (timer) clearTimeout(timer) };
  }, [networkInviteCount]);

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

        {/* ═══ STREAK — Proof-of-Streak (engine F, voted live) ═════ */}
        <StreakCard wallet={wallet} claimed={streakClaimed} />

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

        {/* ═══ GLOBAL MINING FEED ═════════════════════════════════ */}
        <GlobalMiningFeed />

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

        {/* ═══ G. PROOF-OF-NETWORK (engine G · live) ═══════════════ */}
        {network && (
          <NetworkPanel wallet={wallet} setWallet={setWallet} network={network} setNetwork={setNetwork} />
        )}

        {/* ═══ D. PROOF-OF-CURATION (engine D · live) ══════════════ */}
        <CurationWall wallet={wallet} setWallet={setWallet} pins={pins ?? []} setPins={setPins} />

        {/* ═══ FUTURE ENGINES — proposals + voting ═════════════════ */}
        <FutureEngines />

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

// ─── Global mining feed (simulated network) ───────────────────────
// Имитация общей mining-активности на платформе — даёт ощущение
// «не один в сети». Все ивенты client-side, но дают визуальный pulse.
const GLOBAL_NAMES = [
  "Алина из Алматы", "Дмитрий из Астаны", "Мария из Шымкента",
  "Виктор из Караганды", "Айгуль из Актобе", "Рустам из Атырау",
  "Никита из Семея", "Светлана из Павлодара", "Алмаз из Тараза",
  "Олег из Кокшетау", "Нурлан из Костаная", "Айдос из Усть-Каменогорска",
  "Зарина из Туркестана", "Михаил из Актау", "Ержан из Уральска",
];
const GLOBAL_TEMPLATES: { tpl: string; emoji: string; range: [number, number] }[] = [
  { tpl: "победил Master в CyberChess", emoji: "🏆", range: [3, 6] },
  { tpl: "решил Puzzle Rush 25 в ряд", emoji: "🧩", range: [1, 3] },
  { tpl: "подписал документ в QSign", emoji: "✍", range: [1, 2] },
  { tpl: "зарегистрировал право в QRight", emoji: "📜", range: [2, 3] },
  { tpl: "верифицировал бизнес в Bureau", emoji: "🏢", range: [0.8, 1.2] },
  { tpl: "закрыл прибыльную позицию в QTrade", emoji: "💵", range: [0.4, 0.7] },
  { tpl: "достиг 30-дневного streak", emoji: "🔥", range: [5, 5] },
  { tpl: "нашёл brilliant в партии", emoji: "✨", range: [1, 2] },
  { tpl: "завершил compute job (100 units)", emoji: "🧠", range: [4, 6] },
  { tpl: "получил dividend от stewardship", emoji: "🛡", range: [0.05, 0.2] },
  { tpl: "переиграл блундер из своей партии", emoji: "🎯", range: [0.6, 1.0] },
];
type GlobalEvent = { id: number; name: string; tpl: string; emoji: string; amount: number; ts: number };

function GlobalMiningFeed() {
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const seqRef = useRef(0);
  useEffect(() => {
    // Initial backlog of 5 events with synthesized timestamps in the past
    const initial: GlobalEvent[] = [];
    for (let i = 0; i < 6; i++) {
      const name = GLOBAL_NAMES[Math.floor(Math.random() * GLOBAL_NAMES.length)];
      const tpl = GLOBAL_TEMPLATES[Math.floor(Math.random() * GLOBAL_TEMPLATES.length)];
      const amount = +(tpl.range[0] + Math.random() * (tpl.range[1] - tpl.range[0])).toFixed(2);
      initial.push({ id: ++seqRef.current, name, tpl: tpl.tpl, emoji: tpl.emoji, amount, ts: Date.now() - i * 18000 - Math.random() * 12000 });
    }
    setEvents(initial);
    // Stream new events every 6-14s
    const schedule = () => {
      const delay = 6000 + Math.random() * 8000;
      return setTimeout(() => {
        const name = GLOBAL_NAMES[Math.floor(Math.random() * GLOBAL_NAMES.length)];
        const tpl = GLOBAL_TEMPLATES[Math.floor(Math.random() * GLOBAL_TEMPLATES.length)];
        const amount = +(tpl.range[0] + Math.random() * (tpl.range[1] - tpl.range[0])).toFixed(2);
        const ev: GlobalEvent = { id: ++seqRef.current, name, tpl: tpl.tpl, emoji: tpl.emoji, amount, ts: Date.now() };
        setEvents((prev) => [ev, ...prev].slice(0, 12));
        timeoutRef.current = schedule();
      }, delay);
    };
    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    timeoutRef.current = schedule();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) };
  }, []);

  // Aggregate totals (rough live network minted)
  const totalMinted = events.reduce((s, e) => s + e.amount, 0);

  return (
    <section style={{
      padding: 16, borderRadius: 12,
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
      color: "#fff", marginBottom: 14,
      boxShadow: "0 6px 18px rgba(30,27,75,0.25)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.5, color: "#a5b4fc", textTransform: "uppercase" as const }}>
            🌍 Global mining feed
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.4)",
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: "#86efac", textTransform: "uppercase" as const,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: "#22c55e", animation: "qt-pulse 1.4s ease-in-out infinite" }} />
            simulated network
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "ui-monospace, monospace" }}>
          ≈ {totalMinted.toFixed(2)} AEV в feed'е · 12 событий
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, maxHeight: 240, overflowY: "auto" as const }}>
        {events.map((ev, i) => {
          const ago = (() => {
            const dt = (Date.now() - ev.ts) / 1000;
            if (dt < 60) return `${Math.round(dt)}s`;
            if (dt < 3600) return `${Math.round(dt / 60)}m`;
            return `${Math.round(dt / 3600)}h`;
          })();
          return (
            <div key={ev.id} style={{
              padding: "6px 10px", borderRadius: 6,
              background: i === 0 ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
              border: i === 0 ? "1px solid rgba(167,139,250,0.45)" : "1px solid rgba(255,255,255,0.06)",
              display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center" as const, fontSize: 12,
              transition: "background 250ms ease",
            }}>
              <span style={{ fontSize: 16 }}>{ev.emoji}</span>
              <span style={{ color: "#e2e8f0" }}>
                <strong style={{ color: "#fff" }}>{ev.name}</strong> {ev.tpl}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "#86efac" }}>
                +{ev.amount.toFixed(2)} AEV
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{ago}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Streak card (engine F · live) ─────────────────────────────────
function StreakCard({ wallet, claimed }: { wallet: AEVWallet; claimed: { amount: number; day: number } | null }) {
  const streak = wallet.streak ?? { current: 0, longest: 0, lastDayKey: "", totalClaims: 0 };
  const next = previewStreakReward(wallet);
  const day = streak.current;
  const longest = streak.longest;
  const milestones = [
    { at: 7, label: "🔥 неделя", bonus: RATE_CARD.streak.week7Bonus },
    { at: 30, label: "🚀 месяц", bonus: RATE_CARD.streak.month30Bonus },
    { at: 100, label: "👑 век", bonus: RATE_CARD.streak.century100Bonus },
  ];
  // Time-until-tomorrow for countdown
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const msToTomorrow = tomorrow.getTime() - Date.now();
  const h = Math.floor(msToTomorrow / 3600000);
  const m = Math.floor((msToTomorrow % 3600000) / 60000);

  return (
    <section style={{
      padding: 16, borderRadius: 12,
      background: day > 0
        ? "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)"
        : "linear-gradient(135deg, #475569, #334155)",
      color: "#fff", marginBottom: 14,
      boxShadow: day > 0 ? "0 6px 18px rgba(234,88,12,0.25)" : "none",
      position: "relative" as const, overflow: "hidden" as const,
    }}>
      {claimed && (
        <div style={{
          position: "absolute" as const, top: 8, right: 8,
          padding: "6px 12px", borderRadius: 999,
          background: "rgba(255,255,255,0.95)", color: "#c2410c",
          fontWeight: 900, fontSize: 12,
          animation: "qt-pulse 1.4s ease-in-out infinite",
          boxShadow: "0 4px 14px rgba(255,255,255,0.4)",
        }}>
          ✓ Day {claimed.day} · +{claimed.amount.toFixed(4)} AEV
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center" as const }}>
        <div style={{ textAlign: "center" as const }}>
          <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, fontFamily: "ui-monospace, monospace" }}>
            🔥 {day}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.8, textTransform: "uppercase" as const, marginTop: 2 }}>
            {day === 0 ? "Старт streak'а" : day === 1 ? "день" : day < 5 ? "дня подряд" : "дней подряд"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const, marginBottom: 4 }}>
            F · Proof-of-Streak — engine live
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.92 }}>
            Каждый день, когда ты заходишь на /aev, начисляется AEV.
            Множитель растёт +5% каждые 7 дней (cap ×{RATE_CARD.streak.maxMultiplier}).
            Пропустил день — streak сбрасывается на 1.
            {longest > day && longest > 0 && (
              <> · Лучший streak: <strong>{longest}</strong> {longest === 1 ? "день" : "дней"}</>
            )}
          </div>
          {/* Milestone progress bar */}
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            {milestones.map((m) => {
              const pct = Math.min(100, (day / m.at) * 100);
              const reached = day >= m.at;
              return (
                <div key={m.at} style={{ flex: 1, padding: "4px 8px", borderRadius: 6, background: reached ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)", border: `1px solid ${reached ? "#86efac" : "rgba(255,255,255,0.2)"}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
                    {m.label} <span style={{ opacity: 0.7 }}>{day}/{m.at}</span>
                    {reached && <span style={{ marginLeft: 4, color: "#86efac" }}>✓</span>}
                  </div>
                  <div style={{ marginTop: 3, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.2)", overflow: "hidden" as const }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: reached ? "#86efac" : "#fff" }} />
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2, fontFamily: "ui-monospace, monospace", opacity: 0.85 }}>
                    +{m.bonus} AEV bonus
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: "right" as const, minWidth: 120 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, opacity: 0.8, textTransform: "uppercase" as const, marginBottom: 2 }}>
            Завтра
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
            +{next.toFixed(3)}
          </div>
          <div style={{ fontSize: 10, opacity: 0.75, fontFamily: "ui-monospace, monospace" }}>через {h}h {m}m</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
            Всего claims: <strong>{streak.totalClaims}</strong>
          </div>
        </div>
      </div>
      <style>{`@keyframes qt-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.96)}}`}</style>
    </section>
  );
}

// ─── Future emission engines — proposals + voting ─────────────────
type Proposal = {
  id: string;
  letter: string;
  emoji: string;
  name: string;
  tagline: string;
  desc: string;
  builtin?: boolean;
};

const BUILTIN_PROPOSALS: Proposal[] = [
  {
    id: "curation",
    letter: "D",
    emoji: "🧭",
    name: "Proof-of-Curation",
    tagline: "✅ LIVE — engine выпущен 27.04",
    desc: "Pin своих лучших партий / пазлов / трейдов / гайдов в Curation Wall (+0.5 AEV каждый pin). Peer-review через upvotes (+0.05 AEV за каждый голос). Anti-spam: 5 pin'ов в день, cap 50 total. Выпущен сразу после голосования.",
  },
  {
    id: "mentorship",
    letter: "E",
    emoji: "🎓",
    name: "Proof-of-Mentorship",
    tagline: "ученик прогрессирует — учитель майнит",
    desc: "Mentor получает AEV когда его ученик повышает рейтинг или решает пазл из mentor-list'а. Sybil-резистентно, потому что mentor подписывает связь через QSign.",
  },
  {
    id: "streak",
    letter: "F",
    emoji: "🔥",
    name: "Proof-of-Streak",
    tagline: "✅ LIVE — engine выпущен 27.04",
    desc: "Каждый день захода на /aev = AEV (auto-claim). Multiplier ×1 → ×2 за 20 недель, milestone-bonuses на 7/30/100 дней. Скрин-карта вверху страницы. Победил голосование.",
  },
  {
    id: "network",
    letter: "G",
    emoji: "🌐",
    name: "Proof-of-Network",
    tagline: "✅ LIVE — engine выпущен 27.04",
    desc: "Invite chain через твой персональный AEV-код. Приглашённый совершает quality-action — тебе капает 10% royalty. Симуляция активности приглашённых каждые 18-32s. Cap 50 invitees. Выпущен сразу после голосования.",
  },
  {
    id: "insight",
    letter: "H",
    emoji: "💡",
    name: "Proof-of-Insight",
    tagline: "вопрос Coach'у помог другим",
    desc: "Когда твой query к AI Coach (CyberChess) кэшируется и помогает другому юзеру при cache-hit — ты получаешь AEV. Награда за уникальный качественный вопрос.",
  },
];

const VOTES_KEY = "aevion_aev_proposal_votes_v1";
const CUSTOM_PROPS_KEY = "aevion_aev_custom_proposals_v1";

function FutureEngines() {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<Proposal[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOTES_KEY);
      if (raw) {
        const r = JSON.parse(raw);
        if (r.votes) setVotes(r.votes);
        if (r.voted) setVoted(r.voted);
      }
      const c = localStorage.getItem(CUSTOM_PROPS_KEY);
      if (c) {
        const r = JSON.parse(c);
        if (Array.isArray(r)) setCustom(r as Proposal[]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(VOTES_KEY, JSON.stringify({ votes, voted })) } catch {}
  }, [votes, voted]);
  useEffect(() => {
    try { localStorage.setItem(CUSTOM_PROPS_KEY, JSON.stringify(custom)) } catch {}
  }, [custom]);

  const all: Proposal[] = [...BUILTIN_PROPOSALS, ...custom];
  const sorted = [...all].sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0));

  const upvote = (id: string) => {
    if (voted[id]) return;
    setVoted((v) => ({ ...v, [id]: true }));
    setVotes((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
  };

  const submitCustom = () => {
    const name = draftName.trim();
    const desc = draftDesc.trim();
    if (!name || !desc) return;
    const id = `custom-${Date.now().toString(36)}`;
    const next: Proposal = {
      id, letter: "?", emoji: "✨", name: name.slice(0, 60),
      tagline: "пользовательская идея",
      desc: desc.slice(0, 280),
    };
    setCustom((c) => [next, ...c].slice(0, 10));
    setVotes((v) => ({ ...v, [id]: 1 }));
    setVoted((v) => ({ ...v, [id]: true }));
    setDraftName(""); setDraftDesc("");
  };

  const removeCustom = (id: string) => {
    setCustom((c) => c.filter((p) => p.id !== id));
    setVotes((v) => { const next = { ...v }; delete next[id]; return next });
    setVoted((v) => { const next = { ...v }; delete next[id]; return next });
  };

  return (
    <section style={{ padding: 16, borderRadius: 12, border: "1px dashed #cbd5e1", background: "linear-gradient(135deg, #f8fafc, #fff 60%)", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" as const }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>🌱 Будущие движки эмиссии</h2>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          голосуй за то, что включить в next release. Победители уезжают в roadmap.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8, marginBottom: 12 }}>
        {sorted.map((p) => {
          const v = votes[p.id] || 0;
          const did = voted[p.id];
          const isCustom = !BUILTIN_PROPOSALS.find((b) => b.id === p.id);
          return (
            <div key={p.id} style={{
              padding: 12, borderRadius: 10,
              background: "#fff", border: did ? "1px solid #86efac" : "1px solid #e2e8f0",
              boxShadow: did ? "0 4px 12px rgba(34,197,94,0.18)" : "0 1px 2px rgba(15,23,42,0.04)",
              display: "flex", flexDirection: "column" as const, gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 18 }}>{p.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase" as const }}>
                    {p.letter} · {p.tagline}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", lineHeight: 1.25 }}>{p.name}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end" as const, gap: 4 }}>
                  {p.id === "streak" || p.id === "curation" || p.id === "network" ? (
                    <span style={{
                      padding: "5px 11px", borderRadius: 5,
                      background: p.id === "curation"
                        ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                        : p.id === "network"
                        ? "linear-gradient(135deg, #0891b2, #06b6d4)"
                        : "linear-gradient(135deg, #f97316, #ea580c)",
                      color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
                    }}>✓ LIVE</span>
                  ) : (
                    <button onClick={() => upvote(p.id)} disabled={did}
                      style={{
                        padding: "5px 11px", borderRadius: 5, border: "none",
                        background: did ? "#86efac" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                        color: "#fff", fontSize: 11, fontWeight: 800, cursor: did ? "default" : "pointer",
                        whiteSpace: "nowrap" as const,
                      }}>
                      {did ? "✓ Голос за" : "🗳 Vote"}
                    </button>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", fontFamily: "ui-monospace, monospace" }}>{v}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{p.desc}</div>
              {isCustom && (
                <button onClick={() => removeCustom(p.id)}
                  style={{ alignSelf: "flex-start", marginTop: 4, padding: "3px 9px", borderRadius: 4, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  убрать
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom proposal form */}
      <div style={{ padding: 12, borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 6 }}>
          ✨ Своя идея
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={60}
            placeholder="Название (например: Proof-of-Stewardship-of-Strangers)"
            style={{ padding: "7px 10px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} maxLength={280}
            rows={2}
            placeholder="Что значит и как майнится. 1-3 предложения."
            style={{ padding: "7px 10px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical" as const, fontFamily: "inherit" }} />
          <button onClick={submitCustom}
            disabled={!draftName.trim() || !draftDesc.trim()}
            style={{
              alignSelf: "flex-start" as const, padding: "7px 16px", borderRadius: 5, border: "none",
              background: !draftName.trim() || !draftDesc.trim() ? "#cbd5e1" : "linear-gradient(135deg, #16a34a, #22c55e)",
              color: "#fff", fontSize: 12, fontWeight: 800,
              cursor: !draftName.trim() || !draftDesc.trim() ? "default" : "pointer",
            }}>
            + Добавить идею (auto-vote)
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── G. Network panel (engine G · live) ────────────────────────────
function NetworkPanel({ wallet, setWallet, network, setNetwork }: {
  wallet: AEVWallet;
  setWallet: React.Dispatch<React.SetStateAction<AEVWallet | null>>;
  network: NetworkState;
  setNetwork: React.Dispatch<React.SetStateAction<NetworkState | null>>;
}) {
  const [draftName, setDraftName] = useState("");
  const [copied, setCopied] = useState(false);
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/aev?ref=${network.myCode}`
    : `/aev?ref=${network.myCode}`;

  const copyCode = () => {
    try {
      navigator.clipboard?.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const inviteOne = () => {
    setNetwork((n) => (n ? simulateInviteJoin(n, draftName || undefined) : n));
    setDraftName("");
  };

  const triggerActivityFor = (id: string) => {
    const r = simulateNetworkTick(wallet, network, id);
    setWallet(r.wallet);
    setNetwork(r.network);
  };

  const removeOne = (id: string) => {
    setNetwork((n) => (n ? removeInvited(n, id) : n));
  };

  const totalActions = network.invited.reduce((s, u) => s + u.qualityActions, 0);

  return (
    <section style={{
      padding: 16, borderRadius: 12,
      background: "linear-gradient(135deg, #083344 0%, #0e7490 60%, #06b6d4 100%)",
      color: "#fff", marginBottom: 14,
      boxShadow: "0 6px 18px rgba(8,51,68,0.30)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Proof-of-Network · invite chain</h2>
        <span style={{
          padding: "2px 9px", borderRadius: 5,
          background: "linear-gradient(135deg, #fff, #e0f2fe)",
          color: "#0e7490", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
        }}>G · LIVE</span>
        <span style={{ fontSize: 11, opacity: 0.85 }}>
          {(NETWORK.royaltyPct * 100).toFixed(0)}% royalty downstream · cap {NETWORK.maxInvites} invitees
        </span>
      </div>

      {/* My code panel */}
      <div style={{
        padding: 12, borderRadius: 8,
        background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.25)",
        marginBottom: 12,
        display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" as const,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.85, textTransform: "uppercase" as const, marginBottom: 2 }}>
            Твой invite code
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}>
            {network.myCode}
          </div>
          <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" as const }}>
            {inviteUrl}
          </div>
        </div>
        <button onClick={copyCode}
          style={{
            padding: "8px 14px", borderRadius: 6,
            background: copied ? "#16a34a" : "rgba(255,255,255,0.95)",
            color: copied ? "#fff" : "#0e7490",
            border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer",
            transition: "all 0.2s",
          }}>
          {copied ? "✓ Скопировано" : "📋 Copy link"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const }}>Приглашено</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
            {network.invited.length} / {NETWORK.maxInvites}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const }}>Quality actions</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>{totalActions}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const }}>Royalty earned</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#86efac" }}>
            {network.totalDownstreamEarned.toFixed(4)}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const }}>Per action</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace" }}>
            +{(NETWORK.perActionAev * NETWORK.royaltyPct).toFixed(3)}
          </div>
        </div>
      </div>

      {/* Invite simulator */}
      <div style={{
        padding: 10, borderRadius: 8,
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
        marginBottom: 10,
        display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" as const,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, textTransform: "uppercase" as const }}>
          Демо · симуляция invite
        </span>
        <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40}
          placeholder="Имя друга (или оставь пустым — сгенерирую)"
          style={{
            padding: "6px 10px", borderRadius: 5,
            border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.25)",
            color: "#fff", fontSize: 12, flex: "1 1 220px", minWidth: 0,
          }} />
        <button onClick={inviteOne}
          disabled={network.invited.length >= NETWORK.maxInvites}
          style={{
            padding: "7px 14px", borderRadius: 5, border: "none",
            background: network.invited.length >= NETWORK.maxInvites
              ? "rgba(255,255,255,0.15)"
              : "linear-gradient(135deg, #fff, #e0f2fe)",
            color: network.invited.length >= NETWORK.maxInvites ? "#94a3b8" : "#0e7490",
            fontSize: 12, fontWeight: 800,
            cursor: network.invited.length >= NETWORK.maxInvites ? "default" : "pointer",
          }}>
          ➕ Invite
        </button>
        <span style={{ fontSize: 10, opacity: 0.7 }}>каждые 18-32s случайный invitee делает quality action</span>
      </div>

      {/* Invitees list */}
      {network.invited.length === 0 ? (
        <div style={{
          padding: 18, textAlign: "center" as const, fontSize: 12, opacity: 0.85,
          background: "rgba(0,0,0,0.18)", borderRadius: 8,
        }}>
          Пока никого не пригласил. Скопируй ссылку и поделись — или нажми «Invite» для демо.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, maxHeight: 280, overflowY: "auto" as const }}>
          {network.invited.map((u) => {
            const ageH = Math.max(0, Math.floor((Date.now() - u.joinedTs) / 3600000));
            const ageM = Math.max(0, Math.floor(((Date.now() - u.joinedTs) % 3600000) / 60000));
            return (
              <div key={u.id} style={{
                padding: "8px 12px", borderRadius: 7,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 10, alignItems: "center" as const, fontSize: 12,
              }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span>
                  <strong style={{ fontSize: 13 }}>{u.name}</strong>
                  {u.city && <span style={{ opacity: 0.7 }}> · {u.city}</span>}
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, opacity: 0.75 }}>
                  joined {ageH > 0 ? `${ageH}h` : `${ageM}m`}
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#fde68a", whiteSpace: "nowrap" as const }}>
                  {u.qualityActions} act
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#86efac", fontWeight: 800, whiteSpace: "nowrap" as const }}>
                  +{u.earnedFromMe.toFixed(4)}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => triggerActivityFor(u.id)} title="Манально дернуть quality action"
                    style={{
                      padding: "4px 8px", borderRadius: 4,
                      border: "1px solid rgba(134,239,172,0.5)", background: "rgba(134,239,172,0.15)",
                      color: "#86efac", fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}>
                    ⚡
                  </button>
                  <button onClick={() => removeOne(u.id)} title="Убрать из списка"
                    style={{
                      padding: "4px 8px", borderRadius: 4,
                      border: "1px solid rgba(252,165,165,0.5)", background: "rgba(252,165,165,0.10)",
                      color: "#fca5a5", fontSize: 11, fontWeight: 800, cursor: "pointer",
                    }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── D. Curation Wall (engine D · live) ────────────────────────────
const PIN_KIND_META: Record<PinKind, { emoji: string; label: string; color: string }> = {
  game:     { emoji: "♟", label: "CyberChess партия",  color: "#0ea5e9" },
  puzzle:   { emoji: "🧩", label: "Пазл / Endgame",    color: "#22c55e" },
  trade:    { emoji: "💵", label: "QTrade сделка",      color: "#f59e0b" },
  position: { emoji: "📐", label: "Позиция-классика",   color: "#8b5cf6" },
  quote:    { emoji: "💬", label: "Цитата / инсайт",   color: "#ec4899" },
  guide:    { emoji: "📘", label: "Гайд / разбор",     color: "#6366f1" },
};

function CurationWall({ wallet, setWallet, pins, setPins }: {
  wallet: AEVWallet;
  setWallet: React.Dispatch<React.SetStateAction<AEVWallet | null>>;
  pins: PinnedItem[];
  setPins: React.Dispatch<React.SetStateAction<PinnedItem[] | null>>;
}) {
  const [draftKind, setDraftKind] = useState<PinKind>("game");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = pinsToday(pins);
  const remaining = Math.max(0, CURATION.dailyPinLimit - today);
  const totalUpvotes = pins.reduce((s, p) => s + p.upvotes, 0);
  const earned = pins.length * CURATION.perPinAev + totalUpvotes * CURATION.upvoteBonusAev;

  const submit = () => {
    setError(null);
    const result = recordPin(wallet, pins, {
      kind: draftKind,
      title: draftTitle,
      note: draftNote || undefined,
      link: draftLink || undefined,
    });
    if ("error" in result) {
      setError(result.error);
      setTimeout(() => setError(null), 4500);
      return;
    }
    setWallet(result.wallet);
    setPins(result.pins);
    setDraftTitle(""); setDraftNote(""); setDraftLink("");
  };

  const upvotePin = (id: string) => {
    const result = simulateUpvote(wallet, pins, id);
    setWallet(result.wallet);
    setPins(result.pins);
  };

  const deletePin = (id: string) => {
    setPins(removePin(pins, id));
  };

  return (
    <section style={{
      padding: 16, borderRadius: 12,
      background: "linear-gradient(135deg, #faf5ff 0%, #fff 60%)",
      border: "1px solid #d8b4fe", marginBottom: 14,
      boxShadow: "0 6px 18px rgba(124,58,237,0.10)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 18 }}>🧭</span>
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#0f172a" }}>Curation Wall</h2>
        <span style={{
          padding: "2px 9px", borderRadius: 5,
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          color: "#fff", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" as const,
        }}>D · LIVE</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          +{CURATION.perPinAev} AEV за pin · +{CURATION.upvoteBonusAev} AEV за upvote · cap {CURATION.maxPins}
        </span>
      </div>

      {/* ─── Stats row ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, borderRadius: 8, background: "#faf5ff", border: "1px solid #e9d5ff" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#6b21a8", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Сегодня pin'ов</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#581c87" }}>
            {today} / {CURATION.dailyPinLimit}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Всего pin'ов</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#0c4a6e" }}>
            {pins.length} / {CURATION.maxPins}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#ecfdf5", border: "1px solid #86efac" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#14532d", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Upvotes собрано</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#15803d" }}>
            {totalUpvotes}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#9a3412", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Заработано curating</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#7c2d12" }}>
            {earned.toFixed(3)} AEV
          </div>
        </div>
      </div>

      {/* ─── Pin form ────────────────────────────────────────── */}
      <div style={{ padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #e9d5ff", marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" as const }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Тип</label>
            <select value={draftKind} onChange={(e) => setDraftKind(e.target.value as PinKind)}
              style={{ padding: "7px 10px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
              {(Object.keys(PIN_KIND_META) as PinKind[]).map((k) => (
                <option key={k} value={k}>{PIN_KIND_META[k].emoji} {PIN_KIND_META[k].label}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: "#64748b" }}>{remaining > 0 ? `Осталось ${remaining} в лимите дня` : "Дневной лимит исчерпан"}</span>
          </div>
          <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={120}
            placeholder="Заголовок (например: «победа над Master в 24 хода»)"
            style={{ padding: "8px 12px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} maxLength={240}
            rows={2}
            placeholder="Заметка / разбор / контекст (optional, до 240 char)"
            style={{ padding: "8px 12px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical" as const, fontFamily: "inherit" }} />
          <input value={draftLink} onChange={(e) => setDraftLink(e.target.value)} maxLength={200}
            placeholder="Ссылка (optional, например /cyberchess?pgn=…)"
            style={{ padding: "8px 12px", borderRadius: 5, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "ui-monospace, monospace" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" as const, flexWrap: "wrap" as const }}>
            <button onClick={submit}
              disabled={!draftTitle.trim() || remaining <= 0}
              style={{
                padding: "8px 18px", borderRadius: 6, border: "none",
                background: !draftTitle.trim() || remaining <= 0 ? "#cbd5e1" : "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "#fff", fontWeight: 800, fontSize: 13,
                cursor: !draftTitle.trim() || remaining <= 0 ? "default" : "pointer",
                boxShadow: !draftTitle.trim() || remaining <= 0 ? "none" : "0 2px 8px rgba(124,58,237,0.3)",
              }}>
              📌 Pin (+{CURATION.perPinAev} AEV)
            </button>
            {error && (
              <span style={{
                padding: "5px 10px", borderRadius: 5,
                background: "#fef2f2", border: "1px solid #fca5a5",
                color: "#b91c1c", fontSize: 12, fontWeight: 700,
              }}>⚠ {error}</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Pins list ────────────────────────────────────────── */}
      {pins.length === 0 ? (
        <div style={{ padding: 18, textAlign: "center" as const, color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderRadius: 8 }}>
          Пока ничего не запиннено. Pin свою лучшую партию или гайд — получишь первые AEV за curating.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, maxHeight: 360, overflowY: "auto" as const }}>
          {pins.map((p) => {
            const meta = PIN_KIND_META[p.kind];
            const ago = (() => {
              const dt = (Date.now() - p.ts) / 1000;
              if (dt < 60) return `${Math.round(dt)}s назад`;
              if (dt < 3600) return `${Math.round(dt / 60)}m назад`;
              if (dt < 86400) return `${Math.round(dt / 3600)}h назад`;
              return `${Math.round(dt / 86400)}d назад`;
            })();
            return (
              <div key={p.id} style={{
                padding: "10px 12px", borderRadius: 8,
                background: "#fff", border: `1px solid ${meta.color}33`,
                borderLeft: `3px solid ${meta.color}`,
                display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 10, alignItems: "center" as const,
              }}>
                <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>{p.title}</div>
                  {p.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 2, lineHeight: 1.4 }}>{p.note}</div>}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                    <span>{meta.label}</span>
                    <span>· {ago}</span>
                    {p.link && <a href={p.link} style={{ color: meta.color, textDecoration: "underline", fontFamily: "ui-monospace, monospace" }}>↗ ссылка</a>}
                  </div>
                </div>
                <div style={{ textAlign: "center" as const, minWidth: 36 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "ui-monospace, monospace", color: "#15803d", lineHeight: 1 }}>
                    {p.upvotes}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.4, textTransform: "uppercase" as const }}>upvotes</div>
                </div>
                <button onClick={() => upvotePin(p.id)} title="Симулировать peer-review upvote (+0.05 AEV)"
                  style={{
                    padding: "5px 9px", borderRadius: 5, border: "1px solid #86efac", background: "#fff",
                    color: "#16a34a", fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" as const,
                  }}>
                  👍 +{CURATION.upvoteBonusAev}
                </button>
                <button onClick={() => deletePin(p.id)} title="Удалить pin"
                  style={{
                    padding: "5px 9px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fff",
                    color: "#dc2626", fontSize: 11, fontWeight: 800, cursor: "pointer",
                  }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
