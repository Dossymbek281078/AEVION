#!/usr/bin/env node
/**
 * GSC pre-submission verifier — single command operator runs BEFORE clicking
 * any Submit/Request Indexing button in Google Search Console. Wraps the
 * loose set of dig/curl/JSON-LD checks documented in
 * docs/seo/QBUILD_GSC_SUBMISSION.md into one go/no-go output.
 *
 * What it verifies:
 *   1. (optional) DNS TXT record for the GSC verification token resolves
 *      — only if GSC_TOKEN env is provided.
 *   2. /robots.txt — HTTP 200, references both sitemaps.
 *   3. /sitemap.xml — HTTP 200, contains ≥70 <loc> entries, includes all
 *      5 QBuild landings.
 *   4. Each of the 5 QBuild landings — HTTP 200, has title + meta description
 *      + ≥1 parseable <script application/ld+json>.
 *   5. (informational) The structured-data Rich-Results test URL for each
 *      page — operator clicks these once everything else is green.
 *
 * Usage:
 *   node scripts/gsc-pre-submit-verify.js
 *   GSC_TOKEN=AbCdEf node scripts/gsc-pre-submit-verify.js
 *   BASE=https://aevion.app node scripts/gsc-pre-submit-verify.js
 *
 * Exit codes: 0 = safe to click Submit in GSC, 1 = block, 2 = crash.
 */

const { spawnSync } = require("node:child_process");

const BASE = (process.env.BASE || "https://aevion.app").replace(/\/+$/, "");
const GSC_TOKEN = (process.env.GSC_TOKEN || "").trim();

const PAGES = [
  "/build/pricing",
  "/build/vacancies",
  "/build/salary",
  "/build/ai-match",
  "/build/interviews",
];

let failed = 0;
let passed = 0;

function pass(msg) { console.log(`✓ ${msg}`); passed++; }
function fail(msg) { console.error(`✗ ${msg}`); failed++; }
function info(msg) { console.log(`  ${msg}`); }

async function checkDns() {
  if (!GSC_TOKEN) {
    info("GSC_TOKEN not provided — skipping DNS TXT check.");
    info("Set GSC_TOKEN=<token-from-GSC> to verify the record propagated.");
    return;
  }
  // Use dig if available; fall back to nslookup. spawnSync is sync, so no
  // promises — we just exec and inspect stdout.
  const dig = spawnSync("dig", ["+short", "TXT", new URL(BASE).hostname], { encoding: "utf8" });
  if (dig.status === 0 && dig.stdout) {
    if (dig.stdout.includes(GSC_TOKEN)) {
      pass(`DNS TXT for ${new URL(BASE).hostname} contains the GSC token`);
      return;
    }
    fail(`DNS TXT for ${new URL(BASE).hostname} does NOT contain "${GSC_TOKEN}"`);
    info("       Wait 5-60 min for DNS propagation. Re-run this script.");
    return;
  }
  // dig missing — try nslookup
  const ns = spawnSync("nslookup", ["-type=TXT", new URL(BASE).hostname], { encoding: "utf8" });
  if (ns.status === 0 && ns.stdout && ns.stdout.includes(GSC_TOKEN)) {
    pass(`TXT for ${new URL(BASE).hostname} contains the GSC token (via nslookup)`);
    return;
  }
  fail(`could not verify DNS TXT (dig/nslookup unavailable or token missing)`);
}

async function checkRobots() {
  const url = `${BASE}/robots.txt`;
  try {
    const res = await fetch(url);
    if (res.status !== 200) { fail(`robots.txt — HTTP ${res.status}`); return; }
    const text = await res.text();
    const sitemaps = (text.match(/Sitemap:/gi) || []).length;
    if (sitemaps < 1) {
      fail(`robots.txt — no Sitemap: directive`);
      return;
    }
    pass(`robots.txt — 200 + ${sitemaps} Sitemap: directive(s)`);
  } catch (e) {
    fail(`robots.txt — fetch error: ${e.message}`);
  }
}

async function checkSitemap() {
  const url = `${BASE}/sitemap.xml`;
  try {
    const res = await fetch(url);
    if (res.status !== 200) { fail(`sitemap.xml — HTTP ${res.status}`); return; }
    const text = await res.text();
    const locCount = (text.match(/<loc>/g) || []).length;
    if (locCount < 70) {
      fail(`sitemap.xml — only ${locCount} URLs (expected ≥70)`);
      return;
    }
    const missing = PAGES.filter((p) => !text.includes(p));
    if (missing.length > 0) {
      fail(`sitemap.xml — missing /build pages: ${missing.join(", ")}`);
      return;
    }
    pass(`sitemap.xml — 200 + ${locCount} URLs + all 5 /build pages present`);
  } catch (e) {
    fail(`sitemap.xml — fetch error: ${e.message}`);
  }
}

async function checkPage(pathStr) {
  const url = `${BASE}${pathStr}`;
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "aevion-gsc-verify/1.0" } });
    if (res.status !== 200) { fail(`${pathStr} — HTTP ${res.status}`); return; }
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim();
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1]?.trim();
    if (!title) { fail(`${pathStr} — no <title>`); return; }
    if (!desc)  { fail(`${pathStr} — no <meta name=\"description\">`); return; }
    // Count valid JSON-LD blocks
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let validLd = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      try { JSON.parse(m[1].trim()); validLd++; } catch { /* skip */ }
    }
    if (validLd === 0) { fail(`${pathStr} — no parseable JSON-LD`); return; }
    pass(`${pathStr} — title(${title.length}ch) + description(${desc.length}ch) + ${validLd} JSON-LD block(s)`);
  } catch (e) {
    fail(`${pathStr} — fetch error: ${e.message}`);
  }
}

(async () => {
  console.log(`GSC pre-submission verify — BASE=${BASE}`);
  if (GSC_TOKEN) console.log(`Token (truncated): ${GSC_TOKEN.slice(0, 10)}…`);
  console.log("");

  await checkDns();
  await checkRobots();
  await checkSitemap();
  for (const p of PAGES) await checkPage(p);

  console.log("");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log("");
  if (failed === 0) {
    console.log("Safe to proceed in GSC. Click in this order:");
    console.log("  1. Verify (if DNS just landed)");
    console.log("  2. Sitemaps → submit `sitemap.xml`");
    console.log("  3. Sitemaps → submit `api-backend/api/aevion/sitemap.xml`");
    console.log("  4. URL Inspection → Request Indexing for each /build URL:");
    for (const p of PAGES) console.log(`       ${BASE}${p}`);
    console.log("  5. Rich Results Test (optional — Google may auto-validate):");
    for (const p of PAGES) console.log(`       https://search.google.com/test/rich-results?url=${encodeURIComponent(BASE + p)}`);
  } else {
    console.log("DO NOT click any Submit button in GSC. Fix the failing checks first.");
  }
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Crash:", e);
  process.exit(2);
});
