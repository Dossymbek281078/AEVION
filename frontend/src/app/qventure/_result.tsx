"use client";

// Shared QVenture result view — used by the interactive /qventure page and the
// public read-only /qventure/a/[id] share page. Keeps a single source of truth
// for the memo layout so the shared page looks identical to the live result.

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { isSaved, toggleWatchlist } from "./_watchlist";
import { DataProvenanceChip } from "@/components/DataProvenanceChip";
import { dataQualityFromCounts, type DataQuality } from "@/lib/dataQuality";

// ─── Types (mirror backend engine.ts) ────────────────────────────────────────

export type Verdict = "invest" | "watch" | "pass";

export interface ScoreFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  rationale: string;
  basis?: "company-evidence" | "sector-prior" | "no-evidence";
}

export interface Lens {
  lens: string;
  role: string;
  headline: string;
  points: string[];
  risks: string[];
}

export interface Strategy {
  verdict: Verdict;
  conviction: "high" | "medium" | "low";
  ticketUsd: { min: number; target: number; max: number };
  valuationBandUsd: { low: number; base: number; high: number };
  ownershipTargetPct: number;
  tranches: Array<{ label: string; pct: number; trigger: string }>;
  returns: { baseMoic: number; lossProbability: number; expectedMoic: number; targetIrrPct: number; horizonYears: number };
  portfolioNote: string;
  reasoning: string[];
  reEntryConditions?: string[];
}

export interface SectorSource {
  publisher: string;
  year: number;
  claim: string;
  url: string;
}

export interface AnalysisResult {
  id: string;
  name: string;
  composite: number;
  verdict: Verdict;
  result: {
    /** Rubric generation that produced this score; absent on records predating versioning. */
    rubricVersion?: number;
    factors: ScoreFactor[];
    strategy: Strategy;
    assumptions: string[];
    sector: { id?: string; label: string; sources?: SectorSource[] };
    stage: string;
    council: { lenses: Lens[]; memo: string; aiUsed: boolean; aiProvider: string };
    // Company-specific scoring (added 2026-07; optional for older persisted records).
    signalCoverage?: number;
    redFlags?: string[];
    signals?: { fieldsFound: number };
    stress?: {
      base: { ltvCac: number | null; paybackMonths: number | null };
      scenarios: { label: string; shock: string; ltvCac: number | null; paybackMonths: number | null; health: "healthy" | "tight" | "underwater" }[];
      resilience: "robust" | "fragile" | "underwater" | "insufficient-data";
      worstLtvCac: number | null;
      note: string;
    };
    tam?: {
      mode: "full" | "partial" | "insufficient";
      acvUsd: number | null;
      claimedTamUsd: number | null;
      sectorTamUsd: number;
      claimedVsSectorPct: number | null;
      impliedAccounts: number | null;
      currentPenetrationPct: number | null;
      somAt1PctUsd: number | null;
      triangulation: string[];
      flags: string[];
    };
    projections?: {
      years: number;
      startRevenueUsd: number;
      endRevenueUsd: number;
      multiple: number;
      impliedCagrPct: number | null;
      sectorCagrPct: number;
      /** Venture bar for the stage; absent on reports scored before it existed. */
      stageBarCagrPct?: number;
      ratioToBar?: number | null;
      // "grounded" is the pre-2026-07 label, kept so old shared reports still render.
      verdict: "below-market" | "conservative" | "venture-grade" | "grounded" | "aggressive" | "hockey-stick" | "pre-revenue";
      note: string;
    } | null;
  };
}

export const STAGES = ["idea", "pre-seed", "seed", "series-a", "growth"] as const;

// Подпись для человека отдельно от значения для машины. До 01.09.2026 список
// стадий выводил САМО значение — покупатель видел «pre-seed» и «series-a»,
// то есть внутренние ключи. Значение уходит на сервер и остаётся прежним;
// меняется только то, что читают глазами. Образец рядом — VERDICT_LABEL.
export const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  idea: "Идея",
  "pre-seed": "Предпосев",
  seed: "Посев",
  "series-a": "Раунд A",
  growth: "Рост",
};

// Newspaper palette (see feedback_aevion_light_newspaper_ui). Verdict keeps its
// semantic split, but aligned to the paper red/teal/amber rather than SaaS slate.
export const VERDICT_COLOR: Record<Verdict, string> = { invest: "#0a7d72", watch: "#b7791f", pass: "#b5241b" };
export const VERDICT_LABEL: Record<Verdict, string> = { invest: "ИНВЕСТИРУЕМ", watch: "НАБЛЮДАЕМ", pass: "ПАС" };
const LENS_ICON: Record<string, string> = { scientist: "🔬", data_analyst: "📊", economist: "📈", lawyer: "⚖️" };

