/**
 * Deep technical document for engineer-investors and CTOs evaluating AEVION.
 * Complements /demo (product showcase) and /pitch (investment thesis).
 */

export type DeepSection = {
  id: string;
  title: string;
  lead?: string;
  body: string[];
  /** Monospace block (diagram, contract, code) */
  pre?: string;
  bullets?: string[];
};

export const demoDeepIntro = {
  title: "AEVION — technical deep dive",
  subtitle:
    "Architecture, crypto stack, API surface, threat model, performance budgets, deployment topology and i18n — written for the engineer and the CTO doing due diligence on the platform.",
};

export const demoDeepSections: DeepSection[] = [
  {
    id: "architecture",
    title: "1 · Architecture overview",
    lead:
      "Seven shared services, one identity. Every product node composes on top of the same auth + crypto + ledger foundation.",
    body: [
      "Auth issues a single JWT per user. The token is stored in localStorage under a stable key and travels as a Bearer header to every backend module. There is no per-product login; new modules inherit the identity for free. Sessions are stateless on the API side — token introspection runs on every request via /api/auth/me.",
      "QRight is the IP registry. A new entry takes a payload (title, content hash, author, optional geolocation), computes a SHA-256 over the canonical JSON, and binds the result to ownerUserId from the JWT. The entry is the atomic unit of the Trust Graph — every downstream signature, certificate, royalty and award traces back to a QRight id.",
      "QSign is the integrity layer. Given a QRight id (or arbitrary payload), it computes an HMAC-SHA256 over the canonical JSON form and returns a signature plus the payload that was actually signed. Clients verify the same way the server does — UI is never trusted with the truth.",
      "Quantum Shield wraps QSign for high-value artifacts. It generates an Ed25519 keypair, splits the private key with Shamir's Secret Sharing (default 2-of-3), and stores the shards across separate trust zones. Recovery requires a quorum; loss of a single shard never breaks the certificate.",
      "Bureau is the legal layer. It composes a QRight entry, its QSign signature and (when present) its Quantum Shield record into a court-grade PDF certificate citing six international frameworks (Berne, WIPO, TRIPS, eIDAS, ESIGN, KZ Digital Sig). The PDF is served from /api/pipeline/certificate/{id}/pdf and can be re-validated by any third party at /verify/{id}.",
      "Planet is the social-proof layer. Validators vote on submissions; a passing vote turns an artifact into a certified version with a public stats endpoint. Planet is what gives a Bureau certificate quorum-backed legitimacy beyond cryptographic proof.",
      "Bank renders on top of QTrade — a non-custodial AEC ledger with /api/qtrade/{accounts,transfers,operations}.csv for audit. Royalties from Awards, prizes from CyberChess and per-cert revenue from Bureau all settle into the same ledger; the Trust Score (8-factor radar) gates salary advances and credit features.",
    ],
    bullets: [
      "Auth → JWT in localStorage; same token works across all 27 modules.",
      "QRight → SHA-256 + ownerUserId binding; the atomic Trust Graph node.",
      "QSign → HMAC-SHA256 over canonical JSON; client-verifiable.",
      "Quantum Shield → Ed25519 + Shamir SSS (default 2-of-3 threshold).",
      "Bureau → PDF certificate citing 6 international IP frameworks.",
      "Planet → multi-validator quorum on top of the cryptographic chain.",
      "Bank/QTrade → AEC ledger with CSV audit exports and Trust-gated credit.",
    ],
  },
  {
    id: "crypto",
    title: "2 · Crypto stack",
    lead:
      "Three layers: hash for proof-of-existence, HMAC for integrity, Ed25519 + Shamir for high-value custody.",
    body: [
      "Layer 1 — SHA-256 over canonical JSON. Every QRight entry hashes its declared payload using the same key ordering on client and server. Two implementations producing the same hash is the proof that the registry is not a trust-the-UI construct.",
      "Layer 2 — HMAC-SHA256 with a server-side secret. QSign re-derives the canonical JSON server-side and signs it. The verify endpoint accepts the original payload and the signature; mismatched key order, missing fields or stray whitespace all return INVALID. Bureau stores both the payload and the signature so any auditor can replay the verification later.",
      "Layer 3 — Ed25519 keypair with Shamir Secret Sharing. Quantum Shield generates the keypair on creation, signs the artifact root, then splits the private key into N shards (default 3) with threshold T (default 2). Shards live in separate trust zones; a single shard reveals nothing. Recovery is a Lagrange interpolation over T shards.",
      "Why this combination: SHA-256 is fast and universally trusted (proof of existence). HMAC is cheap to verify and needs no PKI (cross-module integrity). Ed25519 + SSS gives quantum-resistant signing today and a clean migration path to lattice-based PQC tomorrow without breaking the existing certificate chain.",
    ],
    pre: `// Pseudocode — what /api/qsign/verify does
function verify(payload, signature, secret) {
  const canonical = canonicalJson(payload);   // sorted keys, no whitespace
  const expected  = hmacSha256(secret, canonical);
  return constantTimeEqual(expected, signature);
}

// And what Bureau does on top
function buildCertificate(qrightId) {
  const entry      = registry.get(qrightId);
  const signature  = qsign.sign(entry);             // HMAC-SHA256
  const shielded   = shield.wrap(entry, { t: 2, n: 3 }); // Ed25519 + SSS
  return pdf.render({ entry, signature, shielded, frameworks });
}`,
    bullets: [
      "Hash: SHA-256 over canonical JSON; identical client/server implementation.",
      "HMAC: HMAC-SHA256 with server-side secret; constant-time compare on verify.",
      "Custody: Ed25519 + Shamir SSS; default 2-of-3 with configurable N and T.",
      "PQC migration: certificates can be re-signed under future schemes without breaking the chain.",
    ],
  },
  {
    id: "api",
    title: "3 · API surface",
    lead: "All modules speak HTTP+JSON. Full schema at /api/openapi.json on the backend origin.",
    body: [
      "Each module exposes a stable namespace under /api/{module}/. The frontend wrapper apiUrl() prepends a base derived from environment (proxy in browser, direct origin in SSR). Every endpoint accepts and returns JSON; CSV variants are provided where audit is the primary consumer.",
    ],
    bullets: [
      "Auth — POST /api/auth/{register,login}; GET /api/auth/me (Bearer token).",
      "QRight — GET /api/qright/objects; POST /api/qright/objects; GET /api/qright/objects/{id}.",
      "QSign — POST /api/qsign/sign; POST /api/qsign/verify.",
      "Quantum Shield — GET /api/quantum-shield/records; POST /api/quantum-shield/wrap.",
      "Bureau — GET /api/pipeline/certificate/{id}; GET /api/pipeline/certificate/{id}/pdf.",
      "Planet — GET /api/planet/stats; GET /api/planet/artifacts/recent; GET /api/planet/artifacts/{id}/public.",
      "Awards — POST /api/awards/{music,film}/submit; GET /api/awards/{music,film}/leaderboard.",
      "Bank / QTrade — GET /api/qtrade/summary; POST /api/qtrade/{topup,transfer}; GET /api/qtrade/{accounts,transfers,operations}.csv.",
      "QCoreAI — GET /api/qcoreai/providers; POST /api/qcoreai/chat.",
      "Globus — GET /api/globus/projects (catalog of all 27 nodes with status and priority).",
    ],
  },
  {
    id: "threat-model",
    title: "4 · Threat model",
    lead: "What we defend against, and how the architecture itself is the mitigation.",
    body: [
      "We assume an attacker with full read access to the UI and to wire-level traffic. We assume the database can be compromised. We assume any single key can be lost. The system is designed so that none of these alone breaks a certificate.",
    ],
    bullets: [
      "Tampering with stored artifacts → HMAC-SHA256 over canonical JSON; the server-side secret is not derivable from any UI surface, and any byte change invalidates the signature.",
      "Single-key loss → Quantum Shield with Shamir Secret Sharing; default 2-of-3 means losing any single shard is recoverable. T and N are configurable per artifact.",
      "Single-point-of-failure on validation → Planet's multi-validator quorum; a Bureau certificate carries the vote tally, not just one party's stamp.",
      "Replay and forgery → JWT with expiry on every Bearer call; signatures are bound to ownerUserId so a stolen payload cannot be re-signed under another identity.",
      "Post-quantum threat → Ed25519 today, with a designed migration to lattice-based PQC (e.g. CRYSTALS-Dilithium) without breaking existing certificate chains; certificates can be re-signed under future schemes.",
      "Supply chain on the LLM side → QCoreAI routes across 5 providers; auto-fallback if any one provider is compromised or rate-limited.",
      "Data exfiltration via UI → no secrets sit client-side. JWT lives in localStorage but every privileged action is server-validated; UI is treated as untrusted display.",
    ],
  },
  {
    id: "performance",
    title: "5 · Performance budgets",
    lead: "Hard targets we measure against in CI and in production.",
    body: [
      "Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on the public-facing pages (/, /pitch, /demo, every product landing). Pages that exceed the budget block the deploy.",
      "Bundle size: per-route JS shipped to the browser stays under 220 KB gzip for landings and under 320 KB gzip for the heaviest authenticated dashboards (Bank, CyberChess). Tree-shaken imports only — no full-library bundling.",
      "API latency SLOs: p50 < 80 ms, p95 < 220 ms, p99 < 600 ms for read endpoints (registry list, planet stats, qtrade summary). Write endpoints (sign, verify, top-up) target p50 < 150 ms / p95 < 400 ms / p99 < 900 ms.",
      "Cold-start budget: first paint under 1.2s on a Moto G4 over slow 4G. Static pages prerender at build time; client islands hydrate progressively.",
    ],
    bullets: [
      "Lighthouse Performance ≥ 90 across public pages; ≥ 95 on Accessibility / Best Practices / SEO.",
      "Per-route JS: ≤ 220 KB gzip (landings), ≤ 320 KB gzip (heavy dashboards).",
      "Read API SLO: p50 < 80 ms / p95 < 220 ms / p99 < 600 ms.",
      "Write API SLO: p50 < 150 ms / p95 < 400 ms / p99 < 900 ms.",
      "First paint under 1.2 s on Moto G4 over slow 4G.",
    ],
  },
  {
    id: "deployment",
    title: "6 · Deployment",
    lead: "Where every piece of the system actually runs.",
    body: [
      "Frontend is Next.js 16 (App Router) deployed to Vercel. Most pages are statically prerendered at build time; client components hydrate where interactivity is required (Bank dashboard, CyberChess engine, Quantum Shield visualizer). API requests from the browser go through a /api-backend rewrite that proxies to the backend origin — no CORS, no leaked origin in the bundle.",
      "Backend is a Node.js (TypeScript) service. Local dev runs on port 4001; production is a long-running process behind the same edge that fronts Vercel. State lives in Postgres (planet votes, qtrade ledger, qright objects) plus a small JSON store for low-write artifacts. Crypto secrets live in environment variables, never in the repo.",
      "Edge OG images and metadata are generated at request time at the edge (cacheable; revalidated on content change). Static assets ride the standard Vercel CDN. The OpenAPI document at /api/openapi.json is the contract every frontend module reads against.",
      "Preview environments: every PR gets a Vercel preview URL with the same backend proxy target as production. Verification is `npm run verify` from the monorepo root — runs backend tsc plus frontend next build.",
    ],
    bullets: [
      "Frontend → Next.js 16 App Router on Vercel; static prerender + selective client islands.",
      "Backend → Node.js + TypeScript on port 4001 locally, long-running process in prod.",
      "Storage → Postgres for transactional data; JSON store for low-write artifacts.",
      "Edge → OG images generated at the edge; static assets on Vercel CDN.",
      "Contract → /api/openapi.json is the single source of truth for the API surface.",
      "Verification → `npm run verify` (backend tsc + frontend next build) gates every push.",
    ],
  },
  {
    id: "i18n",
    title: "7 · Multilingual",
    lead: "Three production languages — English, Russian, Kazakh — without per-locale page duplication.",
    body: [
      "AEVION ships with a runtime DOM walker (AutoTranslate) that swaps text nodes per the active locale. Pages are authored in English; the walker substitutes RU/KZ at render time using a curated phrasebook plus deterministic fallbacks.",
      "This is deliberately not a build-time i18n system: it lets us ship prose updates without a re-deploy, and it keeps source files single-language for editor ergonomics. The trade-off is that the phrasebook is the source of truth for translated copy — additions land in src/data/translations alongside the prose change.",
      "Authoring rule: write the source page in clean English. Avoid embedding text inside SVG paths, image bitmaps or canvas drawings — the DOM walker cannot reach them. Where a non-translatable string is required (a code block, an API path, a brand mark), wrap it in an opt-out marker so the walker skips it.",
    ],
    bullets: [
      "Three locales: en (source), ru, kz.",
      "Runtime DOM walker swaps text nodes; no duplicated page trees.",
      "Phrasebook lives next to prose in src/data/translations.",
      "Opt-out marker for code, API paths and brand marks the walker must not touch.",
    ],
  },
  {
    id: "next-steps",
    title: "8 · Next steps",
    lead: "Where to go from here, depending on what you're evaluating.",
    body: [
      "If you came for the narrative — the visual product showcase across all 27 nodes lives at /demo, and the investment thesis (TAM, network effects, defensibility, GTM, ARR trajectory) lives at /pitch. Both pages pull live data from the same backend you've been reading about above.",
      "If you came for the contract — open /api/openapi.json on the backend origin and start with QRight, QSign and Bureau. Those three modules together are the minimum reproducible end-to-end flow.",
    ],
    bullets: [
      "Visual product tour → /demo (27 nodes, live ecosystem pulse, 90-second pipeline).",
      "Investment thesis → /pitch (why the platform clears $1B+).",
      "API contract → /api/openapi.json on the backend origin.",
      "Reproduce the end-to-end flow → Auth → QRight → QSign → Bureau in any browser.",
    ],
  },
];
