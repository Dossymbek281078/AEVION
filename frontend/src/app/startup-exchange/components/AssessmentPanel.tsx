"use client";

import { useState } from "react";
import { BAND_STYLE, usd, type Assessment, type RedFlag } from "../lib";

/**
 * The free assessment, as the founder and the investor both see it.
 *
 * Rendering rules that are not negotiable:
 *  — the disclaimer is always visible, never behind a toggle;
 *  — every factor shows what its number is based on, so a sector average is
 *    never mistaken for a judgement about this company;
 *  — the blind spots sit next to the score, not at the bottom of the page.
 */

const BASIS_LABEL: Record<string, string> = {
  "company-evidence": "по данным заявки",
  "sector-prior": "по отрасли",
  "text-only": "по тексту",
};

const SEVERITY_STYLE: Record<RedFlag["severity"], { bg: string; border: string; color: string; label: string }> = {
  high: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", label: "Серьёзно" },
  medium: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", label: "Внимание" },
  info: { bg: "#f8fafc", border: "#e2e8f0", color: "#475569", label: "Заметка" },
};

export function AssessmentPanel({ a, compact = false }: { a: Assessment; compact?: boolean }) {
  const [showMethod, setShowMethod] = useState(false);
  const band = BAND_STYLE[a.band];
  const ratio = a.deal.implied.ratioToBandHigh;

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
      {/* Score header */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 92 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{a.score}</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.04em" }}>ИЗ 100</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: band.bg, color: band.color, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            {band.label}
          </span>
          <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.55 }}>{a.headline}</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: a.sector.origin === "fallback" ? "#b45309" : "#64748b" }}>
            {a.sector.label}
            {a.sector.origin === "detected" && " (определена по описанию)"}
            {a.sector.origin === "fallback" && " — отрасль не распознана, цифры рынка общие"}
            {" · доля оценки на фактических цифрах: "}
            {Math.round(a.evidenceCoverage * 100)}%
          </p>
        </div>
      </div>

      {/* Deal band — the part an investor actually reads */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", background: "#fcfcfd" }}>
        <SectionTitle>Сделка против рынка</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 10 }}>
          <Cell label="Просят по факту" value={a.deal.implied.postMoneyUsd !== null ? usd(a.deal.implied.postMoneyUsd) : "—"} hint={a.deal.implied.formula ?? "условия не позволяют посчитать"} />
          <Cell label="Рыночный диапазон" value={`${usd(a.deal.band.low)} – ${usd(a.deal.band.high)}`} hint={a.deal.band.basis} />
          <Cell
            label="Чек инвестора"
            value={a.deal.ticket.low === a.deal.ticket.high ? usd(a.deal.ticket.low) : `${usd(a.deal.ticket.low)} – ${usd(a.deal.ticket.high)}`}
            hint={a.deal.ticket.note}
          />
        </div>
        {ratio !== null && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.5,
              background: ratio <= 1 ? "#f0fdf4" : ratio <= 2 ? "#fffbeb" : "#fef2f2",
              color: ratio <= 1 ? "#166534" : ratio <= 2 ? "#92400e" : "#991b1b",
            }}
          >
            {ratio <= 1
              ? `Запрос внутри диапазона — ${Math.round(ratio * 100)}% от верхней границы.`
              : `Запрос выше верхней границы рынка в ${ratio.toFixed(1)}×. Это не запрет, но переговоры начнутся с этого.`}
          </div>
        )}
      </div>

      {/* Factors */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <SectionTitle>Из чего сложился балл</SectionTitle>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {a.factors.map((f) => (
            <div key={f.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {f.label}
                  <span style={{ fontWeight: 500, color: "#64748b", fontSize: 11, marginLeft: 6 }}>
                    вес {Math.round(f.weight * 100)}% · {BASIS_LABEL[f.basis] ?? f.basis}
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{f.score}</span>
              </div>
              <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, margin: "5px 0 5px" }}>
                <div style={{ width: `${f.score}%`, height: "100%", borderRadius: 3, background: f.score >= 70 ? "#10b981" : f.score >= 45 ? "#f59e0b" : "#ef4444" }} />
              </div>
              {!compact && <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{f.rationale}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Red flags */}
      {a.redFlags.length > 0 && (
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <SectionTitle>Что мешает сделке ({a.redFlags.length})</SectionTitle>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {a.redFlags.map((f, i) => {
              const s = SEVERITY_STYLE[f.severity];
              return (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</span>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.55 }}>{f.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Blind spots — the honest half */}
      <div style={{ padding: "18px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
        <SectionTitle>Чего этот анализ не видел</SectionTitle>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
          {a.blindSpots.map((b, i) => (
            <li key={i} style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>{b}</li>
          ))}
        </ul>
      </div>

      {/* Method + sources */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <button
          type="button"
          onClick={() => setShowMethod((v) => !v)}
          style={{ background: "none", border: "none", padding: "8px 0", minHeight: 36, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#7c3aed", textAlign: "left" }}
        >
          {showMethod ? "Скрыть методику" : "Откуда взяты рыночные цифры"}
        </button>
        {showMethod && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Диапазоны — это published market conventions, а не наш замер. Балл считается формулой без участия языковой
              модели: одинаковая заявка всегда даёт одинаковый результат, поэтому два проекта можно сравнивать между собой.
              Версия правил: {a.version}.
            </p>
            {a.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#475569", textDecoration: "none", lineHeight: 1.5, borderLeft: "2px solid #e2e8f0", paddingLeft: 10 }}
              >
                <strong style={{ color: "#0f172a" }}>{s.publisher}</strong> ({s.year}) — {s.claim}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer — always rendered, never collapsed */}
      <div style={{ padding: "14px 20px", background: "#fffbeb" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>{a.disclaimer}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.07em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", margin: "2px 0 3px" }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}
