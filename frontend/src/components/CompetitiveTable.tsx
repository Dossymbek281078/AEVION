"use client";

import { useState } from "react";
import {
  LANDSCAPES,
  LANDSCAPE_STATS,
  PENDING,
  type ComparisonRow,
  type CompetitorCell,
} from "@/data/competitiveLandscape";

/**
 * Where the module sits against the tools a buyer already knows.
 *
 * Deliberately shows the rows we lose. A table that wins everything reads as
 * marketing and gets discounted whole; the rows where Lovable or PitchBook are
 * simply better are what make the rest worth believing. Every competitor claim
 * carries its source as a link, and where it could not be checked the reader is
 * told so rather than left to assume it was.
 */

/**
 * Russian plural agreement for the derived counts.
 *
 * Needed the moment the numbers stopped being fixed: with one module left
 * unresearched the header read "ЕЩЁ 1 МОДУЛЕЙ", and a page arguing that we are
 * careful with numbers cannot get the grammar around them wrong.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const VERDICT: Record<ComparisonRow["verdict"], { label: string; fg: string; bg: string }> = {
  ours: { label: "Сильнее у нас", fg: "#6ee7b7", bg: "rgba(16,185,129,0.12)" },
  theirs: { label: "Сильнее у них", fg: "#fca5a5", bg: "rgba(239,68,68,0.12)" },
  "different-jobs": { label: "Разные задачи", fg: "#cbd5e1", bg: "rgba(148,163,184,0.12)" },
};

function Cell({ cell }: { cell: CompetitorCell }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
      {cell.value}
      {cell.source ? (
        <a
          href={cell.source}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: 4, fontSize: 11, color: "#7dd3fc", textDecoration: "underline" }}
        >
          источник
        </a>
      ) : null}
      {cell.unverified ? (
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          НЕ ПРОВЕРЕНО
        </span>
      ) : null}
    </div>
  );
}

export function CompetitiveTable() {
  const [active, setActive] = useState(LANDSCAPES[0]?.moduleId ?? "");
  const landscape = LANDSCAPES.find((l) => l.moduleId === active) ?? LANDSCAPES[0];
  if (!landscape) return null;

  return (
    <section
      id="competitors"
      style={{
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: 16,
        padding: "26px 22px",
        marginBottom: 28,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#7dd3fc", marginBottom: 8 }}>
        ЧЕСТНОЕ СРАВНЕНИЕ
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>
        Где мы сильнее, где слабее и где вообще не конкурируем
      </h2>
      <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 6px" }}>
        Наша сторона — только измеренное: под каждой цифрой указано, каким прогоном она получена. Чужая сторона — только
        со ссылкой на источник; где проверить не удалось, стоит пометка. Строки, где конкурент сильнее, оставлены на
        месте — таблица, выигрывающая везде, не стоит ничего.
      </p>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 20px" }}>
        {LANDSCAPE_STATS.researched} {plural(LANDSCAPE_STATS.researched, "модуль", "модуля", "модулей")} ·{" "}
        {LANDSCAPE_STATS.rows} {plural(LANDSCAPE_STATS.rows, "строка", "строки", "строк")} сравнения · из них{" "}
        {LANDSCAPE_STATS.rowsWhereTheyWin} в пользу конкурента · {LANDSCAPE_STATS.sourcedClaims}{" "}
        {plural(LANDSCAPE_STATS.sourcedClaims, "утверждение", "утверждения", "утверждений")} со ссылкой ·{" "}
        {/* Phrased so no number agrees with anything: "41 помечено как
            непроверенные" was grammatical for no value of 41. */}
        {LANDSCAPE_STATS.unverifiedClaims} с пометкой «не проверено»
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {LANDSCAPES.map((l) => (
          <button
            key={l.moduleId}
            type="button"
            onClick={() => setActive(l.moduleId)}
            style={{
              background: l.moduleId === active ? "rgba(56,189,248,0.16)" : "transparent",
              border: `1px solid ${l.moduleId === active ? "rgba(56,189,248,0.5)" : "rgba(148,163,184,0.3)"}`,
              color: l.moduleId === active ? "#e0f2fe" : "#94a3b8",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {l.module}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "rgba(251,191,36,0.07)",
          border: "1px solid rgba(251,191,36,0.25)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#fbbf24", marginBottom: 6 }}>
          ЧТО ВАЖНО ПОНЯТЬ ДО ТАБЛИЦЫ
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#fde68a", margin: 0 }}>{landscape.framing}</p>
      </div>

      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Что сравниваем</th>
              <th style={{ ...th, color: "#6ee7b7" }}>AEVION</th>
              {landscape.competitors.map((c) => (
                <th key={c.id} style={th}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "#e2e8f0", textDecoration: "none" }}>
                    {c.name}
                  </a>
                </th>
              ))}
              <th style={th}>Итог</th>
            </tr>
          </thead>
          <tbody>
            {landscape.rows.map((row) => {
              const v = VERDICT[row.verdict];
              return (
                <tr key={row.axis}>
                  <td style={td}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: row.why ? 4 : 0 }}>{row.axis}</div>
                    {row.why ? <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{row.why}</div> : null}
                  </td>
                  <td style={{ ...td, background: "rgba(16,185,129,0.05)" }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#d1fae5" }}>{row.ours.value}</div>
                    {row.ours.measured ? (
                      <div style={{ fontSize: 11, color: "#6ee7b7", marginTop: 5, fontFamily: "ui-monospace, monospace" }}>
                        замер: {row.ours.measured}
                      </div>
                    ) : null}
                  </td>
                  {landscape.competitors.map((c) => (
                    <td key={c.id} style={td}>
                      {row.theirs[c.id] ? <Cell cell={row.theirs[c.id]} /> : <span style={{ color: "#475569" }}>—</span>}
                    </td>
                  ))}
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: v.fg,
                        background: v.bg,
                        borderRadius: 6,
                        padding: "3px 8px",
                      }}
                    >
                      {v.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "#64748b", margin: "14px 0 0" }}>
        Конкуренты проверены {landscape.researchedAt}. Цены и возможности меняются — перед показом сверяйте по ссылкам.
      </p>

      <div style={{ marginTop: 22, borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 10 }}>
          ЕЩЁ {PENDING.length} {plural(PENDING.length, "МОДУЛЬ", "МОДУЛЯ", "МОДУЛЕЙ")} С АНАЛОГАМИ — СРАВНЕНИЕ НЕ ПРОВЕДЕНО
        </div>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 12px" }}>
          Перечислены, а не сравнены. Пустая строка честнее выдуманной.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PENDING.map((p) => (
            <div
              key={p.module}
              style={{
                border: "1px solid rgba(148,163,184,0.22)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              <strong style={{ color: "#e2e8f0" }}>{p.module}</strong>
              <span style={{ color: "#64748b" }}> · {p.analogues.join(", ")}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#94a3b8",
  padding: "8px 10px",
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  verticalAlign: "bottom",
};

const td: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid rgba(148,163,184,0.12)",
  verticalAlign: "top",
};
