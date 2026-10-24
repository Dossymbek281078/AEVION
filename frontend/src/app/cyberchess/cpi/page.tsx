"use client";

// AEVION CPI (Chess Performance Index) — preview page
// Static preview of the new rating system formula. No engine integration yet.
// Зона: aevion-core/main owns frontend/src/app/cyberchess/**

import Link from "next/link";
import { repoPath } from "@/lib/repoUrl";
import { useCcI18n } from "../i18n";
import { tt } from "./cpiText";

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  dim: "#94a3b8",
  faint: "#64748b",
  purple: "#a78bfa",
  green: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  cyan: "#22d3ee",
};

type Factor = {
  code: string;
  emoji: string;
  name: string;
  desc: string;
  weight: number;
  formula: string;
  source: string;
};

const FACTORS: Factor[] = [
  { code: "E",  emoji: "🎯", name: "Eval-loss",     desc: "Средняя потеря оценки за партию в сотых пешки (точность)", weight: 30, formula: "max(0, 1 − CPL/200)", source: "Stockfish 18" },
  { code: "T",  emoji: "⏱",  name: "Time-mgmt",     desc: "Равномерность затрат времени на ход",          weight: 5,  formula: "1 − stddev/avg",       source: "Clock state" },
  { code: "O",  emoji: "📖", name: "Opening book",  desc: "% ходов из первой десятки базы до 10-го хода",          weight: 10, formula: "hits / first_10",     source: "openingExplorer.ts" },
  { code: "B1", emoji: "①",  name: "Best line",     desc: "% ходов = первый выбор движка",                    weight: 20, formula: "best / total",         source: "Stockfish multiPV=3" },
  { code: "B2", emoji: "②",  name: "Second line",   desc: "% ходов = #2 (частичный кредит)",              weight: 5,  formula: "second / total",       source: "Stockfish multiPV=3" },
  { code: "B3", emoji: "③",  name: "Third line",    desc: "% ходов = #3 (слабый кредит)",                 weight: 2,  formula: "third / total",        source: "Stockfish multiPV=3" },
  { code: "M1", emoji: "💀", name: "Mate-in-1",     desc: "% найденных матов в 1 ход",                    weight: 8,  formula: "found / available",   source: "Stockfish" },
  { code: "M2", emoji: "💀💀", name: "Mate-in-2",   desc: "% найденных матов в 2 хода",                   weight: 15, formula: "found / available",   source: "Stockfish" },
  { code: "M3", emoji: "💀💀💀", name: "Mate-in-3", desc: "% найденных матов в 3 хода",                   weight: 20, formula: "found / available",   source: "Stockfish" },
  { code: "H",  emoji: "💥", name: "Hangs",         desc: "Зевки фигур (оценка падает на 300+ сотых пешки)",                 weight: -25,formula: "−count",               source: "eval diff" },
  { code: "Br", emoji: "💎", name: "Brilliancies",  desc: "Жертвы и неочевидные сильные ходы",            weight: 30, formula: "+count",               source: "brilliancy.ts" },
];

const EXAMPLES = [
  {
    title: "Проиграл, но качество отличное",
    icon: "🥈",
    metrics: { result: "L", CPL: 25, B1pct: 0.45, M1: "2/2", M2: "1/1", hangs: 0, brilliancies: 1 },
    delta: +88,
    note: "В Elo было бы −15. У нас даже за проигрыш — большой плюс.",
    color: "#34d399",
  },
  {
    title: "Выиграл, но с зевком",
    icon: "🪙",
    metrics: { result: "W", CPL: 80, B1pct: 0.34, M1: "0/0", M2: "0/0", hangs: 1, brilliancies: 0 },
    delta: +10,
    note: "В Elo было бы +15. У нас победа есть, но качество посредственное — маленький плюс.",
    color: "#fbbf24",
  },
  {
    title: "Идеальная ничья",
    icon: "🤝",
    metrics: { result: "D", CPL: 8, B1pct: 0.75, M1: "—", M2: "—", hangs: 0, brilliancies: 0 },
    delta: +50,
    note: "В Elo было бы ≈ 0. У нас — большой плюс за технику.",
    color: "#a78bfa",
  },
];

