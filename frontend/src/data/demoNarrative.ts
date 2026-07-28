/**
 * Тексты для демо-экрана: выгоды экосистемы и каждого узла (27 + Planet).
 * Синхронизировано по id с aevion-globus-backend/src/data/projects.ts
 */

/** Порядок как в реестре backend — для демо без API */
export const DEMO_MODULE_ORDER: string[] = [
  "globus",
  "qcoreai",
  "multichat-engine",
  "qfusionai",
  "qright",
  "qsign",
  "aevion-ip-bureau",
  "qtradeoffline",
  "qpaynet-embedded",
  "qmaskcard",
  "veilnetx",
  "cyberchess",
  "healthai",
  "qlife",
  "qgood",
  "psyapp-deps",
  "qpersona",
  "kids-ai-content",
  "voice-of-earth",
  "startup-exchange",
  "deepsan",
  "mapreality",
  "z-tide",
  "qcontract",
  "shadownet",
  "lifebox",
  "qchaingov",
];

/**
 * Блок «боль → что уже есть → почему у нас объёмнее».
 *
 * Демо открывалось инвентарём: «экосистема, доверие, IP, ИИ и финансы на одной
 * карте». Человек, который видит продукт впервые, не знает, зачем ему карта —
 * он знает свою боль. Порядок задан основателем 28.07.2026 и совпадает со
 * структурой писем: сначала боль, потом честный перечень чужих решений, потом
 * чем наше объёмнее — и без обещания «в разы дешевле», которого мы не мерили.
 */
export const painFirst = {
  eyebrow: "Why this exists",
  title: "You made something. Now prove it is yours, license it, and get paid.",
  pains: [
    {
      title: "Proving authorship",
      body:
        "A file says nothing about who made it. Metadata is stripped by the first re-upload, and a screenshot keeps none of it.",
    },
    {
      title: "Licensing",
      body:
        "Agreeing terms means a document, a signature and a counterparty who accepts both. For one image, that is more work than making the image.",
    },
    {
      title: "Getting paid",
      body:
        "A transfer is not a deal. Someone has to record what was sold, on what terms, and what happens if it is disputed.",
    },
  ],
  alternativesTitle: "What already exists — and where each stops",
  alternatives: [
    {
      name: "C2PA / Content Credentials",
      gap: "A manifest inside the file. Survives until the first re-encode, and never touches money.",
    },
    {
      name: "Blockchain timestamps",
      gap: "Prove a moment. Do not prove a person, and issue nothing a counterparty will accept.",
    },
    {
      name: "DocuSign and e-notaries",
      gap: "Built for documents. A frame, a track or a prompt is not their object.",
    },
    {
      name: "Copyright registries",
      gap: "Real and respected — and weeks plus a lawyer per object. Unusable at three items a week.",
    },
  ],
  oursTitle: "What is different here",
  ours: [
    {
      label: "Bigger",
      body:
        "The whole path in one loop: fingerprint → authorship record → signature → certificate → licence → payout. Each step sees the previous one instead of receiving it through a clipboard.",
    },
    {
      label: "Easier",
      body:
        "One login and one settlement unit. Not seven dashboards where one silently falls out of sync with the rest.",
    },
    {
      label: "Cheaper — honestly",
      body:
        "A comparable stack is about seven subscriptions and roughly $162 a month at public July 2026 prices. We do not promise 'many times cheaper': the win is that the steps do not break, which is time rather than money.",
    },
    {
      label: "The part nobody takes",
      body:
        "Banking, transfers and settlement are blocked by licences, not by code. That is not an obstacle — it is an unoccupied niche, and it is where we are heading.",
    },
  ],
};

export const ecosystemIntro = {
  title: "Why the entire AEVION platform matters for investors",
  lead:
    "AEVION is not a collection of separate apps — it is a unified trust operating system: one user identity, a shared signing and integrity layer, IP object registry, authorship & prior-art bureau and compliance layer — and a visual map of how products and teams merge into an ecosystem.",
  bullets: [
    "Integration cost reduction: reusing Auth, QSign and API instead of reinventing the wheel in every product.",
    "Faster time to market: ready-made pipeline 'registry → signature → bureau' to demonstrate maturity to investors and partners.",
    "Scalable story: 40 nodes on Globus — a growth roadmap, not a feature chaos.",
    "Regulatory and ESG transparency: Planet compliance as a foundation for audit and certification.",
    "Network effect: the more modules on the shared platform, the higher the value of data, reputation and cross-selling.",
  ],
};