export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const mm = (n: number) => "$" + (n / 1e6).toFixed(1) + "M";

// Shared section shell and heading, restyled to the paper language: a cream card
// under a hairline rule instead of a rounded SaaS box, and a serif section head.
// These reference the --paper tokens, so any consumer must sit inside .paper.
export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';
export const SECTION: React.CSSProperties = { border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4, padding: 22, background: "var(--card, #fffefb)", marginBottom: 20 };
export const H2: React.CSSProperties = { margin: "0 0 16px", paddingBottom: 9, borderBottom: "2px solid var(--rule-bold, #17181a)", fontFamily: SERIF, fontSize: 24, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--ink, #17181a)" };

// ─── Sub-components ───────────────────────────────────────────────────────────

export function ScoreGauge({ score, verdict, size = 120 }: { score: number; verdict: Verdict; size?: number }) {
  const color = VERDICT_COLOR[verdict];
  const pct = Math.max(0, Math.min(100, score));
  const inner = size - 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `conic-gradient(${color} ${pct * 3.6}deg, var(--rule, #d4d3cc) 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <div style={{
          width: inner, height: inner, borderRadius: "50%", background: "var(--card, #fffefb)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "var(--ink, #17181a)", lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 11, color: "var(--ink-faint, #74767c)" }}>/ 100</span>
        </div>
      </div>
      <div>
        <span style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 999, background: color,
          color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: 0.5,
        }}>{VERDICT_LABEL[verdict]}</span>
        <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)", marginTop: 8 }}>Сводная оценка QVenture</div>
      </div>
    </div>
  );
}

// Provenance of the composite: how much of it rests on this startup's own
// disclosed evidence rather than sector priors.
//
// This used to infer provenance by string-matching the rationale text for
// "cited" / "no traction", and to assume exactly one factor could ever come from
// the founder. Both had gone stale: a submission with real metrics produces
// "Quantified traction: $12M revenue…", which contains none of those words and so
// was miscounted as a sector benchmark — and market, moat and economics can all
// be company-scored when the plan discloses figures. The engine now states the
// provenance of each factor directly, so read that instead of guessing from prose.
export function ventureDataQuality(factors: ScoreFactor[]): DataQuality {
  let measured = 0, derived = 0, guessed = 0;
  for (const f of factors) {
    // Records predating the basis field fall back to sector-benchmark, which is
    // what five of eight factors always were.
    switch (f.basis ?? "sector-prior") {
      case "company-evidence": measured++; break;
      case "no-evidence": guessed++; break;
      default: derived++; break;
    }
  }
  return dataQualityFromCounts(measured, derived, guessed, {
    source: `QVenture engine — ${measured} of ${factors.length} factors scored from this startup's disclosed metrics, the rest from sector benchmarks`,
    note: "из данных стартапа — фактор оценён по раскрытым метрикам основателя; секторный бенчмарк — из отраслевых норм (с источниками); нет данных — трэкшн не раскрыт. Скор — секторный скрининг, не глубокий DD.",
  });
}

// Five of the eight factors are sector constants — the same number for every
// company in that market. Labelling the source stops a reader assuming all eight
// were assessed about this specific company, and explains a low execution score.
const BASIS_TAG: Record<NonNullable<ScoreFactor["basis"]>, { text: string; bg: string; fg: string; title: string }> = {
  "company-evidence": { text: "from this plan", bg: "#ecfdf5", fg: "#047857", title: "Оценка по метрикам, раскрытым в этой заявке." },
  "sector-prior": { text: "sector average", bg: "var(--paper-2, #efeee8)", fg: "var(--ink-soft, #45474c)", title: "Sector benchmark — identical for every company in this sector, not specific to this one." },
  "no-evidence": { text: "not disclosed", bg: "#fef2f2", fg: "#b91c1c", title: "Nothing was submitted for this factor, so it scores low rather than neutral. Add traction metrics to move it." },
};

