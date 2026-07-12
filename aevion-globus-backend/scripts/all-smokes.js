#!/usr/bin/env node
/**
 * AEVION smoke orchestrator — runs every smoke script in sequence against
 * a single target backend (BASE env), aggregates pass/fail, exits 1 if any
 * step failed.
 *
 * Used by:
 *   - npm run smoke:all                       — local manual run
 *   - .github/workflows/daily-smoke.yml       — daily cron in CI
 *
 * Env overrides:
 *   BASE                  default http://127.0.0.1:4001
 *   ONLY                  comma-separated whitelist (e.g. ONLY=tier3,qshield)
 *   SKIP                  comma-separated blacklist (e.g. SKIP=qcore,build)
 *   READ_ONLY             when "1", run only smokes safe for prod
 *                         (read-only — no DB writes). Defaults to "0".
 *
 * Each child smoke inherits the parent env plus any per-smoke overrides
 * from the SMOKES list below. Output streams through to the parent's
 * stdout/stderr in real time.
 *
 * Requires Node 18+ (global fetch in child smokes).
 */

const { spawnSync } = require("child_process");
const path = require("path");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const SKIP = (process.env.SKIP || "").split(",").map((s) => s.trim()).filter(Boolean);
const READ_ONLY = process.env.READ_ONLY === "1";

