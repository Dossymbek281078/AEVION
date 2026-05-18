#!/usr/bin/env node
/**
 * QMaskCard PROD smoke — virtual payment masking.
 * Usage: BASE=https://... node scripts/qmaskcard-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nQMaskCard PROD smoke → ${BASE}\n`);

  // 1-2. Health
  const h = await req("GET", "/api/qmaskcard/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.status === "ok" ? ok("status = ok") : fail("status = ok", JSON.stringify(h.body));

  // 3-7. Stats (public endpoint)
  const stats = await req("GET", "/api/qmaskcard/stats");
  stats.status === 200 ? ok("GET /stats → 200") : fail("GET /stats → 200", String(stats.status));
  typeof (stats.body?.active_masks ?? stats.body?.activeMasks) === "number"
    ? ok("stats.active_masks numeric", String(stats.body?.active_masks ?? stats.body?.activeMasks))
    : fail("stats.active_masks numeric", JSON.stringify(stats.body));
  typeof (stats.body?.total_masks ?? stats.body?.totalMasks) === "number"
    ? ok("stats.total_masks numeric")
    : fail("stats.total_masks numeric");
  typeof (stats.body?.authorized_charges ?? stats.body?.authorizedCharges) === "number"
    ? ok("stats.authorized_charges numeric")
    : fail("stats.authorized_charges numeric");
  typeof (stats.body?.volume_cents ?? stats.body?.volumeCents) !== "undefined"
    ? ok("stats.volume_cents present")
    : fail("stats.volume_cents present");

  // 8-10. Auth gates
  const postMask = await req("POST", "/api/qmaskcard/masks", { label: "T", currency: "KZT" });
  [401, 403].includes(postMask.status) ? ok("POST /masks (no auth) → auth gate", String(postMask.status)) : fail("POST /masks (no auth) → auth gate", String(postMask.status));

  const getMasks = await req("GET", "/api/qmaskcard/masks");
  [401, 403].includes(getMasks.status) ? ok("GET /masks (no auth) → auth gate", String(getMasks.status)) : fail("GET /masks (no auth) → auth gate", String(getMasks.status));

  const getCharges = await req("GET", "/api/qmaskcard/charges");
  [401, 403].includes(getCharges.status) ? ok("GET /charges (no auth) → auth gate", String(getCharges.status)) : fail("GET /charges (no auth) → auth gate", String(getCharges.status));

  // 11-12. Revoke unknown mask
  const revoke = await req("POST", "/api/qmaskcard/masks/00000000-0000-0000-0000-000000000000/revoke", {});
  [400, 401, 403, 404].includes(revoke.status) ? ok("POST /masks/:unknown/revoke → 4xx graceful", String(revoke.status)) : fail("POST /masks/:unknown/revoke → 4xx", String(revoke.status));

  // 13. Charge (no auth)
  const charge = await req("POST", "/api/qmaskcard/charges", { maskId: "x", amount: 100 });
  [400, 401, 403, 404].includes(charge.status) ? ok("POST /charges (no auth) → auth/validation gate", String(charge.status)) : fail("POST /charges gate", String(charge.status));

  // 14-15. Service field in health + stats
  h.body?.service === "qmaskcard" ? ok("health.service = qmaskcard") : fail("health.service = qmaskcard", String(h.body?.service));
  stats.body?.service === "qmaskcard" ? ok("stats.service = qmaskcard") : fail("stats.service = qmaskcard", String(stats.body?.service));

  console.log(`\n15 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
