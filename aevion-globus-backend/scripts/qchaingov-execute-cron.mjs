#!/usr/bin/env node
/**
 * QChainGov execution cron — auto-closes past-deadline proposals and
 * runs the tally on all closed ones.
 *
 * Two phases per run:
 *   1. Auto-close: any `open` proposal where `votesCloseAt < now` → POST /close
 *   2. Auto-execute: every `closed` proposal → POST /execute (tally pass/reject)
 *
 * Designed to run daily as cron (Railway cron OR external scheduler):
 *   ADMIN_EMAIL=... ADMIN_PASS=... node scripts/qchaingov-execute-cron.mjs
 *
 * Idempotent — re-running on already-executed proposals is a no-op (the
 * /execute endpoint returns 400 for non-closed status).
 */

const BASE  = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;

if (!EMAIL || !PASS) {
  console.error("❌  Set ADMIN_EMAIL and ADMIN_PASS env vars before running.");
  console.error("    Usage: ADMIN_EMAIL=you@example.com ADMIN_PASS=<pass> node scripts/qchaingov-execute-cron.mjs");
  process.exit(1);
}

async function post(path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, body: json };
}

async function get(path, token) {
  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method: "GET", headers: h });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, body: json };
}

function shortId(id) {
  const s = String(id || "");
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

function pickProposals(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.proposals)) return body.proposals;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function titleOf(p) {
  return p?.title || p?.summary || p?.id || "(untitled)";
}

function fmtTotals(p, body) {
  const out = body?.result || body?.tally || body || {};
  const winning = out.winningChoice || out.winner || p?.winningChoice;
  const winPct = out.winningPercent ?? out.winnerPercent ?? out.topPercent;
  const threshold = out.passThreshold ?? p?.passThreshold;
  if (winning && (winPct !== undefined)) {
    const thr = threshold !== undefined ? ` / ${threshold}%` : "";
    return `winningChoice=${winning} (${winPct}%${thr})`;
  }
  if (winning) return `winningChoice=${winning}`;
  if (winPct !== undefined && threshold !== undefined) {
    return `${winPct}% < ${threshold}% threshold`;
  }
  return "";
}

async function run() {
  console.log(`\nQChainGov execution cron → ${BASE}\n`);

  // 1. Login
  const login = await post("/api/auth/login", { email: EMAIL, password: PASS });
  if (login.status !== 200 || !login.body?.token) {
    console.error("❌  Login failed:", login.status, JSON.stringify(login.body));
    process.exit(1);
  }
  const token = login.body.token;
  console.log(`  ✓ Logged in as ${EMAIL}`);

  let tallied  = 0;
  let executed = 0;
  let rejected = 0;
  let skipped  = 0;
  let failed   = 0;
  let hadServerError = false;

  // ─── Phase 1: auto-close any open proposal past its deadline ───
  console.log(`  ─ Phase 1: auto-close past-deadline proposals`);
  const openList = await get(`/api/qchaingov/proposals?status=open&limit=100`, token);
  if (openList.status !== 200) {
    console.error(`    ✗ Listing open proposals failed: ${openList.status}`, JSON.stringify(openList.body));
    if (openList.status >= 500) hadServerError = true;
  }
  const openProposals = pickProposals(openList.body);
  const now = Date.now();
  const pastDeadline = openProposals.filter(p => {
    const close = p?.votesCloseAt ? new Date(p.votesCloseAt).getTime() : NaN;
    return Number.isFinite(close) && close < now;
  });

  if (pastDeadline.length === 0) {
    console.log(`    ~ No open proposals past deadline`);
  } else {
    for (const p of pastDeadline) {
      const r = await post(`/api/qchaingov/proposals/${p.id}/close`, undefined, token);
      const label = `${titleOf(p)} (${shortId(p.id)})`;
      if (r.status === 200 && (r.body?.ok || r.body?.proposal || r.body?.status === "closed")) {
        console.log(`    ✓ Closed ${label}`);
      } else if (r.status === 400) {
        console.log(`    ~ Skipped close ${label}: ${r.body?.error || "already closed"}`);
      } else if (r.status === 403) {
        console.error(`    ✗ Close ${label}: 403 forbidden — add ${EMAIL} to QCHAINGOV_ADMIN_EMAILS on Railway.`);
        failed++;
      } else if (r.status === 404) {
        console.error(`    ✗ Close ${label}: 404 not found`);
        failed++;
      } else {
        console.error(`    ✗ Close ${label}: ${r.status}`, JSON.stringify(r.body));
        failed++;
        if (r.status >= 500) hadServerError = true;
      }
    }
  }

  // ─── Phase 2: execute every closed proposal ───
  console.log(`  ─ Phase 2: execute closed proposals`);
  const closedList = await get(`/api/qchaingov/proposals?status=closed&limit=100`, token);
  if (closedList.status !== 200) {
    console.error(`    ✗ Listing closed proposals failed: ${closedList.status}`, JSON.stringify(closedList.body));
    if (closedList.status >= 500) hadServerError = true;
  }
  const closedProposals = pickProposals(closedList.body);

  if (closedProposals.length === 0) {
    console.log(`    ~ No closed proposals to tally`);
  } else {
    for (const p of closedProposals) {
      const r = await post(`/api/qchaingov/proposals/${p.id}/execute`, undefined, token);
      const label = `${titleOf(p)} (${shortId(p.id)})`;
      const totals = fmtTotals(p, r.body);

      if (r.status === 200) {
        tallied++;
        const finalStatus = r.body?.status || r.body?.proposal?.status || r.body?.result?.status;
        const passed = finalStatus === "executed" || r.body?.passed === true || r.body?.result?.passed === true;
        const wasRejected = finalStatus === "rejected" || r.body?.passed === false || r.body?.result?.passed === false;
        if (passed) {
          executed++;
          console.log(`    ✓ ${label}  →  executed  ${totals}`);
        } else if (wasRejected) {
          rejected++;
          console.log(`    ✓ ${label}  →  rejected  ${totals}`);
        } else {
          // 200 but unclear status — count as tallied/skipped
          skipped++;
          console.log(`    ~ ${label}  →  tallied   ${totals || "(no winner)"}`);
        }
      } else if (r.status === 400) {
        skipped++;
        const why = r.body?.error || r.body?.message || "voting still open or quorum not met";
        console.log(`    ~ ${label}  →  skipped   ${why}`);
      } else if (r.status === 403) {
        console.error(`    ✗ ${label}: 403 forbidden — add ${EMAIL} to QCHAINGOV_ADMIN_EMAILS on Railway.`);
        failed++;
      } else if (r.status === 404) {
        console.error(`    ✗ ${label}: 404 not found`);
        failed++;
      } else {
        console.error(`    ✗ ${label}: ${r.status}`, JSON.stringify(r.body));
        failed++;
        if (r.status >= 500) hadServerError = true;
      }
    }
  }

  console.log(`\n  Summary: Tallied ${tallied} · Executed ${executed} · Rejected ${rejected} · Skipped ${skipped} · Failed ${failed}\n`);

  process.exit(hadServerError ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
