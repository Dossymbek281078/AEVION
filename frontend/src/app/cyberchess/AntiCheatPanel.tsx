"use client";

import { type AntiCheatResult, type AntiCheatSignal } from "./anticheat";

type Props = {
  open: boolean;
  onClose: () => void;
  result: AntiCheatResult | null;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
};

function scoreColor(score: number): string {
  if (score < 30) return "#22c55e";
  if (score < 50) return "#eab308";
  if (score < 68) return "#f97316";
  return "#ef4444";
}

function verdictLabel(verdict: AntiCheatResult["verdict"]): string {
  switch (verdict) {
    case "clean":      return "✓ ЧИСТО";
    case "unusual":    return "⚠ НЕСТАНДАРТНО";
    case "suspicious": return "⚠ ПОДОЗРИТЕЛЬНО";
    case "flagged":    return "🚨 НАРУШЕНИЕ";
  }
}

function verdictColor(verdict: AntiCheatResult["verdict"]): string {
  switch (verdict) {
    case "clean":      return "#22c55e";
    case "unusual":    return "#eab308";
    case "suspicious": return "#f97316";
    case "flagged":    return "#ef4444";
  }
}

function confidenceLabel(c: AntiCheatResult["confidence"]): string {
  switch (c) {
    case "insufficient": return "Недостаточно данных";
    case "low":          return "Низкая уверенность";
    case "medium":       return "Средняя уверенность";
    case "high":         return "Высокая уверенность";
  }
}

function signalBarColor(verdict: AntiCheatSignal["verdict"]): string {
  switch (verdict) {
    case "clean":      return "#22c55e";
    case "unusual":    return "#eab308";
    case "suspicious": return "#ef4444";
  }
}

const BEHAVIORAL_IDS  = ["behavioral", "session_baseline"];
const STATISTICAL_IDS = ["engine_agreement", "avg_cpl", "critical_perf", "time_anomaly", "top1_streak", "cpl_uniformity", "endgame_tech"];
const CONTEXT_IDS     = ["intrinsic_context"];

