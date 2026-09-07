#!/usr/bin/env node
/**
 * QSign PROD smoke — read-only checks for QSign v2 (ML-DSA/Ed25519/HMAC)
 * and the legacy QSign v1 deprecation notices.
 *
 * Coverage:
 *  1.  GET /api/qsign/v2/health → service=qsign-v2 + db.ok + status
 *  2.  GET /api/qsign/v2/keys → array of 2 active keys (HMAC + Ed25519)
 *  3.  GET /api/qsign/v2/keys — Ed25519 key has publicKey (not null)
 *  4.  GET /api/qsign/v2/keys — HMAC key publicKey is null (secret-only)
 *  5.  GET /api/qsign/v2/sigs (no auth) → 401 auth gate
 *  6.  POST /api/qsign/v2/sign (no auth) → 401 auth gate
 *  7.  POST /api/qsign/v2/verify (no body) → 400 validation gate
 *  8.  GET /api/qsign/v2/openapi.json → has paths + info
 *  9.  GET /api/qsign/health (legacy) → service=qsign-legacy + deprecated=true
 * 10.  GET /api/qsign/v2/health — db latencyMs numeric
 * 11.  GET /api/qsign/v2/health — activeKeys.ed25519 === "qsign-ed25519-v1"
 * 12.  GET /api/qsign/v2/health — uptimeSec > 0
 * 13.  GET /api/qsign/v2/keys — total count matches active array length
 * 14.  Content-Type application/json on /qsign/v2/health
 * 15.  GET /api/qsign/v2/sigs/:unknownId → 401 or 404 (not 500)
 *
 * Usage:
 *   node scripts/qsign-prod-smoke.js
 *   BASE=http://localhost:4001 node scripts/qsign-prod-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, opts = {}) {
  try {
    const headers = { "Accept": "application/json", ...(opts.headers || {}) };
    const init = { method, headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const r = await fetch(`${BASE}${path}`, init);
    const contentType = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, contentType };
  } catch (e) {
    return { status: 0, body: {}, error: e?.message || String(e) };
  }
}

async function run() {
  console.log(`\nQSign PROD smoke → ${BASE}\n`);

  // 1. v2 health
  let r = await req("GET", "/api/qsign/v2/health");
  let health = null;
  if (r.status === 200 && r.body?.service === "qsign-v2" && r.body?.status === "ok") {
    health = r.body;
    ok("GET /qsign/v2/health", `service=qsign-v2 db.ok=${health.db?.ok}`);
  } else fail("GET /qsign/v2/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 2. v2 keys — 2 keys
  r = await req("GET", "/api/qsign/v2/keys");
  let keys = null;
  if (r.status === 200 && Array.isArray(r.body?.keys) && typeof r.body?.total === "number") {
    keys = r.body.keys;
    ok("GET /qsign/v2/keys", `total=${r.body.total} keys=${keys.length}`);
  } else fail("GET /qsign/v2/keys", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 3. Ed25519 has publicKey
  if (keys) {
    const ed = keys.find(k => k.algo === "Ed25519" || k.kid?.includes("ed25519"));
    if (ed && typeof ed.publicKey === "string" && ed.publicKey.length === 64) {
      ok("Ed25519 key has publicKey (hex64)", `pub=${ed.publicKey.slice(0, 12)}...`);
    } else fail("Ed25519 publicKey", `found=${!!ed} pub=${ed?.publicKey?.slice(0, 12)}`);
  }

  // 4. HMAC publicKey is null
  if (keys) {
    const hmac = keys.find(k => k.algo === "HMAC-SHA256" || k.kid?.includes("hmac"));
    if (hmac && hmac.publicKey === null) {
      ok("HMAC key publicKey is null (secret-only)");
    } else fail("HMAC publicKey null", `got=${hmac?.publicKey}`);
  }

  // 5. Sigs auth gate (404 = endpoint uses /:id path only, no list without auth)
  r = await req("GET", "/api/qsign/v2/sigs");
  if (r.status === 401) ok("GET /qsign/v2/sigs (no auth) → 401");
  else if (r.status === 404) ok("GET /qsign/v2/sigs → 404 (list not exposed, check /api/qsign/v2/sigs/:id)", "informational");
  else fail("GET /qsign/v2/sigs auth gate", `got=${r.status}`);

  // 6. Sign auth gate
  r = await req("POST", "/api/qsign/v2/sign", { body: {} });
  if (r.status === 401) ok("POST /qsign/v2/sign (no auth) → 401");
  else fail("POST /qsign/v2/sign auth gate", `got=${r.status}`);

  // 7. Verify validation gate
  r = await req("POST", "/api/qsign/v2/verify", { body: {} });
  if (r.status === 400 || r.status === 422) ok("POST /qsign/v2/verify {} → 400/422 validation", `status=${r.status}`);
  else if (r.status === 401) ok("POST /qsign/v2/verify → 401 (auth required before validate)", "status=401");
  else fail("POST /qsign/v2/verify gate", `got=${r.status}`);

  // 8. v2 openapi
  r = await req("GET", "/api/qsign/v2/openapi.json");
  if (r.status === 200 && r.body?.paths && r.body?.info) {
    ok("GET /qsign/v2/openapi.json", `paths=${Object.keys(r.body.paths).length}`);
  } else fail("GET /qsign/v2/openapi.json", `${r.status}`);

  // 9. Legacy health deprecated
  r = await req("GET", "/api/qsign/health");
  if (r.status === 200 && r.body?.service === "qsign-legacy" && r.body?.deprecated === true) {
    ok("GET /qsign/health legacy deprecated=true", `sunset=${r.body.sunset}`);
  } else fail("GET /qsign/health legacy", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 10. db latencyMs
  if (health) {
    if (typeof health.db?.latencyMs === "number") {
      ok("v2 health db.latencyMs numeric", `${health.db.latencyMs}ms`);
    } else fail("v2 health db.latencyMs", `got=${typeof health.db?.latencyMs}`);
  }

  // 11. activeKeys.ed25519
  if (health) {
    if (health.activeKeys?.ed25519 === "qsign-ed25519-v1") {
      ok("health.activeKeys.ed25519 correct");
    } else fail("health.activeKeys.ed25519", `got=${health.activeKeys?.ed25519}`);
  }

  // 12. uptimeSec > 0
  if (health) {
    if (typeof health.uptimeSec === "number" && health.uptimeSec > 0) {
      ok("health.uptimeSec > 0", `${health.uptimeSec}s`);
    } else fail("health.uptimeSec > 0", `got=${health.uptimeSec}`);
  }

  // 13. Total matches array length
  r = await req("GET", "/api/qsign/v2/keys");
  if (r.status === 200 && r.body?.total === r.body?.keys?.length) {
    ok("keys total == keys.length", `${r.body.total}`);
  } else fail("keys total mismatch", `total=${r.body?.total} len=${r.body?.keys?.length}`);

  // 14. Content-Type
  r = await req("GET", "/api/qsign/v2/health");
  if (r.status === 200 && /application\/json/i.test(r.contentType || "")) {
    ok("Content-Type application/json on /qsign/v2/health", r.contentType);
  } else fail("Content-Type /qsign/v2/health", `ct='${r.contentType}'`);

  // 15. Unknown sig → not 500
  r = await req("GET", "/api/qsign/v2/sigs/00000000-0000-0000-0000-000000000000");
  if (r.status === 401 || r.status === 404 || r.status === 400) {
    ok("GET /qsign/v2/sigs/<unknown> → 4xx (not 5xx)", `status=${r.status}`);
  } else fail("GET /qsign/v2/sigs/<unknown>", `got=${r.status}`);

  // 16. Пинованная карта offline-верификатора ↖ живые ключи прода.
  //
  // Гэп найден вахтой 07.09.2026: /verify-offline проверяет подпись
  // платформы ключом, ЗАКРЕПЛЁННЫМ в frontend/src/lib/verifyBundle.ts
  // (это и есть заверение, а не самосогласованность), но НИ ОДИН сторож
  // не сверял карту с /api/qsign/v2/keys. Смени прод ключ — и реальные
  // бандлы перестали бы проверяться офлайн МОЛЧА: ручной шаг «добавить
  // строку в карту» — класс manual_step_on_day_x_never_happens.
  //
  // Сверка в ОБЕ стороны: (а) каждый активный Ed25519-kid прода есть в
  // карте и hex совпадает; (б) хотя бы один пин жив на проде (карта из
  // одних мёртвых ключей — тоже слом). Смоук живёт в репо и читает файл
  // верификатора напрямую — третьей копии ключа не появляется.
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const vbPath = path.join(__dirname, "..", "..", "frontend", "src", "lib", "verifyBundle.ts");
    const vb = fs.readFileSync(vbPath, "utf8");
    const mapBlock = (vb.match(/PLATFORM_PUBLIC_KEYS[^=]*=\s*\{([\s\S]*?)\}/) || [])[1] || "";
    const pinned = {};
    for (const m of mapBlock.matchAll(/"([\w-]+)":\s*\n?\s*"([0-9a-f]{64})"/g)) pinned[m[1]] = m[2];
    r = await req("GET", "/api/qsign/v2/keys");
    const activeEd = (r.body?.keys || []).filter((k) => k.algo === "Ed25519" && k.status === "active");
    if (!Object.keys(pinned).length) {
      fail("pinned map parse", "PLATFORM_PUBLIC_KEYS не разобрана — прибор, не прод");
    } else if (!activeEd.length) {
      fail("prod active ed25519", "на проде нет активного Ed25519-ключа");
    } else {
      const missing = activeEd.filter((k) => pinned[k.kid] !== k.publicKey);
      if (missing.length === 0) {
        ok("offline pin == prod keys", activeEd.map((k) => k.kid).join(","));
      } else {
        fail("offline pin mismatch",
          missing.map((k) => `${k.kid}: прод=${(k.publicKey || "null").slice(0, 12)}… пин=${(pinned[k.kid] || "НЕТ").slice(0, 12)}…`).join("; "));
      }
      const alive = Object.keys(pinned).some((kid) => activeEd.some((k) => k.kid === kid));
      if (alive) ok("хотя бы один пин активен на проде", Object.keys(pinned).join(","));
      else fail("все пины мертвы", "ротация прошла мимо verifyBundle");
    }
  } catch (e) {
    fail("pin-check не выполнился", String(e && e.message).slice(0, 120));
  }

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
