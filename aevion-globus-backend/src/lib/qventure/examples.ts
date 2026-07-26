/**
 * QVenture — curated example analyses
 * ───────────────────────────────────
 * A small, hand-written set of realistic (fictional) companies spanning sectors
 * and stages. Each is run through the REAL engine + council at seed time — these
 * are genuine QVenture outputs, not hand-set scores — and shown on /qventure/gallery
 * as "example analyses" so a first-time visitor can see the tool's range across
 * sectors without typing anything.
 *
 * Honesty: these are labeled as examples in the UI. They are fictional companies
 * described plausibly; nothing here impersonates a real business or its metrics.
 *
 * Bump SEED_VERSION when this list changes to trigger a clean re-seed on deploy.
 */

import type { AnalysisInput } from "./engine";

export const EXAMPLE_ID_PREFIX = "ex-";
export const SEED_VERSION = 2;

export type ExampleComplexity = "simple" | "medium" | "complex";

export interface ExampleSeed extends AnalysisInput {
  /** Stable id so re-seeding is idempotent (EXAMPLE_ID_PREFIX + slug). */
  slug: string;
  /**
   * How hard this plan is to read. The showcase groups by it so a visitor can
   * see the tool on an easy case AND on one where the evidence is contracts,
   * clinical phases or offtake rather than ARR — which is where a screening
   * tool usually stops working.
   */
  complexity: ExampleComplexity;
  /** One line on what makes this case easy or hard. Shown publicly. */
  whyThisOne: string;
}

