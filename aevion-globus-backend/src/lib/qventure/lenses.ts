/**
 * QVenture — Multi-Role Analyst Lenses (LLM layer)
 * ────────────────────────────────────────────────
 * Four expert personas review the deal in parallel, then a synthesis pass
 * writes the investment memo. Each lens is *grounded* by the deterministic
 * engine output (engine.ts) so the qualitative narrative stays anchored to the
 * numbers rather than free-floating.
 *
 * Fully degradable: if no AI provider is configured (provider resolves to
 * "stub") or a call fails, every lens falls back to a deterministic narrative
 * derived from the engine result — so the endpoint always returns useful,
 * offline-safe output.
 */

import {
  callProvider,
  pickConfiguredProvider,
  getProviders,
  type ChatMessage,
} from "../../services/qcoreai/providers";
import type { AnalysisInput, AnalysisResult } from "./engine";

export type LensId = "scientist" | "data_analyst" | "economist" | "lawyer";

export interface LensOutput {
  lens: LensId;
  role: string;
  headline: string;
  points: string[];
  risks: string[];
}

export interface MemoOutput {
  lenses: LensOutput[];
  memo: string;
  aiProvider: string;
  aiUsed: boolean;
}

const ROLE_META: Record<LensId, { role: string; brief: string }> = {
  scientist: {
    role: "Research Scientist",
    brief:
      "Assess the evidence base and technological feasibility. Cite the relevant scientific / R&D frontier, whether the approach is grounded in credible research, technical risk, and what breakthrough would de-risk it. Be skeptical of hand-wavy science.",
  },
  data_analyst: {
    role: "Data Analyst",
    brief:
      "Interrogate the numbers: TAM/SAM/SOM logic, unit economics (gross margin, CAC/LTV, payback), comparable multiples, and what metrics would confirm or kill the thesis. Flag where data is missing.",
  },
  economist: {
    role: "Economist",
    brief:
      "Analyze market structure through the lens of market-economy dynamics: demand elasticity, supply-side moats, competitive equilibrium, network effects, macro sensitivity, and where durable economic rents accrue.",
  },
  lawyer: {
    role: "Corporate & Regulatory Lawyer",
    brief:
      "Map the legal and regulatory surface for the target geography: licensing, compliance regimes, IP posture, data/privacy exposure, liability, and deal-structure terms that protect the investor. Note jurisdiction-specific risk.",
  },
};

function providerDefaultModel(providerId: string): string {
  const p = getProviders().find((x) => x.id === providerId);
  return p?.defaultModel || "claude-opus-4-8";
}

function dealContext(input: AnalysisInput, result: AnalysisResult): string {
  const factorLines = result.factors
    .map((f) => `  - ${f.label}: ${f.score}/100 (weight ${Math.round(f.weight * 100)}%) — ${f.rationale}`)
    .join("\n");
  return [
    `COMPANY: ${input.name}`,
    `SECTOR: ${result.sector.label}`,
    `STAGE: ${result.stage}`,
    `GEOGRAPHY: ${input.geography || "US"}`,
    input.askUsd ? `RAISING: $${input.askUsd.toLocaleString("en-US")}` : `RAISING: undisclosed`,
    `DESCRIPTION: ${input.description}`,
    input.tractionNotes ? `TRACTION: ${input.tractionNotes}` : `TRACTION: none disclosed`,
    ``,
    `QUANT MODEL — composite ${result.composite}/100, verdict "${result.verdict}":`,
    factorLines,
    ``,
    `SECTOR FRONTIER: ${result.sector.scienceFrontier}`,
    `STRUCTURAL RISK: ${result.sector.structuralRisk}`,
  ].join("\n");
}

async function runLens(
  lens: LensId,
  provider: string,
  input: AnalysisInput,
  result: AnalysisResult
): Promise<LensOutput> {
  const meta = ROLE_META[lens];
  const fallback = deterministicLens(lens, result);
  if (provider === "stub") return fallback;

  const system: ChatMessage = {
    role: "system",
    content:
      `You are a ${meta.role} on a venture investment committee analyzing an English-market ` +
      `(primarily US/EU) opportunity. ${meta.brief}\n\n` +
      `Respond ONLY with strict JSON, no markdown, of the form: ` +
      `{"headline": string (<=140 chars), "points": string[3-4 concise findings], "risks": string[2-3 concrete risks]}. ` +
      `Be specific, quantitative where possible, and intellectually honest — surface the strongest counter-argument.`,
  };
  const user: ChatMessage = { role: "user", content: dealContext(input, result) };

  try {
    const model = providerDefaultModel(provider);
    const { reply } = await callProvider(provider, [system, user], model, 0.4);
    const parsed = parseLensJson(reply);
    if (!parsed) return fallback;
    return {
      lens,
      role: meta.role,
      headline: String(parsed.headline || fallback.headline).slice(0, 200),
      points: sanitizeList(parsed.points, fallback.points),
      risks: sanitizeList(parsed.risks, fallback.risks),
    };
  } catch {
    return fallback;
  }
}

function parseLensJson(raw: string): { headline?: string; points?: unknown; risks?: unknown } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const cleaned = v
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .map((x) => String(x).trim().slice(0, 400))
    .slice(0, 5);
  return cleaned.length ? cleaned : fallback;
}