export default function AntiCheatPanel({
  open, onClose, result,
  surface1, surface2, border, text, textDim, accent,
}: Props) {
  if (!open || !result) return null;

  const { suspicionScore, verdict, confidence, signals, stats, fenCopyDetected } = result;
  const insufficient = confidence === "insufficient";
  const meterColor   = scoreColor(suspicionScore);

  const byId = (ids: string[]) =>
    signals.filter((s) => ids.includes(s.id)).sort((a, b) => b.score - a.score);

  const behavioral  = byId(BEHAVIORAL_IDS);
  const statistical = byId(STATISTICAL_IDS);
  const contextOnly = byId(CONTEXT_IDS);

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  };

  const card: React.CSSProperties = {
    background: surface1, border: `1px solid ${border}`, borderRadius: "16px",
    width: "100%", maxWidth: "580px", maxHeight: "92vh",
    overflowY: "auto", padding: "24px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", gap: "20px",
    color: text, fontFamily: "inherit",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "12px", fontWeight: 700, color: textDim,
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px",
  };

  function SignalRow({ sig, dimmed }: { sig: AntiCheatSignal; dimmed?: boolean }) {
    const barColor = dimmed ? textDim : signalBarColor(sig.verdict);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", opacity: dimmed ? 0.5 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ flex: 1, fontSize: "13px" }}>{sig.name}</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: barColor, minWidth: "30px", textAlign: "right" }}>
            {sig.score}
          </span>
        </div>
        <div style={{ height: "6px", borderRadius: "3px", background: border, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${sig.score}%`, background: barColor, borderRadius: "3px" }} />
        </div>
        <div style={{ fontSize: "11px", color: textDim }}>{sig.detail}</div>
      </div>
    );
  }

  const sessionDelta = stats.sessionBaseDelta ?? 0;
  const statsGrid: [string, string][] = [
    ["Диагностических ходов",      String(stats.diagnosticMoves)],
    ["Совпадений движка (топ-1)",  `${Math.round(stats.top1Rate * 100)}%`],
    ["Средние потери",             `${stats.avgCpl.toFixed(1)} cp`],
    ["Расчётный уровень",          `~${stats.intrinsicRating} ELO`],
    ["Сессионное отклонение",      `${sessionDelta >= 0 ? "+" : ""}${Math.round(sessionDelta)} ELO`],
    ["Мгновенных ходов",           String(stats.instantMoves ?? 0)],
    ["Серия ходов #1",             String(stats.longestTop1Streak)],
    ["Z-score",                    stats.zScore.toFixed(2)],
  ];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>

        {/* FEN copy alert */}
        {fenCopyDetected && (
          <div style={{
            background: "#ef444422", border: "1px solid #ef4444",
            borderRadius: "10px", padding: "10px 14px",
            fontSize: "13px", color: "#ef4444", fontWeight: 600, lineHeight: 1.4,
          }}>
            🚨 FEN скопирован в буфер обмена — обнаружена возможная передача позиции движку
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "18px", fontWeight: 700 }}>🛡 Анти-чит анализ v2</span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: textDim, fontSize: "22px", lineHeight: 1, padding: "2px 6px",
            }}
            aria-label="Закрыть"
          >×</button>
        </div>

        {/* Suspicion meter */}
        <div style={{ background: surface2, borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: "14px", borderRadius: "7px", background: border, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${suspicionScore}%`,
                  background: meterColor, borderRadius: "7px",
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
            <span style={{ fontSize: "22px", fontWeight: 700, color: meterColor, minWidth: "76px", textAlign: "right" }}>
              {suspicionScore} / 100
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{
              background: verdictColor(verdict) + "22",
              color: verdictColor(verdict), border: `1px solid ${verdictColor(verdict)}55`,
              borderRadius: "999px", padding: "3px 12px", fontSize: "13px", fontWeight: 700,
            }}>
              {verdictLabel(verdict)}
            </span>
            <span style={{
              background: surface1, border: `1px solid ${border}`,
              borderRadius: "999px", padding: "3px 10px", fontSize: "12px", color: textDim,
            }}>
              {confidenceLabel(confidence)}
            </span>
            {(stats.sessionGamesCount ?? 0) > 0 && (
              <span style={{ fontSize: "12px", color: textDim }}>
                Анализ сессии: {stats.sessionGamesCount} {stats.sessionGamesCount === 1 ? "партия" : "партий"}
              </span>
            )}
          </div>
        </div>

        {/* Group 1 — Behavioral signals */}
        {behavioral.length > 0 && (
          <div>
            <div style={sectionTitle}>🔍 Поведенческие сигналы</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", opacity: insufficient ? 0.45 : 1 }}>
              {behavioral.map((sig) => <SignalRow key={sig.id} sig={sig} />)}
            </div>
          </div>
        )}

        {/* Group 2 — Statistical signals */}
        {statistical.length > 0 && (
          <div>
            <div style={sectionTitle}>📊 Статистические сигналы</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", opacity: insufficient ? 0.45 : 1 }}>
              {statistical.map((sig) => <SignalRow key={sig.id} sig={sig} />)}
            </div>
          </div>
        )}

        {/* Group 3 — Context only */}
        {contextOnly.length > 0 && (
          <div>
            <div style={sectionTitle}>ℹ Справка</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {contextOnly.map((sig) => <SignalRow key={sig.id} sig={sig} dimmed />)}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div>
          <div style={sectionTitle}>Статистика</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
            {statsGrid.map(([label, value]) => (
              <div key={label} style={{
                display: "flex", flexDirection: "column",
                background: surface2, borderRadius: "8px", padding: "8px 10px",
              }}>
                <span style={{ fontSize: "11px", color: textDim, marginBottom: "2px" }}>{label}</span>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: "11px", color: textDim,
          borderTop: `1px solid ${border}`, paddingTop: "12px", lineHeight: 1.5,
        }}>
          Для флага требуется совпадение 2–3 сигналов или обнаружение FEN. Расчётный уровень не является основанием для флага — сильный игрок с новым аккаунтом не будет отмечен.
        </div>

      </div>
    </div>
  );
}
