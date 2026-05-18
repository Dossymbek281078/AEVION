/**
 * AEVION CyberChess — FIDE Calibration Panel.
 *
 * Visual breakdown of CPI metrics + slider explorer ("what if I improve X").
 * Modal-style component. Renders the regression result from
 * `estimateFideFromCPI` and lets user experiment with sliders to see how
 * each factor moves the FIDE-equivalent estimate.
 *
 * Usage:
 *   const metrics = calibrateFromGames(savedGames);
 *   <FideCalibrationPanel
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     initialMetrics={metrics}
 *     surface1="#0d1b2a"
 *     surface2="#1b263b"
 *     border="#415a77"
 *     text="#e0e1dd"
 *     textDim="#778da9"
 *     accent="#22d3ee"
 *   />
 */
"use client";

import { useMemo, useState, useEffect } from "react";
import {
  CPIMetrics,
  estimateFideFromCPI,
  nearestAnchor,
  FideFactorBreakdown,
} from "./ratingCalibration";

type Props = {
  open: boolean;
  onClose: () => void;
  initialMetrics: CPIMetrics;
  /** Theme tokens — keep API identical to PlayerStatsDashboard */
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
};

type SliderConfig = {
  key: keyof CPIMetrics;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
};

const SLIDERS: SliderConfig[] = [
  { key: "accuracyPct",         label: "Точность игры",            min: 30, max: 99,  step: 1,   unit: "%",  hint: "GM играют 90%+, клубник ~75%" },
  { key: "openingTheoryDepth",  label: "Глубина теории дебюта",     min: 0,  max: 20,  step: 1,   unit: "ply", hint: "Сколько полуходов вы знаете в основных дебютах" },
  { key: "tacticalEfficiency",  label: "Тактическая эффективность", min: 0,  max: 1,   step: 0.05, unit: "",   hint: "Доля найденных комбинаций — 0..1" },
  { key: "endgameStrength",     label: "Сила эндшпиля",             min: 0,  max: 1,   step: 0.05, unit: "",   hint: "Безошибочность конверсии — 0..1" },
  { key: "blunderRate",         label: "Доля грубых ошибок",        min: 0,  max: 0.5, step: 0.01, unit: "",   hint: "Чем ниже — тем лучше" },
  { key: "avgMoveTime",         label: "Среднее время на ход",      min: 1,  max: 180, step: 1,   unit: "с",  hint: "Сладкое пятно ~30с (Rapid)" },
];

function statusColor(s: "good" | "mid" | "bad"): string {
  if (s === "good") return "#10b981";
  if (s === "mid") return "#f59e0b";
  return "#ef4444";
}