/** Deterministic narrative from the engine result — the offline-safe fallback. */
function deterministicLens(lens: LensId, result: AnalysisResult): LensOutput {
  const meta = ROLE_META[lens];
  const s = result.sector;
  const f = (key: string) => result.factors.find((x) => x.key === key);

  switch (lens) {
    case "scientist":
      return {
        lens, role: meta.role,
        headline: `Feasibility rests on: ${s.scienceFrontier}.`,
        points: [
          `Live frontier: ${s.scienceFrontier}.`,
          `Tech feasibility score ${f("science")?.score}/100 — driven by ${Math.round(s.cagr * 100)}% sector innovation rate.`,
          `Capital intensity ${Math.round(s.capitalIntensity * 100)}% sets the R&D burn profile.`,
        ],
        risks: [
          "Scientific claims unverified without a technical deep-dive / reference customers.",
          `${s.structuralRisk}.`,
        ],
      };
    case "data_analyst":
      return {
        lens, role: meta.role,
        headline: `~$${s.tamUsdBn}B TAM, ${Math.round(s.grossMargin * 100)}% mature gross margin.`,
        points: [
          `Market factor ${f("market")?.score}/100; unit-economics factor ${f("economics")?.score}/100.`,
          `Reference gross margin ~${Math.round(s.grossMargin * 100)}%; validate against actuals.`,
          `Execution signal ${f("execution")?.score}/100 — ${f("execution")?.rationale}.`,
        ],
        risks: [
          "TAM/SAM/SOM and CAC/LTV unconfirmed — require a live data room.",
          "Sector benchmarks are directional, not company-specific.",
        ],
      };
    case "economist":
      return {
        lens, role: meta.role,
        headline: `Rents accrue via ${s.primaryMoat.replace(/-/g, " ")}; competitive intensity ${Math.round(s.competitiveIntensity * 100)}%.`,
        points: [
          `Dominant moat archetype: ${s.primaryMoat.replace(/-/g, " ")} (score ${f("moat")?.score}/100).`,
          `Competitive headroom ${f("competition")?.score}/100.`,
          `Timing tailwind ${f("timing")?.score}/100 vs. neutral baseline.`,
        ],
        risks: [
          `${s.structuralRisk}.`,
          "Durable pricing power unproven at this stage.",
        ],
      };
    case "lawyer":
      return {
        lens, role: meta.role,
        headline: `Regulatory intensity ${Math.round(s.regulatoryIntensity * 100)}% — legal headroom ${f("legal")?.score}/100.`,
        points: [
          `Regulatory drag factor: intensity ${Math.round(s.regulatoryIntensity * 100)}%.`,
          `${s.primaryMoat === "regulatory-license" ? "Licensing is itself the moat — confirm the entity holds (or can obtain) it." : "Confirm IP ownership and freedom-to-operate."}`,
          "Structure entry with pro-rata rights, information rights, and standard downside protection.",
        ],
        risks: [
          "Jurisdiction-specific licensing / compliance not yet verified.",
          "IP, data-privacy, and liability exposure require counsel review.",
        ],
      };
  }
}

function deterministicMemo(result: AnalysisResult, input: AnalysisInput): string {
  const st = result.strategy;
  return [
    `INVESTMENT MEMO — ${input.name} (${result.sector.label}, ${result.stage})`,
    ``,
    `Recommendation: ${st.verdict.toUpperCase()} (${st.conviction} conviction, ${result.composite}/100).`,
    ``,
    st.reasoning.map((r) => `• ${r}`).join("\n"),
    ``,
    `Entry: lead $${st.ticketUsd.target.toLocaleString("en-US")} (range $${st.ticketUsd.min.toLocaleString("en-US")}–$${st.ticketUsd.max.toLocaleString("en-US")}) for ~${st.ownershipTargetPct}% at a ~$${(st.valuationBandUsd.base / 1e6).toFixed(1)}M pre-money base case.`,
    `Staging: ${st.tranches.map((t) => `${t.pct}% ${t.label} (${t.trigger})`).join(" → ")}`,
    `${st.portfolioNote}`,
  ].join("\n");
}

async function runSynthesis(
  provider: string,
  input: AnalysisInput,
  result: AnalysisResult,
  lenses: LensOutput[]
): Promise<string> {
  const fallback = deterministicMemo(result, input);
  if (provider === "stub") return fallback;

  const system: ChatMessage = {
    role: "system",
    content:
      "You are the lead partner writing the final one-paragraph investment memo for the IC. " +
      "Synthesize the four analyst lenses and the quant model into a crisp, decisive recommendation " +
      "for an English-speaking investor: the verdict, the single strongest reason for and against, and " +
      "the concrete entry plan (ticket, ownership, staging). 120–180 words. No markdown headers, plain prose.",
  };
  const lensDigest = lenses
    .map((l) => `${l.role}: ${l.headline} Risks: ${l.risks.join("; ")}`)
    .join("\n");
  const user: ChatMessage = {
    role: "user",
    content:
      dealContext(input, result) +
      `\n\nANALYST LENSES:\n${lensDigest}\n\nENGINE STRATEGY:\n${result.strategy.reasoning.join("\n")}\n${result.strategy.portfolioNote}`,
  };
  try {
    const model = providerDefaultModel(provider);
    const { reply } = await callProvider(provider, [system, user], model, 0.5);
    const text = reply.trim();
    return text.length > 40 ? text : fallback;
  } catch {
    return fallback;
  }
}

/** Run the full four-lens council + synthesis memo. */
export async function runCouncil(input: AnalysisInput, result: AnalysisResult): Promise<MemoOutput> {
  const provider = pickConfiguredProvider(process.env.QVENTURE_PROVIDER);
  const lensIds: LensId[] = ["scientist", "data_analyst", "economist", "lawyer"];
  const lenses = await Promise.all(lensIds.map((id) => runLens(id, provider, input, result)));
  const memo = await runSynthesis(provider, input, result, lenses);
  return { lenses, memo, aiProvider: provider, aiUsed: provider !== "stub" };
}
