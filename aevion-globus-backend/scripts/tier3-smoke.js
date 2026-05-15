#!/usr/bin/env node
/**
 * Tier 3 amplifier surface — end-to-end smoke test.
 *
 * Hits every public crawler-facing endpoint across the 7 platform surfaces
 * (modules, bureau, awards, pipeline, qshield, qright, planet) plus the
 * aevion-hub aggregate. Verifies:
 *
 *   1. status 200
 *   2. expected Content-Type
 *   3. ETag header present
 *   4. Cache-Control: public, max-age=N present
 *   5. repeat fetch with If-None-Match returns 304 + empty body
 *
 * Catches regression when:
 *   - someone deletes a public crawler route during refactor
 *   - someone removes the ETag wiring
 *   - middleware accidentally blocks public access
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/tier3-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   STRICT    if "1", fail on missing-data 404s instead of skipping them
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const STRICT = process.env.STRICT === "1";

let step = 0;
let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name, extra) {
  step += 1;
  passed += 1;
  console.log(`  ${String(step).padStart(3, "0")}  PASS   ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(3, "0")}  FAIL   ${name}`);
  console.error(`       ↳ ${reason}`);
}
function skip(name, reason) {
  step += 1;
  skipped += 1;
  console.log(`  ${String(step).padStart(3, "0")}  SKIP   ${name}  (${reason})`);
}

/**
 * Hit a route and check headers + 304 cycle.
 *
 * @param {string} name        human label
 * @param {string} path        URL path under BASE
 * @param {string} expectType  expected Content-Type prefix (e.g. "image/svg")
 * @param {object} opts        { allowMissing: skip on 404 unless STRICT }
 */
async function check(name, path, expectType, opts = {}) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    fail(name, `network: ${err?.message || err}`);
    return;
  }

  if (res.status === 404 && opts.allowMissing && !STRICT) {
    skip(name, "404 (no seed data)");
    return;
  }

  if (res.status !== 200) {
    fail(name, `expected 200, got ${res.status}`);
    return;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith(expectType)) {
    fail(name, `Content-Type "${ct}" does not start with "${expectType}"`);
    return;
  }

  const etag = res.headers.get("etag");
  if (!etag) {
    fail(name, "missing ETag header");
    return;
  }

  const cache = res.headers.get("cache-control") || "";
  if (!/public/.test(cache) || !/max-age=\d+/.test(cache)) {
    fail(name, `bad Cache-Control: "${cache}"`);
    return;
  }

  // Drain body so the connection can be reused.
  await res.arrayBuffer();

  // 304 cycle.
  let res304;
  try {
    res304 = await fetch(url, { headers: { "if-none-match": etag } });
  } catch (err) {
    fail(name, `304 cycle network: ${err?.message || err}`);
    return;
  }
  if (res304.status !== 304) {
    fail(name, `If-None-Match did not yield 304 (got ${res304.status})`);
    return;
  }
  const body304 = await res304.arrayBuffer();
  if (body304.byteLength !== 0) {
    fail(name, `304 carried ${body304.byteLength} bytes (should be empty)`);
    return;
  }

  pass(name, `etag=${etag.slice(0, 32)}${etag.length > 32 ? "…" : ""}`);
}

