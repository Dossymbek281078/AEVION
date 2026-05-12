#!/usr/bin/env node
/**
 * AEVION ownerless-MVP frontend smoke — verifies the 10 module landings
 * shipped 2026-05-12 actually render in production with their key content.
 *
 * Usage:
 *   node aevion-globus-backend/scripts/ownerless-mvp-smoke.js
 *   FRONT=https://aevion.app node ./aevion-globus-backend/scripts/ownerless-mvp-smoke.js
 *
 * Read-only — safe in any environment including prod.
 * Exits 0 on full PASS, 1 on any failure.
 */

const FRONT = (process.env.FRONT || "https://aevion.app").replace(/\/+$/, "");

const MVPS = [
  { id: "qpersona", contains: ["QPersona", "doppelganger", "Style"] },
  { id: "qlife", contains: ["QLife", "Personal", "OS"] },
  { id: "voice-of-earth", contains: ["Voice of Earth", "language", "royalty"] },
  { id: "kids-ai-content", contains: ["Kids AI", "safe", "AI"] },
  { id: "startup-exchange", contains: ["Startup", "Pitch", "QRight"] },
  { id: "shadownet", contains: ["ShadowNet", "metadata", "mesh"] },
  { id: "deepsan", contains: ["DeepSan", "Inbox", "Focus"] },
  { id: "psyapp-deps", contains: ["PsyApp", "trigger", "anonymous"] },
  { id: "mapreality", contains: ["MapReality", "signals", "QSign"] },
  { id: "lifebox", contains: ["LifeBox", "Shamir"] },
];

let pass = 0;
let fail = 0;

async function checkOne({ id, contains }) {
  const url = `${FRONT}/${id}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { Accept: "text/html" } });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(`  ❌ /${id.padEnd(20)} (${ms}ms) HTTP ${r.status}`);
      fail++;
      return;
    }
    const html = await r.text();
    const missing = contains.filter((kw) => !html.toLowerCase().includes(kw.toLowerCase()));
    if (missing.length > 0) {
      console.log(`  ⚠️  /${id.padEnd(20)} (${ms}ms) missing: [${missing.join(", ")}]`);
      fail++;
      return;
    }
    console.log(`  ✅ /${id.padEnd(20)} (${ms}ms) ${html.length}B`);
    pass++;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ❌ /${id.padEnd(20)} (${ms}ms) ${e.message}`);
    fail++;
  }
}

(async () => {
  console.log(`[ownerless-mvp-smoke] Target: ${FRONT}`);
  console.log("");
  for (const mvp of MVPS) await checkOne(mvp);
  console.log("");
  console.log(`[ownerless-mvp-smoke] PASS=${pass}/${MVPS.length} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[ownerless-mvp-smoke] FATAL:", e?.stack || e);
  process.exit(2);
});
