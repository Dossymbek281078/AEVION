"use client";

import { useEffect, useState, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import ModulePricingChip from "@/components/ModulePricingChip";
import { apiUrl } from "@/lib/apiBase";

// ─── Types (mirror backend engine.ts) ────────────────────────────────────────

type Verdict = "invest" | "watch" | "pass";

interface ScoreFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  rationale: string;
}

interface Lens {
  lens: string;
  role: string;
  headline: string;
  points: string[];
  risks: string[];
}

interface Strategy {
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

interface AnalysisResult {
  id: string;
  name: string;
  composite: number;
  verdict: Verdict;
  result: {
    factors: ScoreFactor[];
    strategy: Strategy;
    assumptions: string[];
    sector: { label: string };
    stage: string;
    council: { lenses: Lens[]; memo: string; aiUsed: boolean; aiProvider: string };
  };
}

interface SectorOption { id: string; label: string; }

const STAGES = ["idea", "pre-seed", "seed", "series-a", "growth"] as const;

const VERDICT_COLOR: Record<Verdict, string> = { invest: "#16a34a", watch: "#d97706", pass: "#dc2626" };
const VERDICT_LABEL: Record<Verdict, string> = { invest: "INVEST", watch: "WATCH", pass: "PASS" };
const LENS_ICON: Record<string, string> = { scientist: "🔬", data_analyst: "📊", economist: "📈", lawyer: "⚖️" };

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const mm = (n: number) => "$" + (n / 1e6).toFixed(1) + "M";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const color = VERDICT_COLOR[verdict];
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        background: `conic-gradient(${color} ${pct * 3.6}deg, #e2e8f0 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <div style={{
          width: 92, height: 92, borderRadius: "50%", background: "#fff",
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

function FactorBar({ f }: { f: ScoreFactor }) {
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

function LensCard({ lens }: { lens: Lens }) {
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

function StrategyPanel({ s }: { s: Strategy }) {
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

// ─── Main page ────────────────────────────────────────────────────────────────

const SECTION: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, background: "#fff", marginBottom: 18 };
const H2: React.CSSProperties = { margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#0f172a" };
const INPUT: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const LABEL: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 4 };

export default function QVenturePage() {
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [form, setForm] = useState({
    name: "", sector: "ai_app", stage: "seed" as (typeof STAGES)[number],
    geography: "US", askUsd: "", description: "", tractionNotes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/qventure/sectors"))
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setSectors(j.data); })
      .catch(() => { /* non-fatal — dropdown falls back to empty */ });
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useCallback(async () => {
    setError(null);
    if (!form.name.trim()) { setError("Company / product name is required."); return; }
    if (form.description.trim().length < 12) { setError("Add a longer description (min 12 characters)."); return; }
    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), sector: form.sector, stage: form.stage,
        geography: form.geography.trim() || "US", description: form.description.trim(),
        tractionNotes: form.tractionNotes.trim() || undefined,
      };
      const ask = parseFloat(form.askUsd.replace(/[^0-9.]/g, ""));
      if (isFinite(ask) && ask > 0) payload.askUsd = ask;

      const res = await fetch(apiUrl("/api/qventure/analyze"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setError(j?.error || "Analysis failed."); return; }
      setResult(j.data as AnalysisResult);
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [form]);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <ModulePricingChip moduleId="qventure" theme="light" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", letterSpacing: 1, textTransform: "uppercase" }}>AEVION · QVenture</div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
            AI Investment Analyst for Any Business
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#475569", maxWidth: 760 }}>
            Fund-grade due diligence in seconds. A transparent quant score, a four-role expert council
            (scientist · data analyst · economist · lawyer), and a concrete entry strategy — how much to
            invest, at what valuation, staged over which milestones, for what risk-adjusted return.
          </p>
        </div>

        {/* Input form */}
        <div style={SECTION}>
          <h2 style={H2}>Analyze an opportunity</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={LABEL}>Company / product name *</label>
              <input style={INPUT} value={form.name} onChange={set("name")} placeholder="e.g. NeuroDx" />
            </div>
            <div>
              <label style={LABEL}>Sector</label>
              <select style={INPUT} value={form.sector} onChange={set("sector")}>
                {sectors.length === 0 && <option value="ai_app">AI Applications</option>}
                {sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Stage</label>
              <select style={INPUT} value={form.stage} onChange={set("stage")}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Target market</label>
              <input style={INPUT} value={form.geography} onChange={set("geography")} placeholder="US" />
            </div>
            <div>
              <label style={LABEL}>Raising (USD, optional)</label>
              <input style={INPUT} value={form.askUsd} onChange={set("askUsd")} placeholder="5,000,000" inputMode="numeric" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>What does it do? *</label>
            <textarea style={{ ...INPUT, minHeight: 72, resize: "vertical" }} value={form.description} onChange={set("description")}
              placeholder="One-paragraph description of the product, the problem it solves, and the wedge." />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>Traction / metrics (optional — improves the execution score)</label>
            <textarea style={{ ...INPUT, minHeight: 56, resize: "vertical" }} value={form.tractionNotes} onChange={set("tractionNotes")}
              placeholder="e.g. $40k MRR growing 18% MoM, 3 enterprise pilots, 92% retention, LTV/CAC 4.2x" />
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{
            padding: "12px 28px", background: loading ? "#94a3b8" : "#7c3aed", color: "#fff", border: "none",
            borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer",
          }}>
            {loading ? "Analyzing…" : "Run analysis"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <>
            <div style={SECTION}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h2 style={{ ...H2, marginBottom: 4 }}>{result.name}</h2>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{result.result.sector.label} · {result.result.stage}</div>
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

            <div style={{ ...SECTION, background: "#fffbeb", borderColor: "#fde68a" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Assumptions & limitations</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#78350f" }}>
                {result.result.assumptions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
              </ul>
            </div>
          </>
        )}
      </ProductPageShell>
    </>
  );
}
