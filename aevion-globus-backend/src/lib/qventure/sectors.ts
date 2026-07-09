/**
 * QVenture — Sector Knowledge Base
 * ────────────────────────────────
 * Curated, English-market (primarily US/EU) reference data for ~18 sectors.
 * Each row is a compressed "research digest": market-size tier, growth rate,
 * regulatory intensity, capital intensity, typical gross margin, the dominant
 * moat archetype, and the live scientific/technological frontier that a
 * scientist-analyst would flag.
 *
 * These are order-of-magnitude reference values used to *ground* the scoring
 * model so the composite score is explainable and reproducible rather than an
 * LLM hallucination. They are deliberately conservative and directional — they
 * are decision inputs, not audited figures. Sources are broad public consensus
 * ranges (industry reports, public-company filings, academic reviews) as of
 * the 2024–2026 window; each analysis surfaces them as assumptions the analyst
 * can override.
 */

export type MoatArchetype =
  | "network-effects"
  | "data-scale"
  | "regulatory-license"
  | "switching-costs"
  | "brand"
  | "ip-patents"
  | "economies-of-scale"
  | "none";

export interface SectorProfile {
  id: string;
  label: string;
  /** Global TAM order of magnitude in USD billions (directional). */
  tamUsdBn: number;
  /** Forward CAGR, fraction (0.18 = 18%/yr). */
  cagr: number;
  /** 0–1: how regulated the space is (higher = more legal drag). */
  regulatoryIntensity: number;
  /** 0–1: capital needed to reach scale (higher = more cash-hungry). */
  capitalIntensity: number;
  /** Typical mature gross margin, fraction. */
  grossMargin: number;
  /** 0–1: how crowded / competitive the space is. */
  competitiveIntensity: number;
  /** Dominant defensibility pattern that tends to win here. */
  primaryMoat: MoatArchetype;
  /** The scientific / technological frontier a scientist would weigh. */
  scienceFrontier: string;
  /** Notable structural risk an economist would flag. */
  structuralRisk: string;
}

