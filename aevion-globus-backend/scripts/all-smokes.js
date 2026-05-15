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

  // The rest mutate state — register users, create records — so they only
  // run in ephemeral CI environments (READ_ONLY=0).
  { name: "auth-replay", script: "auth-replay-smoke.js", readOnly: false },
  { name: "qsign-v2", script: "qsign-v2-smoke.js", readOnly: false },
  { name: "qshield", script: "qshield-smoke.js", readOnly: false },
  { name: "aev", script: "aev-smoke.js", readOnly: false },
  { name: "build", script: "build-smoke.js", readOnly: false },
  { name: "planet", script: "planet-smoke.js", readOnly: false },
  { name: "awards", script: "awards-smoke.js", readOnly: false },
  // qpaynet/qcontract: read-only public legs run anywhere; auth legs gated by TEST_JWT.
  { name: "qpaynet", script: "qpaynet-smoke.js", readOnly: true },
  { name: "qcontract", script: "qcontract-smoke.js", readOnly: true },
  { name: "cyberchess", script: "cyberchess-smoke.js", readOnly: false },
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
  // QSign PROD — 15 read-only checks for QSign v2 (ML-DSA/Ed25519/HMAC) + legacy deprecation.
  { name: "qsign-prod", script: "qsign-prod-smoke.js", readOnly: true },
  // HealthAI PROD — 15 read-only checks (health, referrals, empty-series graceful, auth gates).
  { name: "healthai-prod", script: "healthai-prod-smoke.js", readOnly: true },
  // QShield + QRight PROD — 15 read-only checks (Shamir health, QRight objects, auth gates).
  { name: "qshield-prod", script: "qshield-prod-smoke.js", readOnly: true },
  // QZone PROD — 15 checks: QAI personas+sessions+chat, DevHub, QSocial, QMedia (qzone-block5).
  { name: "qzone-prod", script: "qzone-prod-smoke.js", readOnly: true },
  // Pricing PROD — 15 checks: FAQ, social-proof, provisioning, category filter.
  { name: "pricing-prod", script: "pricing-prod-smoke.js", readOnly: true },
  // AEVION REST PROD — 20 checks across coach/qlearn/qstore/qevents/qjobs/qnews/multichat.
  // Closes the prod-surface gap for modules without their own *-prod-smoke.
  { name: "rest-prod", script: "aevion-rest-prod-smoke.js", readOnly: true },
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

const eligible = SMOKES.filter((sm) => {
  if (ONLY.length > 0 && !ONLY.includes(sm.name)) return false;
  if (SKIP.includes(sm.name)) return false;
  if (READ_ONLY && !sm.readOnly) return false;
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
console.log("");

const results = [];
for (const sm of eligible) {
  const banner = `========== ${sm.name} ==========`;
  console.log(`\n${banner}`);
  const start = Date.now();
  const child = spawnSync("node", [path.join(__dirname, sm.script)], {
    stdio: "inherit",
    env: { ...process.env, BASE, ...(sm.env || {}) },
  });
  const elapsed = Date.now() - start;
  const ok = child.status === 0;
  results.push({ name: sm.name, ok, status: child.status, elapsed });
}

console.log("\n========== Summary ==========");
let passed = 0,
  failed = 0;
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  const detail = r.ok ? "" : ` (exit=${r.status})`;
  console.log(`  ${tag}  ${r.name.padEnd(12)}  ${(r.elapsed / 1000).toFixed(1)}s${detail}`);
  if (r.ok) passed += 1;
  else failed += 1;
}
console.log(`\n  total: ${results.length}, passed: ${passed}, failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