export const EXAMPLE_SEEDS: ExampleSeed[] = [
  {
    slug: "ledgerloop",
    complexity: "simple",
    whyThisOne:
      "Textbook SaaS disclosure: MRR, retention, payment volume — the easy case.",
    name: "LedgerLoop",
    sector: "fintech",
    stage: "seed",
    geography: "US",
    askUsd: 4_000_000,
    description:
      "Embedded treasury API that lets vertical SaaS platforms offer their SMB customers interest-bearing operating accounts and same-day payouts without becoming a bank, via a sponsor-bank + ledger abstraction.",
    tractionNotes:
      "$31k MRR across 9 platform partners, 140% net revenue retention, $210M annualized payment volume, 2 sponsor banks live.",
  },
  {
    slug: "novacompute",
    complexity: "complex",
    whyThisOne:
      "Deep-tech infrastructure: the evidence is benchmarks and design wins, not ARR.",
    name: "Nova Compute",
    sector: "ai_infra",
    stage: "seed",
    geography: "US",
    askUsd: 6_000_000,
    description:
      "Inference router that cuts LLM serving cost by dynamically placing each request on the cheapest GPU pool that meets its latency SLA, across spot capacity from five clouds, with automatic failover.",
    tractionNotes:
      "$48k MRR, 22 paying teams, average 41% cost reduction vs single-provider, 99.95% measured uptime over 90 days.",
  },
  {
    slug: "retinascan",
    complexity: "complex",
    whyThisOne:
      "Regulated diagnostics: reads a clearance path and clinical data, not a sales funnel.",
    name: "RetinaScan",
    sector: "healthtech",
    stage: "seed",
    geography: "US",
    askUsd: 5_500_000,
    description:
      "FDA-pathway diagnostic detecting early diabetic retinopathy from a smartphone-attached lens, letting primary-care clinics screen in-visit instead of referring to ophthalmology.",
    tractionNotes:
      "$40k MRR across 18 clinics, 91% sensitivity vs specialist grading in a 900-patient study, breakthrough-device designation filed.",
  },
  {
    slug: "helion-grid",
    complexity: "complex",
    whyThisOne:
      "Energy project finance: offtake and plant status carry the case.",
    name: "Helion Grid",
    sector: "climate",
    stage: "series-a",
    geography: "EU",
    askUsd: 14_000_000,
    description:
      "Software + hardware that aggregates behind-the-meter batteries and EV chargers into a virtual power plant, bidding the pooled capacity into grid balancing markets and sharing revenue with owners.",
    tractionNotes:
      "38 MWh under management, live in 3 balancing markets, EUR 2.1M ARR growing 18% QoQ, gross margin 62%.",
  },
  {
    slug: "vault-bio",
    complexity: "complex",
    whyThisOne:
      "Therapeutics: a trial phase and partnership, with no product revenue at all.",
    name: "Vault Bio",
    sector: "biotech",
    stage: "series-a",
    geography: "US",
    askUsd: 22_000_000,
    description:
      "Generative-protein platform designing thermostable enzymes for industrial manufacturing, replacing petrochemical catalysts in specialty chemicals with a wet-lab-in-the-loop model.",
    tractionNotes:
      "3 paid discovery contracts with chemical majors, one enzyme in pilot-scale production, $3.4M in committed milestone payments.",
  },
  {
    slug: "shelfsense",
    complexity: "simple",
    whyThisOne:
      "Straightforward B2B software metrics.",
    name: "ShelfSense",
    sector: "ai_app",
    stage: "seed",
    geography: "US",
    askUsd: 3_500_000,
    description:
      "Computer-vision app that turns a phone photo of a retail shelf into planogram-compliance and out-of-stock alerts for CPG field reps, replacing manual clipboard audits.",
    tractionNotes:
      "$26k MRR, 12 CPG brands, 60k shelves scanned/month, reps report 3x faster store visits.",
  },
  {
    slug: "cargoflow",
    complexity: "medium",
    whyThisOne:
      "Logistics software with volume metrics that need unpicking from the revenue line.",
    name: "CargoFlow",
    sector: "marketplace",
    stage: "seed",
    geography: "US",
    askUsd: 5_000_000,
    description:
      "Digital freight marketplace matching mid-market shippers with vetted regional carriers, with instant quoting and automated document handling to undercut broker markups.",
    tractionNotes:
      "$1.1M GMV/month, 14% take rate, 320 active carriers, 40% of loads booked with zero human touch.",
  },
  {
    slug: "coldchain-iq",
    complexity: "medium",
    whyThisOne:
      "Hardware-plus-software mix: margins and deployments both matter.",
    name: "ColdChain IQ",
    sector: "saas",
    stage: "series-a",
    geography: "EU",
    askUsd: 11_000_000,
    description:
      "IoT + SaaS platform monitoring temperature and humidity across pharma and food cold chains, with predictive alerts that flag excursions before spoilage and auto-generate audit reports.",
    tractionNotes:
      "EUR 3.8M ARR, 140 enterprise sites, 118% NRR, average 2.3-month payback on hardware.",
  },
  {
    slug: "tutorpath",
    complexity: "simple",
    whyThisOne:
      "Consumer subscription with plain conversion and churn numbers.",
    name: "TutorPath",
    sector: "ai_app",
    stage: "pre-seed",
    geography: "US",
    askUsd: 1_500_000,
    description:
      "AI tutor for high-school math that diagnoses a student's specific misconception from their wrong answers and generates targeted practice, sold to school districts as an intervention tool.",
    tractionNotes:
      "3 paid district pilots, 4,200 active students, average +0.8 grade-level gain over one semester in the largest pilot.",
  },
  {
    slug: "meshpay",
    complexity: "medium",
    whyThisOne:
      "Payments: volume and take rate rather than seats.",
    name: "MeshPay",
    sector: "fintech",
    stage: "series-a",
    geography: "LATAM",
    askUsd: 18_000_000,
    description:
      "Cross-border payroll and contractor-payment rails for LATAM, letting US companies pay local teams in local currency with automated tax withholding and compliance in six countries.",
    tractionNotes:
      "$14M monthly payment volume, 900 business customers, 1.4% blended take rate, live in 6 countries.",
  },
  {
    slug: "biocircular",
    complexity: "complex",
    whyThisOne:
      "Industrial biotech: pilot plant and offtake, capital intensity in the way.",
    name: "BioCircular",
    sector: "climate",
    stage: "seed",
    geography: "EU",
    askUsd: 4_500_000,
    description:
      "Fermentation process converting food-industry waste streams into food-grade protein ingredients, sold to alt-protein and pet-food manufacturers as a drop-in replacement.",
    tractionNotes:
      "Pilot plant at 200 kg/week, 2 offtake LOIs, 30% lower unit cost than incumbent pea protein at target scale.",
  },
  {
    slug: "opsmind",
    complexity: "simple",
    whyThisOne:
      "Clean SaaS traction disclosure.",
    name: "OpsMind",
    sector: "saas",
    stage: "seed",
    geography: "US",
    askUsd: 4_000_000,
    description:
      "AI copilot for DevOps that reads logs, traces, and past incidents to propose a root cause and a rollback plan within seconds of an alert firing, integrated with PagerDuty and Slack.",
    tractionNotes:
      "$34k MRR, 40 engineering teams, median incident triage time down from 22 to 6 minutes for design partners.",
  },
  {
    slug: "farmyield",
    complexity: "medium",
    whyThisOne:
      "Agtech with seasonal revenue and field trials alongside software.",
    name: "FarmYield",
    sector: "ai_app",
    stage: "idea",
    geography: "IN",
    description:
      "Satellite + weather model advising smallholder farmers on irrigation and fertilizer timing via SMS in local languages, monetized through input-supplier referral fees.",
    tractionNotes:
      "Prototype validated on 200 farms with agronomist partner; no revenue yet; strong retention signal in WhatsApp pilot group.",
  },
  {
    slug: "quantledger",
    complexity: "medium",
    whyThisOne:
      "Fintech infrastructure with regulatory surface as well as revenue.",
    name: "QuantLedger",
    sector: "fintech",
    stage: "growth",
    geography: "US",
    askUsd: 40_000_000,
    description:
      "Real-time accounting and close-automation platform for mid-market finance teams, ingesting bank, billing, and payroll data to keep books continuously close-ready.",
    tractionNotes:
      "$11M ARR growing 70% YoY, 620 customers, 125% NRR, gross margin 81%, 14-month CAC payback.",
  },
  // ── Deliberately hard cases ───────────────────────────────────────────────
  // Added with rubric v5 so the showcase spans the full difficulty range. In
  // each of these the evidence is contracts, clearances, offtake or design wins
  // — the shape a screening tool built around ARR reads as "nothing disclosed".
  {
    slug: "sentinel-autonomy",
    complexity: "complex",
    whyThisOne:
      "Defence programme: no ARR at all — the case rests on contracted backlog, deployments and ITAR standing.",
    name: "Sentinel Autonomy",
    sector: "space",
    stage: "series-a",
    geography: "US",
    askUsd: 45_000_000,
    description:
      "Autonomous perimeter surveillance towers with onboard sensor fusion, sold as a product to border and base-security agencies rather than as a cost-plus programme. ITAR registered. Systems are field-tested and in operational use at eleven sites.",
    tractionNotes:
      "Backlog of $62M across signed contracts with two federal agencies. 11 deployments live. $8M non-dilutive from an OTA award. Unit gross margin 41%. 6% annual churn on renewals.",
  },
  {
    slug: "meridian-grid",
    complexity: "complex",
    whyThisOne:
      "Project finance: a signed PPA and an executed interconnection are the traction; revenue arrives years later.",
    name: "Meridian Grid",
    sector: "climate",
    stage: "growth",
    geography: "US",
    askUsd: 120_000_000,
    description:
      "Utility-scale battery storage co-located with solar. A grid interconnection agreement is executed and a 15-year power purchase agreement is signed with the regional utility. The first pilot plant has been running for 14 months.",
    tractionNotes:
      "Contracted revenue of $210M under signed offtake agreements. 3 production sites operational. Gross margin 34%.",
  },
  {
    slug: "harborline",
    complexity: "medium",
    whyThisOne:
      "Marketplace: revenue is GMV times a take rate, and the churn figure is annual, not monthly.",
    name: "Harborline",
    sector: "marketplace",
    stage: "series-a",
    geography: "US",
    askUsd: 30_000_000,
    description:
      "Two-sided marketplace matching independent freight brokers with verified carriers, handling payments, insurance and dispute resolution on platform.",
    tractionNotes:
      "GMV of $180M annualized with a 14% take rate. 4,200 carriers transacting. Net revenue retention 118%. 6% annual churn on the carrier side.",
  },
  {
    slug: "lumen-diagnostics",
    complexity: "complex",
    whyThisOne:
      "Medical device: an FDA clearance and a published sensitivity/specificity study carry more weight than the revenue line.",
    name: "Lumen Diagnostics",
    sector: "healthtech",
    stage: "series-a",
    geography: "US",
    askUsd: 35_000_000,
    description:
      "Point-of-care optical assay for early sepsis detection. FDA 510(k) clearance granted and CE marked. Clinical validation reported 93% sensitivity and 89% specificity in a 1,400-patient study, peer-reviewed.",
    tractionNotes:
      "Deployed in 38 hospitals. $4.2M revenue, 62% gross margin, 4% annual churn. 9 design wins with group purchasing organisations.",
  },
  {
    slug: "nordledger",
    complexity: "medium",
    whyThisOne:
      "Everything is quoted in euros and the churn is annual — read as dollars and monthly, this company looks like a different business.",
    name: "NordLedger",
    sector: "fintech",
    stage: "seed",
    geography: "EU",
    askUsd: 8_000_000,
    description:
      "Treasury automation for European mid-market finance teams, reconciling multi-bank cash positions across the eurozone in one ledger.",
    tractionNotes:
      "EUR 3,000,000 ARR, 18% annual churn, 240 customers, 81% gross margin, CAC EUR 11,000, LTV EUR 52,000.",
  },
  {
    slug: "aegis-concepts",
    complexity: "simple",
    whyThisOne:
      "The easy verdict: a plan that discloses no contracts, no deployments and no tested hardware, in a sector where those are the benchmark.",
    name: "Aegis Concepts",
    sector: "space",
    stage: "series-a",
    geography: "US",
    askUsd: 45_000_000,
    description:
      "Autonomous perimeter surveillance towers with onboard sensor fusion, intended for border and base-security agencies. The team plans to pursue ITAR registration and expects a first field trial next year.",
    tractionNotes:
      "No contracts signed yet. No deployments. Prototype not yet field-tested.",
  },
];
