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
    case "clean":       return "✓ ЧИСТО";
    case "unusual":     return "⚠ НЕСТАНДАРТНО";
    case "suspicious":  return "⚠ ПОДОЗРИТЕЛЬНО";
    case "flagged":     return "🚨 НАРУШЕНИЕ";
  }
}

function verdictColor(verdict: AntiCheatResult["verdict"]): string {
  switch (verdict) {
    case "clean":       return "#22c55e";
    case "unusual":     return "#eab308";
    case "suspicious":  return "#f97316";
    case "flagged":     return "#ef4444";
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

export default function AntiCheatPanel({
  open, onClose, result,
  surface1, surface2, border, text, textDim, accent,
}: Props) {
  if (!open || !result) return null;

  const { suspicionScore, verdict, confidence, signals, stats } = result;
  const insufficient = confidence === "insufficient";
  const meterColor = scoreColor(suspicionScore);
  const sorted = [...signals].sort((a, b) => b.score - a.score);

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  };

  const card: React.CSSProperties = {
    background: surface1, border: `1px solid ${border}`, borderRadius: "16px",
    width: "100%", maxWidth: "560px", maxHeight: "90vh",
    overflowY: "auto", padding: "24px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", gap: "20px",
    color: text, fontFamily: "inherit",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "18px", fontWeight: 700 }}>🛡 Анти-чит анализ</span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: textDim, fontSize: "22px", lineHeight: 1, padding: "2px 6px",
            }}
            aria-label="Закрыть"
          >×</button>
        </div>

        {/* Meter */}
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
            <span style={{ fontSize: "22px", fontWeight: 700, color: meterColor, minWidth: "70px", textAlign: "right" }}>
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
          </div>

          <div style={{ fontSize: "12px", color: textDim }}>
            Для выводов нужно 15+ диагностических ходов. Сыграно: {stats.diagnosticMoves}
          </div>
        </div>

        {/* Signals */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Сигналы
          </div>
          {insufficient && (
            <div style={{ fontSize: "12px", color: textDim, marginBottom: "8px", fontStyle: "italic" }}>
              Недостаточно ходов для точной оценки сигналов.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", opacity: insufficient ? 0.45 : 1 }}>
            {sorted.map((sig) => (
              <div key={sig.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ flex: 1, fontSize: "13px" }}>{sig.name}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: signalBarColor(sig.verdict), minWidth: "30px", textAlign: "right" }}>
                    {sig.score}
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: border, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${sig.score}%`,
                    background: signalBarColor(sig.verdict), borderRadius: "3px",
                  }} />
                </div>
                <div style={{ fontSize: "11px", color: textDim }}>{sig.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats table */}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Статистика
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            {([
              ["Диагностических ходов",           String(stats.diagnosticMoves)],
              ["Совпадение с движком (топ-1)",     `${Math.round(stats.top1Rate * 100)}%`],
              ["Совпадение (топ-3)",               `${Math.round((stats as unknown as Record<string, number>)["top3Rate"] !== undefined ? (stats as unknown as Record<string, number>)["top3Rate"] * 100 : 0)}%`],
              ["Средние потери (CPL)",             `${stats.avgCpl.toFixed(1)}`],
              ["Расчётный рейтинг",                `~${stats.intrinsicRating} ELO`],
              ["Расхождение рейтинга",             `${stats.ratingDiscrepancy >= 0 ? "+" : ""}${stats.ratingDiscrepancy} ELO`],
              ["Z-score",                          `${stats.zScore.toFixed(2)}`],
              ["Темп игры (CoV)",                  `${(stats.timeCoV * 100).toFixed(0)}%`],
              ["Серия лучших ходов",               `${stats.longestTop1Streak}`],
              ["Критические позиции",              `${Math.round(stats.critTop1Rate * 100)}%`],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", background: surface2, borderRadius: "8px", padding: "8px 10px" }}>
                <span style={{ fontSize: "11px", color: textDim, marginBottom: "2px" }}>{label}</span>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: "11px", color: textDim, borderTop: `1px solid ${border}`, paddingTop: "12px", lineHeight: 1.5 }}>
          Анализ выполнен Stockfish-18 + Regan Statistical Model. Один сигнал не является доказательством — требуется совпадение нескольких.
        </div>

      </div>
    </div>
  );
}
