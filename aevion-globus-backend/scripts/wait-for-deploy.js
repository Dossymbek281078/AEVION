#!/usr/bin/env node
/**
 * Wait-for-deploy — polls a target deployment until a chosen probe path
 * starts answering with the expected shape, then exits 0. Useful as a
 * step before running a smoke against prod after pushing — Railway takes
 * 30-180s to redeploy, and running the smoke too early gives misleading
 * fails for endpoints that don't exist yet.
 *
 * Default probe: `GET /api/health` — must return `{"status":"ok"}`. With
 * `--probe-path`/`--probe-key` you can target a fresh endpoint shape
 * (e.g. the `noun` field on `/api/<id>/<noun>` which only exists after
 * the mvpConcepts mount lands).
 *
 * Exit codes:
 *   0  — deploy ready (probe passed within timeout)
 *   1  — timed out
 *   2  — bad invocation
 *
 * Usage:
 *   node scripts/wait-for-deploy.js \
 *     --base https://aevion-production-a70c.up.railway.app
 *
 *   # Wait until the new mvpConcepts mount is live (noun field appears):
 *   node scripts/wait-for-deploy.js \
 *     --base https://aevion-production-a70c.up.railway.app \
 *     --probe-path /api/startup-exchange/listings?limit=1 \
 *     --probe-key noun \
 *     --probe-value listings
 */

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  if (i === -1) return dflt;
  return process.argv[i + 1];
}

const BASE = (arg("--base", process.env.BASE) || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const PROBE_PATH = arg("--probe-path", "/api/health");
const PROBE_KEY = arg("--probe-key", "status");
const PROBE_VALUE = arg("--probe-value", "ok");
const TIMEOUT_S = Number(arg("--timeout", "180"));
const INTERVAL_S = Number(arg("--interval", "5"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  try {
    const r = await fetch(`${BASE}${PROBE_PATH}`, { headers: { "Accept": "application/json" } });
    if (r.status !== 200) return { ok: false, reason: `status=${r.status}` };
    const body = await r.json().catch(() => ({}));
    const actual = body && typeof body === "object" ? body[PROBE_KEY] : undefined;
    if (String(actual) === String(PROBE_VALUE)) return { ok: true, actual };
    return { ok: false, reason: `key ${PROBE_KEY}=${JSON.stringify(actual)} expected=${PROBE_VALUE}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  if (!BASE) {
    console.error("--base or BASE env is required");
    process.exit(2);
  }
  console.log(`Wait-for-deploy → ${BASE}`);
  console.log(`  probe: GET ${PROBE_PATH}`);
  console.log(`  expecting: ${PROBE_KEY}=${PROBE_VALUE}`);
  console.log(`  timeout: ${TIMEOUT_S}s, interval: ${INTERVAL_S}s\n`);

  const deadline = Date.now() + TIMEOUT_S * 1000;
  let attempts = 0;
  let lastReason = "";
  while (Date.now() < deadline) {
    attempts++;
    const r = await probe();
    if (r.ok) {
      console.log(`✓ Ready after ${attempts} attempt(s). actual=${JSON.stringify(r.actual)}`);
      process.exit(0);
    }
    lastReason = r.reason;
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    process.stdout.write(`\r  attempt ${attempts}: ${lastReason.slice(0, 60).padEnd(60)} (${remaining}s left)`);
    if (Date.now() + INTERVAL_S * 1000 >= deadline) break;
    await sleep(INTERVAL_S * 1000);
  }
  console.log(`\n✗ Timed out after ${TIMEOUT_S}s and ${attempts} attempt(s). Last: ${lastReason}`);
  process.exit(1);
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
