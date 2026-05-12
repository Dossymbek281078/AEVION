#!/usr/bin/env node
/**
 * fintech-all-smoke.js — consolidated smoke test for all 6 AEVION fintech modules.
 * Usage: BASE=https://api.aevion.app node scripts/fintech-all-smoke.js
 */

const BASE = process.env.BASE || "https://aevion-production-a70c.up.railway.app";
let pass = 0, fail = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    if (result) { console.log(`  ✓  ${label}`); pass++; }
    else { console.log(`  ✗  ${label} — returned falsy`); fail++; }
  } catch (e) {
    console.log(`  ✗  ${label} — ${e.message}`);
    fail++;
  }
}

async function get(path, expect = 200) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(6000) });
  if (r.status !== expect) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

(async () => {
  console.log(`\nFintech All-Modules Smoke  →  ${BASE}\n`);

  // QPayNet
  console.log("QPayNet:");
  await check("GET /api/qpaynet/health",     async () => { const d = await get("/api/qpaynet/health"); return d.status === "ok"; });
  await check("GET /api/qpaynet/stats",      async () => { const d = await get("/api/qpaynet/stats"); return typeof d.activeWallets === "number"; });

  // VeilNetX
  console.log("\nVeilNetX:");
  await check("GET /api/veilnetx/health",    async () => { const d = await get("/api/veilnetx/health"); return d.status === "ok" || d.online; });
  await check("GET /api/veilnetx/chain/head",async () => { const d = await get("/api/veilnetx/chain/head"); return d !== null; });

  // QMaskCard
  console.log("\nQMaskCard:");
  await check("GET /api/qmaskcard/health",   async () => { const d = await get("/api/qmaskcard/health"); return d.status === "ok" || d.online; });
  await check("GET /api/qmaskcard/stats",    async () => { const d = await get("/api/qmaskcard/stats"); return d !== null; });

  // QGood
  console.log("\nQGood:");
  await check("GET /api/qgood/health",       async () => { const d = await get("/api/qgood/health"); return d.status === "ok" || d.online; });
  await check("GET /api/qgood/stats",        async () => { const d = await get("/api/qgood/stats"); return d !== null; });

  // Z-Tide
  console.log("\nZ-Tide:");
  await check("GET /api/ztide/health",       async () => { const d = await get("/api/ztide/health"); return d.status === "ok" || d.online; });
  await check("GET /api/ztide/stats",        async () => { const d = await get("/api/ztide/stats"); return d !== null; });

  // QChainGov
  console.log("\nQChainGov:");
  await check("GET /api/qchaingov/health",   async () => { const d = await get("/api/qchaingov/health"); return d.status === "ok" || d.online; });
  await check("GET /api/qchaingov/stats",    async () => { const d = await get("/api/qchaingov/stats"); return d !== null; });

  // API Quotas
  console.log("\nAPI Quotas:");
  await check("GET /api/quotas",             async () => { const d = await get("/api/quotas"); return Array.isArray(d.tiers); });

  console.log(`\n${pass + fail} checks — ${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
