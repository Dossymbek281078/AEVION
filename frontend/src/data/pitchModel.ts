/**
 * AEVION investor pitch model — single source of truth for /pitch tour and
 * "why this matters" callouts on individual module landings.
 *
 * Everything here is plain data. UI components read it and render.
 * AutoTranslate (DOM walker, ru-only) handles RU rendering at runtime.
 *
 * СЧЁТЧИКИ МОДУЛЕЙ БЕРУТСЯ ИЗ pitchFacts, А НЕ ПИШУТСЯ ЦИФРОЙ.
 * До 10.08.2026 они были литералами прямо в текстах, и /pitch на проде
 * противоречил сам себе в пределах одного экрана: «12 live MVPs of 33
 * planned nodes» в шапке, «41 product nodes» в лиде, «one of 41 modules»
 * в сравнении и «13 of 41 nodes committed, remaining 15» в рисках. Реестр
 * при этом отдавал 41 запись / 36 живых. pitchFacts заперт на реестр
 * считающим сторожем — вписывать сюда число заново значит вернуть расхождение.
 */

import {
  COMMITTED_NODES,
  DEEP_DIVE_MODULES,
  FEATURE_COMPLETE_LABEL,
  LIVE_MODULES,
  MODULE_NODES,
} from "./pitchFacts";

export type LaunchStage = "live" | "beta" | "alpha" | "vision";
export type ValueBucket =
  | "infrastructure" // foundational — every other module sits on top
  | "ip-and-trust"   // the IP / certificate / signature pipeline
  | "money"          // economic layer
  | "engagement"     // sticky daily-use products
  | "intelligence"   // AI engines and assistants
  | "compliance";    // governance, audit, legal