const SMOKES = [
  // Read-only public endpoints — safe to run anywhere, including prod.
  // Tier 3 amplifier surfaces (OG cards, sitemaps, RSS, badges).
  { name: "tier3", script: "tier3-smoke.js", readOnly: true },
  // Webhook signing — pure-crypto sign+verify roundtrip + rotation + replay rejection.
  // No backend needed; deterministic, always safe.
  { name: "webhook-sig", script: "webhook-sig-smoke.js", readOnly: true },
  // Hub catalog: read-only unified module discovery endpoint.
  { name: "hub-catalog", script: "hub-catalog-smoke.js", readOnly: true },
  // Waitlist unsubscribe: validates HMAC token rejection paths.
  { name: "waitlist-unsub", script: "waitlist-unsub-smoke.js", readOnly: true },
  // Hub full surface: covers health/catalog/version/openapi/sitemap.xml in one shot.
  { name: "hub-full", script: "hub-full-smoke.js", readOnly: true },
  // QBuild SEO: per-page metadata + JSON-LD on the 5 public /build landings (PR #433).
  // Read-only — hits frontend HTML, not the backend; safe against prod.
  { name: "qbuild-seo", script: "qbuild-seo-smoke.js", readOnly: true, env: { BASE: process.env.QBUILD_SEO_BASE || "https://aevion.app" } },

  // The rest mutate state — register users, create records — so they only
  // run in ephemeral CI environments (READ_ONLY=0).
  { name: "auth-replay", script: "auth-replay-smoke.js", readOnly: false },
  { name: "qsign-v2", script: "qsign-v2-smoke.js", readOnly: false },
  { name: "qshield", script: "qshield-smoke.js", readOnly: false },
  { name: "aev", script: "aev-smoke.js", readOnly: false },
  { name: "build", script: "build-smoke.js", readOnly: false, env: { BUILD_PAYMENT_WEBHOOK_SECRET: process.env.BUILD_PAYMENT_WEBHOOK_SECRET || "4wSqkQHVbttaDO02zDJiPZcmyRVU3gO9fhSY6nicb9kIYxFI" } },
  // Offline: exercises the QCoreAI free fleet + council assembly against dist (no server/DB/keys).
  { name: "qcore-fleet", script: "qcore-fleet-smoke.js", readOnly: true },
  // Offline: exercises the QCoreAI "auto" router (classify → council vs single) via the stub.
  { name: "qcore-autoroute", script: "qcore-autoroute-smoke.js", readOnly: true },
  { name: "planet", script: "planet-smoke.js", readOnly: false },
  { name: "awards", script: "awards-smoke.js", readOnly: false },
  // qpaynet/qcontract: read-only public legs run anywhere; auth legs gated by TEST_JWT.
  { name: "qpaynet", script: "qpaynet-smoke.js", readOnly: true },
  { name: "qcontract", script: "qcontract-smoke.js", readOnly: true },
  { name: "cyberchess", script: "cyberchess-smoke.js", readOnly: false },
  // CyberChess finalize→prize webhook — live end-to-end: signed /tournament-finalized
  // records a podium prize, idempotent replay drops dups, GET /results (Bearer-scoped)
  // surfaces it for the Bank ChessWinnings UI. Signs with CYBERCHESS_WEBHOOK_SECRET.
  { name: "cyberchess-finalize", script: "cyberchess-finalize-smoke.js", readOnly: false, env: { CYBERCHESS_WEBHOOK_SECRET: process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook" } },
  { name: "smeta-trainer", script: "smeta-trainer-smoke.js", readOnly: false },
  { name: "multichat", script: "multichat-smoke.js", readOnly: false },
  // HealthAI — profile/log/screener/plan/LLM-check (soft: needs ANTHROPIC_API_KEY)
  { name: "healthai", script: "healthai-smoke.js", readOnly: false },
  // Platform API keys — self-serve key issuance (Phase B). Creates/verifies/revokes.
  { name: "apikeys", script: "apikeys-smoke.js", readOnly: false },
  // QGood — charity campaigns. Registers test user, creates draft campaign.
  { name: "qgood", script: "qgood-smoke.js", readOnly: false },
  // QMaskCard — virtual payment masking. Issues mask, charges, revokes.
  { name: "qmaskcard", script: "qmaskcard-smoke.js", readOnly: false },
  // VeilNetX privacy-check — live /inspect tool (IP/geo/UA/exposure score) +
  // status + openapi. Read-only & prod-safe: the waitlist WRITE leg self-skips
  // when READ_ONLY=1, so daily prod runs never insert smoke emails.
  { name: "veilnetx", script: "veilnetx-smoke.js", readOnly: true },
  // VeilNetX Ledger — chain integrity + entry write.
  { name: "veilnetx-ledger", script: "veilnetx-ledger-smoke.js", readOnly: false },
  // VeilNetX chaos — bursty parallel writes + chain integrity check. Catches race-condition regressions.
  { name: "veilnetx-chaos", script: "veilnetx-chaos-smoke.js", readOnly: false },
  // Fintech PROD — 53 read-only health + stats + auth-gate + OpenAPI checks across 6 modules. Safe for prod.
  { name: "fintech-prod", script: "fintech-prod-smoke.js", readOnly: true },
  // QTrade PROD — 15 read-only checks for QTrade + QTradeOffline + AEV (trade/exchange/award trio).
  { name: "qtrade-prod", script: "qtrade-prod-smoke.js", readOnly: true },
  // Bureau PROD — 15 read-only checks for IP Bureau (health, transparency, notaries, auth gates).
  { name: "bureau-prod", script: "bureau-prod-smoke.js", readOnly: true },
  // QRight PROD — 26 checks: health, objects CRUD, CSV export, transparency, badge SVG, embed, policies, RSS changelog.
  { name: "qright-prod", script: "qright-prod-smoke.js", readOnly: false },
  // QSign PROD — 15 read-only checks for QSign v2 (ML-DSA/Ed25519/HMAC) + legacy deprecation.
  { name: "qsign-prod", script: "qsign-prod-smoke.js", readOnly: true },
  // HealthAI PROD — 15 read-only checks (health, referrals, empty-series graceful, auth gates).
  { name: "healthai-prod", script: "healthai-prod-smoke.js", readOnly: true },
  // Revenue Hub PROD — 15 checks: health, apps, overview, Stripe balance, env-guide.
  { name: "revenue-prod", script: "revenue-prod-smoke.js", readOnly: true },
  // MVP Concepts PROD — 25 checks across 12 ownerless modules (deepsan/kids-ai/mapreality/etc).
  { name: "mvp-concepts-prod", script: "mvp-concepts-prod-smoke.js", readOnly: true },
  // QMaskCard PROD — 14 checks: health, stats, auth-gates.
  { name: "qmaskcard-prod", script: "qmaskcard-prod-smoke.js", readOnly: true },
  // OpenAPI completeness — guards /api/openapi.json against silent route drops.
  // 19 critical module prefixes must be documented; 20 soft prefixes tracked
  // for awareness (after 2026-05-19 expansion: all 20 present).
  { name: "openapi-completeness", script: "openapi-completeness-smoke.js", readOnly: true },
  // Phantom-endpoint gate — probes every advertised "/api/..." literal and
  // fails if any is a confirmed phantom (advertised + 404 + no handler of any
  // method). Read-only (GET probes only). Guards against the OpenAPI catalog
  // advertising routes that don't exist. Honors BASE.
  { name: "phantom-audit", script: "phantom-endpoint-audit.mjs", readOnly: true },
  // Frontend phantom-page gate — every module in the registry advertises a
  // page at /<id>; this fails if any returns 404 on the live frontend.
  // Read-only; always probes FRONTEND (default https://aevion.app).
  { name: "frontend-phantom", script: "frontend-phantom-audit.mjs", readOnly: true, env: { FRONTEND: process.env.FRONTEND || "https://aevion.app" } },
  // QCoreAI PROD — 12 checks for the multi-agent AI core (foundational —
  // every AI-using module eventually calls into it). Validates health,
  // providers/configuration consistency, sessions/agents/prompts shape.
  { name: "qcoreai-prod", script: "qcoreai-prod-smoke.js", readOnly: true },
  // Planet Compliance PROD — 15 checks for the central trust layer
  // (submissions → artifact versions → certificates → activity). Stats
  // invariants (certified ≤ total), activity timestamp parseability,
  // auth gates on /submissions + /admin/*.
  { name: "planet-prod", script: "planet-prod-smoke.js", readOnly: true },
  // Auth PROD — 15 checks for the JWT auth surface. Foundation gate for
  // every Bearer endpoint. Verifies validation gates (400 on empty body)
  // + auth gates (401 on /me, /sessions, /audit, /whoami-strict, /account
  // DELETE) WITHOUT actually attempting login (avoids rate-limit + lockout).
  { name: "auth-prod", script: "auth-prod-smoke.js", readOnly: true },
  // Modules PROD — 13 checks for /api/modules/status central registry +
  // per-module health probe. Catches silent drops from the live list
  // (frontend portal/docs site/status page all read from this endpoint).
  { name: "modules-prod", script: "modules-prod-smoke.js", readOnly: true },
  // Pipeline PROD — 12 checks for /api/pipeline/* orchestration layer
  // (health, certificates, verify, OTS, auth gates) + Hub /aevion/sdks
  // SDK registry endpoint introduced 2026-05-20.
  { name: "pipeline-prod", script: "pipeline-prod-smoke.js", readOnly: true },
  // Ecosystem PROD — 8 checks for /api/ecosystem/* event-bus surface
  // (fully Bearer-gated on prod — smoke verifies all 5 endpoints return
  // 401 consistently with JSON error shape).
  { name: "ecosystem-prod", script: "ecosystem-prod-smoke.js", readOnly: true },
  // QContract PROD — 17 checks: templates, stats, auth-gates, view-token, openapi.
  { name: "qcontract-prod", script: "qcontract-prod-smoke.js", readOnly: true },
  // QChainGov PROD — 15 checks: proposals, votes, stats, auth-gates.
  { name: "qchaingov-prod", script: "qchaingov-prod-smoke.js", readOnly: true },
  // QShield + QRight PROD — 15 read-only checks (Shamir health, QRight objects, auth gates).
  { name: "qshield-prod", script: "qshield-prod-smoke.js", readOnly: true },
  // QZone PROD — 15 checks: QAI personas+sessions+chat, DevHub, QSocial, QMedia (qzone-block5).
  { name: "qzone-prod", script: "qzone-prod-smoke.js", readOnly: true },
  // Pricing PROD — 15 checks: FAQ, social-proof, provisioning, category filter.
  { name: "pricing-prod", script: "pricing-prod-smoke.js", readOnly: true },
  // AEVION REST PROD — 20 checks across coach/qlearn/qstore/qevents/qjobs/qnews/multichat.
  // Closes the prod-surface gap for modules without their own *-prod-smoke.
  { name: "rest-prod", script: "aevion-rest-prod-smoke.js", readOnly: true },
  // Universal Search PROD — 15 checks: health, results shape, byType, type filter, validation gates.
  { name: "search-prod", script: "search-prod-smoke.js", readOnly: true },
  // Paddle Billing PROD — 15 checks: health/plans/products/transactions + webhook HMAC round-trip.
  { name: "paddle-prod", script: "paddle-prod-smoke.js", readOnly: true, env: { PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET || "" } },
  // Lemon Squeezy subscription webhook — mode probe (stub vs real), bad-sig 401,
  // and (with LEMON_SQUEEZY_WEBHOOK_SECRET) activate/downgrade/ignore/400/dedup.
  // Self-skips gracefully in stub mode or when the secret isn't in env.
  { name: "ls-webhook", script: "ls-webhook-smoke.js", readOnly: false, env: { LEMON_SQUEEZY_WEBHOOK_SECRET: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "" } },
  // Constitution Pro gate (prod contract) — read-only: /me/plan free-limit
  // shape (savedScenarios/aiSuggestPerDay/pdfRequiresSign), publish-route
  // validation gates, ai-suggest liveness. Doesn't trigger 402/429.
  { name: "constitution-prod", script: "constitution-prod-smoke.js", readOnly: false },
  { name: "constitution-pro-prod", script: "constitution-pro-prod-smoke.js", readOnly: true },
  // Gumroad ping webhook — form-encoded paid/refund/no-email/dedup. Also
  // guards the express.urlencoded body-parser fix (form pings must reach the
  // handler with a populated body). Signs with GUMROAD_WEBHOOK_SECRET if set.
  { name: "gumroad-webhook", script: "gumroad-webhook-smoke.js", readOnly: false, env: { GUMROAD_WEBHOOK_SECRET: process.env.GUMROAD_WEBHOOK_SECRET || "" } },
  // Smeta Trainer PROD — read-only: health, leaderboard, per-level stats,
  // groups, graceful student-miss, /sync validation gate. Last live-module gap.
  { name: "smeta-trainer-prod", script: "smeta-trainer-prod-smoke.js", readOnly: true },
  // CyberChess PROD — read-only: CPI leaderboard, tournaments list/detail/meta,
  // spectator, auth+validation gates. No game state, no cyberchess source.
  { name: "cyberchess-prod", script: "cyberchess-prod-smoke.js", readOnly: true },
  // DevHub PROD — 47 assertions: all 8 tabs (projects/files/env/deployments/github/templates/agent/snippets)
  // + 13 media subtabs (TTS/Image/SFX/Music/VoiceClone/STT/Email/Payment/SMS/WhatsApp/Translate/Drive)
  // Accepts 503 gracefully for unconfigured API keys. Writes one project + snippet then cleans up.
  { name: "devhub-prod", script: "devhub-prod-smoke.js", readOnly: false },
  // Fintech cross-module — 7-step health + cross-product flow audit. Read-only public + JWT-gated auth check.
  { name: "fintech-cross-module", script: "fintech-cross-module-smoke.mjs", readOnly: true },
  // Fintech E2E flow — full cross-product chain QPayNet → VeilNetX → Z-Tide → QMaskCard.
  { name: "fintech-flow", script: "fintech-flow-smoke.js", readOnly: false },
  // Ecosystem events — event-bus focused: each emission kind produces the
  // right VeilNetX entry + Z-Tide weight. Complements fintech-flow (which is
  // outcome-focused on the happy path).
  { name: "ecosystem-events", script: "ecosystem-events-smoke.js", readOnly: false },
  // MVP concepts — exercises the 10 ownerless-module concept routers
  // (startup-exchange/listings, mapreality/claims, kids-ai-content/items,
  // qlife/prompts, psyapp-deps/assessments, qpersona/personas,
  // voice-of-earth/feeds, deepsan/runs, shadownet/posts, lifebox/capsules).
  // Mutates: writes one item per module. Safe for CI ephemeral envs.
  { name: "mvp-concepts", script: "mvp-concepts-smoke.js", readOnly: false },
  // Z-Tide — leaderboard read + me lookup (no admin events fired in smoke).
  { name: "ztide", script: "ztide-smoke.js", readOnly: false },
  // QChainGov — proposal create + auth/validation gates.
  { name: "qchaingov", script: "qchaingov-smoke.js", readOnly: false },
  // QJobs — job board: health, list, stats, auth gates, CRUD with TEST_JWT.
  { name: "qjobs", script: "qjobs-smoke.js", readOnly: false },
  // QNews — news aggregator: health, categories, articles, stats, RSS, auth gates.
  { name: "qnews", script: "qnews-smoke.js", readOnly: false },
  // QMedia — music/video/playlists. Read-only public + auth gates.
  { name: "qmedia", script: "qmedia-smoke.js", readOnly: true },
  // QAI — universal AI assistant: chat, sessions, export.
  { name: "qai", script: "qai-smoke.js", readOnly: false },
  // QLearn — courses/quizzes/AI lesson gen. Read-only public + 404 gates.
  { name: "qlearn", script: "qlearn-smoke.js", readOnly: true },
  // QStore — product catalogue/orders. Read-only public + auth gates.
  { name: "qstore", script: "qstore-smoke.js", readOnly: true },
  // QEvents — events platform: health/categories/list/create/calendar.
  { name: "qevents", script: "qevents-smoke.js", readOnly: false },
  // New Wave MVPs (2026-05-13 batch) — startupx/kids-ai/mapreality/voe.
  { name: "startupx", script: "startupx-smoke.js", readOnly: false },
  { name: "kids-ai", script: "kids-ai-smoke.js", readOnly: false },
  { name: "mapreality", script: "mapreality-smoke.js", readOnly: false },
  { name: "voe", script: "voe-smoke.js", readOnly: false },
  // Wave 3 MVPs (2026-05-14) — deepsan/qpersona/qfusionai.
  { name: "deepsan", script: "deepsan-smoke.js", readOnly: false },
  { name: "qpersona", script: "qpersona-smoke.js", readOnly: false },
  { name: "qfusionai", script: "qfusionai-smoke.js", readOnly: false },
  // Wave 4 MVPs (2026-05-15) — qlife/qgood.
  { name: "qlife", script: "qlife-smoke.js", readOnly: false },
  { name: "qgood", script: "qgood-smoke.js", readOnly: false },
  // Wave 5 MVPs (2026-05-15) — lifebox/psyapp-deps/shadownet.
  { name: "lifebox", script: "lifebox-smoke.js", readOnly: false },
  { name: "psyapp-deps", script: "psyapp-deps-smoke.js", readOnly: false },
  { name: "shadownet", script: "shadownet-smoke.js", readOnly: false },
  // qcore needs an LLM provider key for the run step. Default to skipping
  // those legs so the smoke validates plumbing (auth + history + analytics)
  // without burning provider tokens. Override via env if you want the full pass.
  {
    name: "qcore",
    script: "qcore-smoke.js",
    readOnly: false,
    env: { SKIP_RUN: process.env.SKIP_RUN ?? "1", SKIP_LLM_JUDGE: process.env.SKIP_LLM_JUDGE ?? "1" },
  },
];

// The *-prod smokes encode production-specific expectations (live billing
// keys, seeded search indexes, gated mutations). Run against a local backend
// they fail for environment reasons, not real bugs — so skip them unless the
// target actually looks like prod.
const isProdTarget = !/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(BASE);
const prodSkipped = [];

const eligible = SMOKES.filter((sm) => {
  if (ONLY.length > 0 && !ONLY.includes(sm.name)) return false;
  if (SKIP.includes(sm.name)) return false;
  if (READ_ONLY && !sm.readOnly) return false;
  if (!isProdTarget && /-prod$/.test(sm.name) && !ONLY.includes(sm.name)) {
    prodSkipped.push(sm.name);
    return false;
  }
  return true;
});

if (eligible.length === 0) {
  console.error("No smokes selected. Check ONLY / SKIP / READ_ONLY env vars.");
  process.exit(2);
}

console.log(`AEVION smoke orchestrator`);
console.log(`  BASE       = ${BASE}`);
console.log(`  READ_ONLY  = ${READ_ONLY ? "yes" : "no"}`);
console.log(`  scripts    = ${eligible.map((s) => s.name).join(", ")}`);
if (prodSkipped.length > 0) {
  console.log(`  skipped    = ${prodSkipped.length} *-prod smoke(s) (BASE is not prod): ${prodSkipped.join(", ")}`);
}
console.log("");

// Node v24.11.1 on Windows can crash during process teardown (exit code
// 0xC0000409 = 3221226505, STATUS_STACK_BUFFER_OVERRUN) when fetch/undici
// keep-alive sockets are still open at exit — even after a clean
// process.exit(0). That overrides the child's real exit code, so a fully
// passing smoke shows up as a failure. When we see that exact sentinel,
// fall back to judging by the child's printed summary instead of the code.
const WIN_EXIT_TEARDOWN_CRASH = 3221226505; // 0xC0000409

// True when the captured output reports zero failed assertions. Covers the
// summary formats in use across the smoke fleet:
//   "… N PASS  0 FAIL"   "… N passed, 0 failed"   "failed: 0"
//   "[x-smoke] PASS=9 FAIL=0"   "✅ all steps passed"
function reportsZeroFailures(out) {
  const hasSummary =
    /\bassertions\b|\bPASS\b|\bpassed\b|\bFAIL=\d+\b/i.test(out);
  const zeroFail =
    /\b0\s+FAIL\b/i.test(out) ||
    /\b0\s+failed\b/i.test(out) ||
    /failed:\s*0\b/i.test(out) ||
    /\bFAIL=0\b/i.test(out) ||
    /\ball (?:steps|checks|assertions|tests) passed\b/i.test(out);
  // Note the (?!=) guards: in "PASS=9 FAIL=0" the "9 FAIL" substring must NOT
  // be read as a fail count — FAIL there is followed by "=0" (a zero count).
  const hasFailMarker =
    /\b[1-9]\d*\s+FAIL\b(?!=)/i.test(out) ||
    /\b[1-9]\d*\s+failed\b/i.test(out) ||
    /\bFAIL=[1-9]\d*\b/i.test(out) ||
    /failed:\s*[1-9]\d*\b/i.test(out);
  return hasSummary && zeroFail && !hasFailMarker;
}

const results = [];
for (const sm of eligible) {
  const banner = `========== ${sm.name} ==========`;
  console.log(`\n${banner}`);
  const start = Date.now();
  // Preload a fetch wrapper that retries idempotent GETs once on a transient
  // network blip, so prod latency doesn't produce false FAILs. Forward slashes
  // work on Windows and avoid backslash escaping inside NODE_OPTIONS.
  const preload = path.join(__dirname, "lib", "fetch-retry.cjs").replace(/\\/g, "/");
  const childNodeOptions = `${process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + " " : ""}--require ${preload}`;
  const child = spawnSync("node", [path.join(__dirname, sm.script)], {
    env: { ...process.env, BASE, NODE_OPTIONS: childNodeOptions, ...(sm.env || {}) },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  // Stream the captured output through, preserving the previous live-ish UX.
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  const elapsed = Date.now() - start;
  const combined = (child.stdout || "") + "\n" + (child.stderr || "");
  let ok = child.status === 0;
  let note = "";
  if (!ok && child.status === WIN_EXIT_TEARDOWN_CRASH && reportsZeroFailures(combined)) {
    ok = true;
    note = " (Node/Windows exit-teardown crash ignored — 0 failures reported)";
  }
  results.push({ name: sm.name, ok, status: child.status, elapsed, note });
}

console.log("\n========== Summary ==========");
let passed = 0,
  failed = 0;
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  const detail = r.ok ? r.note || "" : ` (exit=${r.status})`;
  console.log(`  ${tag}  ${r.name.padEnd(12)}  ${(r.elapsed / 1000).toFixed(1)}s${detail}`);
  if (r.ok) passed += 1;
  else failed += 1;
}
console.log(`\n  total: ${results.length}, passed: ${passed}, failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
