"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import ModulePricingChip from "@/components/ModulePricingChip";
import { apiUrl } from "@/lib/apiBase";
import paper from "@/styles/aevionPaper.module.css";
import {
  ResultView, ScoreGauge, STAGES, VERDICT_COLOR, VERDICT_LABEL,
  SECTION, H2, SERIF, type AnalysisResult, type Verdict,
} from "./_result";

interface SectorOption { id: string; label: string; }

// One-click showcase: a realistic seed-stage opportunity so a first-time
// visitor sees a full memo without typing anything.
const SAMPLE = {
  name: "NeuroDx",
  sector: "healthtech",
  stage: "seed" as (typeof STAGES)[number],
  geography: "US",
  askUsd: "6,000,000",
  description:
    "FDA-pathway diagnostic that detects early-stage Alzheimer's from a standard retinal scan using a self-supervised vision model, turning any optometrist's chair into a screening point years before symptom onset.",
  tractionNotes:
    "$55k MRR across 14 clinics growing 22% MoM, breakthrough-device designation filed, 89% sensitivity vs PET baseline in a 1,200-patient cohort, LTV/CAC 5.1x.",
};

type FormShape = {
  name: string; sector: string; stage: (typeof STAGES)[number];
  geography: string; askUsd: string; description: string; tractionNotes: string;
  // Optional exact financials — override the text parser for precise scoring.
  finArr: string; finGrossMargin: string; finLtvCac: string; finChurn: string;
  // Churn only means something with its period: 4%/mo and 4%/yr are different companies.
  finChurnPeriod: "weekly" | "monthly" | "quarterly" | "annual";
  finCustomers: string; finGrowth: string; finGrowthPeriod: "WoW" | "MoM" | "YoY"; finTam: string;
  // Optional 3-year revenue projection (this year, +1, +2).
  projY0: string; projY1: string; projY2: string;
};
const emptyForm = (): FormShape => ({
  name: "", sector: "ai_app", stage: "seed", geography: "US", askUsd: "", description: "", tractionNotes: "",
  finArr: "", finGrossMargin: "", finLtvCac: "", finChurn: "", finChurnPeriod: "monthly",
  finCustomers: "", finGrowth: "", finGrowthPeriod: "MoM", finTam: "",
  projY0: "", projY1: "", projY2: "",
});

const INPUT: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 4, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: "var(--card, #fffefb)", color: "var(--ink, #17181a)" };
const LABEL: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint, #74767c)", marginBottom: 5 };