const RIVALS = [
  { name: "FIDE Elo",         basis: "Только результат + Elo соперника",      score: "—" },
  { name: "Lichess Glicko-2", basis: "Результат + RD (отклонение рейтинга)",     score: "—" },
  { name: "chess.com Glicko", basis: "Результат + волатильность",             score: "—" },
  { name: "AEVION CPI",       basis: "11 факторов качества + R-бонус",        score: "✓ — наш" },
];

export default function CPIPreviewPage() {
  const { locale: L } = useCcI18n();
  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "@id": "https://aevion.app/cyberchess/cpi",
        headline: "AEVION CPI — Chess Performance Index Specification",
        description: "Composite chess rating system. Awards points for quality of play across 11 factors, not just match results. Differentiates AEVION from FIDE Elo, Lichess Glicko-2, chess.com Glicko.",
        datePublished: "2026-05-12",
        author: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
        publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
        keywords: ["chess", "rating system", "Stockfish", "NNUE", "performance index", "centipawn loss", "brilliancy detection"],
      }) }} />
      <style>{`
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; }
          button, a[role="button"] { min-height: 44px; }
          table { font-size: 11px; }
          pre { font-size: 11px !important; }
        }
      `}</style>
      <article style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>CyberChess</Link>
          {" / "}<span style={{ color: C.text }}>CPI</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            {tt(L, "v0.1 · ЧЕРНОВИК · 2026-05-12")}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 12px", lineHeight: 1.15 }}>
            AEVION CPI <span style={{ color: C.purple }}>Chess Performance Index</span>
          </h1>
          <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.65, margin: 0, maxWidth: 680 }}>
            {tt(L, "Новая система рейтинга для CyberChess. Принципиально отличается от FIDE Elo, Lichess Glicko-2 и chess.com Glicko:")}{" "}
            <strong style={{ color: C.text }}>{tt(L, "даёт баллы за каждую партию независимо от результата")}</strong>{tt(L, ", на основе составной оценки качества игры.")}
          </p>
        </div>

        {/* Why */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "Зачем нужна новая система")}</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.7 }}>
              {tt(L, "Все три топа (FIDE/Lichess/chess.com) считают рейтинг")} <em>{tt(L, "только по результату партии")}</em>{tt(L, ". Это:")}
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                <li>{tt(L, "грубо — один блестящий ход в проигранной партии = 0 баллов")}</li>
                <li>{tt(L, "демотивирует тренировку — упорная игра без победы = минус")}</li>
                <li>{tt(L, "скрывает реальный прогресс — можно расти качественно, но падать в рейтинге")}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Rivals table */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "Сравнение с конкурентами")}</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(167,139,250,0.08)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>{tt(L, "Система")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>{tt(L, "Что измеряет")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5 }}>{tt(L, "Скилл-чувствительность")}</th>
                </tr>
              </thead>
              <tbody>
                {RIVALS.map((r, i) => (
                  <tr key={r.name} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}`, background: r.name === "AEVION CPI" ? "rgba(167,139,250,0.05)" : "transparent" }}>
                    <td style={{ padding: "10px 14px", fontWeight: r.name === "AEVION CPI" ? 800 : 600, color: r.name === "AEVION CPI" ? C.purple : C.text }}>{r.name}</td>
                    <td style={{ padding: "10px 14px", color: C.dim }}>{tt(L, r.basis)}</td>
                    <td style={{ padding: "10px 14px", color: r.name === "AEVION CPI" ? C.green : C.faint, fontWeight: r.name === "AEVION CPI" ? 800 : 400 }}>{tt(L, r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        {/* Formula */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "Формула ΔCPI")}</h2>
          <pre style={{
            background: "#020617",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "16px 18px",
            margin: "0 0 16px",
            fontSize: 12,
            lineHeight: 1.7,
            color: C.cyan,
            fontFamily: "ui-monospace, monospace",
            overflowX: "auto",
          }}>{`ΔCPI =   w_E   · E_score     ← 30 (eval-loss)
       + w_T   · T_score     ← 5  (time-mgmt)
       + w_O   · O_score     ← 10 (opening book)
       + w_B   · B1_score    ← 20 (best line)
       + w_B2  · B2_score    ← 5  (2nd line)
       + w_B3  · B3_score    ← 2  (3rd line)
       + w_M1  · M1_score    ← 8  (mate-in-1)
       + w_M2  · M2_score    ← 15 (mate-in-2)
       + w_M3  · M3_score    ← 20 (mate-in-3)
       − w_H   · H_count     ← −25 (hangs)
       + w_Br  · Br_count    ← +30 (brilliancies)
       + R_bonus             ← +10/+5/0 (W/D/L)

CPI_new = clamp(CPI_old + ΔCPI, 0, 4000)`}</pre>
          <p style={{ fontSize: 13, color: C.faint, margin: 0, lineHeight: 1.6 }}>
            {tt(L, "Веса предварительные. Финальные будут подобраны после симуляции на 100+ исторических партиях разного уровня.")}
          </p>
        </section>

        {/* Factors */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "11 факторов")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 10 }}>
            {FACTORS.map((f) => (
              <div key={f.code} style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${f.weight < 0 ? C.red : C.purple}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{f.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{f.name}</span>
                    <code style={{ fontSize: 10, color: C.faint, fontFamily: "ui-monospace, monospace", background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 3 }}>{f.code}</code>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: f.weight < 0 ? C.red : C.green, fontFamily: "ui-monospace, monospace" }}>
                    {f.weight > 0 ? "+" : ""}{f.weight}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 8 }}>{tt(L, f.desc)}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.faint }}>
                  <code style={{ fontFamily: "ui-monospace, monospace", color: C.cyan }}>{f.formula}</code>
                  <span>{f.source}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "Примеры — CPI vs Elo")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {EXAMPLES.map((ex, i) => (
              <div key={i} style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${ex.color}`,
                borderRadius: 10,
                padding: "14px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{ex.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{tt(L, ex.title)}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: 0.5 }}>ΔCPI</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ex.color, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>
                      {ex.delta > 0 ? "+" : ""}{ex.delta}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {Object.entries(ex.metrics).map(([k, v]) => (
                    <code key={k} style={{
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      color: C.dim,
                      background: "rgba(255,255,255,0.04)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}>{k}: {String(v)}</code>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, fontStyle: "italic" }}>{tt(L, ex.note)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "План развития")}</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
            <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.dim, lineHeight: 1.8 }}>
              <li><strong style={{ color: C.green }}>F1</strong> — spec doc + preview page <em style={{ color: C.faint }}>{tt(L, "(этот экран — текущая фаза ✓)")}</em></li>
              <li><strong style={{ color: C.text }}>F2</strong> {tt(L, "— Stockfish с тремя лучшими линиями в игровом цикле")}</li>
              <li><strong style={{ color: C.text }}>F3</strong> — <code style={{ color: C.cyan }}>cpi.ts</code> {tt(L, "функция")} <code>computeGameCPI()</code> + unit tests</li>
              <li><strong style={{ color: C.text }}>F4</strong> — <code style={{ color: C.cyan }}>/cyberchess/cpi/dashboard</code> {tt(L, "с SVG-графиками")}</li>
              <li><strong style={{ color: C.text }}>F5</strong> {tt(L, "— Подбор от тренера по CPI — автоподборка упражнений по слабому фактору")}</li>
            </ol>
          </div>
        </section>

        {/* Open questions */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>{tt(L, "Открытые вопросы")}</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
              <li><strong style={{ color: C.text }}>{tt(L, "Веса факторов")}</strong> {tt(L, "— симуляция на 100+ партий разного уровня")}</li>
              <li><strong style={{ color: C.text }}>{tt(L, "Сопоставление CPI и FIDE")}</strong> {tt(L, "— показывать ли «эквивалент по FIDE»?")}</li>
              <li><strong style={{ color: C.text }}>{tt(L, "Античит")}</strong> {tt(L, "— сильный игрок может симулировать ошибки. Считать только в режимах против ИИ?")}</li>
              <li><strong style={{ color: C.text }}>{tt(L, "Затухание")}</strong> {tt(L, "— должен ли CPI «затухать», если не играешь?")}</li>
              <li><strong style={{ color: C.text }}>{tt(L, "Стеклянный потолок")}</strong> {tt(L, "— потолок 4000 — может ли быть мало для топов?")}</li>
            </ul>
          </div>
        </section>

        {/* Related */}
        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>← CyberChess</Link>
          <span style={{ color: C.faint }}>·</span>
          <a href={repoPath("blob/main/CYBERCHESS_CPI_SPEC.md")} style={{ color: C.purple, textDecoration: "none" }}>{tt(L, "📄 Полная спецификация на GitHub")}</a>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          {tt(L, "Версия 0.1 · 2026-05-12 · может меняться")}
        </div>
      </article>
    </main>
  );
}