export function FactorBar({ f }: { f: ScoreFactor }) {
  const color = f.score >= 70 ? "var(--teal, #0a7d72)" : f.score >= 50 ? "var(--amber, #b7791f)" : "var(--red, #b5241b)";
  const tag = f.basis ? BASIS_TAG[f.basis] : null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: "var(--ink, #17181a)", fontWeight: 600 }}>
          {f.label} <span style={{ color: "var(--ink-faint, #74767c)", fontWeight: 400 }}>· {Math.round(f.weight * 100)}%</span>
          {tag && (
            <span title={tag.title} style={{
              marginLeft: 6, fontSize: 10.5, fontWeight: 600, padding: "1px 6px",
              borderRadius: 999, background: tag.bg, color: tag.fg, whiteSpace: "nowrap",
            }}>{tag.text}</span>
          )}
        </span>
        <span style={{ fontWeight: 700, color }}>{f.score}</span>
      </div>
      <div style={{ height: 7, background: "var(--rule, #d4d3cc)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${f.score}%`, height: "100%", background: color }} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 3 }}>{f.rationale}</div>
    </div>
  );
}

/**
 * Score breakdown, split by what the number is actually about.
 *
 * Listing all eight factors flat gives equal billing to rows that describe this
 * company and rows that are the same for every deal in the sector. Reading top
 * to bottom, five sector constants drown the two or three rows that carry the
 * real information. What the company disclosed leads; the sector benchmark
 * collapses into one block that opens on demand.
 */
export function FactorBreakdown({ factors }: { factors: ScoreFactor[] }) {
  const [showSector, setShowSector] = useState(false);
  const company = factors.filter((f) => f.basis !== "sector-prior");
  const sector = factors.filter((f) => f.basis === "sector-prior");
  const sectorWeight = Math.round(sector.reduce((s, f) => s + f.weight, 0) * 100);

  if (sector.length === 0 || company.length === 0) {
    return <>{factors.map((f) => <FactorBar key={f.key} f={f} />)}</>;
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink, #17181a)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        О самой компании · {100 - sectorWeight}% of the score
      </div>
      {company.map((f) => <FactorBar key={f.key} f={f} />)}

      <button
        type="button"
        onClick={() => setShowSector((v) => !v)}
        style={{
          width: "100%", marginTop: 6, padding: "9px 12px", cursor: "pointer",
          background: "var(--paper-2, #efeee8)", border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4,
          fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft, #45474c)", textAlign: "left",
        }}
      >
        {showSector ? "▾" : "▸"} Sector context · {sectorWeight}% of the score ·{" "}
        <span style={{ fontWeight: 400 }}>
          {sector.length} factors identical for every company in this sector
        </span>
      </button>
      {showSector && (
        <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: "3px solid var(--rule, #d4d3cc)" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-faint, #74767c)", lineHeight: 1.5 }}>
            These are benchmarks for the sector, not findings about this company — a rival deal in
            the same market scores the same here. They set the backdrop; they do not differentiate.
          </p>
          {sector.map((f) => <FactorBar key={f.key} f={f} />)}
        </div>
      )}
    </div>
  );
}

