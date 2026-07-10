/**
 * QVenture — Sector Knowledge Base
 * ────────────────────────────────
 * Curated, English-market (primarily US/EU) reference data for ~18 sectors.
 * Each row is a compressed "research digest": market-size tier, growth rate,
 * regulatory intensity, capital intensity, typical gross margin, the dominant
 * moat archetype, and the live scientific/technological frontier that a
 * scientist-analyst would flag.
 *
 * `tamUsdBn` and `cagr` are anchored to recent (2024–2026) third-party market
 * research and each row carries the `sources` it was drawn from, so the market
 * factor is *cited*, not invented. Figures are the technology-addressable
 * market (what a startup can actually capture), taken at current (~2025) size;
 * where research firms disagree we use a representative mid-range and list the
 * bracketing reports. The qualitative fields (regulatory/capital intensity,
 * moat, frontier, risk) remain directional analyst judgment. Every analysis
 * surfaces these sources so an investor can audit or override them.
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

export interface SectorSource {
  publisher: string;
  year: number;
  /** The specific figure/claim drawn from this source. */
  claim: string;
  url: string;
}

export interface SectorProfile {
  id: string;
  label: string;
  /** Technology-addressable market, ~2025 size, USD billions (cited). */
  tamUsdBn: number;
  /** Forward CAGR, fraction (0.18 = 18%/yr), cited. */
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
  /** Third-party market-research citations for tamUsdBn / cagr. */
  sources: SectorSource[];
}

