/**
 * QVenture — Sector Knowledge Base
 * ────────────────────────────────
 * Curated, English-market (primarily US/EU) reference data for ~18 sectors.
 * Each row is a compressed "research digest": market-size tier, growth rate,
 * regulatory intensity, capital intensity, typical gross margin, the dominant
 * moat archetype, and the live scientific/technological frontier that a
 * scientist-analyst would flag.
 *
 * `tamUsdBn` and `cagr` are anchored to recent third-party market research
 * (refreshed 2026-07 against the latest available reports) and each row carries
 * the `sources` it was drawn from, so the market
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
    tamUsdBn: 400, cagr: 0.16, regulatoryIntensity: 0.85, capitalIntensity: 0.55,
    grossMargin: 0.55, competitiveIntensity: 0.8, primaryMoat: "regulatory-license",
    scienceFrontier: "real-time risk ML, on-device fraud graphs, programmable stablecoin rails",
    structuralRisk: "rate-cycle sensitivity and licensing moats favoring incumbents",
    sources: [
      { publisher: "Polaris Market Research", year: 2026, claim: "Fintech ~$395.4B in 2025, ~16.3% CAGR 2026–2034", url: "https://www.polarismarketresearch.com/industry-analysis/fintech-market" },
      { publisher: "Fortune Business Insights", year: 2026, claim: "Fintech $460.8B in 2026 → $1,760.2B by 2034 at 16.2% CAGR", url: "https://www.fortunebusinessinsights.com/fintech-market-108641" },
    ],
  },
  healthtech: {
    id: "healthtech", label: "Healthtech / Digital Health",
    tamUsdBn: 420, cagr: 0.23, regulatoryIntensity: 0.9, capitalIntensity: 0.6,
    grossMargin: 0.6, competitiveIntensity: 0.6, primaryMoat: "regulatory-license",
    scienceFrontier: "multimodal diagnostic models, FDA SaMD pathways, RWE evidence loops",
    structuralRisk: "reimbursement dependency and long clinical validation cycles",
    sources: [
      { publisher: "Grand View Research", year: 2026, claim: "Digital health $420.2B in 2026, 23.4% CAGR 2026–2033", url: "https://www.grandviewresearch.com/industry-analysis/digital-health-market" },
      { publisher: "Fortune Business Insights", year: 2026, claim: "Digital health $491.6B in 2026 at 21.6% CAGR through 2034", url: "https://www.fortunebusinessinsights.com/industry-reports/digital-health-market-100227" },
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
      { publisher: "Fortune Business Insights", year: 2026, claim: "Climate tech $39.1B in 2026 at 23.3% CAGR 2026–2034 (~$31–32B in 2025)", url: "https://www.fortunebusinessinsights.com/climate-tech-market-109849" },
      { publisher: "Precedence Research", year: 2026, claim: "$39.6B in 2026 → $282.0B by 2035 at 24.4% CAGR", url: "https://www.precedenceresearch.com/climate-tech-market" },
    ],
  },
  ai_infra: {
    id: "ai_infra", label: "AI Infrastructure / Tooling",
    tamUsdBn: 190, cagr: 0.19, regulatoryIntensity: 0.35, capitalIntensity: 0.7,
    grossMargin: 0.65, competitiveIntensity: 0.9, primaryMoat: "data-scale",
    scienceFrontier: "inference cost curves, sparse/MoE architectures, eval + safety tooling",
    structuralRisk: "foundation-model commoditization compressing the middle layer",
    sources: [
      { publisher: "MarketsandMarkets", year: 2026, claim: "AI infrastructure $135.8B (2024) → $394.5B by 2030 at 19.4% CAGR (~$190B in 2026)", url: "https://www.marketsandmarkets.com/Market-Reports/ai-infrastructure-market-38254348.html" },
      { publisher: "Precedence Research", year: 2026, claim: "To reach $465.9B by 2034", url: "https://www.precedenceresearch.com/artificial-intelligence-infrastructure-market" },
    ],
  },
  ai_app: {
    id: "ai_app", label: "AI Applications (vertical SaaS)",
    tamUsdBn: 70, cagr: 0.36, regulatoryIntensity: 0.4, capitalIntensity: 0.35,
    grossMargin: 0.7, competitiveIntensity: 0.85, primaryMoat: "switching-costs",
    scienceFrontier: "agentic workflows, domain eval harnesses, retrieval + tool orchestration",
    structuralRisk: "thin wrapper risk — value must accrue above the model layer",
    sources: [
      { publisher: "Global Market Insights", year: 2026, claim: "Generative AI $83.3B in 2026 → $988.4B by 2035 at 31.6% CAGR", url: "https://www.gminsights.com/industry-analysis/generative-ai-market" },
      { publisher: "Fortune Business Insights", year: 2026, claim: "Generative AI $161B in 2026 → $1,260.2B by 2034 at 39.6% CAGR", url: "https://www.fortunebusinessinsights.com/generative-ai-market-107837" },
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
      { publisher: "Grand View Research", year: 2026, claim: "EdTech $187.0B (2025) → $213.2B in 2026 → $437.5B by 2033 at 10.8% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/education-technology-market" },
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
      { publisher: "Grand View Research", year: 2026, claim: "Cybersecurity $271.9B (2025) → $302.0B in 2026 at 11.7% CAGR 2026–2033", url: "https://www.grandviewresearch.com/industry-analysis/cyber-security-market" },
      { publisher: "Mordor Intelligence", year: 2026, claim: "~12.3% CAGR over 2026–2031", url: "https://www.mordorintelligence.com/industry-reports/cyber-security-market" },
    ],
  },
  logistics: {
    id: "logistics", label: "Logistics / Supply Chain",
    tamUsdBn: 72, cagr: 0.13, regulatoryIntensity: 0.5, capitalIntensity: 0.8,
    grossMargin: 0.35, competitiveIntensity: 0.7, primaryMoat: "economies-of-scale",
    scienceFrontier: "autonomy, route optimization, warehouse robotics + vision",
    structuralRisk: "asset heaviness and macro/freight-cycle exposure",
    sources: [
      { publisher: "Research and Markets", year: 2026, claim: "Digital supply-chain/logistics tech ~$72B in 2025 → $146.9B by 2031 (~12.6% CAGR)", url: "https://www.researchandmarkets.com/reports/4896677/digital-logistics-market-global-forecast-2026" },
      { publisher: "Mordor Intelligence", year: 2026, claim: "Narrower digital logistics $55.6B in 2026 → $150.8B by 2031 at 22.1% CAGR", url: "https://www.mordorintelligence.com/industry-reports/digital-logistics-market" },
    ],
  },
  proptech: {
    id: "proptech", label: "Proptech / Real Estate",
    tamUsdBn: 40, cagr: 0.15, regulatoryIntensity: 0.55, capitalIntensity: 0.75,
    grossMargin: 0.5, competitiveIntensity: 0.6, primaryMoat: "data-scale",
    scienceFrontier: "valuation models, energy/DPE analytics, construction automation",
    structuralRisk: "rate sensitivity and balance-sheet-heavy transaction models",
    sources: [
      { publisher: "Fortune Business Insights", year: 2026, claim: "PropTech $44.6B in 2026 (~$40B in 2025) at 11.2% CAGR through 2034", url: "https://www.fortunebusinessinsights.com/proptech-market-108634" },
      { publisher: "Mordor Intelligence", year: 2026, claim: "$53.2B in 2026 at 17.8% CAGR through 2031", url: "https://www.mordorintelligence.com/industry-reports/proptech-market" },
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
    tamUsdBn: 300, cagr: 0.06, regulatoryIntensity: 0.4, capitalIntensity: 0.5,
    grossMargin: 0.68, competitiveIntensity: 0.9, primaryMoat: "brand",
    scienceFrontier: "gen-AI content pipelines, procedural worlds, live-ops ML",
    structuralRisk: "hit-driven revenue, rising production costs, and post-2024 growth deceleration to mid-single digits",
    sources: [
      { publisher: "Newzoo", year: 2026, claim: "Global games market $201.6B in 2025 (+9.1% YoY) → ~$205B in 2026; forward growth mid-single digits", url: "https://gamedevreports.substack.com/p/newzoo-gaming-market-surpassed-200" },
      { publisher: "Grand View Research", year: 2026, claim: "Video games (incl. hardware) $351.6B in 2026 → $498.0B by 2033 at 5.1% CAGR", url: "https://www.grandviewresearch.com/industry-analysis/video-game-market" },
    ],
  },
  agtech: {
    id: "agtech", label: "Agtech / Food",
    tamUsdBn: 35, cagr: 0.12, regulatoryIntensity: 0.6, capitalIntensity: 0.7,
    grossMargin: 0.4, competitiveIntensity: 0.55, primaryMoat: "ip-patents",
    scienceFrontier: "precision ag sensing, biologicals, alt-protein fermentation",
    structuralRisk: "commodity margins and long adoption cycles among growers",
    sources: [
      { publisher: "The Business Research Company", year: 2026, claim: "Agritech $34.6B (2025) → $38.6B in 2026 at 11.5% CAGR", url: "https://www.thebusinessresearchcompany.com/report/agritech-global-market-report" },
      { publisher: "Data Bridge Market Research", year: 2026, claim: "$31.5B in 2025 → $77.9B by 2033 at 13.4% CAGR", url: "https://www.databridgemarketresearch.com/reports/global-agritech-market" },
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
