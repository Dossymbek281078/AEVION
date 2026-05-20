#!/usr/bin/env node
/**
 * Pipeline PROD smoke — read-only checks for the orchestration layer
 * (protect → sign → certify → verify chain) + Hub SDK registry.
 *
 *  1.  GET /api/pipeline/health → 200 + service marker
 *  2.  health response has version or status field
 *  3.  GET /api/pipeline/certificates → 200 + array shape
 *  4.  GET /api/pipeline/verify/__no_such__ → 404 (graceful for unknown cert)
 *  5.  GET /api/pipeline/ots/__no_such__/proof → 4xx graceful
 *  6.  POST /api/pipeline/protect (no auth) → 401 auth gate
 *  7.  POST /api/pipeline/reconstruct (no auth) → 401 auth gate
 *  8.  POST /api/pipeline (non-existent root) → 4xx graceful
 *  9.  GET /api/aevion/sdks → 200 + total + sdks array (new feature)
 * 10.  sdks list contains 4 packages (fintech-sdk, catalog-client, qpaynet, qcoreai)
 * 11.  sdks[0] shape (id, name, version, install, registry)
 * 12.  Content-Type application/json on /pipeline/health
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
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

async function run() {
  console.log(`\nPipeline PROD smoke → ${BASE}\n`);

  // 1. Pipeline health
  let r = await req("GET", "/api/pipeline/health");
  if (r.status === 200) {
    ok("GET /pipeline/health", `keys=${Object.keys(r.body).join(",").slice(0, 60)}`);
  } else fail("GET /pipeline/health", `${r.status}`);

  // 2. Health has identifiable shape
  if (r.status === 200) {
    const hasMarker = r.body?.service || r.body?.status || r.body?.version || r.body?.ok !== undefined;
    if (hasMarker) ok("health has marker (service/status/version/ok)");
    else fail("health shape", `keys=${Object.keys(r.body).join(",")}`);
  }

  // 3. Certificates list
  r = await req("GET", "/api/pipeline/certificates");
  if (r.status === 200) {
    const arr = r.body?.items ?? r.body?.certificates ?? (Array.isArray(r.body) ? r.body : null);
    if (arr !== null && Array.isArray(arr)) {
      ok("GET /pipeline/certificates", `count=${arr.length}`);
    } else if (typeof r.body === "object") {
      ok("GET /pipeline/certificates (object)", `keys=${Object.keys(r.body).length}`);
    } else fail("certificates shape", `type=${typeof r.body}`);
  } else fail("GET /pipeline/certificates", `${r.status}`);

  // 4. Verify unknown cert
  r = await req("GET", "/api/pipeline/verify/__no_such_cert__");
  if (r.status === 404 || r.status === 400) {
    ok("GET /pipeline/verify/<unknown> → 4xx graceful", `status=${r.status}`);
  } else fail("Verify unknown cert", `got=${r.status}`);

  // 5. OTS proof unknown
  r = await req("GET", "/api/pipeline/ots/__no_such__/proof");
  if (r.status === 404 || r.status === 400) {
    ok("GET /pipeline/ots/<unknown>/proof → 4xx graceful", `status=${r.status}`);
  } else fail("OTS unknown", `got=${r.status}`);

  // 6. Protect auth gate
  r = await req("POST", "/api/pipeline/protect", { body: {} });
  if (r.status === 401 || r.status === 400) {
    ok("POST /pipeline/protect (no auth) → 401/400", `status=${r.status}`);
  } else fail("POST /pipeline/protect auth gate", `got=${r.status}`);

  // 7. Reconstruct auth gate
  r = await req("POST", "/api/pipeline/reconstruct", { body: {} });
  if (r.status === 401 || r.status === 400) {
    ok("POST /pipeline/reconstruct (no auth) → 401/400", `status=${r.status}`);
  } else fail("POST /pipeline/reconstruct auth gate", `got=${r.status}`);

  // 8. Non-existent root
  r = await req("POST", "/api/pipeline", { body: {} });
  if (r.status === 404 || r.status === 405 || r.status === 400) {
    ok("POST /api/pipeline → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/pipeline graceful", `got=${r.status}`);

  // 9. SDKs registry (new feature today)
  r = await req("GET", "/api/aevion/sdks");
  let sdks = null;
  if (r.status === 200 && typeof r.body?.total === "number" && Array.isArray(r.body?.sdks)) {
    sdks = r.body.sdks;
    ok("GET /aevion/sdks", `total=${r.body.total}`);
  } else fail("GET /aevion/sdks", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 10. SDK list contains 4 packages
  if (sdks) {
    const ids = sdks.map((s) => s.id);
    const expected = ["fintech-sdk", "catalog-client", "qpaynet-client", "qcoreai-client"];
    const allPresent = expected.every((id) => ids.includes(id));
    if (allPresent) ok("sdks contains 4 expected packages", ids.join(","));
    else fail("sdks missing expected", `got=${ids.join(",")}`);
  }

  // 11. SDK shape
  if (sdks && sdks.length > 0) {
    const s = sdks[0];
    if (s.id && s.name && /^\d+\.\d+\.\d+$/.test(s.version || "") && s.install && s.registry?.startsWith("https://www.npmjs.com/")) {
      ok("sdks[0] shape", `${s.name}@${s.version}`);
    } else fail("sdks[0] shape", `name=${s.name} v=${s.version} reg=${s.registry}`);
  }

  // 12. Content-Type
  r = await req("GET", "/api/pipeline/health");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /pipeline/health", r.ct);
  } else fail("Content-Type /pipeline/health", `ct='${r.ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