// Pure request helper — returns the analysis or an error string, no state.
async function analyzeReq(data: FormShape): Promise<{ ok: true; data: AnalysisResult } | { ok: false; error: string }> {
  if (!data.name.trim()) return { ok: false, error: "Company / product name is required." };
  if (data.description.trim().length < 12) return { ok: false, error: "Add a longer description (min 12 characters)." };
  try {
    const payload: Record<string, unknown> = {
      name: data.name.trim(), sector: data.sector, stage: data.stage,
      geography: data.geography.trim() || "US", description: data.description.trim(),
      tractionNotes: data.tractionNotes.trim() || undefined,
    };
    const ask = parseFloat(data.askUsd.replace(/[^0-9.]/g, ""));
    if (isFinite(ask) && ask > 0) payload.askUsd = ask;

    // Optional exact financials → override the text parser.
    const num = (s: string) => { const v = parseFloat((s || "").replace(/[^0-9.]/g, "")); return isFinite(v) && v > 0 ? v : undefined; };
    const financials: Record<string, number> = {};
    const map: [string, string][] = [
      ["arrUsd", data.finArr], ["grossMarginPct", data.finGrossMargin], ["ltvCacRatio", data.finLtvCac],
      ["churnPct", data.finChurn], ["customers", data.finCustomers], ["growthPct", data.finGrowth], ["bottomUpTamUsd", data.finTam],
    ];
    for (const [k, v] of map) { const n = num(v); if (n !== undefined) financials[k] = n; }
    if (Object.keys(financials).length) {
      // Periods travel with their figures — without them the engine has to assume.
      const withPeriods: Record<string, unknown> = { ...financials };
      if (financials.churnPct !== undefined) withPeriods.churnPeriod = data.finChurnPeriod;
      if (financials.growthPct !== undefined) withPeriods.growthPeriod = data.finGrowthPeriod;
      payload.financials = withPeriods;
    }

    // Optional 3-year projection.
    const y0 = new Date().getFullYear();
    const proj = [data.projY0, data.projY1, data.projY2]
      .map((v, i) => ({ year: y0 + i, revenueUsd: num(v) }))
      .filter((p) => p.revenueUsd !== undefined)
      .map((p) => ({ year: p.year, revenueUsd: p.revenueUsd as number }));
    if (proj.length >= 2) payload.projections = proj;

    const res = await fetch(apiUrl("/api/qventure/analyze"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error || "Analysis failed." };
    return { ok: true, data: j.data as AnalysisResult };
  } catch {
    return { ok: false, error: "Network error — is the backend running?" };
  }
}

export default function QVenturePage() {
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [mode, setMode] = useState<"single" | "compare">("single");

  useEffect(() => {
    fetch(apiUrl("/api/qventure/sectors"))
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j?.data)) setSectors(j.data); })
      .catch(() => { /* non-fatal — dropdown falls back to empty */ });
  }, []);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
       <div className={paper.paper} style={{ background: "transparent", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <ModulePricingChip moduleId="qventure" theme="light" />
        </div>

        {/* Masthead — newspaper treatment: kicker rule, serif headline. */}
        <div style={{ borderTop: "3px solid var(--rule-bold, #17181a)", paddingTop: 14, marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: "0.32em", textTransform: "uppercase" }}>AEVION · QVenture</div>
          <h1 style={{ margin: "8px 0 10px", fontFamily: SERIF, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink, #17181a)", lineHeight: 1.1 }}>
            AI Investment Analyst for Any Business
          </h1>
          <p style={{ margin: 0, fontSize: 15.5, color: "var(--ink-soft, #45474c)", maxWidth: 760, lineHeight: 1.55 }}>
            Fund-grade due diligence in seconds. A transparent quant score, a four-role expert council
            (scientist · data analyst · economist · lawyer), and a concrete entry strategy — how much to
            invest, at what valuation, staged over which milestones, for what risk-adjusted return.
          </p>
          <Link href="/qventure/a/demo-neurodx" style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12,
            fontSize: 14, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none",
            borderBottom: "1px solid color-mix(in srgb, var(--teal, #0a7d72) 45%, transparent)",
          }}>
            See a live example → <span style={{ fontWeight: 400, color: "var(--ink-faint, #74767c)" }}>(NeuroDx report)</span>
          </Link>
        </div>

        {/* Mode switch + watchlist link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--paper-2, #efeee8)", borderRadius: 10 }}>
            {(["single", "compare"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13.5, fontWeight: 700,
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "var(--teal-deep, #075b53)" : "#64748b",
                boxShadow: mode === m ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
              }}>
                {m === "single" ? "Analyze one" : "⚖ Compare two"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/qventure/batch" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ☰ Batch funnel →
            </Link>
            <Link href="/qventure/gallery" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ▦ Examples →
            </Link>
            <Link href="/qventure/watchlist" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ★ Watchlist →
            </Link>
          </div>
        </div>

        {mode === "single"
          ? <SinglePanel sectors={sectors} />
          : <ComparePanel sectors={sectors} />}

        <MarketingSections />
       </div>
      </ProductPageShell>
    </>
  );
}

// ─── Marketing block ──────────────────────────────────────────────────────────

function MarketingSections() {
  const steps = [
    { icon: "📝", title: "Describe the deal", body: "Company, sector, stage, and a paragraph on what it does. Traction is optional but sharpens the execution score." },
    { icon: "🧠", title: "AI runs the analysis", body: "A deterministic 0–100 quant score across 8 factors, then a four-role expert council writes the memo and entry strategy." },
    { icon: "📊", title: "Act on the memo", body: "Verdict, ticket size, valuation band, staged tranches, and risk-adjusted return — export to PDF, save, or share." },
  ];
  const audience = [
    { icon: "👼", label: "Angel investors", body: "Screen inbound in seconds; write with conviction, not vibes." },
    { icon: "🏦", label: "Micro-VCs & solo GPs", body: "A repeatable rubric across every deal in the pipeline." },
    { icon: "🔭", label: "Scouts", body: "Turn a founder chat into a shareable, fund-grade memo." },
    { icon: "🤝", label: "Syndicates", body: "Align the group with one transparent score and strategy." },
  ];
  const trust = [
    ["Deterministic", "The score is reproducible math, not a black box."],
    ["18 sectors", "Grounded in a curated market knowledge base."],
    ["4 experts", "Scientist · data analyst · economist · lawyer."],
    ["Transparent", "Every factor shows its weight and rationale."],
  ];
  return (
    <div style={{ marginTop: 28 }}>
      <div style={SECTION}>
        <h2 style={H2}>How it works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ padding: "4px 4px" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal-deep, #075b53)" }}>STEP {i + 1}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink, #17181a)", margin: "2px 0 6px" }}>{s.title}</div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#475569", lineHeight: 1.5 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Who it&apos;s for</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {audience.map((a, i) => (
            <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink, #17181a)" }}>{a.label}</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...SECTION, background: "var(--ink, #17181a)", borderColor: "transparent" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {trust.map(([k, v], i) => (
            <div key={i}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--teal, #0a7d72)" }}>{k}</div>
              <div style={{ fontSize: 12.5, color: "#cbd5e1", marginTop: 3, lineHeight: 1.4 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11.5, color: "#94a3b8" }}>
          QVenture is an AI screening tool for research purposes — not investment advice, an offer, or a solicitation. Figures are model estimates, not guarantees.
          {" "}
          {/* Доступ выдаётся по почте подписки: planGate спрашивает
              hasActiveAppSubscription(plan.email, "qventure"), а plan.email берётся
              из токена входа. Модуль при этом работает и анонимно, поэтому
              человек может оплатить подписку и не связать покупку с собой —
              сегодня это незаметно (платная стена включена у 6 модулей из 43,
              QVenture среди них нет), но включение стены и есть запуск.
              Строка на языке окружающего блока: язык интерфейса модуля —
              открытый вопрос к основателю, и вводить второй язык внутри
              одного абзаца хуже, чем следовать соседнему тексту. */}
          Paid access is tied to the email on your subscription — sign in with that
          same email after paying, or the analyses stay on the free tier.
        </div>
      </div>
    </div>
  );
}