export function LensCard({ lens }: { lens: Lens }) {
  return (
    <div style={{ border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4, padding: 16, background: "var(--card, #fffefb)" }}>
      <div style={{ fontWeight: 700, color: "var(--ink, #17181a)", marginBottom: 6 }}>
        {LENS_ICON[lens.lens] || "•"} {lens.role}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--ink-soft, #45474c)", fontStyle: "italic", marginBottom: 10 }}>{lens.headline}</div>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, color: "var(--ink-soft, #45474c)" }}>
        {lens.points.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
      </ul>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--red, #b5241b)", marginBottom: 3 }}>Риски</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#7f1d1d" }}>
        {lens.risks.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
      </ul>
    </div>
  );
}

export function StrategyPanel({ s }: { s: Strategy }) {
  const r = s.returns;
  const cell = (label: string, value: string, sub?: string) => (
    <div style={{ background: "var(--paper-2, #efeee8)", border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--ink-faint, #74767c)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink, #17181a)", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
  // On a pass the sizing grid is a reference for a hypothetical re-score, not a
  // recommendation — label it so, and lead with what would have to change instead.
  const isPass = s.verdict === "pass";
  return (
    <div>
      {isPass && s.reEntryConditions && s.reEntryConditions.length > 0 && (
        <div style={{ marginBottom: 14, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 4, padding: "12px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b", marginBottom: 6 }}>
            В текущем виде инвестировать нельзя — что нужно изменить
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-soft, #45474c)", lineHeight: 1.55 }}>
            {s.reEntryConditions.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
          </ol>
        </div>
      )}
      {isPass && (
        <div style={{ fontSize: 12, color: "#92400e", marginBottom: 8 }}>
          The figures below are the terms this deal would have to earn on a re-score — not an offer.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14, opacity: isPass ? 0.62 : 1 }}>
        {cell(isPass ? "Чек (ориентировочно)" : "Лид-чек", usd(s.ticketUsd.target), `range ${usd(s.ticketUsd.min)}–${usd(s.ticketUsd.max)}`)}
        {cell("Целевая доля", s.ownershipTargetPct + "%", `${s.conviction} conviction`)}
        {cell("Оценка до раунда", mm(s.valuationBandUsd.base), `${mm(s.valuationBandUsd.low)}–${mm(s.valuationBandUsd.high)}`)}
        {cell("Ожидаемая доходность", r.expectedMoic + "x", `base ${r.baseMoic}x · ${Math.round(r.lossProbability * 100)}% loss rate`)}
        {cell("Целевой IRR", r.targetIrrPct + "%", `${r.horizonYears}yr horizon`)}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #17181a)", marginBottom: 6 }}>График вложений</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.tranches.map((t, i) => (
            <div key={i} style={{ flex: "1 1 180px", border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4, padding: "10px 12px", background: "var(--card, #fffefb)" }}>
              <div style={{ fontWeight: 800, color: "var(--ink, #17181a)" }}>{t.pct}% <span style={{ fontWeight: 600, fontSize: 13 }}>· {t.label}</span></div>
              <div style={{ fontSize: 12, color: "var(--ink-faint, #74767c)", marginTop: 2 }}>{t.trigger}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        fontSize: 13, color: "var(--ink-soft, #45474c)", borderRadius: 4, padding: "10px 14px",
        background: isPass ? "#fffbeb" : "#f0fdf4",
        border: `1px solid ${isPass ? "#fde68a" : "#bbf7d0"}`,
      }}>
        <strong>Портфель:</strong> {s.portfolioNote}
      </div>
    </div>
  );
}

// ─── Share button (copies public link) ───────────────────────────────────────

export function ShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/qventure/a/${id}` : `/qventure/a/${id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Разбор QVenture", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user dismissed share sheet or clipboard blocked — non-fatal
    }
  };
  return (
    <button type="button" onClick={share} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 16px", background: "var(--card, #fffefb)", color: "var(--teal-deep, #075b53)",
      border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
    }}>
      {copied ? "✓ Link copied" : "🔗 Share"}
    </button>
  );
}

// ─── Save to watchlist ────────────────────────────────────────────────────────

export function SaveButton({ result }: { result: AnalysisResult }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isSaved(result.id)); }, [result.id]);
  const onClick = () => {
    const now = saved; // toggle returns new state; keep UI in sync
    const nextSaved = toggleWatchlist({
      id: result.id,
      name: result.name,
      sector: result.result.sector.label,
      stage: result.result.stage,
      composite: result.composite,
      verdict: result.verdict,
      savedAt: new Date().toISOString(),
    });
    setSaved(nextSaved);
    void now;
  };
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
      background: saved ? "var(--teal-deep, #075b53)" : "#fff",
      color: saved ? "#fff" : "var(--teal-deep, #075b53)",
      border: "1px solid #ddd6fe",
    }}>
      {saved ? "★ Saved" : "☆ Save to watchlist"}
    </button>
  );
}

// ─── Recent comparable rounds (loads independently) ───────────────────────────

interface Comparable {
  company: string; amountText: string; amountUsd: number | null; round: string; date: string; url: string | null;
}
interface ComparablesData {
  mode: "live" | "illustrative" | "unavailable"; comps: Comparable[]; disclaimer: string;
}