export const planetLayer = {
  code: "PLANET",
  name: "Planet Compliance — cross-cutting evidence layer",
  summary:
    "Combines artifacts (code, web, media) with validators, evidence root and certificates — to show not just 'what was released' but 'how it was verified'.",
  benefits: [
    "Single source of truth for audit: version chain, voting, Merkle snapshots.",
    "Ready for enterprise and fund conversations: formalized compliance narrative.",
    "Linked to the rest of the platform: same product keys and policies as Bureau/QSign.",
  ],
};

/** Расширенные выгоды по id проекта */
export const moduleBenefits: Record<
  string,
  { tagline: string; benefits: string[]; investorAngle?: string }
> = {
  globus: {
    tagline: "Unified ecosystem map and entry point for users and investors.",
    benefits: [
      "Visualization of 27 directions: status, priority, runtime — no \"slides instead of product\".",
      "Clicking a node leads to a meaningful scenario: location → QRight → signature → bureau.",
      "For the team — release orchestration; for investors — live portfolio pulse on one screen.",
    ],
    investorAngle: "Reduces cognitive load: one URL shows the scale and maturity of the entire product matrix.",
  },
  qcoreai: {
    tagline: "Shared AI engine for all Q-products.",
    benefits: [
      "One agent API and orchestration contract instead of N different chatbots.",
      "Centralized policies, limits and model usage accounting.",
      "Faster experiments: new vertical product connects to the core instead of building AI from scratch.",
    ],
    investorAngle: "OPEX savings on ML/ops and more predictable unit economics per token.",
  },
  "multichat-engine": {
    tagline: "Multi-chat with parallel agents for different tasks.",
    benefits: [
      "User manages code, finances, IP and content in one interface without switching services.",
      "Agents are context-isolated — fewer leaks and hallucinations in critical domains.",
      "Ready B2B foundation: white-label assistants for industries.",
    ],
  },
  qfusionai: {
    tagline: "Hybrid engine for different model providers.",
    benefits: [
      "Vendor lock-in reduction: model switching without UX change.",
      "Auto-select model per task — cost-quality balance.",
      "Resilience to LLM market changes.",
    ],
  },
  qright: {
    tagline: "Independent registry of digital objects and authorship priorities.",
    benefits: [
      "Records the fact of idea/content existence with hash and metadata.",
      "Linked to owner (including via Auth) and to geolocation on Globus.",
      "Foundation for subsequent signing (QSign) and certification (Bureau).",
    ],
    investorAngle: "Builds a 'legally tangible' layer on top of digital creation — the foundation for IP monetization.",
  },
  qsign: {
    tagline: "Cryptographic artifact integrity for the entire ecosystem.",
    benefits: [
      "One payload format for modules — fewer integration errors.",
      "Provability: client can verify signature independently without trusting the UI.",
      "Compliance and audit foundation: what is signed is immutable.",
    ],
  },
  "aevion-ip-bureau": {
    tagline: "Electronic proof-of-authorship bureau: from registry to 'readiness certificate'.",
    benefits: [
      "Connects QRight and QSign in a scenario understandable to lawyers and investors.",
      "Local signature storage + path to PDF/blockchain export (roadmap).",
      "Accelerates due diligence: artifacts collected in one pipeline.",
    ],
  },
  qtradeoffline: {
    tagline: "Trading and transfers without constant internet.",
    benefits: [
      "TAM expansion to regions with unstable connectivity.",
      "Sync and verification when network appears — fewer lost transactions.",
      "Differentiation in the fintech app market.",
    ],
  },
  "qpaynet-embedded": {
    tagline: "Built-in payment core for AEVION applications.",
    benefits: [
      "Unified accounts, fees and accounting within ecosystem.",
      "Faster monetization of new modules — no separate payment MVP needed each time.",
      "Risk control and audit in one pipeline.",
    ],
  },
  qmaskcard: {
    tagline: "Card with masking and anti-fraud.",
    benefits: [
      "Reduced chargebacks and credential leaks.",
      "Premium B2C experience for AEVION fintech lineup.",
      "Cross-sell with QPayNet and QTrade.",
    ],
  },
  veilnetx: {
    tagline: "Privacy and energy efficiency in crypto layer.",
    benefits: [
      "Foundation for ecosystem asset tokenization without privacy compromise.",
      "Positioning for institutional audience.",
      "Synergy with QSign and registries.",
    ],
  },
  cyberchess: {
    tagline: "Next-gen chess: learning, anti-cheat, teams.",
    benefits: [
      "High-engagement content for retention and micropayments.",
      "Esport events as marketing channel for the entire platform.",
      "Real-time and anti-cheat demonstration on shared infrastructure.",
    ],
  },
  healthai: {
    tagline: "Personal AI health coach (not a doctor replacement).",
    benefits: [
      "Sticky daily use — user retention in ecosystem.",
      "Data for premium subscriptions and insurance/wellness partnerships (within regulation).",
      "Cross-selling with QGood and content.",
    ],
  },
  qlife: {
    tagline: "Longevity and anti-aging: biomarker plans.",
    benefits: [
      "Premium segment with high LTV.",
      "Long data retention horizons — value for R&D partners.",
      "Strengthens HealthAI as product family.",
    ],
  },
  qgood: {
    tagline: "Psychological wellbeing with AI and offline mode.",
    benefits: [
      "Socially significant product — ESG agenda for investors.",
      "Deep personalization raises the barrier to copying.",
      "Synergy with PsyApp and Kids AI.",
    ],
  },
  "psyapp-deps": {
    tagline: "Addiction recovery support.",
    benefits: [
      "Acute social demand; partnerships with NGOs and clinics.",
      "Long-term user retention programs.",
      "Trust through privacy and ethical design.",
    ],
  },
  qpersona: {
    tagline: "Digital avatar for work and communication.",
    benefits: [
      "New subscription class: customization and premium assets.",
      "Integration with Multichat and content.",
      "Bridge between 'human' and all Q-services.",
    ],
  },
  "kids-ai-content": {
    tagline: "Children education, multilingual, safe content.",
    benefits: [
      "Parent segment with high willingness to pay.",
      "AEVION brand trust in families — upsell to other services.",
      "Localization as scaling to countries.",
    ],
  },
  "voice-of-earth": {
    tagline: "International music content project.",
    benefits: [
      "Emotional marketing and brand recognition.",
      "Cross-media: music → apps → merch.",
      "Cultural ESG narrative.",
    ],
  },
  "startup-exchange": {
    tagline: "Ideas and startup exchange with authorship protection.",
    benefits: [
      "Direct link to QRight/IP Bureau — unique USP.",
      "Commission from deals and subscriptions for investors/funds.",
      "Network effect: more ideas → more liquidity.",
    ],
    investorAngle: "Turns ecosystem into marketplace, not just a utility set.",
  },
  deepsan: {
    tagline: "Anti-chaos: focus, task structure.",
    benefits: [
      "Daily utility — ecosystem entry for knowledge workers.",
      "Productivity data for AI personalization.",
      "Low implementation threshold.",
    ],
  },
  mapreality: {
    tagline: "Map of real needs and events.",
    benefits: [
      "Aggregated signals for B2G and media.",
      "Data potential as separate asset (with ethics and consent).",
      "Strengthens Globus as a 'meaning map', not just products.",
    ],
  },
  "z-tide": {
    tagline: "Energy/emotion currency concept.",
    benefits: [
      "Research foundation for future token mechanics.",
      "Media and philosophical brand differentiator.",
      "Link to community and DAO roadmap.",
    ],
  },
  qcontract: {
    tagline: "Smart documents with access control and lifespan.",
    benefits: [
      "Reduced legal risks in B2B pipelines.",
      "Combines with QSign and Planet for full cycle.",
      "Premium for enterprise.",
    ],
  },
  shadownet: {
    tagline: "Alternative private network.",
    benefits: [
      "Long-term R&D asset in privacy narrative.",
      "Synergy with VeilNetX and regulatory-sensitive products.",
    ],
  },
  lifebox: {
    tagline: "Digital vault for the next generation.",
    benefits: [
      "Emotionally strong use case — high willingness to pay.",
      "Long-term storage = trust in AEVION infrastructure.",
      "Compliance and inheritance as separate revenue line.",
    ],
  },
  qchaingov: {
    tagline: "DAO and transparent community governance.",
    benefits: [
      "Value distribution mechanism for ecosystem holders and participants.",
      "Link to Planet voting and reputation.",
      "History for tokenization and public goods.",
    ],
  },
};