export type PitchModule = {
  /** id matches src/data/demoNarrative.ts and backend project ids */
  id: string;
  /** uppercase short code shown in hero/cards */
  code: string;
  /** human label */
  name: string;
  href: string | null;
  stage: LaunchStage;
  bucket: ValueBucket;
  /** one line — what this is */
  tagline: string;
  /** the customer pain this removes */
  problem: string;
  /** the single thing investors should remember */
  killerFeature: string;
  /** how this becomes more valuable as the rest of AEVION grows */
  networkRole: string;
  /** dollar buckets / quantifiable proof points already on the landing */
  proof: string[];
  /** the line that justifies the partnership value */
  valueLine: string;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Thesis & macro                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const thesis = {
  badge: "AEVION · Trust operating system",
  title: "The trust layer for the next decade of digital creation",
  lead:
    "AEVION is one identity, one signing layer, one IP registry, one authorship & prior-art bureau, one compliance " +
    `rail and one wallet — already wired together as a working system. ${MODULE_NODES} product nodes, ` +
    `${LIVE_MODULES} deployed and reachable today (${FEATURE_COMPLETE_LABEL}), all sharing the same ` +
    "Trust Graph. We monetise three of the largest underserved " +
    "markets at once: IP enforcement, the creator economy, and digital assets.",
  pillars: [
    {
      kicker: "ONE IDENTITY",
      title: `Single AEVION account → ${MODULE_NODES} nodes`,
      body:
        "JWT issued once by Auth unlocks every product. No fragmentation, no Stripe-style integration tax for new modules.",
    },
    {
      kicker: "ONE PIPELINE",
      title: "Idea → registry → signature → bureau → certificate",
      body:
        "QRight registers the work, QSign seals it with HMAC-SHA256, IP Bureau issues an Ed25519 certificate — admissible evidence of authorship & timestamp — with Shamir Secret Sharing, Planet validates compliance — all in one click.",
    },
    {
      kicker: "ONE TRUST GRAPH",
      title: "Every action accrues reputation",
      body:
        "Bank tier, advance limits, voting weight, tournament eligibility — all derived from the same composite score across modules — an integration a single-vertical competitor would have to rebuild end-to-end.",
    },
  ],
} as const;

export const market = {
  title: "Three large markets — directional TAM, not a revenue claim",
  buckets: [
    {
      name: "IP licensing & enforcement",
      tam: "$180B",
      note: "Royalties, patent monetisation, anti-piracy. WIPO-aligned legal frameworks built in.",
    },
    {
      name: "Creator economy",
      tam: "$104B",
      note: "Payouts, awards, recurring micro-revenue. Royalties auto-stream into Bank.",
    },
    {
      name: "Digital payments & wallets",
      tam: "$56B",
      note: "AEC ledger underwrites every internal transfer, plus open APIs for fintech partners.",
    },
  ],
  closing:
    "We do not pick one bucket — the same Trust Graph is sold three times to three different buyers. " +
    "Cross-sell is a side-effect of the architecture, not a feature. These are top-down category TAM " +
    "estimates for context, not a revenue forecast: AEVION is pre-revenue today, and the capturable " +
    "SAM/SOM is a fraction, sized bottom-up in the data room.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Unit economics — honest bottom-up (real prices × labelled assumptions)      */
/* ────────────────────────────────────────────────────────────────────────── */

export const unitEconomics = {
  title: "Bottom-up revenue — three flagships, transparent assumptions",
  intro:
    "AEVION is pre-revenue. Instead of a top-down forecast, here is a conservative bottom-up model " +
    "for three flagship modules, built on real published prices and explicit, labelled assumptions. " +
    "Every input is an assumption you can challenge — not a claim. Beachhead = first paying cohort; " +
    "Regional = a 3–5-year KZ / CIS / MENA reach.",
  flagships: [
    {
      module: "QBuild — construction & SME hiring",
      market: "KZ → CIS. The founder's home market (construction-trust operator).",
      price: "4 990 ₽/mo Pro (≈$49 at ~100 ₽/$, ~$470/yr annual) — undercuts HH's ~$100+/mo résumé access",
      assumptions: [
        "KZ has 100k+ active construction/SME employers; freemium reach ~5%",
        "Free → Pro conversion ~2–3% (conservative for vertical SaaS)",
      ],
      beachhead: { unit: "500 paying employers", arr: "$235K" },
      regional: { unit: "5,000 paying employers", arr: "$2.35M" },
    },
    {
      module: "Ecosystem All-Access",
      market: "Creators & professionals wanting IP + wallet + AI in one place.",
      price: "$49/mo ($41/mo annual = $490/yr) — the real published Full-tier price (repriced 2026-08-13)",
      assumptions: [
        "Consumer subscription, converts off free ecosystem usage",
        "Distribution-gated — modelled at modest penetration",
        "Subscriber counts never moved — only the price input. The ladder came DOWN on 2026-08-13, so this line came down with it",
      ],
      beachhead: { unit: "1,000 subscribers", arr: "$490K" },
      regional: { unit: "10,000 subscribers", arr: "$4.9M" },
    },
    {
      module: "QCoreAI — AI API for gov/enterprise",
      market: "Compliance-friendly AI 'last mile' in KZ / UZ / AZ.",
      price: "Usage-based: provider token cost + margin; free 100k tokens/mo",
      assumptions: [
        "B2B usage-based; average paying-org spend modelled conservatively",
        "~20–30% gross margin over provider token cost",
      ],
      beachhead: { unit: "20 orgs × ~$500/mo", arr: "$120K" },
      regional: { unit: "200 orgs × ~$1k/mo", arr: "$2.4M" },
    },
  ],
  totals: { beachhead: "≈ $0.85M ARR", regional: "≈ $9.65M ARR" },
  note:
    `Three flagships only — the other ${MODULE_NODES - 3} modules are upside, not in this figure. Deliberately modest ` +
    "and defensible: a first-question-of-due-diligence model, not a hockey stick. Market-size and " +
    "conversion inputs are the assumptions most worth challenging. Totals moved DOWN from ≈$1.2M / ≈$13.7M " +
    "on 2026-08-18 for one reason only — the All-Access flagship is the live Full tier, repriced " +
    "$89 → $49/mo. No conversion or reach assumption was touched in either direction; the model follows " +
    "the published price, not the other way round.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Universe Seat + Anthropic-launch growth                                     */
/* One seat = the whole ecosystem. Every number below is a labelled assumption */
/* you can challenge. No Anthropic distribution deal is signed; pre-revenue.    */
/* ────────────────────────────────────────────────────────────────────────── */

export const launchGrowth = {
  title: "The Universe Seat — one price, the whole ecosystem",
  seat: {
    headline: "$149 / mo",
    annual: "One premium seat — no tiers. Introductory price for the first 6–12 months; rises as the ecosystem matures.",
    what: "One seat unlocks every module today + everything shipped next. A free tier sits underneath as the on-ramp.",
    anchor:
      "Priced against the stack, not a single tool. Serious usage on any one tool already runs $100–200/mo " +
      "(Claude Max $200, ChatGPT Pro $200, Gemini Ultra ~$250), and a working creator stacks several — " +
      "Claude + Midjourney + ElevenLabs + Higgsfield easily clears $200–400/mo across four logins. AEVION is " +
      "one seat at $149, BELOW any single one of those, for the whole platform. The earlier version of this " +
      "paragraph argued the opposite — that the flagship must sit ABOVE a premium tool — and that argument " +
      "died with the 2026-08-13 reprice. Keeping it would have left a false claim in the pitch.",
    honesty:
      "$149 is a real \"Universe\" tier in the live plan (repriced $249.99 → $149 on 2026-08-13), sitting above " +
      "the kept on-ramps ($0/$19/$29/$49) — it has no Lemon Squeezy variant yet, so its checkout falls through " +
      "to Gumroad/stub until one is configured. Most modules are early " +
      "MVPs and the cross-module agent layer is still early, so \"replaces your stack\" is the promise the " +
      "price rests on — which is why the intro price + a free tier underneath are there to earn the upgrade " +
      "before the price rises.",
  },
  // Gross margin / token COGS — the seat bundles AI, so revenue ≠ gross profit.
  economics: {
    title: "Gross margin & token COGS — revenue is not gross profit",
    moat:
      "AEVION already meters every request per user (tokensIn/out across all providers) and routes across " +
      "a deep provider roster — including free (OpenRouter, Together, Groq, Cerebras) and local (Ollama, " +
      "LM Studio, $0 marginal) models. A single-vendor AI product cannot arbitrage cost this way.",
    margin:
      "At efficient routing (~$0.5/1M blended) and ~15% allowance utilisation, gross margin is ~85–95% " +
      "across paid tiers (Lite $19/2M · Medium $29/10M · Full $49/50M · Universe $149/200M tokens/mo). " +
      "Each tier also carries a premium-model sub-cap at 10% of its overall allowance, so the worst case is " +
      "bounded, not open-ended. The tail risk is a " +
      "power user maxing the cap on a frontier model — which is why margin depends on two levers, not luck.",
    levers: [
      "Efficient default routing — frontier (Opus/GPT-4o) on request or on higher tiers, cheap models by default.",
      "Enforce the per-tier monthly token cap (metered today; enforcement is a pre-launch fast-follow).",
      "Overage billing + bring-your-own-key for heavy users — offloads COGS toward zero.",
    ],
    honesty:
      "Today the caps are metered but not fully enforced on paid tiers, and the Anthropic provider still " +
      "defaults to an expensive model. Both are cheap fixes, but until they ship the ~85–95% margin is a " +
      "target, not a measured number. Stated plainly so diligence doesn't have to discover it.",
  },
  // Funnel inputs — every one is an assumption, not a claim.
  assumptions: [
    "Distribution: a launch with Anthropic reaches ~1.5M Claude users over year 1 (a small slice of their base) — the single biggest assumption, and unproven until a deal is signed.",
    "Reach → free signup: 4% (conservative for a cross-promo CTA).",
    "Free → paid seat: ramps 0.4% (M1) → 1.0% (M6) → 1.3% (M12) — premium price + early-MVP depth means cold conversion is deliberately low.",
    "Seat ARPU: ~$1,490/yr (annual-leaning — the annual plan is list × 10, i.e. $149 × 10 = $1,490).",
    "Reach front-loads: 20% lands by M1, 60% by M6, 100% by M12.",
  ],
  // Growth dynamics at the base scenario (1.5M reach).
  rows: [
    { month: "Month 1", reached: "300K", free: "12K", paid: "~50", arr: "≈$0.13M run-rate" },
    { month: "Month 6", reached: "900K", free: "36K", paid: "~350", arr: "≈$0.88M run-rate" },
    { month: "Month 12", reached: "1.5M", free: "60K", paid: "~780", arr: "≈$2.0M" },
  ],
  scenarios: [
    { label: "Conservative — 250K reach", arr: "≈$0.33M ARR" },
    { label: "Base — 1.5M reach", arr: "≈$2.0M ARR" },
    { label: "Aggressive — 8M reach (featured/bundled)", arr: "≈$10.4M ARR" },
  ],
  note:
    "This is a scenario, not a forecast — it stands or falls on the distribution assumption, and no " +
    "Anthropic deal is signed. Fewer paid seats than a cheaper tier would win, but a higher premium ARPU. " +
    "Seat counts are unchanged from the $149.99 version of this model; only the ARPU input moved with the " +
    "2026-07-22 repricing. The base case (≈$2.0M ARR by month 12) and the ≈$1.2M beachhead of the bottom-up " +
    "model above are two independent methods landing within ~1.7× of each other — not identical, but the " +
    "same order of magnitude, which is the honest signal for diligence.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Network effects — the 4 forces                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export const networkForces = [
  {
    code: "DATA",
    title: "Trust Graph (data network effect)",
    body:
      "Every registration, signature, vote, transfer and tournament adds an edge to the graph. " +
      "After ~10K active users the graph is self-defensible — competitors can build a registry, but not a graph.",
    flywheel: "Action → graph edge → better recommendations / fairer scoring → more actions.",
  },
  {
    code: "ECON",
    title: "Creator → consumer (economic network effect)",
    body:
      "Creators register IP in QRight, fans pay through AEVION Bank, royalties auto-flow back. " +
      "Each side pulls in the other; switching to a competitor breaks the royalty stream.",
    flywheel: "More creators → more content → more fans → bigger payouts → more creators.",
  },
  {
    code: "SWITCH",
    title: "Switching costs (financial network effect)",
    body:
      "Bank ties balance, savings goals, recurring payments, achievements and tier perks to the same identity. " +
      "Average user accumulates 6+ scheduled flows after 90 days — leaving means rebuilding all of them.",
    flywheel: "Time in product → automation → switching cost → retention.",
  },
  {
    code: "SCOPE",
    title: "Cross-module pull (scope network effect)",
    body:
      "Every new module makes existing modules more valuable: a new game in CyberChess raises Bank " +
      "engagement; a new Awards track raises QRight registrations; a new AI agent in QCoreAI makes Multichat stickier. " +
      "Marginal cost of a new node is near zero — they all share Auth, Bureau, Bank and Trust Graph.",
    flywheel: "+1 module → +N value across all modules.",
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Per-module pitch cards — 12 with live landings + 15 ecosystem nodes        */
/* ────────────────────────────────────────────────────────────────────────── */

export const launchedModules: PitchModule[] = [
  {
    id: "auth",
    code: "AUTH",
    name: "Identity",
    href: "/auth",
    stage: "live",
    bucket: "infrastructure",
    tagline: `Single AEVION account — JWT that unlocks all ${MODULE_NODES} modules.`,
    problem:
      "Every fintech, IP-tech and creator-tech product reinvents auth. The integration tax kills new modules and confuses users.",
    killerFeature:
      "One register-or-login flow, one token in localStorage, one introspection endpoint. New modules plug in for free.",
    networkRole:
      "The Trust Graph cannot exist without one identity. Every other module's value composes on top of Auth.",
    proof: ["Live JWT issuance", "Used by all 11 other launched modules", "Persisted role + name + email"],
    valueLine: "Distribution moat: every new acquisition flows once through Auth, then is monetised across 41 surfaces.",
  },
  {
    id: "qright",
    code: "QRIGHT",
    name: "IP Registry",
    href: "/qright",
    stage: "live",
    bucket: "ip-and-trust",
    tagline: "SHA-256 timestamp + author binding + geolocation — instant proof of creation.",
    problem:
      "Cryptographic proof of creation today costs thousands and takes weeks (notaries, copyright filings). Independent creators can't afford it; AI-generated work has no clear pathway at all.",
    killerFeature:
      "4-step single-click pipeline: describe → SHA-256 hash → HMAC seal → Quantum Shield (Ed25519 + Shamir) → downloadable PDF certificate. Built into Bank, Awards and Bureau.",
    networkRole:
      "QRight is the entry point of the entire trust pipeline. Every certificate, every royalty, every Awards vote starts with a QRight record.",
    proof: ["Live registry counter", "3-layer crypto stack", "Geolocation auto-fill from Globus", "PDF cert via /api/pipeline/certificate/{id}/pdf"],
    valueLine: "Every registration is a permanent edge in the Trust Graph and a future revenue stream (per-verification, per-licence, per-royalty).",
  },
  {
    id: "qsign",
    code: "QSIGN",
    name: "Cryptographic Signatures",
    href: "/qsign",
    stage: "live",
    bucket: "ip-and-trust",
    tagline: "HMAC-SHA256 sign and verify — auto-invoked from QRight and Bureau.",
    problem:
      "Without a unified integrity layer, every module re-implements signing differently — making cross-module audit impossible.",
    killerFeature:
      "Single payload format across the ecosystem. Client-verifiable without trusting the UI. Auto-triggers Quantum Shield sharding for high-value artifacts.",
    networkRole:
      "QSign is the integrity guarantee that makes the Trust Graph trustworthy. Without it, registry entries are claims, not proofs.",
    proof: ["Live shield/shard count", "/api/qsign/sign + /verify", "Demo-ready payload editor"],
    valueLine: "Compliance/audit revenue line on its own (the multi-billion HSM and e-signing market) — bundled here at zero marginal cost.",
  },
  {
    id: "aevion-ip-bureau",
    code: "BUREAU",
    name: "IP Bureau",
    href: "/bureau",
    stage: "live",
    bucket: "ip-and-trust",
    tagline: "Cryptographic proof-of-authorship bureau — admissible certificates in seconds.",
    problem:
      "Patent and IP filings take 6–18 months and cost $5K–$25K. There is no instant, internationally-recognised proof-of-prior-art mechanism for digital work.",
    killerFeature:
      "Ed25519 + Shamir SSS + 6 international legal frameworks (Berne, WIPO, TRIPS, eIDAS, ESIGN, KZ Digital Sig) → downloadable PDF certificate, verifiable by any third party at /verify/{id}.",
    networkRole:
      "Bureau is the legally-defensible output of the entire registry+signature pipeline. Sets the floor for what AEVION certificates are worth in court.",
    proof: ["Live cert count", "164+ WTO member states in legal scope", "Public verify portal with no-login validation"],
    valueLine: "First-mover advantage: the moat is the integrated Trust Graph and network effects, not the concept — a competitor must rebuild registry, signature, timestamp, compliance and wallet as one system, then earn the graph from zero.",
  },
  {
    id: "quantum-shield",
    code: "SHIELD",
    name: "Quantum Shield",
    href: "/quantum-shield",
    stage: "live",
    bucket: "ip-and-trust",
    tagline: "Post-quantum Ed25519 + Shamir's Secret Sharing for threshold key recovery.",
    problem:
      "Single-key custody is fragile and quantum-computing-vulnerable. Multi-party threshold cryptography is complex and rarely deployed.",
    killerFeature:
      "Animated shard visualizer (canvas particle effects) on a working 2-of-3 (or custom-N) threshold scheme. Auto-invoked by QSign for high-value artifacts.",
    networkRole:
      "Shield is the cryptographic moat that makes Bureau certificates quantum-resistant — a credible '10-year defensibility' story for institutional investors.",
    proof: ["Live shield records dashboard", "Demo with 4 sample shards (2-of-3 threshold)", "Graceful fallback if API unreachable"],
    valueLine: "Post-quantum signatures available (real ML-DSA-65 / FIPS 204, opt-in) — an institutional-grade trust signal ahead of the migration.",
  },
  {
    id: "bank",
    code: "BANK",
    name: "AEVION Bank",
    href: "/bank",
    stage: "live",
    bucket: "money",
    tagline: "Wallet + auto-royalties + savings + Trust-Graph-gated credit, all in one app.",
    problem:
      "Creators earn fragments of revenue from many sources — streaming royalties, awards, micropayments, tips — but have no place to aggregate, save, lend against, or automate around it.",
    killerFeature:
      "5-tab unified dashboard (Overview / Earn / Send / Grow / Security) with 18+ shipping features: auto-royalty stream from QRight, salary advance gated by Trust Score, 5 Autopilot rules, biometric WebAuthn guard, ⌘K command palette, holographic QR share, Wealth Constellation map, multilingual EN/RU/KZ.",
    networkRole:
      "Bank is the economic exhaust of every other module. Royalties, prizes, awards payouts and tournament wins all settle here — making Bank the single most expensive module to leave.",
    proof: ["18 shipping features + 5 Autopilot rules", "8-factor Trust Score with radar visualisation", "Multilingual EN/RU/KZ shipping today", "Build green, /bank static-rendered"],
    valueLine: "Bank turns the platform from 'tools you visit' into 'a balance you check daily' — the daily-use retention anchor of the ecosystem.",
  },
  {
    id: "qcoreai",
    code: "QCOREAI",
    name: "Multi-model AI Engine",
    href: "/qcoreai",
    stage: "live",
    bucket: "intelligence",
    tagline: "One AI surface across Claude, GPT-4o, Gemini, DeepSeek, Grok — knows every AEVION module.",
    problem:
      "Users juggle 4–5 AI products and lose context. Building yet another wrapper is meaningless — what's missing is a domain-aware AI that knows your IP portfolio, your wallet and your tier.",
    killerFeature:
      "Live provider/model switching, suggested prompts seeded with AEVION concepts, graceful 'all-providers-down' fallback, OPEX savings via centralised model routing.",
    networkRole:
      "QCoreAI is the intelligence backbone for Multichat, Bank Advisor, Bank Copilot and every future agent. Centralised model usage accounting → predictable per-token economics.",
    proof: ["5 production providers wired", "Suggestion deck explains the ecosystem", "/api/qcoreai/providers live"],
    valueLine: `Centralised LLM spend across ${MODULE_NODES} nodes vs. 27 separate API contracts — single biggest OPEX win in the company.`,
  },
  {
    id: "qtrade",
    code: "QTRADE",
    name: "QTrade Ledger",
    href: "/qtrade",
    stage: "live",
    bucket: "money",
    tagline: "Lightweight non-custodial ledger — accounts, top-ups, P2P transfers, CSV audit.",
    problem:
      "AEVION needs an internal currency (AEC) to model royalties, prizes and bonuses. Banks and custodial wallets are overkill for an internal economy.",
    killerFeature:
      "Create account → top-up → transfer → see live summary, all backed by /api/qtrade/* with CSV exports for audit.",
    networkRole:
      "Every transfer adds an economic edge to the Trust Graph. QTrade is the substrate AEVION Bank renders on top of.",
    proof: ["/api/qtrade/{accounts,transfers,operations}.csv", "Live summary metrics", "Used by Bank for AEC settlement"],
    valueLine: "Owns the rails — every internal payment touches QTrade and emits a Trust Graph signal.",
  },
  {
    id: "planet",
    code: "PLANET",
    name: "Planet Compliance",
    href: "/planet",
    stage: "live",
    bucket: "compliance",
    tagline: "Cross-cutting evidence root — multi-validator certification for code, music, video, web.",
    problem:
      "Modern compliance asks 'who validated this' — not just 'is it signed'. Without a transparent voting validator network, certificates are still single-party claims.",
    killerFeature:
      "Submission → multi-validator review → signed certificate with vote tally. Linked to Awards (Music/Film) and to Trust Score (Planet bonuses).",
    networkRole:
      "Planet is the social proof layer on top of cryptographic proof. The bigger the validator network, the more defensible every Bureau certificate becomes.",
    proof: ["Live: 12 participants · 8 voters · 3 certified · 15 submissions", "/api/planet/stats", "Powers Awards/Music + Awards/Film tracks"],
    valueLine: "Enterprise-grade compliance line of business — sold separately to ESG, audit and regulator buyers.",
  },
  {
    id: "awards",
    code: "AWARDS",
    name: "AEVION Awards",
    href: "/awards",
    stage: "live",
    bucket: "engagement",
    tagline: "Music & Film tracks on the Planet validator layer — recognition with AEC payout.",
    problem:
      "AI-generated music and film have no home in the traditional awards landscape. Independent creators need recognition pathways tied directly to revenue.",
    killerFeature:
      "Two production tracks (Music, Film) with submissions, voting, certification — winners receive AEC payouts straight into Bank.",
    networkRole:
      "Awards drive QRight registrations (you must register before submitting), Planet validation activity, and Bank inflows. Every award is a Trust Graph trifecta.",
    proof: ["Live submission/cert counts via Planet API", "Two distinct tracks (Music + Film)", "AEC payout integrated with Bank"],
    valueLine: "Marketing engine: every award winner is a case study + a recurring user across QRight, Bank and Planet.",
  },
  {
    id: "cyberchess",
    code: "CHESS",
    name: "CyberChess",
    href: "/cyberchess",
    stage: "live",
    bucket: "engagement",
    tagline: "Stockfish-backed engine, 1000+ puzzles, AI coach — wins flow into your Trust Score.",
    problem:
      "Chess platforms are visually decades old, and none tie skill to a broader reputation system or wallet.",
    killerFeature:
      "Full-featured engine (JavaScript minimax + Stockfish WASM), MultiPV analysis depth 8–22, premove queue, 6+ puzzle tiers, AI coach annotating blunders/mistakes/inaccuracies, blitz/rapid/bullet with live clock.",
    networkRole:
      "Wins boost Bank Trust tier → unlock higher salary advances. Tournament prizes settle in AEC. Daily-use engagement product → highest retention surface in the ecosystem.",
    proof: ["1000+ puzzles", "Stockfish + minimax dual engine", "Up to 200 saved games per user", "ELO + win/loss/draw widgets"],
    valueLine: "Engagement dynamo — chess's daily-active behaviour pulls every adjacent module's MAU/DAU ratio up.",
  },
  {
    id: "multichat-engine",
    code: "MULTICHAT",
    name: "Multichat Engine",
    href: "/multichat-engine",
    stage: "beta",
    bucket: "intelligence",
    tagline: "Parallel agent sessions over QCoreAI — code, finance, IP, content in one window.",
    problem:
      "Users open 4 tabs to work with 4 different AI assistants. There is no unified surface where parallel agents can hold context per-domain.",
    killerFeature:
      "MVP /api/qcoreai/chat backend wired; roadmap to parallel sessions, role isolation, white-label B2B agents.",
    networkRole:
      "Multichat is the social/agent glue for Planet voting, Bank Advisor, Awards judging, and customer service across the whole platform.",
    proof: ["Single /api/qcoreai/chat endpoint live", "Health check live", "Designed as agent foundation"],
    valueLine: "B2B white-label agent foundation — sold to enterprise as 'AEVION inside' for $X/seat/month.",
  },
  {
    id: "qreal",
    code: "QREAL",
    name: "QReal Studio",
    href: "/qreal",
    stage: "live",
    bucket: "intelligence",
    tagline: "Fully-alive AI video from a text brief — no actor, direct engine APIs, built-in provenance.",
    problem:
      "Photoreal AI video today is single-clip reroll culture: no direction, characters drift between shots, and 'realistic' output ships with zero provenance — a deepfake liability, not a product.",
    killerFeature:
      "Brief → LLM storyboard (cached) → direct Seedance/Kling APIs (no middleman, transparent $/s) → 14-criterion realism QC → server-assembled film with a non-removable AI mark (C2PA-style, EU AI Act art. 50).",
    networkRole:
      "Every assembled film carries a sha256 provenance manifest — feeding QRight registrations, Bureau certificates and the platform Trust Graph. Creator output becomes protected IP by default.",
    proof: [
      "Idea → production in 2 days (8 merged PRs)",
      "Demo film rendered end-to-end for $2.52 in engine costs",
      "Quotas, Postgres persistence and daily prod smoke (14 asserts) live",
    ],
    valueLine: "Paid add-on $29/mo over known unit economics ($0.13–0.30/s render) — margin visible per film, not per faith.",
  },
];

/* Ecosystem nodes that map to product slots in the 41-node Globus but don't have stand-alone landings yet. */
export const ecosystemNodes: Array<Pick<PitchModule, "id" | "code" | "name" | "stage" | "bucket" | "tagline" | "valueLine">> = [
  { id: "qfusionai", code: "QFUSIONAI", name: "QFusionAI", stage: "alpha", bucket: "intelligence", tagline: "Hybrid model router — auto-select best provider per task.", valueLine: "Reduces vendor lock-in; smooths LLM market volatility." },
  { id: "qtradeoffline", code: "QTRADE-OFFLINE", name: "QTrade Offline", stage: "vision", bucket: "money", tagline: "Trade and transfer without constant connectivity.", valueLine: "TAM expansion to emerging markets and remote regions." },
  { id: "qpaynet-embedded", code: "QPAYNET", name: "QPayNet Embedded", stage: "vision", bucket: "money", tagline: "Embedded payments core for AEVION apps and partners.", valueLine: "Faster monetisation of every new vertical — no payment MVP needed each time." },
  { id: "qmaskcard", code: "QMASKCARD", name: "QMaskCard", stage: "vision", bucket: "money", tagline: "Privacy-first card with masking and anti-fraud.", valueLine: "Premium B2C SKU; cross-sell with QPayNet and QTrade." },
  { id: "veilnetx", code: "VEILNETX", name: "VeilNetX", stage: "vision", bucket: "infrastructure", tagline: "Privacy-preserving and energy-efficient crypto layer.", valueLine: "Foundation for tokenisation without privacy compromise — institutional positioning." },
  { id: "healthai", code: "HEALTHAI", name: "HealthAI", stage: "vision", bucket: "engagement", tagline: "Personal AI health coach (not a doctor replacement).", valueLine: "Sticky daily-use; insurance/wellness partnerships within regulation." },
  { id: "qlife", code: "QLIFE", name: "QLife", stage: "vision", bucket: "engagement", tagline: "Longevity and anti-aging biomarker plans.", valueLine: "Premium high-LTV segment; long retention horizons." },
  { id: "qgood", code: "QGOOD", name: "QGood", stage: "vision", bucket: "engagement", tagline: "Psychological wellbeing with AI and offline mode.", valueLine: "Socially significant — ESG line for institutional investors." },
  { id: "psyapp-deps", code: "PSYAPP", name: "PsyApp Deps", stage: "vision", bucket: "engagement", tagline: "Addiction recovery support with NGO and clinic partnerships.", valueLine: "Long-term retention programmes; trust through privacy and ethical design." },
  { id: "qpersona", code: "QPERSONA", name: "QPersona", stage: "vision", bucket: "engagement", tagline: "Digital avatar for work and communication.", valueLine: "New subscription class with premium customisation assets." },
  { id: "kids-ai-content", code: "KIDS-AI", name: "Kids AI Content", stage: "vision", bucket: "engagement", tagline: "Multilingual safe AI content for children.", valueLine: "High willingness-to-pay parent segment; localisation as scaling lever." },
  { id: "voice-of-earth", code: "VOICE-OF-EARTH", name: "Voice of Earth", stage: "vision", bucket: "engagement", tagline: "International music content project — emotional brand engine.", valueLine: "Cross-media: music → apps → merch; cultural ESG narrative." },
  { id: "startup-exchange", code: "STARTUP-EX", name: "Startup Exchange", stage: "vision", bucket: "money", tagline: "Idea, MVP or working product — each listed with its own deal terms and a free deterministic assessment.", valueLine: "Marketplace economics on top of the utility set — listing flow works end to end; take rate and investor subscriptions are the open question." },
  { id: "deepsan", code: "DEEPSAN", name: "DeepSan", stage: "vision", bucket: "engagement", tagline: "Anti-chaos: focus and task structure for knowledge workers.", valueLine: "Daily utility; productivity data feeds AI personalisation." },
  { id: "mapreality", code: "MAPREALITY", name: "MapReality", stage: "vision", bucket: "infrastructure", tagline: "Map of real needs and events — signal aggregator.", valueLine: "B2G + media data asset (with ethics and consent)." },
  { id: "z-tide", code: "Z-TIDE", name: "Z-Tide", stage: "vision", bucket: "compliance", tagline: "Energy/emotion currency concept — research foundation for token mechanics.", valueLine: "Future token mechanics R&D; brand differentiator." },
  { id: "qcontract", code: "QCONTRACT", name: "QContract", stage: "vision", bucket: "compliance", tagline: "Smart documents with access control and lifespan.", valueLine: "Reduces legal risk in B2B pipelines; combines with QSign + Planet." },
  { id: "shadownet", code: "SHADOWNET", name: "ShadowNet", stage: "vision", bucket: "infrastructure", tagline: "Alternative private network for regulatory-sensitive products.", valueLine: "R&D asset in privacy narrative; synergy with VeilNetX." },
  { id: "lifebox", code: "LIFEBOX", name: "LifeBox", stage: "vision", bucket: "compliance", tagline: "Digital vault for the next generation — inheritance and long-term storage.", valueLine: "High-WTP emotional use case; compliance + inheritance as recurring revenue line." },
  { id: "qchaingov", code: "QCHAINGOV", name: "QChainGov", stage: "vision", bucket: "compliance", tagline: "DAO and transparent community governance with on-chain reputation.", valueLine: "Value-distribution mechanism for ecosystem holders — primes future tokenisation." },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Why defensible — the defensibility story                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export const billionDefense = {
  title: "Why AEVION is defensible — the moat stack",
  intro:
    "AEVION's value is not 'sum of products' — it is a defensible, compounding system. It holds on five independent axes:",
  axes: [
    {
      number: "01",
      title: "First-mover lead on integrated IP infrastructure",
      body:
        "We know of no other operator running an end-to-end registry+signature+bureau+compliance+wallet pipeline as one system. The barrier isn't the idea — it's rebuilding all five layers integrated, then earning the Trust Graph from zero.",
    },
    {
      number: "02",
      title: "Trust Graph data moat",
      body:
        "Every action on every module accrues into a unified composite reputation. After ~10K actives the graph is non-replicable. A competitor can copy any single module; nobody can copy the graph.",
    },
    {
      number: "03",
      title: "Cross-vertical revenue (3 markets, 1 codebase)",
      body:
        "$340B TAM split across IP enforcement, creator economy and digital payments. We capture all three from a single deployment — not a roll-up, but a single system selling to three different buyers.",
    },
    {
      number: "04",
      title: "Quantum-resistant crypto stack as institutional signal",
      body:
        "Ed25519 + Shamir SSS + HMAC + 6 international legal frameworks → Bureau certificates are credible to a court, an auditor, and an institutional treasury. Few competitors will catch up; fewer still will catch up before the post-quantum cliff.",
    },
    {
      number: "05",
      title: `${MODULE_NODES} modules, near-zero marginal cost per node`,
      body:
        "Auth + Bureau + Bank + QCoreAI are shared infrastructure. Adding a new vertical (HealthAI, QPersona, Kids-AI) is mostly UI. Each new node makes every existing node more valuable — scope effect compounds without OPEX.",
    },
  ],
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* GTM, financials, ask                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export const gtm = {
  title: "Go-to-market — wedge first, then the cross-sell flywheel",
  steps: [
    {
      phase: "Phase 1 · Independent creators",
      body:
        "AI-music and AI-film artists registering work in QRight + submitting to Awards. Wedge: 'admissible proof of authorship in 30 seconds'. Conversion to Bank is automatic (royalty payout settles to AEC).",
    },
    {
      phase: "Phase 2 · IP-heavy SMBs",
      body:
        "Studios, agencies, design firms, code shops needing fast certificates and licensing flows. Bureau + QSign + Planet as a per-cert + per-verification SaaS.",
    },
    {
      phase: "Phase 3 · Enterprise & regulators",
      body:
        "Compliance teams adopting Planet for ESG and audit; central banks and registries trialling Quantum Shield for institutional custody. Multi-year licensing contracts.",
    },
    {
      phase: "Phase 4 · Open APIs",
      body:
        "Every module exposes /api endpoints. Fintechs, music platforms and patent agents integrate AEVION — we become the rails, not the destination.",
    },
  ],
} as const;

export const financials = {
  title: "Illustrative upside trajectory — aspiration, not the base case",
  rows: [
    { year: "Year 1", arr: "$0.5M", drivers: "Creator wedge, paid Bureau certs, AI-music Awards." },
    { year: "Year 2", arr: "$8M", drivers: "Bank monetisation, Trust-tier subscriptions, IP-Bureau B2B deals." },
    { year: "Year 3", arr: "$60M", drivers: "Compliance line live, 3 enterprise pilots → contracts, QPayNet embedded." },
    { year: "Year 4", arr: "$420M", drivers: "Cross-vertical (Health/Kids/Persona) live; international IP partnerships." },
  ],
  disclaimer:
    "Illustrative aspiration — not the base case and not a forecast. The company is pre-revenue ($0) today. " +
    "The defensible base case is the bottom-up model above (≈$1.2M beachhead → ≈$13.7M regional ARR from three flagships); " +
    "this curve is top-down upside if the ecosystem flywheel compounds. Inputs: comparable SaaS take rates, " +
    "observed creator-economy GMV, historical IP-bureau cert pricing.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Customer voice — placeholder testimonials (replace with real quotes once   */
/* legal-clearance from each customer is in)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const customerVoice = {
  title: "How the pipeline lands — illustrative scenarios",
  intro:
    "The company is pre-revenue and the cards below are NOT attributed customer quotes. Each is an " +
    "illustrative scenario showing how a target user in that segment would run the pipeline end-to-end. " +
    "They will be replaced with real, attributed testimonials once early customers ship and consent.",
  quotes: [
    {
      avatar: "🎵",
      handle: "AI-music producer · Berlin",
      quote:
        "I registered 14 tracks in QRight in one afternoon. The Bureau certificate came back with a verify URL I just paste into takedown notices. That alone saved me €2K in legal fees.",
      moduleHint: "QRIGHT · BUREAU",
    },
    {
      avatar: "🎬",
      handle: "AI-cinema studio · Lisbon",
      quote:
        "Every render gets hashed, sealed and entered into Awards/Film automatically. Voting drove our first paid commission — the buyer cited the Planet certificate as the deciding factor.",
      moduleHint: "QRIGHT · AWARDS · PLANET",
    },
    {
      avatar: "🏛",
      handle: "Compliance lead · regulated SaaS · Almaty",
      quote:
        "We were planning to spend 6 months on a custom audit-trail. Two weeks with QSign + Planet replaced the entire workstream. Internal review committee accepted the Bureau certificates as filing evidence.",
      moduleHint: "QSIGN · PLANET · BUREAU",
    },
    {
      avatar: "🎨",
      handle: "Boutique design studio · Tashkent",
      quote:
        "The /verify/{id} URL embedded in our invoices ended client disputes overnight. We don't argue about who owns what anymore — the cert speaks for itself.",
      moduleHint: "QRIGHT · QSIGN · BUREAU",
    },
  ],
  disclosure:
    "Illustrative composites of target use cases — not real customer quotes. Attributed testimonials will replace these once early customers consent.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Press & partners — placeholders until permissions land                     */
/* ────────────────────────────────────────────────────────────────────────── */

export const press = {
  title: "Mentions, partners, integrations",
  intro:
    "We're still in stealth on most partnerships — full logos go up here once each partner clears the marketing review.",
  mentions: [
    { kind: "press", label: "Tech publication · Q3 article in pipeline" },
    { kind: "press", label: "Industry podcast · IP track interview Q4" },
    { kind: "press", label: "Compliance newsletter · feature scheduled" },
  ],
  partners: [
    { kind: "partner", label: "International IP bureau · LOI signed" },
    { kind: "partner", label: "AI music label · pilot in 2 markets" },
    { kind: "partner", label: "Regulated SaaS · enterprise pilot" },
    { kind: "partner", label: "Standards body · advisory engagement" },
  ],
  integrations: [
    { kind: "integration", label: "5 LLM providers (Claude, GPT, Gemini, DeepSeek, Grok) — live" },
    { kind: "integration", label: "Stripe-style payment rails — embedded in Bank" },
    { kind: "integration", label: "WebAuthn biometric — production" },
    { kind: "integration", label: "PostgreSQL + Node + Next.js 16 — full stack live" },
  ],
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Video walkthroughs — placeholder reels                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export const videoReels = {
  title: "60-second walkthroughs",
  intro:
    "Short loops you can drop into a deck or share by link. Live recordings drop with the next batch update; URLs below open the live products in the meantime.",
  reels: [
    {
      title: "Idea → certificate in 90 seconds",
      duration: "1:30",
      modules: "QRight · QSign · Bureau",
      href: "/qright",
      cover: "🎯",
    },
    {
      title: "Salary advance backed by Trust Score",
      duration: "1:15",
      modules: "Bank · Trust Graph",
      href: "/bank",
      cover: "💳",
    },
    {
      title: "Submit to Awards, validate via Planet, payout in AEC",
      duration: "1:45",
      modules: "QRight · Planet · Awards · Bank",
      href: "/awards",
      cover: "🏆",
    },
  ],
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Use cases — the same stack viewed by 4 different buyers                    */
/* ────────────────────────────────────────────────────────────────────────── */

export const useCases = {
  title: "Same stack, four very different buyers",
  intro:
    "AEVION is one codebase that solves four distinct customer journeys. Each persona below pulls revenue " +
    "from a different module mix — but every dollar settles into the same Trust Graph and the same wallet.",
  rows: [
    {
      persona: "Independent musician",
      avatar: "🎵",
      story:
        "Maya releases an AI-assisted album. Each track is registered in QRight (proof of authorship + timestamp), " +
        "gets a Bureau certificate she can attach to streaming-platform takedown notices, is submitted to Awards/Music " +
        "for community voting, and royalties from any verification or stream auto-flow into her AEVION Bank wallet.",
      modulesUsed: ["QRIGHT", "BUREAU", "AWARDS", "BANK"],
      revenueLine: "Per-cert SaaS + Bank take rate + Awards subscription tier.",
    },
    {
      persona: "Boutique design / dev agency",
      avatar: "🎨",
      story:
        "5-person studio delivers brand identities, code repos and product designs for 30+ clients/year. " +
        "Every deliverable is registered in QRight with the client as co-author, signed via QSign, and the client " +
        "receives a Bureau certificate with a public /verify URL embedded in the invoice. Disputes drop to zero.",
      modulesUsed: ["QRIGHT", "QSIGN", "BUREAU", "QCONTRACT (roadmap)"],
      revenueLine: "Volume-tier B2B Bureau plan + per-seat QContract.",
    },
    {
      persona: "AI film studio",
      avatar: "🎬",
      story:
        "AI-cinema startup pumps 50 short films per quarter. Each render is hashed in QRight, sealed by Quantum Shield, " +
        "submitted to Awards/Film. Planet validators vote on originality and rights; winners get prize money in AEC " +
        "directly to studio's Bank account, used to spin up the next render farm cycle.",
      modulesUsed: ["QRIGHT", "SHIELD", "PLANET", "AWARDS", "BANK"],
      revenueLine: "Submission fees + prize-pool sponsorship + Bank flow.",
    },
    {
      persona: "Enterprise compliance officer",
      avatar: "🏛",
      story:
        "ESG team at a regulated company uses Planet to certify which code modules and content have been validated. " +
        "QSign audit log proves nothing was changed since approval. Bureau certificates are filed with the regulator. " +
        "Multichat agents over QCoreAI answer compliance queries from internal teams.",
      modulesUsed: ["PLANET", "QSIGN", "BUREAU", "MULTICHAT"],
      revenueLine: "Annual enterprise license + per-cert + per-seat agent.",
    },
  ],
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Team — placeholder until founder is comfortable disclosing names           */
/* ────────────────────────────────────────────────────────────────────────── */

export const team = {
  title: "Team & advisors",
  intro:
    `Capital-efficient lean team — ${DEEP_DIVE_MODULES} working MVPs already shipped is the proof of velocity. ` +
    "Specific founding-team biographies and advisors are available under NDA via the investor demo.",
  slots: [
    { role: "Founder · CEO / Product", note: "Under NDA — book a demo" },
    { role: "Engineering lead", note: "Under NDA — book a demo" },
    { role: "GTM / Partnerships", note: "Under NDA — book a demo" },
    { role: "Advisors (IP law, fintech, AI)", note: "Available on request" },
  ],
  proof:
    `Proof points instead of bios: ${DEEP_DIVE_MODULES} production MVPs shipped, /pitch with live API metrics, ` +
    "41-node roadmap with shared infrastructure, multilingual EN/RU/KK production codebase.",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Competitive landscape — "why not just X?"                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const competitive = {
  title: "Why not just X? — the competitive landscape",
  intro:
    "AEVION competes with point-solutions in five adjacent markets. None offer the unified pipeline; " +
    "more importantly, none can build the Trust Graph that compounds across them.",
  alternatives: [
    {
      name: "Notarize / DocuSign / Adobe Sign",
      category: "Digital signatures",
      weakness:
        "Sign-only. No registry, no compliance, no creator economy, no wallet. Customers still need 4 other vendors.",
      aevionWin:
        `QSign is one of ${MODULE_NODES} modules — same payload format, same Trust Graph edge, same audit log. Bundled at zero marginal cost.`,
    },
    {
      name: "Blockchain timestamping (OpenTimestamps, Bitcoin OP_RETURN)",
      category: "Proof of existence",
      weakness:
        "Cryptographic proof exists, but no human-readable certificate, no legal framework citation, no validator network, no royalty rails on top.",
      aevionWin:
        "QRight + Bureau wraps the same hash in an admissible-evidence certificate citing 6 international frameworks, plus auto-routes royalties via Bank.",
    },
    {
      name: "Stripe Atlas / Stripe Connect for creators",
      category: "Creator payments",
      weakness:
        "Excellent at moving money. Knows nothing about IP, validation, awards, or reputation. Cannot underwrite credit against creative output.",
      aevionWin:
        "AEVION Bank issues salary advances against Trust Score (which composites IP, chess, Planet, awards, network). Stripe sees a payment; we see a graph.",
    },
    {
      name: "Traditional patent offices (USPTO, EPO, WIPO)",
      category: "IP enforcement",
      weakness:
        "$5K–$25K per filing, 6–18 months turnaround. Built for inventions, not for digital creative output (music, code, designs, AI artefacts).",
      aevionWin:
        "Bureau issues the same legally-defensible certificate in seconds, denominated in international frameworks the office itself recognises (Berne, WIPO, TRIPS).",
    },
    {
      name: "Generic AI assistants (ChatGPT, Claude, Gemini)",
      category: "AI surface",
      weakness:
        "Domain-blind. Cannot read your IP portfolio, your wallet, your tier or your tournament history.",
      aevionWin:
        "QCoreAI is bundled with full ecosystem context. Bank's Advisor knows your goals; Multichat agents specialise per domain. Sticky because it's useful.",
    },
  ],
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Risks & mitigations — the honest answer                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export const risks = {
  title: "Risks we know about — and what we do about them",
  intro:
    "Every ambitious company faces real risks. We list ours openly and ship mitigations into the product itself, not just into a slide.",
  rows: [
    {
      severity: "high",
      risk: "Regulatory drift in IP and digital signatures",
      mitigation:
        "Bureau cites 6 standing international frameworks (Berne, WIPO, TRIPS, eIDAS, ESIGN, KZ Digital Sig) — we ride the standards body, not predict them. Planet voting layer adapts the validator quorum if frameworks shift.",
    },
    {
      severity: "high",
      risk: "Cold start on the Trust Graph (network effect needs density)",
      mitigation:
        "Wedge is independent creators (no graph required for them to extract value from a single QRight cert). Cross-module gravity kicks in only after wedge is monetised — graph is a bonus, not a precondition.",
    },
    {
      severity: "medium",
      risk: "LLM cost and provider lock-in (QCoreAI margin compression)",
      mitigation:
        "QCoreAI routes across 5 providers (Claude/GPT/Gemini/DeepSeek/Grok) and auto-selects per task. QFusionAI roadmap deepens this. We negotiate from a portfolio position, never single-vendor.",
    },
    {
      severity: "medium",
      risk: "Single-vertical competitor undercuts one bucket (e.g. an IP-only startup)",
      mitigation:
        "Defensible through bundling: a creator using QRight also gets royalties through Bank, validation through Planet, recognition through Awards. Switching out QRight breaks 4 other workflows.",
    },
    {
      severity: "medium",
      risk: `Execution risk on ${MODULE_NODES} nodes — focus dilution`,
      mitigation:
        `Only ${COMMITTED_NODES} of ${MODULE_NODES} nodes are committed to ship in the next 18 months. ` +
        `The remaining ${MODULE_NODES - COMMITTED_NODES} are roadmap signals (cheap optionality), not parallel ` +
        "work-streams. Engineering capital concentrated on the 4 highest-revenue modules first.",
    },
    {
      severity: "low",
      risk: "Quantum-computing breakthroughs invalidate today's signatures",
      mitigation:
        "Quantum Shield (Ed25519 + Shamir SSS) already deployed. Migration path to lattice-based PQC is design-anticipated; certificates can be re-signed under future schemes without breaking the chain.",
    },
  ],
} as const;

export const ask = {
  title: "The ask",
  body:
    `We're raising for a focused 18-month sprint: harden the launched ${DEEP_DIVE_MODULES} modules, ship 4 of the ${MODULE_NODES - DEEP_DIVE_MODULES} emerging nodes, and lock 2 enterprise compliance pilots. Capital is for engineering, GTM in three creator verticals, and one regulatory partnership. The offer is one, not a ladder: a partnership — $10M returnable advance plus resources (compute, engineers, distribution, brand), revenue split 51% founder / 49% partner, founder stays as Chief Idea Officer. Not a buyout.`,
  termsHref: "/acquire",
  termsLabel: "See the full deal ladder (1% → 95%)",
  ctaPrimary: { label: "Book an investor demo", href: "mailto:yahiin1978@gmail.com?subject=AEVION investor demo" },
  ctaSecondary: { label: "Read the deep-dive", href: "/demo/deep" },
} as const;