function ComparablesBlock({ sectorLabel, stage }: { sectorLabel: string; stage: string }) {
  const [data, setData] = useState<ComparablesData | null>(null);
  const [loading, setLoading] = useState(true);
  // Отказ запроса и «данных нет» — РАЗНЫЕ вещи. Без этого флага раздел
  // просто исчезал, и человек читал это как «сравнимых сделок не бывает».
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/qventure/comparables?sector=${encodeURIComponent(sectorLabel)}&stage=${encodeURIComponent(stage)}`))
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? j.data : null); })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sectorLabel, stage]);

  if (loading) {
    return (
      <div style={SECTION}>
        <h2 style={H2}>Похожие сделки за последнее время</h2>
        <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>Ищем недавние сделки: {sectorLabel} · {stage} rounds…</div>
      </div>
    );
  }
  // Отказ показываем строкой, а не исчезновением раздела: пропавший блок
  // читается как «таких сделок не бывает», то есть как факт о рынке.
  if (failed) {
    return (
      <div style={SECTION}>
        <h2 style={H2}>Похожие сделки за последнее время</h2>
        <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>
          Не удалось загрузить похожие сделки — это не значит, что их нет.
        </div>
      </div>
    );
  }
  if (!data || data.comps.length === 0) return null;

  const badge = data.mode === "live"
    ? { text: "LIVE · web-sourced", bg: "var(--teal, #0a7d72)" }
    : { text: "ILLUSTRATIVE · model-recalled", bg: "var(--amber, #b7791f)" };

  return (
    <div style={SECTION}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ ...H2, margin: 0 }}>Похожие сделки за последнее время</h2>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: badge.bg, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>{badge.text}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-faint, #74767c)", fontSize: 12 }}>
              <th style={{ padding: "6px 8px" }}>Компания</th>
              <th style={{ padding: "6px 8px" }}>Сумма</th>
              <th style={{ padding: "6px 8px" }}>Раунд</th>
              <th style={{ padding: "6px 8px" }}>Дата</th>
              {data.mode === "live" && <th style={{ padding: "6px 8px" }}>Источник</th>}
            </tr>
          </thead>
          <tbody>
            {data.comps.map((c, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--paper-2, #efeee8)" }}>
                <td style={{ padding: "8px", fontWeight: 700, color: "var(--ink, #17181a)" }}>{c.company}</td>
                <td style={{ padding: "8px", color: "var(--ink, #17181a)" }}>{c.amountText || (c.amountUsd ? `$${(c.amountUsd / 1e6).toFixed(1)}M` : "—")}</td>
                <td style={{ padding: "8px", color: "var(--ink-soft, #45474c)" }}>{c.round || "—"}</td>
                <td style={{ padding: "8px", color: "var(--ink-faint, #74767c)" }}>{c.date || "—"}</td>
                {data.mode === "live" && (
                  <td style={{ padding: "8px" }}>
                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal-deep, #075b53)", fontWeight: 700, textDecoration: "none" }}>ссылка ↗</a> : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 10 }}>{data.disclaimer}</div>
    </div>
  );
}

interface BenchmarkBucket { label: string; count: number; containsScore: boolean }
interface BenchmarkData {
  mode: "ok" | "insufficient";
  basisLabel: string;
  count: number;
  totalCount: number;
  score: number;
  percentile: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  best: number | null;
  buckets: BenchmarkBucket[];
  needed: number;
  disclaimer: string;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Proprietary network signal — where this score ranks against QVenture's corpus.
function BenchmarkBlock({ sectorId, sectorLabel, stage, score }: { sectorId: string; sectorLabel: string; stage: string; score: number }) {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  // Отказ запроса и «данных нет» — РАЗНЫЕ вещи. Без этого флага раздел
  // просто исчезал, и человек читал это как «сравнимых сделок не бывает».
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/qventure/benchmark?sector=${encodeURIComponent(sectorId)}&stage=${encodeURIComponent(stage)}&score=${encodeURIComponent(String(score))}`))
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? j.data : null); })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sectorId, stage, score]);

  if (failed) {
    return (
      <div style={SECTION}>
        <h2 style={H2}>Ориентир QVenture</h2>
        <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>
          Не удалось загрузить ориентир — это сбой загрузки, а не вердикт.
        </div>
      </div>
    );
  }
  if (loading || !data) return null;

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <h2 style={{ ...H2, margin: 0 }}>Ориентир QVenture</h2>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: "var(--ink, #17181a)", color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>СИГНАЛ СЕТИ</span>
    </div>
  );

  if (data.mode === "insufficient") {
    return (
      <div style={SECTION}>
        {header}
        <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>{data.disclaimer}</div>
      </div>
    );
  }

  const maxBucket = Math.max(1, ...data.buckets.map((b) => b.count));
  const pctColor = (data.percentile ?? 0) >= 66 ? "var(--teal, #0a7d72)" : (data.percentile ?? 0) >= 33 ? "var(--amber, #b7791f)" : "var(--red, #b5241b)";

  return (
    <div style={SECTION}>
      {header}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: pctColor, lineHeight: 1 }}>{ordinal(data.percentile ?? 0)}</span>
        <span style={{ fontSize: 14, color: "var(--ink-soft, #45474c)" }}>перцентиль</span>
        <span style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>— scores higher than {data.percentile}% of {data.count} {data.basisLabel}</span>
      </div>

      {/* Distribution histogram with this deal's bucket highlighted */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 74, margin: "16px 0 6px" }}>
        {data.buckets.map((b) => (
          <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 10.5, color: b.containsScore ? "var(--ink, #17181a)" : "var(--ink-faint, #74767c)", fontWeight: b.containsScore ? 800 : 400 }}>{b.count}</div>
            <div
              title={`${b.count} deals scored ${b.label}`}
              style={{
                width: "100%",
                height: `${Math.max(4, (b.count / maxBucket) * 52)}px`,
                background: b.containsScore ? pctColor : "var(--rule, #d4d3cc)",
                borderRadius: "4px 4px 0 0",
              }}
            />
            <div style={{ fontSize: 10, color: b.containsScore ? "var(--ink, #17181a)" : "var(--ink-faint, #74767c)", fontWeight: b.containsScore ? 700 : 400 }}>{b.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "var(--ink-faint, #74767c)", marginTop: 10 }}>
        {data.p25 != null && <span>25th pct: <b style={{ color: "var(--ink-soft, #45474c)" }}>{Math.round(data.p25)}</b></span>}
        {data.median != null && <span>медиана: <b style={{ color: "var(--ink-soft, #45474c)" }}>{Math.round(data.median)}</b></span>}
        {data.p75 != null && <span>75th pct: <b style={{ color: "var(--ink-soft, #45474c)" }}>{Math.round(data.p75)}</b></span>}
        {data.best != null && <span>лучшее из виденного: <b style={{ color: "var(--ink-soft, #45474c)" }}>{Math.round(data.best)}</b></span>}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 10 }}>{data.disclaimer}</div>
    </div>
  );
}

