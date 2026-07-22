#!/usr/bin/env node
/**
 * Live-page smoke — actually OPENS the public page of each live module.
 *
 * Why: 2026-07-21 lesson. Every CF Pages deploy DevHub ever made reported
 * success while the page served an empty 500 — because nothing anywhere
 * fetched the page itself. API smokes prove endpoints; this proves the
 * thing a human actually loads.
 *
 * Pass criteria per page: HTTP 2xx, body over 5KB, body mentions "aevion"
 * (case-insensitive) — enough to catch full-page 500s, empty shells, and
 * hosting-level breakage without being brittle about copy or i18n.
 *
 * Env:
 *   PAGES_BASE  default https://aevion.vercel.app
 */

const BASE = (process.env.PAGES_BASE || "https://aevion.vercel.app").replace(/\/+$/, "");

const PAGES = [
  "/",
  "/explore",
  "/devhub",
  "/studio",
  "/pricing",
  "/apps",
  "/qright",
  "/qsign",
  "/bureau",
  "/planet",
  "/awards",
  "/bank",
  "/cyberchess",
  "/qventure",
  "/build",
  "/qtrade",
  "/smeta-trainer",
  "/revenue",
  "/pitch",
  "/acquire",
];

let pass = 0;
let fail = 0;
const failures = [];

async function checkPage(p) {
  const url = BASE + p;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { Accept: "text/html" } });
    const body = await r.text();
    const okStatus = r.ok;
    const okSize = body.length > 5000;
    const okBrand = /aevion/i.test(body);
    if (okStatus && okSize && okBrand) {
      pass++;
      console.log(`  PASS ${p} (${r.status}, ${(body.length / 1024).toFixed(0)}KB)`);
    } else {
      fail++;
      failures.push(p);
      console.log(`  FAIL ${p} — status=${r.status} size=${body.length} brand=${okBrand}`);
    }
  } catch (e) {
    fail++;
    failures.push(p);
    console.log(`  FAIL ${p} — ${e.message}`);
  }
}

(async () => {
  console.log(`pages-live-smoke against ${BASE} (${PAGES.length} pages)`);
  // Small batches: fast enough, and no thundering herd against prod.
  for (let i = 0; i < PAGES.length; i += 5) {
    await Promise.all(PAGES.slice(i, i + 5).map(checkPage));
  }
  console.log(`\npages-live-smoke: ${pass}/${PAGES.length} PASS${fail ? ` — FAILING: ${failures.join(", ")}` : ""}`);
  process.exit(fail ? 1 : 0);
})();
