#!/usr/bin/env node
/**
 * Planning Waitlist smoke — verifies POST /api/{module}/waitlist on prod
 * for every factory-registered AEVION planning module + the two pre-launch
 * modules that ship their own dedicated routers (veilnetx, qfusionai).
 *
 * Usage:
 *   node aevion-globus-backend/scripts/planning-waitlist-smoke.js
 *   BASE=https://api.aevion.app node aevion-globus-backend/scripts/planning-waitlist-smoke.js
 *
 * Exit 0 if every module returned 200 or 201, non-zero otherwise.
 *
 * Unique emails per run (timestamp-suffixed) so each request is a fresh signup,
 * which would trigger the confirmation email path if SMTP is configured server-
 * side. The smoke does NOT verify that email actually arrived.
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://api.aevion.app").replace(/\/+$/, "");

// Order matches the user's task spec — keeps the table readable.
const MODULES = [
  "veilnetx",
  "qfusionai",
  "voice-of-earth",
  "kids-ai-content",
  "startup-exchange",
  "shadownet",
  "deepsan",
  "qpersona",
  "qlife",
  "psyapp-deps",
  "mapreality",
  "z-tide",
  "lifebox",
];

const RUN_TS = Date.now();

function emailFor(moduleId) {
  return `smoke-test+${moduleId}-${RUN_TS}@aevion.app`;
}

async function postWaitlist(moduleId) {
  const url = `${BASE}/api/${moduleId}/waitlist`;
  const email = emailFor(moduleId);
  const started = Date.now();
  let status = 0;
  let body = null;
  let error = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ email }),
    });
    status = res.status;
    try {
      body = await res.json();
    } catch {
      try {
        body = { _raw: (await res.text()).slice(0, 200) };
      } catch {
        body = null;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const latencyMs = Date.now() - started;
  return { moduleId, email, status, body, error, latencyMs };
}

function summariseBody(body) {
  if (body == null) return "—";
  const ok = body.ok;
  const already = body.alreadyJoined;
  const err = body.error;
  if (err) return `error=${err}`;
  if (ok === true) {
    const wc = typeof body.waitlistCount === "number" ? ` count=${body.waitlistCount}` : "";
    return `ok=true${already ? " alreadyJoined" : " created"}${wc}`;
  }
  if (body._raw) return `raw=${body._raw}`;
  try {
    return JSON.stringify(body).slice(0, 80);
  } catch {
    return "—";
  }
}

function pad(s, n) {
  s = String(s);
  if (s.length >= n) return s;
  return s + " ".repeat(n - s.length);
}

async function run() {
  console.log(`\nPlanning Waitlist smoke → ${BASE}\n`);
  console.log(`Run id: ${RUN_TS} (unique email suffix)\n`);

  const results = [];
  for (const moduleId of MODULES) {
    const r = await postWaitlist(moduleId);
    results.push(r);
    const verdict = r.error
      ? "NETERR"
      : (r.status === 200 || r.status === 201) ? "PASS" : `FAIL(${r.status})`;
    console.log(`  ${pad(verdict, 10)} ${pad(moduleId, 18)} ${pad(r.status || "—", 5)} ${pad(r.latencyMs + "ms", 8)} ${summariseBody(r.body)}${r.error ? "  err=" + r.error : ""}`);
  }

  console.log("\n── Summary table ──────────────────────────────────────────────");
  console.log(`${pad("module", 18)} ${pad("status", 7)} ${pad("ok?", 5)} ${pad("latency", 9)} body`);
  console.log("-".repeat(80));
  let pass = 0;
  let fail = 0;
  for (const r of results) {
    const okFlag = (r.status === 200 || r.status === 201) ? "yes" : "no";
    if (okFlag === "yes") pass++; else fail++;
    console.log(
      `${pad(r.moduleId, 18)} ${pad(r.status || "ERR", 7)} ${pad(okFlag, 5)} ${pad(r.latencyMs + "ms", 9)} ${summariseBody(r.body)}`,
    );
  }
  console.log("-".repeat(80));
  console.log(`${results.length} modules — ${pass} PASS  ${fail} FAIL\n`);

  // Highlight 500s specifically — usually SMTP / DB bootstrap.
  const fives = results.filter((r) => r.status >= 500 && r.status < 600);
  if (fives.length) {
    console.log("WARNING: 5xx responses (likely SMTP missing or table bootstrap issue):");
    for (const r of fives) console.log(`  - ${r.moduleId}: ${r.status} ${summariseBody(r.body)}`);
    console.log("");
  }

  const fourOhFours = results.filter((r) => r.status === 404);
  if (fourOhFours.length) {
    console.log("NOTE: 404 responses (module has no /waitlist on this build):");
    for (const r of fourOhFours) console.log(`  - ${r.moduleId}`);
    console.log("");
  }

  if (fail > 0) process.exit(1);
}

run().catch((e) => {
  console.error("crash:", e);
  process.exit(2);
});
