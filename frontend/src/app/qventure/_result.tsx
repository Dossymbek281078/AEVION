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
  };
}

export const STAGES = ["idea", "pre-seed", "seed", "series-a", "growth"] as const;

export const VERDICT_COLOR: Record<Verdict, string> = { invest: "#16a34a", watch: "#d97706", pass: "#dc2626" };
export const VERDICT_LABEL: Record<Verdict, string> = { invest: "INVEST", watch: "WATCH", pass: "PASS" };
const LENS_ICON: Record<string, string> = { scientist: "🔬", data_analyst: "📊", economist: "📈", lawyer: "⚖️" };

export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const mm = (n: number) => "$" + (n / 1e6).toFixed(1) + "M";

export const SECTION: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, background: "#fff", marginBottom: 18 };
export const H2: React.CSSProperties = { margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#0f172a" };

// ─── Sub-components ───────────────────────────────────────────────────────────

export function ScoreGauge({ score, verdict, size = 120 }: { score: number; verdict: Verdict; size?: number }) {
  const color = VERDICT_COLOR[verdict];
  const pct = Math.max(0, Math.min(100, score));
  const inner = size - 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `conic-gradient(${color} ${pct * 3.6}deg, #e2e8f0 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <div style={{
          width: inner, height: inner, borderRadius: "50%", background: "#fff",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>/ 100</span>
        </div>
      </div>
      <div>
        <span style={{
          display: "inline-block", padding: "6px 16px", borderRadius: 999, background: color,
          color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: 0.5,
        }}>{VERDICT_LABEL[verdict]}</span>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>QVenture composite score</div>
      </div>
    </div>
  );
}

// Provenance of the composite score: how much of it reflects THIS startup's own
// disclosed evidence vs. sector-level priors. Only the execution factor is scored
// from the founder's traction input; the other seven are sector-benchmark derived
// (from SectorProfile, which carries cited sources). Honest by the engine's design.
export function ventureDataQuality(factors: ScoreFactor[]): DataQuality {
  let measured = 0, derived = 0, guessed = 0;
  for (const f of factors) {
    if (f.key === "execution") {
      const r = f.rationale.toLowerCase();
      if (r.includes("cited")) measured++;               // founder cited concrete metrics
      else if (r.includes("no traction") || r.includes("unproven")) guessed++;
      else derived++;                                     // qualitative traction only
    } else {
      derived++;                                          // sector benchmark (sourced)
    }
  }
  return dataQualityFromCounts(measured, derived, guessed, {
    source: "QVenture engine — 1 execution factor from startup input, 7 from sector benchmarks",
    note: "из данных стартапа — фактор оценён по раскрытым метрикам основателя; секторный бенчмарк — из отраслевых норм (с источниками); нет данных — трэкшн не раскрыт. Скор — секторный скрининг, не глубокий DD.",
  });
}

export function FactorBar({ f }: { f: ScoreFactor }) {
  const color = f.score >= 70 ? "#16a34a" : f.score >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: "#0f172a", fontWeight: 600 }}>{f.label} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {Math.round(f.weight * 100)}%</span></span>
        <span style={{ fontWeight: 700, color }}>{f.score}</span>
      </div>
      <div style={{ height: 7, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${f.score}%`, height: "100%", background: color }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>{f.rationale}</div>
    </div>
  );
}

export function LensCard({ lens }: { lens: Lens }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
        {LENS_ICON[lens.lens] || "•"} {lens.role}
      </div>
      <div style={{ fontSize: 13.5, color: "#334155", fontStyle: "italic", marginBottom: 10 }}>{lens.headline}</div>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, color: "#334155" }}>
        {lens.points.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
      </ul>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 3 }}>Risks</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#7f1d1d" }}>
        {lens.risks.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
      </ul>
    </div>
  );
}

