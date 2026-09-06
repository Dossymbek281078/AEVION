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
import { legalSurface } from "./jurisdictions";

export type LensId = "scientist" | "data_analyst" | "economist" | "lawyer";

export interface LensOutput {
  lens: LensId;
  /**
   * Ответила ли МОДЕЛЬ по этой линзе. Отсутствует у записей, сделанных до
   * 03.09.2026 — там ответа на этот вопрос нет, и подставлять его нельзя.
   */
  live?: boolean;
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
  /** Сколько из aiTotal частей пришло ОТ МОДЕЛИ. Отсутствует у старых записей. */
  aiLive?: number;
  /** Всего частей: четыре линзы плюс сведение. */
  aiTotal?: number;
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

// The quant factor each role owns. Anchoring a lens to its factor makes the
// narrative reference the number instead of floating beside it — "unit economics
// scored 33/100 because…" is a diligence note; a generic paragraph is filler.
const LENS_FACTOR: Record<LensId, string> = {
  scientist: "science",
  data_analyst: "economics",
  economist: "market",
  lawyer: "legal",
};

/** The one-line "anchor" a lens is told to open from: its factor's score + why. */
function lensAnchor(lens: LensId, result: AnalysisResult): string | null {
  const f = result.factors.find((x) => x.key === LENS_FACTOR[lens]);
  if (!f) return null;
  return `Your primary quant factor is "${f.label}", currently ${f.score}/100 (${Math.round(f.weight * 100)}% of the composite). ` +
    `Open by engaging that score directly — agree or push back on it, and say why — then broaden. Do not restate it without a view.`;
}

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
    ``,
    `PARSED PLAN METRICS (deterministically extracted from the plan — ${result.signals.fieldsFound} quantified field(s); signal coverage ${Math.round(result.signalCoverage * 100)}%):`,
    signalLines(result),
    result.redFlags.length
      ? `RED FLAGS (auto-detected): ${result.redFlags.map((r) => `(!) ${r}`).join(" ")}`
      : `RED FLAGS: none auto-detected.`,
    result.stress.resilience !== "insufficient-data"
      ? `STRESS TEST — resilience "${result.stress.resilience}" (base LTV/CAC ${result.stress.base.ltvCac}, worst-case ${result.stress.worstLtvCac} under combined CAC+churn shocks): ${result.stress.note}`
      : `STRESS TEST: not run — unit economics (LTV/CAC) not disclosed.`,
    result.tam.mode !== "insufficient"
      ? `TAM TRIANGULATION: ${result.tam.triangulation.join(" ")}${result.tam.flags.length ? ` FLAGS: ${result.tam.flags.join(" ")}` : ""}`
      : `TAM TRIANGULATION: not run — no bottom-up TAM or revenue/customers disclosed.`,
    result.projections
      ? `REVENUE PROJECTIONS — verdict "${result.projections.verdict}": ${result.projections.note}`
      : `REVENUE PROJECTIONS: none supplied.`,
  ].join("\n");
}

/** One-line digest of the quantitative signals parsed from the plan. */
function signalLines(result: AnalysisResult): string {
  const s = result.signals;
  const parts: string[] = [];
  if (s.revenueUsd !== null) parts.push(`revenue ~$${Math.round(s.revenueUsd).toLocaleString("en-US")} (${s.revenueBasis ?? "revenue"})`);
  if (s.growthPct !== null) parts.push(`growth ${s.growthPct}% ${s.growthPeriod ?? ""}`.trim());
  if (s.grossMarginPct !== null) parts.push(`gross margin ${s.grossMarginPct}%`);
  if (s.ltvCacRatio !== null) parts.push(`LTV/CAC ${s.ltvCacRatio}`);
  if (s.paybackMonths !== null) parts.push(`payback ${s.paybackMonths}mo`);
  if (s.churnPct !== null) parts.push(`churn ${s.churnPct}%`);
  if (s.retentionPct !== null) parts.push(`retention ${s.retentionPct}%`);
  if (s.customers !== null) parts.push(`${s.customers.toLocaleString("en-US")} customers`);
  if (s.bottomUpTamUsd !== null) parts.push(`bottom-up TAM ~$${Math.round(s.bottomUpTamUsd).toLocaleString("en-US")}`);
  return parts.length ? `  ${parts.join(" · ")}` : `  (none disclosed — scoring leans on sector priors)`;
}

/** Jurisdiction-specific legal surface, appended to the lawyer lens prompt. */
function legalContext(input: AnalysisInput, result: AnalysisResult): string {
  const ls = legalSurface(result.sector, input.geography);
  return [
    `LEGAL SURFACE (${ls.jurisdiction.label}):`,
    `  Securities regime for the round: ${ls.jurisdiction.securitiesRegime}`,
    `  Available exemptions: ${ls.jurisdiction.privateExemptions.join(", ")}`,
    `  Sector licensing (${result.sector.label}): ${ls.sectorLicensing}`,
    `  Data privacy: ${ls.jurisdiction.dataPrivacy}`,
    `  AI governance: ${ls.jurisdiction.aiGovernance}`,
    `  Investor-protection norms: ${ls.jurisdiction.investorTerms.join("; ")}`,
    `  Jurisdiction note: ${ls.jurisdiction.note}`,
  ].join("\n");
}