// ─── Single analysis ──────────────────────────────────────────────────────────

function SinglePanel({ sectors }: { sectors: SectorOption[] }) {
  const [form, setForm] = useState<FormShape>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const set = (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = useCallback(async (data: FormShape) => {
    setError(null); setLoading(true); setResult(null);
    const r = await analyzeReq(data);
    if (r.ok) setResult(r.data); else setError(r.error);
    setLoading(false);
  }, []);

  const runSample = useCallback(() => {
    const s: FormShape = { ...emptyForm(), ...SAMPLE };
    setForm(s);
    run(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [run]);

  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDeckFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-selected later
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setExtractNote("Please upload a PDF pitch deck."); return;
    }
    setExtracting(true); setError(null); setExtractNote(null);
    try {
      const res = await fetch(apiUrl("/api/qventure/extract"), {
        method: "POST", headers: { "Content-Type": "application/pdf" }, body: file,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setExtractNote(j?.hint || j?.error || "Could not read that deck — enter the details manually."); return; }
      const d = j.data;
      const fin = d.financials || {};
      const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? String(v) : "");
      const proj: Array<{ year: number; revenueUsd: number }> = Array.isArray(d.projections) ? d.projections : [];
      const projRev = (i: number) => (proj[i] && isFinite(proj[i].revenueUsd) ? String(proj[i].revenueUsd) : "");
      setForm({
        ...emptyForm(),
        name: d.name || "",
        sector: d.sector || "ai_app",
        stage: ((STAGES as readonly string[]).includes(d.stage) ? d.stage : "seed") as FormShape["stage"],
        geography: d.geography || "US",
        askUsd: d.askUsd ? String(d.askUsd) : "",
        description: d.description || "",
        tractionNotes: d.tractionNotes || "",
        finArr: num(fin.arrUsd),
        finGrossMargin: num(fin.grossMarginPct),
        finLtvCac: num(fin.ltvCacRatio),
        finChurn: num(fin.churnPct),
        // Keep the period the deck stated; only fall back to the default when it said nothing.
        finChurnPeriod: (["weekly", "monthly", "quarterly", "annual"].includes(fin.churnPeriod) ? fin.churnPeriod : "monthly") as FormShape["finChurnPeriod"],
        finCustomers: num(fin.customers),
        finGrowth: num(fin.growthPct),
        finGrowthPeriod: (["WoW", "MoM", "YoY"].includes(fin.growthPeriod) ? fin.growthPeriod : "MoM") as FormShape["finGrowthPeriod"],
        finTam: num(fin.bottomUpTamUsd),
        projY0: projRev(0),
        projY1: projRev(1),
        projY2: projRev(2),
      });
      const gotExact = Object.values(fin).some((v) => typeof v === "number" && v) || proj.length > 0;
      setExtractNote(
        (d.aiUsed
          ? "✓ Pre-filled from your deck (AI-parsed). "
          : "✓ Pre-filled from your deck (text-parsed). ") +
          (gotExact ? "Exact financials filled in below — review and run the analysis." : "Review the fields and run the analysis."),
      );
    } catch {
      setExtractNote("Upload failed — check your connection and try again.");
    } finally {
      setExtracting(false);
    }
  }, []);

  return (
    <>
      <div style={SECTION}>
        <h2 style={H2}>Analyze an opportunity</h2>
        <div style={{ border: "1px dashed var(--rule-mid, #b9b8b0)", background: "var(--paper-2, #efeee8)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onDeckFile} style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={extracting || loading} style={{
            padding: "10px 18px", background: extracting ? "var(--teal, #0a7d72)" : "var(--teal-deep, #075b53)", color: "#fff", border: "none",
            borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: extracting ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
            {extracting ? "Reading deck…" : "📄 Upload pitch deck (PDF)"}
          </button>
          <span style={{ fontSize: 12.5, color: extractNote ? "var(--teal-deep, #075b53)" : "#94a3b8", fontWeight: extractNote ? 600 : 400 }}>
            {extractNote || "We extract the fields and pre-fill the form — you review, then run."}
          </span>
        </div>
        <FormFields form={form} set={set} sectors={sectors} full />
        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => run(form)} disabled={loading} style={primaryBtn(loading)}>
            {loading ? "Analyzing…" : "Run analysis"}
          </button>
          <button onClick={runSample} disabled={loading} type="button" style={ghostBtn(loading)}>
            ✨ See a sample analysis
          </button>
          <span style={{ fontSize: 12.5, color: "#94a3b8" }}>No input needed — loads a real seed-stage case.</span>
        </div>
      </div>
      {result && <ResultView result={result} />}
    </>
  );
}

// ─── Compare two ──────────────────────────────────────────────────────────────

function ComparePanel({ sectors }: { sectors: SectorOption[] }) {
  const [a, setA] = useState<FormShape>(() => ({ ...emptyForm(), name: "Company A" }));
  const [b, setB] = useState<FormShape>(() => ({ ...emptyForm(), name: "Company B" }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<[AnalysisResult, AnalysisResult] | null>(null);

  const setter = (which: "a" | "b") => (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const upd = (f: FormShape) => ({ ...f, [k]: e.target.value });
    if (which === "a") setA(upd); else setB(upd);
  };

  const run = useCallback(async () => {
    setError(null); setLoading(true); setPair(null);
    const [ra, rb] = await Promise.all([analyzeReq(a), analyzeReq(b)]);
    if (!ra.ok) { setError(`Company A: ${ra.error}`); setLoading(false); return; }
    if (!rb.ok) { setError(`Company B: ${rb.error}`); setLoading(false); return; }
    setPair([ra.data, rb.data]);
    setLoading(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [a, b]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {([["a", a], ["b", b]] as const).map(([which, f]) => (
          <div key={which} style={SECTION}>
            <h2 style={H2}>{which === "a" ? "Company A" : "Company B"}</h2>
            <FormFields form={f} set={setter(which)} sectors={sectors} />
          </div>
        ))}
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={run} disabled={loading} style={{ ...primaryBtn(loading), marginBottom: 18 }}>
        {loading ? "Analyzing both…" : "⚖ Compare"}
      </button>
      {pair && <CompareResult a={pair[0]} b={pair[1]} />}
    </>
  );
}

function CompareResult({ a, b }: { a: AnalysisResult; b: AnalysisResult }) {
  const winner = a.composite === b.composite ? null : a.composite > b.composite ? "a" : "b";
  const head = (r: AnalysisResult, side: "a" | "b") => (
    <div style={{
      ...SECTION, flex: "1 1 300px", marginBottom: 0,
      borderColor: winner === side ? "var(--teal-deep, #075b53)" : "#e2e8f0",
      borderWidth: winner === side ? 2 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h2 style={{ ...H2, marginBottom: 4 }}>{r.name}</h2>
          <div style={{ fontSize: 13, color: "#64748b" }}>{r.result.sector.label} · {r.result.stage}</div>
          {winner === side && <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal-deep, #075b53)", marginTop: 6 }}>◆ Higher score</div>}
        </div>
      </div>
      <div style={{ marginTop: 12 }}><ScoreGauge score={r.composite} verdict={r.verdict} size={104} /></div>
    </div>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        {head(a, "a")}
        {head(b, "b")}
      </div>
      <div style={{ marginBottom: 18 }}>
        <a
          href={apiUrl(`/api/qventure/compare/pdf?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", background: "#fff", color: "var(--teal-deep, #075b53)",
            border: "1px solid #ddd6fe", borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none",
          }}
        >
          ⬇ Export comparison to PDF
        </a>
      </div>

      <div style={SECTION}>
        <h2 style={H2}>Factor-by-factor delta</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12 }}>
                <th style={{ padding: "6px 8px" }}>Factor</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>{a.name}</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>{b.name}</th>
                <th style={{ padding: "6px 8px", textAlign: "center" }}>Δ (B−A)</th>
              </tr>
            </thead>
            <tbody>
              {a.result.factors.map((fa) => {
                const fb = b.result.factors.find((x) => x.key === fa.key);
                const bs = fb ? fb.score : 0;
                const delta = bs - fa.score;
                const dColor = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#94a3b8";
                return (
                  <tr key={fa.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px", color: "var(--ink, #17181a)", fontWeight: 600 }}>{fa.label}
                      <span style={{ color: "#94a3b8", fontWeight: 400 }}> · {Math.round(fa.weight * 100)}%</span></td>
                    <td style={{ padding: "8px", textAlign: "center", color: "#334155" }}>{fa.score}</td>
                    <td style={{ padding: "8px", textAlign: "center", color: "#334155" }}>{bs}</td>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: dColor }}>
                      {delta > 0 ? "+" : ""}{delta}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                <td style={{ padding: "8px", fontWeight: 800, color: "var(--ink, #17181a)" }}>Composite</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800 }}>{a.composite}</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800 }}>{b.composite}</td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: 800, color: b.composite - a.composite >= 0 ? "#16a34a" : "#dc2626" }}>
                  {b.composite - a.composite > 0 ? "+" : ""}{Math.round((b.composite - a.composite) * 10) / 10}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Verdict + one-line memo per side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {([a, b] as const).map((r) => (
          <div key={r.id} style={SECTION}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ padding: "4px 12px", borderRadius: 999, background: VERDICT_COLOR[r.verdict], color: "#fff", fontWeight: 800, fontSize: 13 }}>
                {VERDICT_LABEL[r.verdict as Verdict]}
              </span>
              <strong style={{ color: "var(--ink, #17181a)" }}>{r.name}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{firstSentences(r.result.council.memo)}</p>
            <a href={apiUrl(`/api/qventure/analyses/${r.id}/pdf`)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--teal-deep, #075b53)", textDecoration: "none" }}>
              ⬇ PDF memo
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function firstSentences(text: string, max = 2): string {
  const parts = text.split(/(?<=[.!?])\s+/).slice(0, max);
  return parts.join(" ");
}

// ─── Shared form fields ───────────────────────────────────────────────────────

function FormFields({ form, set, sectors, full = false }: {
  form: FormShape;
  set: (k: keyof FormShape) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  sectors: SectorOption[];
  full?: boolean;
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={LABEL}>Company / product name *</label>
          <input aria-label="Company / product name" style={INPUT} value={form.name} onChange={set("name")} placeholder="e.g. NeuroDx" />
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
        {full && (
          <>
            <div>
              <label style={LABEL}>Target market</label>
              <input aria-label="Target market" style={INPUT} value={form.geography} onChange={set("geography")} placeholder="US" />
            </div>
            <div>
              <label style={LABEL}>Raising (USD, optional)</label>
              <input aria-label="Raising (USD, optional)" style={INPUT} value={form.askUsd} onChange={set("askUsd")} placeholder="5,000,000" inputMode="numeric" />
            </div>
          </>
        )}
      </div>
      <div style={{ marginBottom: full ? 14 : 0 }}>
        <label style={LABEL}>What does it do? *</label>
        <textarea style={{ ...INPUT, minHeight: 72, resize: "vertical" }} value={form.description} onChange={set("description")}
          aria-label="What does it do?" placeholder="One-paragraph description of the product, the problem it solves, and the wedge." />
      </div>
      {full && (
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Traction / metrics</label>
          <textarea style={{ ...INPUT, minHeight: 56, resize: "vertical" }} value={form.tractionNotes} onChange={set("tractionNotes")}
            aria-label="Traction / metrics" placeholder="e.g. $40k MRR growing 18% MoM, 3 enterprise pilots, 92% retention, LTV/CAC 4.2x" />
          {/* Execution carries 28% of the composite and scores low — not neutral — when
              nothing is submitted. Saying so here beats letting someone submit an empty
              field and be surprised by the number. */}
          {!form.tractionNotes.trim() && (
            <div style={{
              marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "#92400e",
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 11px",
            }}>
              Leaving this empty caps the score at about 58 — no submission without metrics has
              ever reached &ldquo;invest&rdquo;. Execution is 28% of the total and counts as unproven,
              not neutral. Any real figure moves it: revenue, customers, growth, retention.
            </div>
          )}
        </div>
      )}
      {full && (
        <details style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", background: "#f8fafc" }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#334155" }}>
            Exact financials & projections (optional — precise numbers beat parsing the text)
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
            <div><label style={LABEL}>ARR (USD)</label><input aria-label="ARR (USD)" style={INPUT} value={form.finArr} onChange={set("finArr")} placeholder="3,000,000" inputMode="numeric" /></div>
            <div><label style={LABEL}>Gross margin (%)</label><input aria-label="Gross margin (%)" style={INPUT} value={form.finGrossMargin} onChange={set("finGrossMargin")} placeholder="82" inputMode="numeric" /></div>
            <div><label style={LABEL}>LTV / CAC ratio</label><input aria-label="LTV / CAC ratio" style={INPUT} value={form.finLtvCac} onChange={set("finLtvCac")} placeholder="4" inputMode="numeric" /></div>
            <div>
              <label style={LABEL}>Churn (%)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...INPUT, flex: 1 }} value={form.finChurn} onChange={set("finChurn")} aria-label="Churn (%)" placeholder="3" inputMode="numeric" />
                <select style={{ ...INPUT, width: 104 }} value={form.finChurnPeriod} onChange={set("finChurnPeriod")} aria-label="Churn period">
                  <option value="weekly">/ week</option>
                  <option value="monthly">/ month</option>
                  <option value="quarterly">/ quarter</option>
                  <option value="annual">/ year</option>
                </select>
              </div>
            </div>
            <div><label style={LABEL}>Customers</label><input aria-label="Customers" style={INPUT} value={form.finCustomers} onChange={set("finCustomers")} placeholder="2,000" inputMode="numeric" /></div>
            <div>
              <label style={LABEL}>Growth (%)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...INPUT, flex: 1 }} value={form.finGrowth} onChange={set("finGrowth")} aria-label="Growth (%)" placeholder="15" inputMode="numeric" />
                <select style={{ ...INPUT, width: 104 }} value={form.finGrowthPeriod} onChange={set("finGrowthPeriod")} aria-label="Growth period">
                  <option value="WoW">WoW</option>
                  <option value="MoM">MoM</option>
                  <option value="YoY">YoY</option>
                </select>
              </div>
            </div>
            <div><label style={LABEL}>Bottom-up TAM (USD)</label><input aria-label="Bottom-up TAM (USD)" style={INPUT} value={form.finTam} onChange={set("finTam")} placeholder="12,000,000,000" inputMode="numeric" /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={LABEL}>Projected revenue (USD) — this year / +1yr / +2yr (for the hockey-stick check)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <input style={INPUT} aria-label="Projected revenue this year" value={form.projY0} onChange={set("projY0")} placeholder="Y0: 2,000,000" inputMode="numeric" />
              <input style={INPUT} aria-label="Projected revenue +1yr" value={form.projY1} onChange={set("projY1")} placeholder="Y1: 5,000,000" inputMode="numeric" />
              <input style={INPUT} aria-label="Projected revenue +2yr" value={form.projY2} onChange={set("projY2")} placeholder="Y2: 12,000,000" inputMode="numeric" />
            </div>
          </div>
        </details>
      )}
    </>
  );
}

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  padding: "12px 28px", background: loading ? "var(--ink-faint, #74767c)" : "var(--teal-deep, #075b53)", color: "#fff", border: "none",
  borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer",
});
const ghostBtn = (loading: boolean): React.CSSProperties => ({
  padding: "12px 22px", background: "#fff", color: "var(--teal-deep, #075b53)", border: "1px solid #ddd6fe",
  borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
});
