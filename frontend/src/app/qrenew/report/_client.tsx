"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import ModulePricingChip from "@/components/ModulePricingChip";

// QRenew · Report — годовой отчёт биовозраста. Вводим два среза анализов
// (baseline и latest), backend /report считает PhenoAge (Levine 2018) в обеих
// точках и показывает, сузился ли разрыв «биологический − паспортный».

interface BioField { key: string; label: string; unit: string; placeholder: string; }

const FIELDS: BioField[] = [
  { key: "age", label: "Возраст", unit: "лет", placeholder: "40" },
  { key: "albumin", label: "Альбумин", unit: "г/л", placeholder: "45" },
  { key: "creatinine", label: "Креатинин", unit: "мкмоль/л", placeholder: "80" },
  { key: "glucose", label: "Глюкоза", unit: "ммоль/л", placeholder: "5.0" },
  { key: "crp", label: "CRP (СРБ)", unit: "мг/л", placeholder: "1.0" },
  { key: "lymphocytePct", label: "Лимфоциты", unit: "%", placeholder: "35" },
  { key: "mcv", label: "MCV", unit: "фл", placeholder: "90" },
  { key: "rdw", label: "RDW", unit: "%", placeholder: "13" },
  { key: "alp", label: "Щёлочная фосфатаза", unit: "Ед/л", placeholder: "70" },
  { key: "wbc", label: "Лейкоциты", unit: "×10⁹/л", placeholder: "6" },
];

interface Point { chronologicalAge: number; phenotypicAge: number; ageGap: number; }
interface Report {
  baseline: Point;
  latest: Point;
  phenoAgeChange: number;
  ageGapChange: number;
  trajectory: "improving" | "worsening" | "stable";
  interpretation: string;
  method: string;
  disclaimer: string;
}

export default function QRenewReportClient() {
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState<Record<string, string>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toNumeric(src: Record<string, string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }

  async function buildReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/qrenew/report"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseline: toNumeric(baseline), latest: toNumeric(latest) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "missing_biomarkers") {
          throw new Error("Заполните все поля в обоих срезах (нужны все 10 показателей в baseline и latest).");
        }
        throw new Error(`Сервер вернул ${res.status}`);
      }
      setReport((await res.json()) as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось построить отчёт");
    } finally {
      setLoading(false);
    }
  }

  const trajColor =
    report?.trajectory === "improving" ? "#5fbf7f" : report?.trajectory === "worsening" ? "#e0a878" : "#c8823f";

  function column(title: string, hint: string, values: Record<string, string>, set: (v: Record<string, string>) => void) {
    return (
      <div style={styles.col}>
        <h3 style={styles.h3}>{title}</h3>
        <p style={styles.colHint}>{hint}</p>
        {FIELDS.map((f) => (
          <label key={f.key} style={styles.field}>
            <span style={styles.fieldLabel}>
              {f.label} <span style={styles.unit}>{f.unit}</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => set({ ...values, [f.key]: e.target.value })}
              style={styles.input}
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · QRenew · Report</div>
        <h1 style={styles.h1}>Отчёт биологического возраста</h1>
        <p style={styles.lede}>
          Введите два среза анализов — исходный (baseline) и свежий (latest, обычно через 6–12 месяцев).
          Мы считаем фенотипический возраст (PhenoAge, Levine 2018) в обеих точках и показываем, сузился
          ли разрыв между биологическим и паспортным возрастом. Это wellness-оценка, не диагноз.
        </p>
        <div style={{ marginTop: 14 }}>
          <ModulePricingChip moduleId="qrenew" theme="dark" />
        </div>

        <section style={styles.card}>
          <div style={styles.cols}>
            {column("Baseline (исходный)", "Первый замер — точка отсчёта.", baseline, setBaseline)}
            {column("Latest (свежий)", "Повторный замер через 6–12 мес.", latest, setLatest)}
          </div>
          <button onClick={buildReport} disabled={loading} style={styles.btn}>
            {loading ? "Считаю отчёт…" : "Построить отчёт"}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </section>

        {report && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Динамика</h2>
            <div style={styles.statRow}>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Био-возраст: было</div>
                <div style={styles.statValue}>{report.baseline.phenotypicAge}</div>
                <div style={styles.statSub}>разрыв {report.baseline.ageGap > 0 ? "+" : ""}{report.baseline.ageGap}</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Био-возраст: стало</div>
                <div style={styles.statValue}>{report.latest.phenotypicAge}</div>
                <div style={styles.statSub}>разрыв {report.latest.ageGap > 0 ? "+" : ""}{report.latest.ageGap}</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Δ био-возраст</div>
                <div style={{ ...styles.statValue, color: trajColor }}>
                  {report.phenoAgeChange > 0 ? `+${report.phenoAgeChange}` : report.phenoAgeChange}
                </div>
                <div style={styles.statSub}>лет</div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Δ разрыв</div>
                <div style={{ ...styles.statValue, color: trajColor }}>
                  {report.ageGapChange > 0 ? `+${report.ageGapChange}` : report.ageGapChange}
                </div>
                <div style={styles.statSub}>отрицат. = лучше</div>
              </div>
            </div>
            <p style={{ ...styles.interpretation, borderColor: trajColor }}>{report.interpretation}</p>
            <p style={styles.method}>Метод: {report.method}</p>
            <p style={styles.disclaimer}>{report.disclaimer}</p>
          </section>
        )}

        <p style={styles.foot}>
          ← Назад к <a href="/qrenew" style={styles.link}>калькулятору QRenew</a>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 900, margin: "0 auto" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c8823f" },
  h1: { fontSize: 34, margin: "10px 0 0", fontWeight: 700 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 680 },
  card: { background: "#0d1422", border: "1px solid #1c2942", borderRadius: 16, padding: 24, marginTop: 26 },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 22 },
  col: { display: "flex", flexDirection: "column", gap: 10 },
  h2: { fontSize: 20, margin: "0 0 16px" },
  h3: { fontSize: 15, margin: "0", color: "#c8823f" },
  colHint: { fontSize: 12.5, color: "#8b9bb0", margin: "0 0 4px" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 13, color: "#c3d0e0" },
  unit: { color: "#6c7d92", fontSize: 11 },
  input: { background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "9px 11px", color: "#e8eef6", fontSize: 14 },
  btn: { marginTop: 20, background: "#c8823f", color: "#0a0a0a", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { color: "#e0787f", marginTop: 12 },
  statRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  stat: { background: "#0a101c", border: "1px solid #1c2942", borderRadius: 12, padding: "12px 18px", minWidth: 120 },
  statLabel: { fontSize: 12, color: "#8b9bb0" },
  statValue: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  statSub: { fontSize: 11, color: "#6c7d92", marginTop: 2, fontFamily: "monospace" },
  interpretation: { marginTop: 18, borderLeft: "3px solid #c8823f", paddingLeft: 14, color: "#c3d0e0", lineHeight: 1.6 },
  method: { marginTop: 12, fontSize: 12.5, color: "#8b9bb0", fontFamily: "monospace" },
  disclaimer: { marginTop: 12, fontSize: 12.5, color: "#8b9bb0", borderTop: "1px solid #1c2942", paddingTop: 14 },
  foot: { marginTop: 26, color: "#8b9bb0", fontSize: 14 },
  link: { color: "#c8823f" },
};
