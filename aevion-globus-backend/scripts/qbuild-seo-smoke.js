#!/usr/bin/env node
/**
 * QBuild SEO smoke — verifies the per-page metadata + JSON-LD shipped in
 * PR #433 is still present on the five public /build landings. Read-only,
 * safe to run anywhere (including prod). Wired into `npm run smoke:all`
 * as the `qbuild-seo` step.
 *
 * What it checks per page:
 *   - HTTP 200
 *   - <title> exists and is non-empty
 *   - <meta name="description"> exists and is non-empty
 *   - at least one <script type="application/ld+json"> exists and parses
 *
 * It also smokes the site-wide SEO infra (robots.txt + sitemap.xml).
 *
 * Usage:
 *   node scripts/qbuild-seo-smoke.js
 *   BASE=https://aevion.app node scripts/qbuild-seo-smoke.js
 *   BASE=https://<preview>.vercel.app node scripts/qbuild-seo-smoke.js
 *
 * Exit codes: 0 = all green, 1 = at least one regression, 2 = crash.
 */

const BASE = (process.env.BASE || "https://aevion.app").replace(/\/+$/, "");

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

async function getHtml(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "aevion-seo-smoke/1.0" } });
  const text = await res.text();
  return { url, status: res.status, text };
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractMetaDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      JSON.parse(raw);
      blocks.push(raw);
    } catch {
      // skip unparseable — caller treats zero valid blocks as failure
    }
  }
  return blocks;
}

async function checkPage(path) {
  try {
    const { url, status, text } = await getHtml(path);
    if (status !== 200) {
      fail(`${path} — HTTP ${status} (${url})`);
      return;
    }
    const title = extractTitle(text);
    const desc = extractMetaDescription(text);
    const ld = extractJsonLd(text);
    if (!title) { fail(`${path} — missing <title>`); return; }
    if (!desc)  { fail(`${path} — missing <meta name="description">`); return; }
    if (ld.length === 0) { fail(`${path} — no parseable JSON-LD blocks`); return; }
    pass(`${path} — title(${title.length}ch) + description(${desc.length}ch) + ${ld.length} JSON-LD block(s)`);
  } catch (e) {
    fail(`${path} — fetch error: ${e.message}`);
  }
}

async function checkRobots() {
  const url = `${BASE}/robots.txt`;
  try {
    const res = await fetch(url);
    if (res.status !== 200) { fail(`robots.txt — HTTP ${res.status}`); return; }
    const text = await res.text();
    if (!/sitemap/i.test(text)) {
      fail(`robots.txt — no Sitemap: directive`);
      return;
    }
    pass(`robots.txt — 200 + references sitemap`);
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
    const missing = PAGES.filter((p) => !text.includes(p));
    if (missing.length) {
      fail(`sitemap.xml — missing URL(s): ${missing.join(", ")}`);
      return;
    }
    pass(`sitemap.xml — 200 + lists all 5 QBuild landings`);
  } catch (e) {
    fail(`sitemap.xml — fetch error: ${e.message}`);
  }
}

(async () => {
  console.log(`QBuild SEO smoke — BASE=${BASE}`);
  console.log("");
  await checkRobots();
  await checkSitemap();
  for (const p of PAGES) await checkPage(p);
  console.log("");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Crash:", e);
  process.exit(2);
});