export default function FideCalibrationPanel({
  open,
  onClose,
  initialMetrics,
  surface1,
  surface2,
  border,
  text,
  textDim,
  accent,
}: Props) {
  // Local mutable copy — slider explorer
  const [metrics, setMetrics] = useState<CPIMetrics>(initialMetrics);

  // Re-sync when external metrics change (e.g. user played new games)
  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  // Run regression
  const result = useMemo(() => estimateFideFromCPI(metrics), [metrics]);
  const initialResult = useMemo(() => estimateFideFromCPI(initialMetrics), [initialMetrics]);

  const anchor = useMemo(() => nearestAnchor(result.fide), [result.fide]);
  const initialAnchor = useMemo(() => nearestAnchor(initialResult.fide), [initialResult.fide]);

  const fideDelta = result.fide - initialResult.fide;
  const dirty = fideDelta !== 0;

  function updateMetric(key: keyof CPIMetrics, value: number) {
    setMetrics(prev => ({ ...prev, [key]: value }));
  }

  function reset() {
    setMetrics(initialMetrics);
  }

  if (!open) return null;

  // Confidence-interval whiskers scale
  const ciSpan = result.high - result.low;
  // For visual whisker — map ±200 ELO to 100% width
  const whiskerScale = Math.min(100, (ciSpan / 400) * 100);

  // Factor bar visualization — relative to max abs ELO contribution
  const maxAbsDelta = Math.max(
    ...result.factors.map(f => Math.abs(f.deltaElo)),
    100,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FIDE Calibration Panel"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: surface1,
          border: `1px solid ${border}`,
          borderRadius: 16,
          maxWidth: 980,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 20,
          color: text,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>
              Калибровка FIDE
            </div>
            <div style={{ fontSize: 13, color: textDim, marginTop: 2 }}>
              Разбор вашей силы по 6 факторам · {result.samples} партий в выборке
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: surface2,
              border: `1px solid ${border}`,
              color: text,
              padding: "8px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Hero — current estimate */}
        <div
          style={{
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 18,
            marginBottom: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: textDim, textTransform: "uppercase", letterSpacing: 1 }}>
              {dirty ? "Симуляция" : "Текущая оценка"}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: accent, lineHeight: 1 }}>
                {result.fide}
              </div>
              <div style={{ fontSize: 14, color: textDim }}>FIDE</div>
              {dirty && (
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: fideDelta > 0 ? "#10b981" : "#ef4444",
                  marginLeft: 8,
                }}>
                  {fideDelta > 0 ? "+" : ""}{fideDelta}
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 16 }}>
              {anchor.badge} <b>{anchor.title}</b>
            </div>
            <div style={{ fontSize: 12, color: textDim, marginTop: 4 }}>
              {anchor.desc}
            </div>
          </div>

          {/* Confidence interval whiskers */}
          <div>
            <div style={{ fontSize: 12, color: textDim, textTransform: "uppercase", letterSpacing: 1 }}>
              Доверительный интервал
            </div>
            <div style={{ marginTop: 12, position: "relative", height: 56 }}>
              {/* Track */}
              <div style={{
                position: "absolute",
                top: 26,
                left: 0,
                right: 0,
                height: 4,
                background: border,
                borderRadius: 2,
              }} />
              {/* Whiskers */}
              <div style={{
                position: "absolute",
                top: 22,
                left: `${50 - whiskerScale / 2}%`,
                width: `${whiskerScale}%`,
                height: 12,
                background: accent,
                opacity: 0.35,
                borderRadius: 6,
              }} />
              {/* Center marker */}
              <div style={{
                position: "absolute",
                top: 14,
                left: "50%",
                transform: "translateX(-50%)",
                width: 4,
                height: 28,
                background: accent,
                borderRadius: 2,
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: textDim, marginTop: 4 }}>
              <span>{result.low}</span>
              <span style={{ color: text }}>±{Math.round(ciSpan / 2)}</span>
              <span>{result.high}</span>
            </div>
            {!dirty && (
              <div style={{ fontSize: 11, color: textDim, marginTop: 8 }}>
                Интервал сузится после ~100 партий до ±50
              </div>
            )}
          </div>
        </div>

        {/* Factor breakdown */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Разбор по факторам
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.factors.map((f) => (
              <FactorRow
                key={f.key}
                factor={f}
                maxAbsDelta={maxAbsDelta}
                surface2={surface2}
                border={border}
                text={text}
                textDim={textDim}
              />
            ))}
          </div>
        </div>

        {/* Slider explorer */}
        <div
          style={{
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Симулятор «что если...»
              </div>
              <div style={{ fontSize: 12, color: textDim, marginTop: 2 }}>
                Двигайте слайдеры — FIDE пересчитается мгновенно
              </div>
            </div>
            {dirty && (
              <button
                onClick={reset}
                style={{
                  background: "transparent",
                  border: `1px solid ${border}`,
                  color: text,
                  padding: "6px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Сбросить
              </button>
            )}
          </div>

          {SLIDERS.map((s) => {
            const val = metrics[s.key];
            const displayVal = s.step < 1
              ? val.toFixed(2)
              : Math.round(val).toString();
            return (
              <div key={s.key} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: accent }}>
                    {displayVal}{s.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  onChange={(e) => updateMetric(s.key, parseFloat(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: accent,
                  }}
                  aria-label={`${s.label} slider`}
                />
                <div style={{ fontSize: 11, color: textDim, marginTop: 2 }}>
                  {s.hint}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare snapshot */}
        {dirty && (
          <div style={{
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 12,
            alignItems: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                Сейчас
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: text, marginTop: 4 }}>
                {initialResult.fide}
              </div>
              <div style={{ fontSize: 12, color: textDim }}>
                {initialAnchor.badge} {initialAnchor.title}
              </div>
            </div>
            <div style={{ fontSize: 24, color: accent }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                Цель
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: accent, marginTop: 4 }}>
                {result.fide}
              </div>
              <div style={{ fontSize: 12, color: textDim }}>
                {anchor.badge} {anchor.title}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: 11, color: textDim, lineHeight: 1.5 }}>
          Оценка построена на анализе ваших партий через CPI-метрики. Формула:
          base 1200 + accuracy + opening depth + tactical + endgame − blunders − timing.
          Якоря (25 уровней) калибруют шкалу к FIDE-equivalent. При &lt;100 партий
          доверительный интервал может быть широк — играйте больше для уточнения.
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function FactorRow({
  factor,
  maxAbsDelta,
  surface2,
  border,
  text,
  textDim,
}: {
  factor: FideFactorBreakdown;
  maxAbsDelta: number;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
}) {
  const pct = Math.min(100, (Math.abs(factor.deltaElo) / maxAbsDelta) * 100);
  const negative = factor.deltaElo < 0;
  const color = statusColor(factor.status);

  return (
    <div
      style={{
        background: surface2,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: text }}>
            {factor.label}
          </div>
          <div style={{ fontSize: 11, color: textDim, marginTop: 1 }}>
            Текущее: <span style={{ fontFamily: "monospace" }}>{factor.value}{factor.unit}</span>
            {" · "}Цель: <span style={{ fontFamily: "monospace" }}>{factor.target}{factor.unit}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: negative ? "#ef4444" : "#10b981",
            fontFamily: "monospace",
          }}>
            {factor.deltaElo > 0 ? "+" : ""}{factor.deltaElo}
          </div>
          <div style={{ fontSize: 10, color: textDim }}>ELO</div>
        </div>
      </div>
      {/* Bar */}
      <div style={{
        position: "relative",
        height: 8,
        background: border,
        borderRadius: 4,
        overflow: "hidden",
      }}>
        {/* Center line */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: textDim,
          opacity: 0.5,
        }} />
        {/* Bar from center */}
        <div style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          ...(negative
            ? { right: "50%", width: `${pct / 2}%` }
            : { left: "50%", width: `${pct / 2}%` }),
          background: color,
          borderRadius: 4,
        }} />
      </div>
    </div>
  );
}
