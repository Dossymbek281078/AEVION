"use client";

// Shared QVenture result view — used by the interactive /qventure page and the
// public read-only /qventure/a/[id] share page. Keeps a single source of truth
// for the memo layout so the shared page looks identical to the live result.

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { isSaved, toggleWatchlist } from "./_watchlist";

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
    sector: { label: string; sources?: SectorSource[] };
    stage: string;
    council: { lenses: Lens[]; memo: string; aiUsed: boolean; aiProvider: string };
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

// ─── Full result body (shared by both pages) ──────────────────────────────────

export function ResultView({ result, shared = false }: { result: AnalysisResult; shared?: boolean }) {
  return (
    <>
      <div style={SECTION}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ ...H2, marginBottom: 4 }}>{result.name}</h2>
            <div style={{ fontSize: 13, color: "#64748b" }}>{result.result.sector.label} · {result.result.stage}</div>
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

      <div style={SECTION}>
        <h2 style={H2}>Score breakdown</h2>
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
