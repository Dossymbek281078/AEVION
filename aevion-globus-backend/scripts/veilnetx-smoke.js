#!/usr/bin/env node
/**
 * VeilNetX smoke test — runs against a live backend.
 * Usage: BASE=http://localhost:4001 node scripts/veilnetx-smoke.js
 *
 * Covers the live privacy-check surface: /status, /inspect (the shippable-today
 * tool) and waitlist rate limiting. The Tor proxy itself is Q4 2026 roadmap.
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");

let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nVeilNetX smoke → ${BASE}\n`);

  // 1. Status
  console.log("1. Status");
  const status = await req("GET", "/api/veilnetx/status");
  assert("GET /status → 200", status.status === 200);
  assert("status.module === veilnetx", status.body?.module === "veilnetx");
  assert("threatModel present", Array.isArray(status.body?.threatModel?.protectsFrom));

  // 2. Inspect — the live privacy tool
  console.log("\n2. Inspect (live privacy check)");
  const ins = await req("GET", "/api/veilnetx/inspect", null, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "X-Forwarded-For": "203.0.113.7, 10.0.0.1",
  });
  assert("GET /inspect → 200", ins.status === 200);
  assert("inspect.tool === inspect", ins.body?.tool === "inspect");
  assert("ip echoed from X-Forwarded-For leftmost", ins.body?.ip === "203.0.113.7");
  assert("ipChain has 2 hops", Array.isArray(ins.body?.ipChain) && ins.body.ipChain.length === 2);
  assert("proxyDetected true (multi-hop XFF)", ins.body?.proxyDetected === true);
  assert("UA parsed → Chrome / Windows", ins.body?.userAgent?.browser === "Chrome" && ins.body?.userAgent?.os === "Windows");
  assert("primaryLanguage parsed", ins.body?.primaryLanguage === "ru-RU");
  assert("exposure.score is number 0..100",
    typeof ins.body?.exposure?.score === "number" && ins.body.exposure.score >= 0 && ins.body.exposure.score <= 100);
  assert("exposure.level is colour", ["green", "yellow", "red"].includes(ins.body?.exposure?.level));
  assert("exposure.findings non-empty", Array.isArray(ins.body?.exposure?.findings) && ins.body.exposure.findings.length > 0);

  // 2b. Direct connection (no XFF) → real IP exposed → higher risk
  const insDirect = await req("GET", "/api/veilnetx/inspect", null, {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Firefox/121.0",
  });
  assert("direct: proxyDetected false", insDirect.body?.proxyDetected === false);
  assert("direct: real-ip finding exposed", insDirect.body?.exposure?.findings?.find(f => f.id === "real-ip")?.exposed === true);

  // 3. OpenAPI documents /inspect
  console.log("\n3. OpenAPI");
  const oas = await req("GET", "/api/veilnetx/openapi.json");
  assert("GET /openapi.json → 200", oas.status === 200);
  assert("/inspect documented", Boolean(oas.body?.paths?.["/inspect"]));

  // 4. Waitlist validation + rate limit
  console.log("\n4. Waitlist");
  const bad = await req("POST", "/api/veilnetx/waitlist", { email: "not-an-email" });
  assert("invalid email → 400", bad.status === 400);

  let limited = false;
  for (let i = 0; i < 8; i++) {
    const r = await req("POST", "/api/veilnetx/waitlist", { email: `smoke+${i}@example.com` });
    if (r.status === 429) { limited = true; break; }
  }
  assert("rate limit kicks in (429 within 8 tries)", limited);

  // Summary
  console.log(`\nVeilNetX: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