// ─── Full result body (shared by both pages) ──────────────────────────────────

/** Bottom-up TAM triangulation — claimed TAM vs derived ACV / implied accounts / SOM. */
/** Revenue projection vs the venture bar for the stage — the plan-quality check. */
function ProjectionPanel({ p }: { p: NonNullable<NonNullable<AnalysisResult["result"]["projections"]>> }) {
  const V: Record<string, { c: string; bg: string; label: string }> = {
    "below-market": { c: "var(--red, #b5241b)", bg: "#fef2f2", label: "НИЖЕ РЫНКА" },
    conservative: { c: "var(--amber, #b7791f)", bg: "#fffbeb", label: "КОНСЕРВАТИВНО" },
    "venture-grade": { c: "var(--teal, #0a7d72)", bg: "#f0fdf4", label: "ВЕНЧУРНЫЙ УРОВЕНЬ" },
    grounded: { c: "var(--teal, #0a7d72)", bg: "#f0fdf4", label: "ОБОСНОВАННО" },
    aggressive: { c: "var(--amber, #b7791f)", bg: "#fffbeb", label: "АГРЕССИВНО" },
    "hockey-stick": { c: "var(--red, #b5241b)", bg: "#fef2f2", label: "КЛЮШКА" },
    "pre-revenue": { c: "var(--ink-faint, #74767c)", bg: "var(--paper-2, #efeee8)", label: "ДО ВЫРУЧКИ" },
  };
  const fmt = (n: number) => (n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n));
  // An unknown verdict (a report from a newer engine) still renders, neutrally.
  const v = V[p.verdict] ?? { c: "var(--ink-faint, #74767c)", bg: "var(--paper-2, #efeee8)", label: String(p.verdict).toUpperCase() };
  return (
    <div style={{ ...SECTION, background: v.bg, borderColor: `${v.c}44` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ ...H2, margin: 0 }}>Прогноз выручки</h2>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: v.c, color: "#fff", fontSize: 12, fontWeight: 800 }}>{v.label}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft, #45474c)" }}>
          {fmt(p.startRevenueUsd)} → {fmt(p.endRevenueUsd)} ({p.multiple}× / {p.years}yr)
          {p.impliedCagrPct !== null
            ? ` · ${p.impliedCagrPct}% CAGR vs ${p.stageBarCagrPct ? `${p.stageBarCagrPct}% stage bar · ` : ""}${p.sectorCagrPct}% market`
            : ""}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft, #45474c)", lineHeight: 1.55 }}>{p.note}</p>
    </div>
  );
}