async function runLens(
  lens: LensId,
  provider: string,
  input: AnalysisInput,
  result: AnalysisResult
): Promise<LensOutput> {
  const meta = ROLE_META[lens];
  const fallback = deterministicLens(lens, result, input);
  if (provider === "stub") return fallback;

  const system: ChatMessage = {
    role: "system",
    content:
      `You are a ${meta.role} on a venture investment committee analyzing an English-market ` +
      `(primarily US/EU) opportunity. ${meta.brief}\n\n` +
      `Respond ONLY with strict JSON, no markdown, of the form: ` +
      `{"headline": string (<=140 chars), "points": string[3-4 concise findings], "risks": string[2-3 concrete risks]}. ` +
      `Be specific, quantitative where possible, and intellectually honest — surface the strongest counter-argument. ` +
      `If the brief lists RED FLAGS that fall in your domain, you must address them explicitly rather than writing around them: ` +
      `a lawyer praising IP the model just penalised for lapsing, or an economist ignoring a disclosed free incumbent, is worse than no memo.` +
      (lensAnchor(lens, result) ? `\n\n${lensAnchor(lens, result)}` : ""),
  };
  const legalAppendix =
    lens === "lawyer" ? `\n\n${legalContext(input, result)}` : "";
  const user: ChatMessage = { role: "user", content: dealContext(input, result) + legalAppendix };

  try {
    const model = providerDefaultModel(provider);
    const { reply } = await callProvider(provider, [system, user], model, 0.4, undefined, undefined, { module: "qventure-lens" });
    const parsed = parseLensJson(reply);
    if (!parsed) return fallback;
    return {
      lens,
      role: meta.role,
      headline: String(parsed.headline || fallback.headline).slice(0, 200),
      points: sanitizeList(parsed.points, fallback.points),
      risks: sanitizeList(parsed.risks, fallback.risks),
      live: true,
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
function deterministicLens(lens: LensId, result: AnalysisResult, input: AnalysisInput): LensOutput {
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
    case "lawyer": {
      const ls = legalSurface(result.sector, input.geography);
      return {
        lens, role: meta.role,
        headline: `${ls.jurisdiction.label}: ${ls.jurisdiction.privateExemptions[0]} round; regulatory intensity ${Math.round(s.regulatoryIntensity * 100)}% — legal headroom ${f("legal")?.score}/100.`,
        points: [
          `Round structure: ${ls.jurisdiction.securitiesRegime}`,
          `Sector licensing (${result.sector.label}): ${ls.sectorLicensing}`,
          ls.regulated
            ? `${s.primaryMoat === "regulatory-license" ? "Licensing is itself the moat — confirm the entity holds (or can obtain) it." : "Named regime applies — confirm the entity's authorizations before close."}`
            : "Structure entry with pro-rata rights, information rights, and standard downside protection.",
          `Data/AI exposure: ${ls.jurisdiction.dataPrivacy} · ${ls.jurisdiction.aiGovernance}`,
        ],
        risks: [
          ls.regulated
            ? `${ls.jurisdiction.label} licensing/authorization for a ${result.sector.label.toLowerCase()} venture not yet verified.`
            : "Jurisdiction-specific compliance and IP freedom-to-operate not yet verified.",
          `${ls.jurisdiction.note}`,
          "IP, data-privacy, and liability exposure require local counsel review — this is directional, not legal advice.",
        ],
      };
    }
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
  // Возвращаем ПАРУ: текст и признак «это ответ модели». Раньше возвращалась
  // одна строка, и отличить ответ от заготовки было нельзя — обе просто строки.
): Promise<{ text: string; live: boolean }> {
  const fallback = deterministicMemo(result, input);
  if (provider === "stub") return { text: fallback, live: false };

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
    const { reply } = await callProvider(provider, [system, user], model, 0.5, undefined, undefined, { module: "qventure-synthesis" });
    const text = reply.trim();
    // Слишком короткий ответ — это тоже НЕ ответ модели: дальше идёт
    // заготовка, и признак обязан это отражать.
    return text.length > 40 ? { text, live: true } : { text: fallback, live: false };
  } catch {
    return { text: fallback, live: false };
  }
}

/** Run the full four-lens council + synthesis memo. */
export async function runCouncil(input: AnalysisInput, result: AnalysisResult): Promise<MemoOutput> {
  const provider = pickConfiguredProvider(process.env.QVENTURE_PROVIDER);
  const lensIds: LensId[] = ["scientist", "data_analyst", "economist", "lawyer"];
  const lenses = await Promise.all(lensIds.map((id) => runLens(id, provider, input, result)));
  const memo = await runSynthesis(provider, input, result, lenses);
  // 🔴 ЗДЕСЬ БЫЛО `aiUsed: provider !== "stub"` — признак считался по НАСТРОЙКЕ,
  // а не по тому, ответила ли модель. Если поставщик настроен, но вызовы
  // падают (кончилась квота, битый ключ, провайдер лежит), все четыре линзы и
  // записка подставлялись заготовкой — а ответ говорил «разбор ИИ», и экран
  // печатал платящему «Текст собран: живая модель». Замер 03.09.2026.
  const liveLinz = lenses.filter((l) => l.live === true).length;
  const aiLive = liveLinz + (memo.live ? 1 : 0);
  return {
    lenses,
    memo: memo.text,
    aiProvider: provider,
    aiUsed: aiLive > 0,
    aiLive,
    aiTotal: lenses.length + 1,
  };
}