export function StrategyPanel({ s }: { s: Strategy }) {
  const r = s.returns;
  const cell = (label: string, value: string, sub?: string) => (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>{sub}</div>}
    </div>
  );
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        {cell("Lead ticket", usd(s.ticketUsd.target), `range ${usd(s.ticketUsd.min)}–${usd(s.ticketUsd.max)}`)}
        {cell("Target ownership", s.ownershipTargetPct + "%", `${s.conviction} conviction`)}
        {cell("Valuation (pre)", mm(s.valuationBandUsd.base), `${mm(s.valuationBandUsd.low)}–${mm(s.valuationBandUsd.high)}`)}
        {cell("Expected return", r.expectedMoic + "x", `base ${r.baseMoic}x · ${Math.round(r.lossProbability * 100)}% loss rate`)}
        {cell("Target IRR", r.targetIrrPct + "%", `${r.horizonYears}yr horizon`)}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Deployment schedule</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.tranches.map((t, i) => (
            <div key={i} style={{ flex: "1 1 180px", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>{t.pct}% <span style={{ fontWeight: 600, fontSize: 13 }}>· {t.label}</span></div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.trigger}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#334155", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
        <strong>Portfolio:</strong> {s.portfolioNote}
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
        await navigator.share({ title: "QVenture analysis", url });
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
      padding: "8px 16px", background: "#fff", color: "#7c3aed",
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
      background: saved ? "#7c3aed" : "#fff",
      color: saved ? "#fff" : "#7c3aed",
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/qventure/comparables?sector=${encodeURIComponent(sectorLabel)}&stage=${encodeURIComponent(stage)}`))
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? j.data : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sectorLabel, stage]);

  if (loading) {
    return (
      <div style={SECTION}>
        <h2 style={H2}>Recent comparable rounds</h2>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Searching for recent {sectorLabel} · {stage} rounds…</div>
      </div>
    );
  }
  if (!data || data.comps.length === 0) return null;

  const badge = data.mode === "live"
    ? { text: "LIVE · web-sourced", bg: "#16a34a" }
    : { text: "ILLUSTRATIVE · model-recalled", bg: "#d97706" };

  return (
    <div style={SECTION}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ ...H2, margin: 0 }}>Recent comparable rounds</h2>
        <span style={{ padding: "3px 10px", borderRadius: 999, background: badge.bg, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>{badge.text}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12 }}>
              <th style={{ padding: "6px 8px" }}>Company</th>
              <th style={{ padding: "6px 8px" }}>Amount</th>
              <th style={{ padding: "6px 8px" }}>Round</th>
              <th style={{ padding: "6px 8px" }}>Date</th>
              {data.mode === "live" && <th style={{ padding: "6px 8px" }}>Source</th>}
            </tr>
          </thead>
          <tbody>
            {data.comps.map((c, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px", fontWeight: 700, color: "#0f172a" }}>{c.company}</td>
                <td style={{ padding: "8px", color: "#0f172a" }}>{c.amountText || (c.amountUsd ? `$${(c.amountUsd / 1e6).toFixed(1)}M` : "—")}</td>
                <td style={{ padding: "8px", color: "#334155" }}>{c.round || "—"}</td>
                <td style={{ padding: "8px", color: "#64748b" }}>{c.date || "—"}</td>
                {data.mode === "live" && (
                  <td style={{ padding: "8px" }}>
                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>link ↗</a> : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10 }}>{data.disclaimer}</div>
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/qventure/benchmark?sector=${encodeURIComponent(sectorId)}&stage=${encodeURIComponent(stage)}&score=${encodeURIComponent(String(score))}`))
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? j.data : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sectorId, stage, score]);

  if (loading || !data) return null;

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <h2 style={{ ...H2, margin: 0 }}>QVenture benchmark</h2>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: "#0f172a", color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3 }}>NETWORK SIGNAL</span>
    </div>
  );

  if (data.mode === "insufficient") {
    return (
      <div style={SECTION}>
        {header}
        <div style={{ fontSize: 13, color: "#64748b" }}>{data.disclaimer}</div>
      </div>
    );
  }

  const maxBucket = Math.max(1, ...data.buckets.map((b) => b.count));
  const pctColor = (data.percentile ?? 0) >= 66 ? "#16a34a" : (data.percentile ?? 0) >= 33 ? "#d97706" : "#dc2626";

  return (
    <div style={SECTION}>
      {header}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: pctColor, lineHeight: 1 }}>{ordinal(data.percentile ?? 0)}</span>
        <span style={{ fontSize: 14, color: "#334155" }}>percentile</span>
        <span style={{ fontSize: 13, color: "#64748b" }}>— scores higher than {data.percentile}% of {data.count} {data.basisLabel}</span>
      </div>

      {/* Distribution histogram with this deal's bucket highlighted */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 74, margin: "16px 0 6px" }}>
        {data.buckets.map((b) => (
          <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 10.5, color: b.containsScore ? "#0f172a" : "#94a3b8", fontWeight: b.containsScore ? 800 : 400 }}>{b.count}</div>
            <div
              title={`${b.count} deals scored ${b.label}`}
              style={{
                width: "100%",
                height: `${Math.max(4, (b.count / maxBucket) * 52)}px`,
                background: b.containsScore ? pctColor : "#e2e8f0",
                borderRadius: "4px 4px 0 0",
              }}
            />
            <div style={{ fontSize: 10, color: b.containsScore ? "#0f172a" : "#94a3b8", fontWeight: b.containsScore ? 700 : 400 }}>{b.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginTop: 10 }}>
        {data.p25 != null && <span>25th pct: <b style={{ color: "#334155" }}>{Math.round(data.p25)}</b></span>}
        {data.median != null && <span>median: <b style={{ color: "#334155" }}>{Math.round(data.median)}</b></span>}
        {data.p75 != null && <span>75th pct: <b style={{ color: "#334155" }}>{Math.round(data.p75)}</b></span>}
        {data.best != null && <span>best seen: <b style={{ color: "#334155" }}>{Math.round(data.best)}</b></span>}
      </div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10 }}>{data.disclaimer}</div>
    </div>
  );
}