export const SECTORS: Record<string, SectorProfile> = {
  fintech: {
    id: "fintech", label: "Fintech / Payments",
    tamUsdBn: 12000, cagr: 0.15, regulatoryIntensity: 0.85, capitalIntensity: 0.55,
    grossMargin: 0.55, competitiveIntensity: 0.8, primaryMoat: "regulatory-license",
    scienceFrontier: "real-time risk ML, on-device fraud graphs, programmable stablecoin rails",
    structuralRisk: "rate-cycle sensitivity and licensing moats favoring incumbents",
  },
  healthtech: {
    id: "healthtech", label: "Healthtech / Digital Health",
    tamUsdBn: 11000, cagr: 0.18, regulatoryIntensity: 0.9, capitalIntensity: 0.6,
    grossMargin: 0.6, competitiveIntensity: 0.6, primaryMoat: "regulatory-license",
    scienceFrontier: "multimodal diagnostic models, FDA SaMD pathways, RWE evidence loops",
    structuralRisk: "reimbursement dependency and long clinical validation cycles",
  },
  biotech: {
    id: "biotech", label: "Biotech / Therapeutics",
    tamUsdBn: 1600, cagr: 0.11, regulatoryIntensity: 0.98, capitalIntensity: 0.95,
    grossMargin: 0.85, competitiveIntensity: 0.5, primaryMoat: "ip-patents",
    scienceFrontier: "AI protein design, base/prime editing, patient-derived organoid screens",
    structuralRisk: "binary trial risk and 8–12yr capital-intensive timelines",
  },
  climate: {
    id: "climate", label: "Climate / Energy Transition",
    tamUsdBn: 6000, cagr: 0.2, regulatoryIntensity: 0.6, capitalIntensity: 0.85,
    grossMargin: 0.4, competitiveIntensity: 0.55, primaryMoat: "economies-of-scale",
    scienceFrontier: "solid-state storage, long-duration storage chemistry, DAC cost curves",
    structuralRisk: "policy/subsidy dependence and commodity-linked margins",
  },
  ai_infra: {
    id: "ai_infra", label: "AI Infrastructure / Tooling",
    tamUsdBn: 900, cagr: 0.35, regulatoryIntensity: 0.35, capitalIntensity: 0.7,
    grossMargin: 0.65, competitiveIntensity: 0.9, primaryMoat: "data-scale",
    scienceFrontier: "inference cost curves, sparse/MoE architectures, eval + safety tooling",
    structuralRisk: "foundation-model commoditization compressing the middle layer",
  },
  ai_app: {
    id: "ai_app", label: "AI Applications (vertical SaaS)",
    tamUsdBn: 1500, cagr: 0.32, regulatoryIntensity: 0.4, capitalIntensity: 0.35,
    grossMargin: 0.7, competitiveIntensity: 0.85, primaryMoat: "switching-costs",
    scienceFrontier: "agentic workflows, domain eval harnesses, retrieval + tool orchestration",
    structuralRisk: "thin wrapper risk — value must accrue above the model layer",
  },
  saas: {
    id: "saas", label: "B2B SaaS (horizontal)",
    tamUsdBn: 1200, cagr: 0.13, regulatoryIntensity: 0.3, capitalIntensity: 0.4,
    grossMargin: 0.78, competitiveIntensity: 0.8, primaryMoat: "switching-costs",
    scienceFrontier: "usage-based pricing telemetry, embedded analytics, PLG instrumentation",
    structuralRisk: "seat-based model pressure as AI collapses headcount-linked demand",
  },
  marketplace: {
    id: "marketplace", label: "Marketplaces / Platforms",
    tamUsdBn: 3500, cagr: 0.14, regulatoryIntensity: 0.45, capitalIntensity: 0.5,
    grossMargin: 0.65, competitiveIntensity: 0.75, primaryMoat: "network-effects",
    scienceFrontier: "matching/ranking ML, trust-and-safety graphs, dynamic pricing",
    structuralRisk: "cold-start liquidity and take-rate ceiling from disintermediation",
  },
  ecommerce: {
    id: "ecommerce", label: "E-commerce / DTC",
    tamUsdBn: 6300, cagr: 0.1, regulatoryIntensity: 0.35, capitalIntensity: 0.55,
    grossMargin: 0.45, competitiveIntensity: 0.85, primaryMoat: "brand",
    scienceFrontier: "demand forecasting, supply-chain optimization, gen-AI merchandising",
    structuralRisk: "CAC inflation and low structural gross margin",
  },
  edtech: {
    id: "edtech", label: "Edtech / Workforce",
    tamUsdBn: 800, cagr: 0.13, regulatoryIntensity: 0.4, capitalIntensity: 0.35,
    grossMargin: 0.7, competitiveIntensity: 0.7, primaryMoat: "brand",
    scienceFrontier: "adaptive tutoring, learning-science-backed retention, credentialing",
    structuralRisk: "engagement/retention cliffs and fragmented buyer budgets",
  },
  cybersecurity: {
    id: "cybersecurity", label: "Cybersecurity",
    tamUsdBn: 500, cagr: 0.12, regulatoryIntensity: 0.55, capitalIntensity: 0.45,
    grossMargin: 0.75, competitiveIntensity: 0.85, primaryMoat: "switching-costs",
    scienceFrontier: "AI-driven detection, post-quantum crypto migration, identity graphs",
    structuralRisk: "platform consolidation squeezing point solutions",
  },
  logistics: {
    id: "logistics", label: "Logistics / Supply Chain",
    tamUsdBn: 9000, cagr: 0.09, regulatoryIntensity: 0.5, capitalIntensity: 0.8,
    grossMargin: 0.35, competitiveIntensity: 0.7, primaryMoat: "economies-of-scale",
    scienceFrontier: "autonomy, route optimization, warehouse robotics + vision",
    structuralRisk: "asset heaviness and macro/freight-cycle exposure",
  },
  proptech: {
    id: "proptech", label: "Proptech / Real Estate",
    tamUsdBn: 4000, cagr: 0.11, regulatoryIntensity: 0.55, capitalIntensity: 0.75,
    grossMargin: 0.5, competitiveIntensity: 0.6, primaryMoat: "data-scale",
    scienceFrontier: "valuation models, energy/DPE analytics, construction automation",
    structuralRisk: "rate sensitivity and balance-sheet-heavy transaction models",
  },
  space: {
    id: "space", label: "Space / Aerospace",
    tamUsdBn: 600, cagr: 0.16, regulatoryIntensity: 0.8, capitalIntensity: 0.95,
    grossMargin: 0.5, competitiveIntensity: 0.4, primaryMoat: "ip-patents",
    scienceFrontier: "reusable launch, in-orbit servicing, EO/imaging ML",
    structuralRisk: "extreme capital intensity and long revenue horizons",
  },
  consumer: {
    id: "consumer", label: "Consumer / Social Apps",
    tamUsdBn: 1000, cagr: 0.1, regulatoryIntensity: 0.45, capitalIntensity: 0.35,
    grossMargin: 0.72, competitiveIntensity: 0.9, primaryMoat: "network-effects",
    scienceFrontier: "recommendation ML, on-device gen-AI, retention/virality loops",
    structuralRisk: "platform-distribution dependence and fickle attention",
  },
  gaming: {
    id: "gaming", label: "Gaming / Interactive",
    tamUsdBn: 280, cagr: 0.09, regulatoryIntensity: 0.4, capitalIntensity: 0.5,
    grossMargin: 0.68, competitiveIntensity: 0.9, primaryMoat: "brand",
    scienceFrontier: "gen-AI content pipelines, procedural worlds, live-ops ML",
    structuralRisk: "hit-driven revenue and rising production costs",
  },
  agtech: {
    id: "agtech", label: "Agtech / Food",
    tamUsdBn: 5000, cagr: 0.1, regulatoryIntensity: 0.6, capitalIntensity: 0.7,
    grossMargin: 0.4, competitiveIntensity: 0.55, primaryMoat: "ip-patents",
    scienceFrontier: "precision ag sensing, biologicals, alt-protein fermentation",
    structuralRisk: "commodity margins and long adoption cycles among growers",
  },
  other: {
    id: "other", label: "Other / General",
    tamUsdBn: 1000, cagr: 0.1, regulatoryIntensity: 0.45, capitalIntensity: 0.5,
    grossMargin: 0.55, competitiveIntensity: 0.7, primaryMoat: "none",
    scienceFrontier: "domain-specific automation and data advantages",
    structuralRisk: "undifferentiated positioning without a clear moat",
  },
};

export function resolveSector(input: string | undefined): SectorProfile {
  if (!input) return SECTORS.other;
  const key = input.trim().toLowerCase().replace(/[\s/-]+/g, "_");
  if (SECTORS[key]) return SECTORS[key];
  // fuzzy contains match against labels/ids
  for (const s of Object.values(SECTORS)) {
    if (s.id.includes(key) || key.includes(s.id) || s.label.toLowerCase().includes(input.trim().toLowerCase())) {
      return s;
    }
  }
  return SECTORS.other;
}

export function listSectors(): Array<{ id: string; label: string }> {
  return Object.values(SECTORS).map((s) => ({ id: s.id, label: s.label }));
}