export const SECTORS: Record<string, SectorProfile> = {
  fintech: {
    id: "fintech", label: "Fintech / Payments",
    tamUsdBn: 340, cagr: 0.17, regulatoryIntensity: 0.85, capitalIntensity: 0.55,
    grossMargin: 0.55, competitiveIntensity: 0.8, primaryMoat: "regulatory-license",
    scienceFrontier: "real-time risk ML, on-device fraud graphs, programmable stablecoin rails",
    structuralRisk: "rate-cycle sensitivity and licensing moats favoring incumbents",
    sources: [
      { publisher: "Mordor Intelligence", year: 2025, claim: "Global fintech market ~$253–395B in 2025, ~16–18% CAGR to 2030", url: "https://www.mordorintelligence.com/industry-reports/global-fintech-market" },
      { publisher: "Grand View Research", year: 2025, claim: "Fintech-as-a-Service to reach $949.5B by 2030 at 17.5% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/fintech-as-a-service-market-report" },
    ],
  },
  healthtech: {
    id: "healthtech", label: "Healthtech / Digital Health",
    tamUsdBn: 200, cagr: 0.22, regulatoryIntensity: 0.9, capitalIntensity: 0.6,
    grossMargin: 0.6, competitiveIntensity: 0.6, primaryMoat: "regulatory-license",
    scienceFrontier: "multimodal diagnostic models, FDA SaMD pathways, RWE evidence loops",
    structuralRisk: "reimbursement dependency and long clinical validation cycles",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "Digital health to reach $946.0B by 2030 at 22.2% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/digital-health-market" },
      { publisher: "MarketsandMarkets", year: 2025, claim: "$199.1B in 2025 → $573.5B by 2030 at 23.6% CAGR", url: "https://www.marketsandmarkets.com/Market-Reports/digital-health-market-45458752.html" },
    ],
  },
  biotech: {
    id: "biotech", label: "Biotech / Therapeutics",
    tamUsdBn: 1770, cagr: 0.14, regulatoryIntensity: 0.98, capitalIntensity: 0.95,
    grossMargin: 0.85, competitiveIntensity: 0.5, primaryMoat: "ip-patents",
    scienceFrontier: "AI protein design, base/prime editing, patient-derived organoid screens",
    structuralRisk: "binary trial risk and 8–12yr capital-intensive timelines",
    sources: [
      { publisher: "Precedence Research", year: 2025, claim: "Biotechnology ~$1.77T in 2025, ~13.6% CAGR to 2035", url: "https://www.precedenceresearch.com/biotechnology-market" },
      { publisher: "Grand View Research", year: 2025, claim: "To reach $3.88T by 2030 at 13.96% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/biotechnology-market" },
    ],
  },
  climate: {
    id: "climate", label: "Climate / Energy Transition",
    tamUsdBn: 31, cagr: 0.24, regulatoryIntensity: 0.6, capitalIntensity: 0.85,
    grossMargin: 0.4, competitiveIntensity: 0.55, primaryMoat: "economies-of-scale",
    scienceFrontier: "solid-state storage, long-duration storage chemistry, DAC cost curves",
    structuralRisk: "policy/subsidy dependence and commodity-linked margins",
    sources: [
      { publisher: "Fortune Business Insights", year: 2025, claim: "Climate tech $31.2B in 2025 → $202.8B by 2034 at 23.8% CAGR", url: "https://www.fortunebusinessinsights.com/climate-tech-market-109849" },
      { publisher: "Precedence Research", year: 2025, claim: "To ~$282B by 2035 at 24.4% CAGR", url: "https://www.precedenceresearch.com/climate-tech-market" },
    ],
  },
  ai_infra: {
    id: "ai_infra", label: "AI Infrastructure / Tooling",
    tamUsdBn: 158, cagr: 0.24, regulatoryIntensity: 0.35, capitalIntensity: 0.7,
    grossMargin: 0.65, competitiveIntensity: 0.9, primaryMoat: "data-scale",
    scienceFrontier: "inference cost curves, sparse/MoE architectures, eval + safety tooling",
    structuralRisk: "foundation-model commoditization compressing the middle layer",
    sources: [
      { publisher: "BCC Research", year: 2025, claim: "AI infrastructure $158.3B in 2025 → $418.8B by 2030 at 21.5% CAGR", url: "https://www.bccresearch.com/market-research/artificial-intelligence-technology/ai-infrastructure-market.html" },
      { publisher: "Grand View Research", year: 2025, claim: "To $223.4B by 2030 at 30.4% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/ai-infrastructure-market-report" },
    ],
  },
  ai_app: {
    id: "ai_app", label: "AI Applications (vertical SaaS)",
    tamUsdBn: 45, cagr: 0.37, regulatoryIntensity: 0.4, capitalIntensity: 0.35,
    grossMargin: 0.7, competitiveIntensity: 0.85, primaryMoat: "switching-costs",
    scienceFrontier: "agentic workflows, domain eval harnesses, retrieval + tool orchestration",
    structuralRisk: "thin wrapper risk — value must accrue above the model layer",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "Generative AI $22.2B in 2025, 37.6% CAGR to 2030", url: "https://www.grandviewresearch.com/industry-analysis/generative-ai-market-report" },
      { publisher: "ABI Research", year: 2025, claim: "Gen-AI software $63B in 2025 → ~$220B by 2030 at ~29% CAGR", url: "https://www.abiresearch.com/blog/generative-ai-software-market-report-summary" },
    ],
  },
  saas: {
    id: "saas", label: "B2B SaaS (horizontal)",
    tamUsdBn: 465, cagr: 0.13, regulatoryIntensity: 0.3, capitalIntensity: 0.4,
    grossMargin: 0.78, competitiveIntensity: 0.8, primaryMoat: "switching-costs",
    scienceFrontier: "usage-based pricing telemetry, embedded analytics, PLG instrumentation",
    structuralRisk: "seat-based model pressure as AI collapses headcount-linked demand",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "SaaS $464.7B in 2025 → $1,109.2B by 2033 at 11.1% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/saas-market-report" },
      { publisher: "Research and Markets", year: 2025, claim: "$281.8B (2024) → $774.3B by 2030 at 18.3% CAGR", url: "https://www.statista.com/outlook/tmo/public-cloud/software-as-a-service/worldwide/" },
    ],
  },
  marketplace: {
    id: "marketplace", label: "Marketplaces / Platforms",
    tamUsdBn: 3500, cagr: 0.16, regulatoryIntensity: 0.45, capitalIntensity: 0.5,
    grossMargin: 0.65, competitiveIntensity: 0.75, primaryMoat: "network-effects",
    scienceFrontier: "matching/ranking ML, trust-and-safety graphs, dynamic pricing",
    structuralRisk: "cold-start liquidity and take-rate ceiling from disintermediation",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "Proxy — B2C e-commerce to $17.77T by 2030 at 19.1% CAGR (platform GMV)", url: "https://www.grandviewresearch.com/press-release/global-b2c-e-commerce-market" },
    ],
  },
  ecommerce: {
    id: "ecommerce", label: "E-commerce / DTC",
    tamUsdBn: 6400, cagr: 0.11, regulatoryIntensity: 0.35, capitalIntensity: 0.55,
    grossMargin: 0.45, competitiveIntensity: 0.85, primaryMoat: "brand",
    scienceFrontier: "demand forecasting, supply-chain optimization, gen-AI merchandising",
    structuralRisk: "CAC inflation and low structural gross margin",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "B2C e-commerce to $17.77T by 2030 at 19.1% CAGR; ~$6.4T base 2025", url: "https://www.grandviewresearch.com/industry-analysis/e-commerce-market" },
      { publisher: "Statista", year: 2025, claim: "Asia-Pacific ~45% of global e-commerce revenue", url: "https://www.statista.com/outlook/emo/ecommerce/worldwide/" },
    ],
  },
  edtech: {
    id: "edtech", label: "Edtech / Workforce",
    tamUsdBn: 190, cagr: 0.12, regulatoryIntensity: 0.4, capitalIntensity: 0.35,
    grossMargin: 0.7, competitiveIntensity: 0.7, primaryMoat: "brand",
    scienceFrontier: "adaptive tutoring, learning-science-backed retention, credentialing",
    structuralRisk: "engagement/retention cliffs and fragmented buyer budgets",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "EdTech $187.0B in 2025 → $437.5B by 2033 at 10.8% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/education-technology-market" },
      { publisher: "MarketsandMarkets", year: 2025, claim: "$197.3B in 2025 → $353.1B by 2030 at 12.3% CAGR", url: "https://www.marketsandmarkets.com/Market-Reports/educational-technology-ed-tech-market-1066.html" },
    ],
  },
  cybersecurity: {
    id: "cybersecurity", label: "Cybersecurity",
    tamUsdBn: 250, cagr: 0.11, regulatoryIntensity: 0.55, capitalIntensity: 0.45,
    grossMargin: 0.75, competitiveIntensity: 0.85, primaryMoat: "switching-costs",
    scienceFrontier: "AI-driven detection, post-quantum crypto migration, identity graphs",
    structuralRisk: "platform consolidation squeezing point solutions",
    sources: [
      { publisher: "MarketsandMarkets", year: 2025, claim: "Cybersecurity $227.6B in 2025 → $351.9B by 2030 at 9.1% CAGR", url: "https://www.marketsandmarkets.com/Market-Reports/cyber-security-market-505.html" },
      { publisher: "Grand View Research", year: 2025, claim: "$271.9B in 2025 → $663.2B by 2033 at 11.9% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/cyber-security-market" },
    ],
  },
  logistics: {
    id: "logistics", label: "Logistics / Supply Chain",
    tamUsdBn: 93, cagr: 0.13, regulatoryIntensity: 0.5, capitalIntensity: 0.8,
    grossMargin: 0.35, competitiveIntensity: 0.7, primaryMoat: "economies-of-scale",
    scienceFrontier: "autonomy, route optimization, warehouse robotics + vision",
    structuralRisk: "asset heaviness and macro/freight-cycle exposure",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "Digital logistics $33.8B (2024) → $93.3B by 2030 at 18.8% CAGR", url: "https://www.grandviewresearch.com/horizon/outlook/digital-logistics-market-size/global" },
      { publisher: "MarketsandMarkets", year: 2025, claim: "Supply-chain management market to $48.6B by 2030 at 11.4% CAGR", url: "https://www.marketsandmarkets.com/Market-Reports/supply-chain-management-market-190997554.html" },
    ],
  },
  proptech: {
    id: "proptech", label: "Proptech / Real Estate",
    tamUsdBn: 40, cagr: 0.15, regulatoryIntensity: 0.55, capitalIntensity: 0.75,
    grossMargin: 0.5, competitiveIntensity: 0.6, primaryMoat: "data-scale",
    scienceFrontier: "valuation models, energy/DPE analytics, construction automation",
    structuralRisk: "rate sensitivity and balance-sheet-heavy transaction models",
    sources: [
      { publisher: "Precedence Research", year: 2025, claim: "PropTech $40.2B in 2025 → $185.3B by 2035 (~15–16% CAGR)", url: "https://www.precedenceresearch.com/proptech-market" },
      { publisher: "Grand View Research", year: 2025, claim: "Double-digit CAGR to 2030 driven by AI/IoT/VR adoption", url: "https://www.grandviewresearch.com/industry-analysis/proptech-market-report" },
    ],
  },
  space: {
    id: "space", label: "Space / Aerospace",
    tamUsdBn: 500, cagr: 0.08, regulatoryIntensity: 0.8, capitalIntensity: 0.95,
    grossMargin: 0.5, competitiveIntensity: 0.4, primaryMoat: "ip-patents",
    scienceFrontier: "reusable launch, in-orbit servicing, EO/imaging ML",
    structuralRisk: "extreme capital intensity and long revenue horizons",
    sources: [
      { publisher: "Global Market Insights", year: 2026, claim: "Space economy ~$439B in 2025 → $851.8B by 2035 at ~7% CAGR", url: "https://www.gminsights.com/industry-analysis/space-economy-market" },
    ],
  },
  consumer: {
    id: "consumer", label: "Consumer / Social Apps",
    tamUsdBn: 1000, cagr: 0.1, regulatoryIntensity: 0.45, capitalIntensity: 0.35,
    grossMargin: 0.72, competitiveIntensity: 0.9, primaryMoat: "network-effects",
    scienceFrontier: "recommendation ML, on-device gen-AI, retention/virality loops",
    structuralRisk: "platform-distribution dependence and fickle attention",
    sources: [
      { publisher: "Directional", year: 2025, claim: "No single consensus report; sized from consumer-internet/app-economy aggregates — treat as an order-of-magnitude proxy", url: "https://www.statista.com/markets/424/topic/540/social-media-user-generated-content/" },
    ],
  },
  gaming: {
    id: "gaming", label: "Gaming / Interactive",
    tamUsdBn: 300, cagr: 0.1, regulatoryIntensity: 0.4, capitalIntensity: 0.5,
    grossMargin: 0.68, competitiveIntensity: 0.9, primaryMoat: "brand",
    scienceFrontier: "gen-AI content pipelines, procedural worlds, live-ops ML",
    structuralRisk: "hit-driven revenue and rising production costs",
    sources: [
      { publisher: "Grand View Research", year: 2025, claim: "Video games $322.6B in 2025 → $600.7B by 2030 at 12.2% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/video-game-market" },
      { publisher: "Mordor Intelligence", year: 2025, claim: "$289.7B in 2025 → $593.4B by 2031 at 12.68% CAGR", url: "https://www.mordorintelligence.com/industry-reports/video-game-market" },
    ],
  },
  agtech: {
    id: "agtech", label: "Agtech / Food",
    tamUsdBn: 24, cagr: 0.12, regulatoryIntensity: 0.6, capitalIntensity: 0.7,
    grossMargin: 0.4, competitiveIntensity: 0.55, primaryMoat: "ip-patents",
    scienceFrontier: "precision ag sensing, biologicals, alt-protein fermentation",
    structuralRisk: "commodity margins and long adoption cycles among growers",
    sources: [
      { publisher: "Research and Markets", year: 2025, claim: "Agritech $24.4B (2024) → $48.98B by 2030 at 12.3% CAGR", url: "https://www.researchandmarkets.com/report/agricultural-technology" },
      { publisher: "Mordor Intelligence", year: 2025, claim: "~11–15% CAGR through 2031; AI-in-ag CAGR ~28.5%", url: "https://www.mordorintelligence.com/industry-reports/global-agritech-market" },
    ],
  },
  other: {
    id: "other", label: "Other / General",
    tamUsdBn: 1000, cagr: 0.1, regulatoryIntensity: 0.45, capitalIntensity: 0.5,
    grossMargin: 0.55, competitiveIntensity: 0.7, primaryMoat: "none",
    scienceFrontier: "domain-specific automation and data advantages",
    structuralRisk: "undifferentiated positioning without a clear moat",
    sources: [
      { publisher: "Directional", year: 2025, claim: "No sector-specific report — generic fallback; supply a specific sector for cited market data", url: "https://www.grandviewresearch.com/" },
    ],
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
