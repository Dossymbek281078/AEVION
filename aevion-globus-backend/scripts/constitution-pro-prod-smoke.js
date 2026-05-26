#!/usr/bin/env node
/**
 * constitution-pro-prod-smoke — verify the Constitution Pro gating CONTRACT
 * on a live backend, read-only and safe for prod.
 *
 * It does NOT trigger the actual 402/429 limits (that needs real publishes /
 * burning AI tokens — covered locally by ls-webhook-smoke + manual e2e).
 * Instead it asserts the surfaces the frontend paywall depends on are intact:
 *
 *   - GET  /api/constitution/me/plan (no auth) → free + correct limit shape
 *     (savedScenarios 5, aiSuggestPerDay 10, pdfRequiresSign true, no
 *      customThemes/embed) + upgrade block. This is the single source the UI
 *      reads, so a drift here means the paywall is wrong.
 *   - POST /api/planet/constitution-artifacts with no signature/payload → 400
 *     (publish route alive, validation before any write — the free-publish
 *      gate lives on this route).
 *   - GET  artifacts list + stats → 200 (read surface healthy).
 *   - POST /api/constitution/ai-suggest empty body → route alive (400/402/429,
 *     not 404/5xx). One call only (≤1 of the 10/day free counter).
 *
 * Usage:
 *   BASE=https://aevion.app/api-backend node scripts/constitution-pro-prod-smoke.js
 */

"use strict";

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
const failures = [];
function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function ko(label, detail) { fail++; failures.push({ label, detail }); console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`); }

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

(async () => {
  console.log(`\nConstitution Pro gate (prod contract) → ${BASE}\n`);

  // ── /me/plan: anonymous → free + limit contract ────────────────────────────
  const plan = await req("GET", "/api/constitution/me/plan");
  if (plan.status === 200) ok("GET /me/plan → 200");
  else ko("GET /me/plan → 200", `HTTP ${plan.status}`);

  const p = plan.json || {};
  p.plan === "free" ? ok("anon plan = free") : ko("anon plan = free", JSON.stringify(p.plan));
  p.reason === "no-token" ? ok("anon reason = no-token") : ko("anon reason = no-token", String(p.reason));

  const lim = p.limits || {};
  lim.savedScenarios === 5 ? ok("limit savedScenarios = 5") : ko("limit savedScenarios = 5", String(lim.savedScenarios));
  lim.aiSuggestPerDay === 10 ? ok("limit aiSuggestPerDay = 10") : ko("limit aiSuggestPerDay = 10", String(lim.aiSuggestPerDay));
  lim.pdfRequiresSign === true ? ok("limit pdfRequiresSign = true (watermark)") : ko("limit pdfRequiresSign = true", String(lim.pdfRequiresSign));
  lim.customThemes === false ? ok("limit customThemes = false (Pro-only)") : ko("limit customThemes = false", String(lim.customThemes));
  lim.embedSnippet === false ? ok("limit embedSnippet = false (Pro-only)") : ko("limit embedSnippet = false", String(lim.embedSnippet));
  p.upgrade && p.upgrade.checkout ? ok("upgrade block present for free") : ko("upgrade block present", JSON.stringify(p.upgrade));

  // ── publish route alive + validation before write (free-cap gate lives here) ─
  const noSig = await req("POST", "/api/planet/constitution-artifacts", {});
  noSig.status === 400 && noSig.json.error === "missing_signature"
    ? ok("publish w/o signature → 400 missing_signature")
    : ko("publish w/o signature → 400", `HTTP ${noSig.status} ${JSON.stringify(noSig.json)}`);

  const noPayload = await req("POST", "/api/planet/constitution-artifacts", { envelope: { signature: "x" } });
  noPayload.status === 400 && noPayload.json.error === "missing_payload"
    ? ok("publish w/o payload → 400 missing_payload")
    : ko("publish w/o payload → 400", `HTTP ${noPayload.status} ${JSON.stringify(noPayload.json)}`);

  // ── read surface ─────────────────────────────────────────────────────────────
  const list = await req("GET", "/api/planet/constitution-artifacts?limit=5");
  list.status === 200 ? ok("GET artifacts list → 200") : ko("GET artifacts list → 200", `HTTP ${list.status}`);

  const stats = await req("GET", "/api/planet/constitution-artifacts/stats");
  stats.status === 200 ? ok("GET artifacts stats → 200") : ko("GET artifacts stats → 200", `HTTP ${stats.status}`);

  // ── ai-suggest route alive (one call; gate runs before validation) ──────────
  const ai = await req("POST", "/api/constitution/ai-suggest", {});
  [400, 402, 422, 429].includes(ai.status)
    ? ok(`ai-suggest route alive → ${ai.status}`)
    : ko("ai-suggest route alive (400/402/422/429)", `HTTP ${ai.status} ${JSON.stringify(ai.json)}`);

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log(`\n[constitution-pro-prod-smoke] ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error("\nFailures:");
    for (const f of failures) console.error(`  - ${f.label}${f.detail ? "  " + f.detail : ""}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error("[constitution-pro-prod-smoke] crashed:", e.message);
  process.exit(2);
});