function TamPanel({ tam }: { tam: NonNullable<AnalysisResult["result"]["tam"]> }) {
  if (tam.mode === "insufficient") return null;
  const fmt = (n: number | null) => (n === null ? "—" : n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n));
  const stat = (label: string, value: string) => (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--ink-faint, #74767c)", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink, #17181a)" }}>{value}</div>
    </div>
  );
  return (
    <div style={SECTION}>
      <h2 style={H2}>TAM снизу вверх</h2>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
        {tam.acvUsd !== null && stat("Расчётный ACV", fmt(tam.acvUsd))}
        {tam.claimedTamUsd !== null && stat("Заявленный TAM", fmt(tam.claimedTamUsd))}
        {tam.impliedAccounts !== null && stat("Подразумеваемых клиентов", tam.impliedAccounts.toLocaleString("en-US"))}
        {tam.currentPenetrationPct !== null && stat("Проникновение", tam.currentPenetrationPct + "%")}
        {stat("SOM @ 1%", fmt(tam.somAt1PctUsd))}
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {tam.triangulation.map((t, i) => (
          <li key={i} style={{ fontSize: 13, color: "var(--ink-soft, #45474c)", lineHeight: 1.55, marginBottom: 4 }}>{t}</li>
        ))}
      </ul>
      {tam.flags.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 4 }}>
          {tam.flags.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>⚠ {f}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Financial stress test — unit economics flexed under CAC/churn/margin shocks. */
function StressPanel({ stress }: { stress: NonNullable<AnalysisResult["result"]["stress"]> }) {
  if (stress.resilience === "insufficient-data") {
    return (
      <div style={SECTION}>
        <h2 style={H2}>Стресс-тест финансов</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-faint, #74767c)" }}>{stress.note}</p>
      </div>
    );
  }
  const RES: Record<string, { c: string; bg: string; label: string }> = {
    robust: { c: "var(--teal, #0a7d72)", bg: "#f0fdf4", label: "УСТОЙЧИВО" },
    fragile: { c: "var(--amber, #b7791f)", bg: "#fffbeb", label: "ХРУПКО" },
    underwater: { c: "var(--red, #b5241b)", bg: "#fef2f2", label: "ПОД ВОДОЙ" },
  };
  const HEALTH: Record<string, string> = { healthy: "var(--teal, #0a7d72)", tight: "var(--amber, #b7791f)", underwater: "var(--red, #b5241b)" };
  const r = RES[stress.resilience];
  return (
    <div style={{ ...SECTION, background: r.bg, borderColor: `${r.c}44` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ ...H2, margin: 0 }}>Стресс-тест финансов</h2>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: r.c, color: "#fff", fontSize: 12, fontWeight: 800 }}>{r.label}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft, #45474c)" }}>базовый LTV/CAC {stress.base.ltvCac} → worst-case {stress.worstLtvCac}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--ink-faint, #74767c)", fontSize: 11.5, textTransform: "uppercase" }}>
              <th style={{ padding: "6px 8px" }}>Сценарий</th>
              <th style={{ padding: "6px 8px" }}>LTV/CAC</th>
              <th style={{ padding: "6px 8px" }}>Окупаемость</th>
            </tr>
          </thead>
          <tbody>
            {stress.scenarios.map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--rule, #d4d3cc)" }}>
                <td style={{ padding: "7px 8px" }}><b>{s.label}</b> <span style={{ color: "var(--ink-faint, #74767c)" }}>· {s.shock}</span></td>
                <td style={{ padding: "7px 8px", fontWeight: 700, color: HEALTH[s.health] }}>{s.ltvCac ?? "—"}</td>
                <td style={{ padding: "7px 8px", color: "var(--ink-soft, #45474c)" }}>{s.paybackMonths !== null ? `${s.paybackMonths} mo` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-soft, #45474c)", lineHeight: 1.5 }}>{stress.note}</p>
    </div>
  );
}

/** Shows how much of the score is backed by the plan's own numbers vs sector priors. */
function SignalCoverageChip({ coverage, fields }: { coverage: number; fields: number }) {
  const pct = Math.round(coverage * 100);
  const color = pct >= 40 ? "var(--teal, #0a7d72)" : pct >= 15 ? "var(--amber, #b7791f)" : "var(--ink-faint, #74767c)";
  const label = pct >= 40 ? "company-specific" : pct >= 15 ? "partly company-specific" : "sector-based";
  return (
    <div
      title="Share of the composite score backed by metrics disclosed in the plan (revenue, growth, margin, LTV/CAC…) rather than sector averages. Add financials to raise it."
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10,
        padding: "5px 10px", borderRadius: 999, background: "var(--paper-2, #efeee8)",
        border: `1px solid ${color}33`, fontSize: 12, color: "var(--ink-soft, #45474c)",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span><b style={{ color }}>{pct}%</b> охват сигналов · {label}</span>
      <span style={{ color: "var(--ink-faint, #74767c)" }}>({fields} metric{fields === 1 ? "" : "s"} parsed)</span>
    </div>
  );
}

export function ResultView({ result, shared = false }: { result: AnalysisResult; shared?: boolean }) {
  return (
    <>
      <div style={SECTION}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ ...H2, marginBottom: 4 }}>{result.name}</h2>
            <div style={{ fontSize: 13, color: "var(--ink-faint, #74767c)" }}>{result.result.sector.label} · {result.result.stage}</div>
            {typeof result.result.signalCoverage === "number" && (
              <SignalCoverageChip
                coverage={result.result.signalCoverage}
                fields={result.result.signals?.fieldsFound ?? 0}
              />
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <a
                href={apiUrl(`/api/qventure/analyses/${result.id}/pdf`)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", background: "var(--card, #fffefb)", color: "var(--teal-deep, #075b53)",
                  border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                ⬇ Export memo to PDF
              </a>
              {!shared && <ShareButton id={result.id} />}
              <SaveButton result={result} />
            </div>
          </div>
          <ScoreGauge score={result.composite} verdict={result.verdict} />
        </div>
      </div>

      {result.result.redFlags && result.result.redFlags.length > 0 && (
        <div style={{ ...SECTION, background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <h2 style={{ ...H2, marginBottom: 8, color: "#b45309" }}>
            ⚠ Red flags <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>({result.result.redFlags.length} auto-detected from the plan)</span>
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.result.redFlags.map((f, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#78350f", lineHeight: 1.55, marginBottom: 6 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <BenchmarkBlock
        sectorId={result.result.sector.id ?? ""}
        sectorLabel={result.result.sector.label}
        stage={result.result.stage}
        score={result.composite}
      />

      <div style={SECTION}>
        <h2 style={H2}>Инвестиционное резюме</h2>
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--ink, #17181a)", lineHeight: 1.6, margin: 0 }}>{result.result.council.memo}</p>
        <div style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 10 }}>
          Текст собран: {result.result.council.aiUsed ? `живая модель (${result.result.council.aiProvider})` : "детерминированно, без модели (ключ ИИ не настроен)"}
          {result.result.rubricVersion ? ` · оценка по рубрике v${result.result.rubricVersion} — оценки сравнимы только внутри одной версии` : ""}
        </div>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Стратегия входа</h2>
        <StrategyPanel s={result.result.strategy} />
      </div>

      {result.result.tam && <TamPanel tam={result.result.tam} />}

      {result.result.projections && <ProjectionPanel p={result.result.projections} />}

      {result.result.stress && <StressPanel stress={result.result.stress} />}

      <ComparablesBlock sectorLabel={result.result.sector.label} stage={result.result.stage} />

      <div style={SECTION}>
        <h2 style={H2}>Из чего сложилась оценка</h2>
        <div style={{ marginBottom: 12 }}>
          <DataProvenanceChip
            dataQuality={ventureDataQuality(result.result.factors)}
            labels={{ measured: "из данных стартапа", derived: "секторный бенчмарк", guessed: "нет данных", unit: "факторов" }}
          />
        </div>
        <FactorBreakdown factors={result.result.factors} />
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Совет аналитиков</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {result.result.council.lenses.map((l) => <LensCard key={l.lens} lens={l} />)}
        </div>
      </div>

      {result.result.sector.sources && result.result.sector.sources.length > 0 && (
        <div style={SECTION}>
          <h2 style={{ ...H2, marginBottom: 6 }}>Источники рыночных данных</h2>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-faint, #74767c)" }}>
            Данные о размере рынка и росте для {result.result.sector.label} are anchored to recent third-party research:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-soft, #45474c)" }}>
            {result.result.sector.sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal-deep, #075b53)", fontWeight: 700, textDecoration: "none" }}>
                  {s.publisher} ({s.year})
                </a>
                <span style={{ color: "var(--ink-soft, #45474c)" }}> — {s.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ ...SECTION, background: "#fffbeb", borderColor: "#fde68a" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Допущения и ограничения</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#78350f" }}>
          {result.result.assumptions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
        </ul>
      </div>
    </>
  );
}