// ─── Full result body (shared by both pages) ──────────────────────────────────

/** Shows how much of the score is backed by the plan's own numbers vs sector priors. */
function SignalCoverageChip({ coverage, fields }: { coverage: number; fields: number }) {
  const pct = Math.round(coverage * 100);
  const color = pct >= 40 ? "#16a34a" : pct >= 15 ? "#d97706" : "#64748b";
  const label = pct >= 40 ? "company-specific" : pct >= 15 ? "partly company-specific" : "sector-based";
  return (
    <div
      title="Share of the composite score backed by metrics disclosed in the plan (revenue, growth, margin, LTV/CAC…) rather than sector averages. Add financials to raise it."
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10,
        padding: "5px 10px", borderRadius: 999, background: "#f8fafc",
        border: `1px solid ${color}33`, fontSize: 12, color: "#334155",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span><b style={{ color }}>{pct}%</b> signal coverage · {label}</span>
      <span style={{ color: "#94a3b8" }}>({fields} metric{fields === 1 ? "" : "s"} parsed)</span>
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
            <div style={{ fontSize: 13, color: "#64748b" }}>{result.result.sector.label} · {result.result.stage}</div>
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
                  padding: "8px 16px", background: "#fff", color: "#7c3aed",
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
        <h2 style={H2}>Investment memo</h2>
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#1e293b", lineHeight: 1.6, margin: 0 }}>{result.result.council.memo}</p>
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10 }}>
          Narrative engine: {result.result.council.aiUsed ? `live model (${result.result.council.aiProvider})` : "deterministic (no AI key configured)"}
        </div>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Entry strategy</h2>
        <StrategyPanel s={result.result.strategy} />
      </div>

      <ComparablesBlock sectorLabel={result.result.sector.label} stage={result.result.stage} />

      <div style={SECTION}>
        <h2 style={H2}>Score breakdown</h2>
        <div style={{ marginBottom: 12 }}>
          <DataProvenanceChip
            dataQuality={ventureDataQuality(result.result.factors)}
            labels={{ measured: "из данных стартапа", derived: "секторный бенчмарк", guessed: "нет данных", unit: "факторов" }}
          />
        </div>
        {result.result.factors.map((f) => <FactorBar key={f.key} f={f} />)}
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Analyst council</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {result.result.council.lenses.map((l) => <LensCard key={l.lens} lens={l} />)}
        </div>
      </div>

      {result.result.sector.sources && result.result.sector.sources.length > 0 && (
        <div style={SECTION}>
          <h2 style={{ ...H2, marginBottom: 6 }}>Market data sources</h2>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#64748b" }}>
            Market-size and growth figures for {result.result.sector.label} are anchored to recent third-party research:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
            {result.result.sector.sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
                  {s.publisher} ({s.year})
                </a>
                <span style={{ color: "#475569" }}> — {s.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ ...SECTION, background: "#fffbeb", borderColor: "#fde68a" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Assumptions & limitations</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#78350f" }}>
          {result.result.assumptions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
        </ul>
      </div>
    </>
  );
}
