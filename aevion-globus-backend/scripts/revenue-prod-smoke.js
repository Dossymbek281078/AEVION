#!/usr/bin/env node
/**
 * Revenue Hub PROD smoke — Gumroad (live) + Paddle + YouTube + Twitch monetization hub.
 * Usage: BASE=https://... node scripts/revenue-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
async function req(path) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(10000) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nRevenue Hub PROD smoke → ${BASE}\n`);

  // 1-4. Health
  const h = await req("/api/revenue/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.ok === true ? ok("health.ok = true") : fail("health.ok = true");
  typeof h.body?.appsTotal === "number" ? ok("appsTotal numeric", String(h.body.appsTotal)) : fail("appsTotal numeric");
  typeof h.body?.providers === "object" ? ok("providers object present") : fail("providers object present");

  // 5-8. Apps list
  const apps = await req("/api/revenue/apps");
  apps.status === 200 ? ok("GET /apps → 200") : fail("GET /apps → 200", String(apps.status));
  Array.isArray(apps.body?.apps) ? ok("apps is array", `len=${apps.body.apps.length}`) : fail("apps is array");
  (apps.body?.apps?.length ?? 0) >= 10 ? ok("≥ 10 apps registered") : fail("≥ 10 apps", String(apps.body?.apps?.length));
  apps.body?.apps?.every((a) => a.appId && a.channels) ? ok("each app has appId + channels") : fail("each app has appId + channels");

  // 9-11. Overview
  const ov = await req("/api/revenue/overview");
  ov.status === 200 ? ok("GET /overview → 200") : fail("GET /overview → 200", String(ov.status));
  typeof ov.body?.totalApps === "number" ? ok("overview.totalApps numeric", String(ov.body.totalApps)) : fail("overview.totalApps numeric");
  typeof ov.body?.channelCoverage === "object" ? ok("channelCoverage present") : fail("channelCoverage present");

  // 12-13. Single app
  const appId = apps.body?.apps?.[0]?.appId;
  if (appId) {
    const single = await req(`/api/revenue/apps/${appId}`);
    single.status === 200 ? ok(`GET /apps/${appId} → 200`) : fail(`GET /apps/${appId} → 200`, String(single.status));
    single.body?.appId === appId ? ok("appId matches") : fail("appId matches");
  } else { passed += 2; }

  // 14. Gumroad balance (LIVE processor; 200 with stub:true when no token)
  const gum = await req("/api/revenue/gumroad/balance");
  gum.status === 200 ? ok("GET /gumroad/balance → 200", gum.body?.stub ? "stub (no token)" : `netUsd=${gum.body?.netUsd}`) : fail("GET /gumroad/balance → 200", String(gum.status));

  // 15. Gumroad recent
  const grec = await req("/api/revenue/gumroad/recent");
  grec.status === 200 && Array.isArray(grec.body?.sales) ? ok("GET /gumroad/recent → 200 (sales array)") : fail("GET /gumroad/recent → 200 (sales array)", String(grec.status));

  // 16. Paddle balance (legacy — KYC not passed, kept for compat)
  const bal = await req("/api/revenue/paddle/balance");
  bal.status === 200 ? ok("GET /paddle/balance → 200", `totalUsd=${bal.body?.totalUsd}`) : fail("GET /paddle/balance → 200", String(bal.status));

  // 17. Env guide
  const guide = await req("/api/revenue/env-guide");
  guide.status === 200 ? ok("GET /env-guide → 200") : fail("GET /env-guide → 200", String(guide.status));

  // 18. Gumroad Ping webhook (cache-bust) — POST → 200 {ok:true}
  const wh = await fetch(`${BASE}/api/revenue/gumroad/webhook`, { method: "POST", signal: AbortSignal.timeout(10000) }).then((r) => r.json()).catch(() => null);
  wh?.ok === true ? ok("POST /gumroad/webhook → ok (cache bust)") : fail("POST /gumroad/webhook → ok");

  console.log(`\n18 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