async function pickSomeId(path, key = "id") {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.status !== 200) return null;
    const j = await res.json();
    if (Array.isArray(j?.items) && j.items[0]?.[key]) return j.items[0][key];
    if (Array.isArray(j) && j[0]?.[key]) return j[0][key];
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Tier 3 smoke against ${BASE} (STRICT=${STRICT ? "on" : "off"})\n`);
  console.log("== Index OG cards ==");
  await check("modules /og.svg", "/api/modules/og.svg", "image/svg");
  await check("bureau /og.svg", "/api/bureau/og.svg", "image/svg");
  await check("awards /og.svg", "/api/awards/og.svg", "image/svg");
  await check("pipeline /og.svg", "/api/pipeline/og.svg", "image/svg");
  await check("qshield /og.svg", "/api/quantum-shield/og.svg", "image/svg");
  await check("qright /og.svg", "/api/qright/og.svg", "image/svg");
  await check("planet /og.svg", "/api/planet/og.svg", "image/svg");

  console.log("\n== Sitemaps ==");
  await check("modules /sitemap.xml", "/api/modules/sitemap.xml", "application/xml");
  await check("bureau /sitemap.xml", "/api/bureau/sitemap.xml", "application/xml");
  await check("awards /sitemap.xml", "/api/awards/sitemap.xml", "application/xml");
  await check("pipeline /sitemap.xml", "/api/pipeline/sitemap.xml", "application/xml");
  await check("qshield /sitemap.xml", "/api/quantum-shield/sitemap.xml", "application/xml");
  await check("qright /sitemap.xml", "/api/qright/sitemap.xml", "application/xml");
  await check("planet /sitemap.xml", "/api/planet/sitemap.xml", "application/xml");
  await check("aevion-hub /sitemap.xml", "/api/aevion/sitemap.xml", "application/xml");

  console.log("\n== RSS feeds (registry-level) ==");
  await check("modules /changelog.rss", "/api/modules/changelog.rss", "application/rss+xml");

  console.log("\n== OG cards / RSS / badges per-entity (skips when no seed data) ==");

  // modules — try first project
  await check("modules /:id/og.svg", "/api/modules/qright/og.svg", "image/svg", { allowMissing: true });
  await check("modules /:id/badge.svg", "/api/modules/qright/badge.svg", "image/svg", { allowMissing: true });
  await check("modules /:id/changelog.rss", "/api/modules/qright/changelog.rss", "application/rss+xml", { allowMissing: true });
  await check("modules /tags/:tag/changelog.rss", "/api/modules/tags/ai/changelog.rss", "application/rss+xml", { allowMissing: true });

  // bureau — discover a cert id
  const bureauCertId = await pickSomeId("/api/bureau/certs?limit=1", "id") || await pickSomeId("/api/bureau/certs/recent?limit=1", "id");
  if (bureauCertId) {
    await check("bureau /cert/:id/og.svg", `/api/bureau/cert/${encodeURIComponent(bureauCertId)}/og.svg`, "image/svg");
    await check("bureau /cert/:id/badge.svg", `/api/bureau/cert/${encodeURIComponent(bureauCertId)}/badge.svg`, "image/svg");
    await check("bureau /cert/:id/changelog.rss", `/api/bureau/cert/${encodeURIComponent(bureauCertId)}/changelog.rss`, "application/rss+xml");
  } else {
    skip("bureau per-cert OG/badge/RSS", "no cert seed");
    skip("bureau per-cert badge", "no cert seed");
    skip("bureau per-cert RSS", "no cert seed");
  }

  // awards — discover an entry id
  const awardsEntryId = await pickSomeId("/api/awards/entries/recent?limit=1", "id");
  if (awardsEntryId) {
    await check("awards /entries/:id/og.svg", `/api/awards/entries/${encodeURIComponent(awardsEntryId)}/og.svg`, "image/svg");
    await check("awards /entries/:id/badge.svg", `/api/awards/entries/${encodeURIComponent(awardsEntryId)}/badge.svg`, "image/svg");
  } else {
    skip("awards per-entry OG/badge", "no entry seed");
    skip("awards per-entry badge", "no entry seed");
  }

  // qshield — discover a shield id
  const shieldId = await pickSomeId("/api/quantum-shield?limit=1", "id");
  if (shieldId) {
    await check("qshield /:id/og.svg", `/api/quantum-shield/${encodeURIComponent(shieldId)}/og.svg`, "image/svg");
    await check("qshield /:id/changelog.rss", `/api/quantum-shield/${encodeURIComponent(shieldId)}/changelog.rss`, "application/rss+xml");
  } else {
    skip("qshield per-shield OG", "no shield seed");
    skip("qshield per-shield RSS", "no shield seed");
  }

  // qright — discover an object id
  const qrightObjectId = await pickSomeId("/api/qright/objects?limit=1", "id");
  if (qrightObjectId) {
    await check("qright /badge/:id.svg", `/api/qright/badge/${encodeURIComponent(qrightObjectId)}.svg`, "image/svg");
    await check("qright /objects/:id/changelog.rss", `/api/qright/objects/${encodeURIComponent(qrightObjectId)}/changelog.rss`, "application/rss+xml");
  } else {
    skip("qright per-object badge", "no object seed");
    skip("qright per-object RSS", "no object seed");
  }

  console.log("\n== Summary ==");
  console.log(`  total: ${step}, passed: ${passed}, failed: ${failed}, skipped: ${skipped}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(2);
});
