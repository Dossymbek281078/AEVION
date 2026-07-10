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
export const SEED_VERSION = 1;

export interface ExampleSeed extends AnalysisInput {
  /** Stable id so re-seeding is idempotent (EXAMPLE_ID_PREFIX + slug). */
  slug: string;
}

export const EXAMPLE_SEEDS: ExampleSeed[] = [
  {
    slug: "ledgerloop",
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
];
