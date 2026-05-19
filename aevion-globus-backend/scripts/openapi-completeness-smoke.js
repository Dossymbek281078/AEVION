#!/usr/bin/env node
/**
 * OpenAPI completeness smoke — validates /api/openapi.json exposes paths
 * for the core AEVION modules that are under prod-smoke coverage.
 *
 * Why: accidentally dropping a route from the spec is silent (the route
 * still works, just isn't documented), and consumers building SDKs from
 * /api/openapi.json get a degraded surface. This smoke catches it.
 *
 * Approach: fetch the live spec, then for each required module check that
 * at least ONE path with that prefix exists. Soft-fails (informational)
 * for non-critical modules so we can grow the list without churn.
 *
 *  1.  GET /api/openapi.json → 200 + valid openapi 3.x JSON
 *  2.  spec.info.title is "AEVION Globus Backend"
 *  3.  spec.info.version matches semver
 *  4.  Paths object non-empty (≥ 50 entries — current is 122)
 *  5-N. For each required module: at least 1 path with prefix
 *  N+1. Content-Type application/json on /api/openapi.json
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

// Critical modules — must be in OpenAPI or the SDK consumers break.
// (Soft-listed ones below are informational only; we grow the critical
// list as more modules ship public SDK surfaces.)
const CRITICAL_PREFIXES = [
  "/api/auth",
  "/api/globus",
  "/api/pricing",
  "/api/qright",
  "/api/qsign",
  "/api/qpaynet",
  "/api/qgood",
  "/api/qmaskcard",
  "/api/veilnetx-ledger",
  "/api/ztide",
  "/api/qchaingov",
  "/api/qtrade",
  "/api/qtradeoffline",
  "/api/healthai",
  "/api/qstore",
  "/api/qcoreai",
  "/api/revenue",
  "/api/planet",
  "/api/modules",
];

// Informational — checked but missing doesn't fail the smoke.
const SOFT_PREFIXES = [
  "/api/coach",
  "/api/qlearn",
  "/api/qevents",
  "/api/qjobs",
  "/api/qnews",
  "/api/qmedia",
  "/api/qai",
  "/api/multichat",
  "/api/devhub",
  "/api/qfusionai",
  "/api/qpersona",
  "/api/qlife",
  "/api/lifebox",
  "/api/shadownet",
  "/api/deepsan",
  "/api/psyapp-deps",
  "/api/kids-ai",
  "/api/mapreality",
  "/api/voice-of-earth",
  "/api/startupx",
  "/api/qfusionai",
];

async function run() {
  console.log(`\nOpenAPI completeness smoke → ${BASE}\n`);

  let r;
  try {
    r = await fetch(`${BASE}/api/openapi.json`, { signal: AbortSignal.timeout(15000) });
  } catch (e) {
    fail("GET /api/openapi.json", e?.message || String(e));
    process.exit(1);
  }

  const ct = r.headers.get("content-type") || "";
  let spec;
  try { spec = await r.json(); } catch { spec = null; }

  if (r.status === 200 && spec && typeof spec === "object") {
    ok("GET /api/openapi.json", `status=${r.status}`);
  } else {
    fail("GET /api/openapi.json", `${r.status} ${typeof spec}`);
    process.exit(1);
  }

  if (spec.info?.title === "AEVION Globus Backend") {
    ok("spec.info.title = 'AEVION Globus Backend'");
  } else fail("spec.info.title", `got=${spec.info?.title}`);

  if (/^\d+\.\d+\.\d+$/.test(spec.info?.version || "")) {
    ok("spec.info.version semver", spec.info.version);
  } else fail("spec.info.version semver", `got=${spec.info?.version}`);

  const paths = spec.paths || {};
  const pathKeys = Object.keys(paths);
  if (pathKeys.length >= 50) {
    ok("paths non-empty", `count=${pathKeys.length}`);
  } else fail("paths too few", `count=${pathKeys.length}`);

  // Critical modules — must have at least 1 path
  for (const prefix of CRITICAL_PREFIXES) {
    const hit = pathKeys.some((p) => p.startsWith(prefix));
    if (hit) ok(`CRITICAL ${prefix}`);
    else fail(`MISSING critical ${prefix}`, "no path with this prefix");
  }

  // Soft modules — informational
  const softMissing = SOFT_PREFIXES.filter((p) => !pathKeys.some((k) => k.startsWith(p)));
  if (softMissing.length === 0) {
    ok("All soft prefixes present", `${SOFT_PREFIXES.length} checked`);
  } else {
    // This is INFO only — print as ok with annotation so we don't fail the run
    ok(`Soft prefixes present (${SOFT_PREFIXES.length - softMissing.length}/${SOFT_PREFIXES.length})`,
       `missing: ${softMissing.map((p) => p.replace("/api/", "")).join(", ")}`);
  }

  if (/application\/json/i.test(ct)) {
    ok("Content-Type application/json", ct);
  } else fail("Content-Type", `got='${ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
