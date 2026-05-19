#!/usr/bin/env node
/**
 * QCoreAI PROD smoke — read-only checks for the multi-agent AI core.
 *
 * QCoreAI is foundational — every AI-using module (HealthAI, QAI, Coach,
 * Multichat, DevHub, KidsAI, etc.) eventually calls into it. A regression
 * here cascades. Group smokes (rest-prod, qzone-prod, healthai-prod) all
 * smoke their own AI surfaces, but none verify QCoreAI's own /providers,
 * /sessions, /agents, /prompts shape directly — this fills that gap.
 *
 *  1.  GET /api/qcoreai/health → service=qcoreai + ok=true + version semver
 *  2.  health.configuredProviders is array, length ≥ 1
 *  3.  health.activeProvider is a string in configuredProviders
 *  4.  health.storage shape ('postgres' or 'memory')
 *  5.  GET /api/qcoreai/providers → providers[] array, length ≥ 3
 *  6.  providers[0] shape (id + name + models[] + configured)
 *  7.  providers list intersects with health.configuredProviders
 *  8.  GET /api/qcoreai/sessions → 200 + array shape (public list)
 *  9.  GET /api/qcoreai/agents → 200 + array shape
 * 10.  GET /api/qcoreai/prompts → 401 (auth gate) or 200 if opened
 * 11.  POST /api/qcoreai (non-existent path) → 4xx graceful
 * 12.  Content-Type application/json on /qcoreai/health
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
  console.log(`\nQCoreAI PROD smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/qcoreai/health");
  let health = null;
  if (r.status === 200 && r.body?.service === "qcoreai" && r.body?.ok === true && /^\d+\.\d+\.\d+$/.test(r.body?.version || "")) {
    health = r.body;
    ok("GET /qcoreai/health", `v${health.version} storage=${health.storage}`);
  } else fail("GET /qcoreai/health", `${r.status} service=${r.body?.service} v=${r.body?.version}`);

  // 2. configuredProviders array
  if (health) {
    if (Array.isArray(health.configuredProviders) && health.configuredProviders.length >= 1) {
      ok("health.configuredProviders array ≥ 1", `[${health.configuredProviders.join(",")}]`);
    } else fail("health.configuredProviders", `got=${JSON.stringify(health.configuredProviders)}`);
  }

  // 3. activeProvider in configuredProviders
  if (health) {
    if (typeof health.activeProvider === "string" && health.configuredProviders?.includes(health.activeProvider)) {
      ok("health.activeProvider valid", health.activeProvider);
    } else fail("health.activeProvider", `active=${health.activeProvider} configured=${health.configuredProviders}`);
  }

  // 4. storage shape
  if (health) {
    if (health.storage === "postgres" || health.storage === "memory") {
      ok("health.storage valid", health.storage);
    } else fail("health.storage", `got=${health.storage}`);
  }

  // 5. Providers list
  r = await req("GET", "/api/qcoreai/providers");
  let providers = null;
  if (r.status === 200 && Array.isArray(r.body?.providers) && r.body.providers.length >= 3) {
    providers = r.body.providers;
    ok("GET /qcoreai/providers", `count=${providers.length}`);
  } else fail("GET /qcoreai/providers", `${r.status} count=${r.body?.providers?.length}`);

  // 6. Provider shape
  if (providers) {
    const p = providers[0];
    if (p.id && p.name && Array.isArray(p.models) && typeof p.configured === "boolean") {
      ok("providers[0] shape", `${p.id} (${p.models.length} models, configured=${p.configured})`);
    } else fail("providers[0] shape", `keys=${Object.keys(p).join(",")}`);
  }

  // 7. Providers intersects with health.configuredProviders
  if (health && providers) {
    const providerIds = providers.filter((p) => p.configured).map((p) => p.id);
    const matches = health.configuredProviders.filter((p) => providerIds.includes(p));
    if (matches.length >= 1) ok("providers ↔ health agree", `intersect=${matches.length}`);
    else fail("providers ↔ health disagree", `health=${health.configuredProviders} configured=${providerIds}`);
  }

  // 8. Sessions
  r = await req("GET", "/api/qcoreai/sessions");
  if (r.status === 200 && (Array.isArray(r.body?.sessions) || Array.isArray(r.body?.items) || Array.isArray(r.body))) {
    const arr = r.body.sessions ?? r.body.items ?? r.body;
    ok("GET /qcoreai/sessions", `count=${arr.length}`);
  } else if (r.status === 401) {
    ok("GET /qcoreai/sessions → 401 (auth gate)", "");
  } else fail("GET /qcoreai/sessions", `${r.status}`);

  // 9. Agents
  r = await req("GET", "/api/qcoreai/agents");
  if (r.status === 200) {
    const arr = r.body?.agents ?? r.body?.items ?? (Array.isArray(r.body) ? r.body : []);
    ok("GET /qcoreai/agents", `count=${Array.isArray(arr) ? arr.length : "obj"}`);
  } else if (r.status === 401) {
    ok("GET /qcoreai/agents → 401 (auth gate)", "");
  } else fail("GET /qcoreai/agents", `${r.status}`);

  // 10. Prompts (auth gate expected)
  r = await req("GET", "/api/qcoreai/prompts");
  if (r.status === 401 || r.status === 403) {
    ok("GET /qcoreai/prompts → 401 (auth gate)", `status=${r.status}`);
  } else if (r.status === 200) {
    ok("GET /qcoreai/prompts public OK", `status=${r.status}`);
  } else fail("GET /qcoreai/prompts", `${r.status}`);

  // 11. Non-existent POST
  r = await req("POST", "/api/qcoreai", { body: {} });
  if (r.status === 404 || r.status === 405 || r.status === 400) {
    ok("POST /api/qcoreai → 4xx graceful", `status=${r.status}`);
  } else fail("POST /api/qcoreai graceful", `got=${r.status}`);

  // 12. Content-Type
  r = await req("GET", "/api/qcoreai/health");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /qcoreai/health", r.ct);
  } else fail("Content-Type /qcoreai/health", `ct='${r.ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
