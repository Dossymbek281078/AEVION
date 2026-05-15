#!/usr/bin/env node
/**
 * AEVION fintech CLI — interactive wrapper around the 5 fintech modules.
 *
 * Modules: QGood (matching donations), QMaskCard (disposable cards),
 * VeilNetX Ledger (settlement chain), Z-Tide (ranking/streaks),
 * QChainGov (governance proposals).
 *
 * Read commands need no auth. Auth-gated commands lazy-login using
 * ADMIN_EMAIL + ADMIN_PASS env vars and cache the bearer token.
 * Mutations require an explicit --yes flag.
 *
 * Env:
 *   BASE           backend URL (default https://aevion-production-a70c.up.railway.app)
 *   ADMIN_EMAIL    only needed for `me`, `claim-streak`, or admin commands
 *   ADMIN_PASS     same
 *
 * Usage examples (PowerShell):
 *   node scripts/fintech-cli.mjs stats
 *   node scripts/fintech-cli.mjs leaderboard --limit=5
 *   $env:ADMIN_EMAIL="x@y.z"; $env:ADMIN_PASS="..."; node scripts/fintech-cli.mjs me
 *   node scripts/fintech-cli.mjs approve-campaign abc123 --yes
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

// ----- ANSI colour helpers -----------------------------------------------

const isTTY = !!process.stdout.isTTY;
const C = {
  reset:  isTTY ? "\x1b[0m"  : "",
  bold:   isTTY ? "\x1b[1m"  : "",
  dim:    isTTY ? "\x1b[2m"  : "",
  red:    isTTY ? "\x1b[31m" : "",
  green:  isTTY ? "\x1b[32m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  blue:   isTTY ? "\x1b[34m" : "",
  cyan:   isTTY ? "\x1b[36m" : "",
  gray:   isTTY ? "\x1b[90m" : "",
};
const ok    = (m) => console.log(`${C.green}  ✓${C.reset} ${m}`);
const fail  = (m) => console.log(`${C.red}  ✗${C.reset} ${m}`);
const warn  = (m) => console.log(`${C.yellow}  ~${C.reset} ${m}`);
const info  = (m) => console.log(`  ${m}`);
const head  = (m) => console.log(`\n${C.cyan}${C.bold}${m}${C.reset}\n`);
const sub   = (m) => console.log(`${C.gray}${m}${C.reset}`);

// ----- HTTP helpers ------------------------------------------------------

async function request(method, path, { body, token, timeoutMs = 15000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; }
    catch { json = { _raw: text }; }
    return { status: r.status, body: json };
  } catch (e) {
    if (e?.name === "AbortError") {
      return { status: 0, body: { error: "timeout" }, _network: "timeout" };
    }
    return { status: 0, body: { error: String(e?.message || e) }, _network: "error" };
  } finally {
    clearTimeout(t);
  }
}

const get  = (path, opts)        => request("GET",  path, opts);
const post = (path, body, opts)  => request("POST", path, { ...opts, body });

// ----- Auth (lazy + cached) ---------------------------------------------

let cachedToken = null;
let cachedEmail = null;

async function getToken() {
  if (cachedToken) return cachedToken;
  const email = process.env.ADMIN_EMAIL;
  const pass  = process.env.ADMIN_PASS;
  if (!email || !pass) {
    throw new CliError(
      "AUTH_MISSING",
      "Need ADMIN_EMAIL + ADMIN_PASS env vars set for this command.",
    );
  }
  const r = await post("/api/auth/login", { email, password: pass });
  if (r._network) {
    throw new CliError("NETWORK", `Couldn't reach BASE (${BASE}).`);
  }
  if (r.status !== 200 || !r.body?.token) {
    throw new CliError(
      "AUTH_FAIL",
      `Login failed (${r.status}): ${r.body?.error || JSON.stringify(r.body)}`,
    );
  }
  cachedToken = r.body.token;
  cachedEmail = email;
  return cachedToken;
}

class CliError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

// ----- Generic error reporter -------------------------------------------

function reportHttp(r, { context = "Request", notFoundHint = "not found" } = {}) {
  if (r._network === "timeout") {
    fail(`${context}: request timed out — Couldn't reach BASE (${BASE}).`);
    return true;
  }
  if (r._network === "error" || r.status === 0) {
    fail(`${context}: Couldn't reach BASE (${BASE}). ${r.body?.error || ""}`);
    return true;
  }
  if (r.status === 401) {
    fail("Need ADMIN_EMAIL + ADMIN_PASS env vars set.");
    return true;
  }
  if (r.status === 403) {
    fail("Account is not admin for this module.");
    return true;
  }
  if (r.status === 404) {
    fail(`${notFoundHint}.`);
    return true;
  }
  if (r.status >= 500) {
    console.log(`${C.red}${C.bold}  ✗ ${context}: server error ${r.status}${C.reset}`);
    if (r.body?.error) sub(`    ${r.body.error}`);
    return true;
  }
  if (r.status >= 400) {
    fail(`${context}: ${r.status} ${r.body?.error || JSON.stringify(r.body)}`);
    return true;
  }
  return false;
}

// ----- Arg parsing -------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

// ----- Pretty printing ---------------------------------------------------

function pad(s, w) {
  s = String(s ?? "");
  if (s.length >= w) return s.slice(0, w);
  return s + " ".repeat(w - s.length);
}
function padR(s, w) {
  s = String(s ?? "");
  if (s.length >= w) return s.slice(0, w);
  return " ".repeat(w - s.length) + s;
}
function shortId(id, n = 10) {
  if (!id) return "";
  const s = String(id);
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function fmtMoney(v) {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
function fmtDate(s) {
  if (!s) return "—";
  try { return new Date(s).toISOString().slice(0, 16).replace("T", " "); }
  catch { return String(s); }
}

function dumpKv(obj, indent = "    ") {
  if (!obj || typeof obj !== "object") {
    console.log(`${indent}${obj}`);
    return;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) { sub(`${indent}(empty)`); return; }
  const w = Math.min(28, Math.max(...keys.map(k => k.length)));
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      console.log(`${indent}${C.dim}${pad(k, w)}${C.reset}`);
      dumpKv(v, indent + "  ");
    } else if (Array.isArray(v)) {
      console.log(`${indent}${C.dim}${pad(k, w)}${C.reset} [${v.length} item${v.length === 1 ? "" : "s"}]`);
    } else {
      console.log(`${indent}${C.dim}${pad(k, w)}${C.reset} ${v}`);
    }
  }
}

// ----- Command: stats ----------------------------------------------------

const STATS_MODULES = [
  { id: "qgood",          path: "/api/qgood/stats",          label: "QGood" },
  { id: "qmaskcard",      path: "/api/qmaskcard/stats",      label: "QMaskCard" },
  { id: "veilnetx",       path: "/api/veilnetx-ledger/stats",label: "VeilNetX Ledger" },
  { id: "ztide",          path: "/api/ztide/stats",          label: "Z-Tide" },
  { id: "qchaingov",      path: "/api/qchaingov/stats",      label: "QChainGov" },
];

async function cmdStats() {
  head(`Stats across 5 fintech modules — ${BASE}`);
  const results = await Promise.all(STATS_MODULES.map(m => get(m.path)));
  for (let i = 0; i < STATS_MODULES.length; i++) {
    const m = STATS_MODULES[i];
    const r = results[i];
    console.log(`${C.cyan}${C.bold}[${m.label}]${C.reset}  ${C.gray}${m.path}${C.reset}`);
    if (r._network) {
      fail(`  Couldn't reach BASE (${BASE}).`);
      console.log("");
      continue;
    }
    if (r.status !== 200) {
      fail(`  ${r.status} ${r.body?.error || ""}`);
      console.log("");
      continue;
    }
    dumpKv(r.body, "    ");
    console.log("");
  }
}

// ----- Command: chain ----------------------------------------------------

async function cmdChain() {
  head(`VeilNetX Ledger — chain head + integrity verify`);

  const [hRes, vRes] = await Promise.all([
    get("/api/veilnetx-ledger/chain/head"),
    get("/api/veilnetx-ledger/chain/verify"),
  ]);

  console.log(`${C.cyan}Head${C.reset}`);
  if (reportHttp(hRes, { context: "Head" })) { /* already printed */ }
  else dumpKv(hRes.body, "    ");

  console.log(`\n${C.cyan}Verify${C.reset}`);
  if (reportHttp(vRes, { context: "Verify" })) { /* printed */ }
  else {
    const v = vRes.body;
    const ok2 = v?.ok === true || v?.valid === true || v?.verified === true;
    if (ok2) ok("Integrity verified");
    else warn("Integrity result unclear — see body below");
    dumpKv(v, "    ");
  }
}

// ----- Command: search ---------------------------------------------------

async function cmdSearch(prefix) {
  if (!prefix) {
    fail("Usage: search <hashPrefix>");
    return;
  }
  head(`Ledger search for hash starting with "${prefix}"`);
  const r = await get(`/api/veilnetx-ledger/search?hash=${encodeURIComponent(prefix)}`);
  if (reportHttp(r, { context: "Search", notFoundHint: `no entries for "${prefix}"` })) return;

  const items = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.entries) ? r.body.entries
              : Array.isArray(r.body?.results) ? r.body.results
              : [];
  if (items.length === 0) {
    warn(`No entries match "${prefix}".`);
    return;
  }
  ok(`${items.length} match${items.length === 1 ? "" : "es"}`);
  console.log("");
  console.log(`  ${C.dim}${pad("id", 12)}  ${pad("hash", 20)}  ${pad("amount", 14)}  ${pad("createdAt", 18)}${C.reset}`);
  for (const e of items.slice(0, 50)) {
    const id   = shortId(e.id || e._id, 12);
    const hash = shortId(e.contentHash || e.hash, 20);
    const amt  = fmtMoney(e.amount ?? e.value ?? e.amountUsd);
    const at   = fmtDate(e.createdAt || e.timestamp);
    info(`${pad(id, 12)}  ${pad(hash, 20)}  ${pad(amt, 14)}  ${pad(at, 18)}`);
  }
  if (items.length > 50) sub(`  …and ${items.length - 50} more`);
}

// ----- Command: leaderboard ---------------------------------------------

async function cmdLeaderboard(flags) {
  const limit = parseInt(flags.limit, 10) || 10;
  head(`Z-Tide leaderboard — top ${limit}`);
  const r = await get(`/api/ztide/leaderboard?limit=${limit}`);
  if (reportHttp(r, { context: "Leaderboard" })) return;

  const items = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.entries) ? r.body.entries
              : Array.isArray(r.body?.leaderboard) ? r.body.leaderboard
              : [];
  if (items.length === 0) { warn("Leaderboard is empty."); return; }

  console.log(`  ${C.dim}${pad("#", 4)} ${pad("userId", 16)}  ${pad("name", 22)}  ${padR("score", 10)}  ${padR("streak", 8)}${C.reset}`);
  let i = 1;
  for (const e of items) {
    const rank  = e.rank ?? i;
    const uid   = shortId(e.userId || e.id, 16);
    const name  = e.name || e.displayName || e.email || "—";
    const score = e.score ?? e.points ?? e.aev ?? 0;
    const streak = e.streak ?? e.streakDays ?? e.loginStreak ?? "—";
    info(`${pad(String(rank), 4)} ${pad(uid, 16)}  ${pad(name, 22)}  ${padR(fmtMoney(score), 10)}  ${padR(streak, 8)}`);
    i++;
  }
}

// ----- Command: proposals -----------------------------------------------

async function cmdProposals(flags) {
  const status = flags.status;
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  head(`QChainGov proposals${status ? ` (status=${status})` : ""}`);
  const r = await get(`/api/qchaingov/proposals${qs}`);
  if (reportHttp(r, { context: "Proposals" })) return;

  const items = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.proposals) ? r.body.proposals
              : [];
  if (items.length === 0) { warn("No proposals."); return; }

  console.log(`  ${C.dim}${pad("id", 12)}  ${pad("status", 10)}  ${pad("category", 12)}  ${pad("title", 50)}${C.reset}`);
  for (const p of items) {
    info(`${pad(shortId(p.id, 12), 12)}  ${pad(p.status || "—", 10)}  ${pad(p.category || "—", 12)}  ${pad(p.title || "—", 50)}`);
  }
}

async function cmdProposal(id) {
  if (!id) { fail("Usage: proposal <id>"); return; }
  head(`Proposal ${shortId(id, 16)}`);
  const r = await get(`/api/qchaingov/proposals/${encodeURIComponent(id)}`);
  if (reportHttp(r, { context: "Proposal", notFoundHint: `proposal ${shortId(id, 12)} not found` })) return;
  const p = r.body?.proposal || r.body;
  dumpKv(p, "    ");

  if (p?.tally || r.body?.tally) {
    console.log(`\n${C.cyan}Tally${C.reset}`);
    dumpKv(p?.tally || r.body?.tally, "    ");
  }
}

// ----- Command: campaigns ------------------------------------------------

async function cmdCampaigns(flags) {
  const cat = flags.category;
  const qs = cat ? `?category=${encodeURIComponent(cat)}` : "";
  head(`QGood campaigns${cat ? ` (category=${cat})` : ""}`);
  const r = await get(`/api/qgood/campaigns${qs}`);
  if (reportHttp(r, { context: "Campaigns" })) return;

  const items = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.campaigns) ? r.body.campaigns
              : [];
  if (items.length === 0) { warn("No campaigns."); return; }

  console.log(`  ${C.dim}${pad("id", 12)}  ${pad("status", 10)}  ${pad("category", 12)}  ${padR("raised", 12)}  ${pad("title", 40)}${C.reset}`);
  for (const c of items) {
    const raised = c.raised ?? c.amountRaised ?? c.totalRaised ?? 0;
    info(`${pad(shortId(c.id, 12), 12)}  ${pad(c.status || "—", 10)}  ${pad(c.category || "—", 12)}  ${padR(fmtMoney(raised), 12)}  ${pad(c.title || "—", 40)}`);
  }
}

async function cmdPools() {
  head(`QGood matching pools`);
  const r = await get(`/api/qgood/matching-pools`);
  if (reportHttp(r, { context: "Pools" })) return;
  const items = Array.isArray(r.body) ? r.body
              : Array.isArray(r.body?.pools) ? r.body.pools
              : [];
  if (items.length === 0) { warn("No matching pools."); return; }

  console.log(`  ${C.dim}${pad("id", 12)}  ${pad("status", 10)}  ${padR("size", 12)}  ${padR("used", 12)}  ${pad("name", 40)}${C.reset}`);
  for (const p of items) {
    info(`${pad(shortId(p.id, 12), 12)}  ${pad(p.status || "—", 10)}  ${padR(fmtMoney(p.size ?? p.budget ?? p.totalSize ?? 0), 12)}  ${padR(fmtMoney(p.used ?? p.consumed ?? 0), 12)}  ${pad(p.name || p.title || "—", 40)}`);
  }
}

// ----- Command: rank -----------------------------------------------------

async function cmdRank(userId) {
  if (!userId) { fail("Usage: rank <userId>"); return; }
  head(`Z-Tide rank for ${shortId(userId, 16)}`);
  const r = await get(`/api/ztide/rank/${encodeURIComponent(userId)}`);
  if (reportHttp(r, { context: "Rank", notFoundHint: `user ${shortId(userId, 12)} not ranked` })) return;
  dumpKv(r.body?.rank || r.body, "    ");
}

// ----- Command: me -------------------------------------------------------

async function cmdMe() {
  head(`Z-Tide /me`);
  const token = await getToken();
  const r = await get(`/api/ztide/me`, { token });
  if (reportHttp(r, { context: "Me" })) return;
  sub(`  account: ${cachedEmail}`);
  console.log("");
  dumpKv(r.body, "    ");
}

async function cmdClaimStreak() {
  head(`Claim Z-Tide login streak`);
  const token = await getToken();
  const r = await post(`/api/ztide/me/login-streak`, undefined, { token });
  if (reportHttp(r, { context: "Claim streak" })) return;
  ok("Streak claim accepted");
  dumpKv(r.body, "    ");
}

// ----- Admin mutations ---------------------------------------------------

function requireYes(flags, action) {
  if (!flags.yes) {
    warn(`Refusing — pass --yes to confirm ${action}`);
    return false;
  }
  return true;
}

async function adminPost(path, label) {
  const token = await getToken();
  const r = await post(path, undefined, { token });
  if (reportHttp(r, { context: label, notFoundHint: `${label} target not found` })) return false;
  ok(`${label} done`);
  if (r.body && Object.keys(r.body).length) dumpKv(r.body, "    ");
  return true;
}

async function cmdApproveCampaign(id, flags) {
  if (!id) { fail("Usage: approve-campaign <id> --yes"); return; }
  if (!requireYes(flags, `approving campaign ${shortId(id, 12)}`)) return;
  head(`Approve campaign ${shortId(id, 16)}`);
  await adminPost(`/api/qgood/campaigns/${encodeURIComponent(id)}/approve`, "Approve");
}

async function cmdProposalTransition(action, id, flags) {
  if (!id) { fail(`Usage: ${action}-proposal <id> --yes`); return; }
  if (!requireYes(flags, `${action} proposal ${shortId(id, 12)}`)) return;
  head(`${action[0].toUpperCase()}${action.slice(1)} proposal ${shortId(id, 16)}`);
  await adminPost(`/api/qchaingov/proposals/${encodeURIComponent(id)}/${action}`, action);
}

async function cmdPoolTransition(action, id, flags) {
  if (!id) { fail(`Usage: ${action}-pool <id> --yes`); return; }
  if (!requireYes(flags, `${action} pool ${shortId(id, 12)}`)) return;
  head(`${action[0].toUpperCase()}${action.slice(1)} matching pool ${shortId(id, 16)}`);
  await adminPost(`/api/qgood/matching-pools/${encodeURIComponent(id)}/${action}`, action);
}

// ----- Help --------------------------------------------------------------

function printHelp() {
  console.log(`
${C.cyan}${C.bold}AEVION fintech CLI${C.reset}  ${C.dim}— wraps 5 fintech module APIs${C.reset}
${C.dim}BASE = ${BASE}${C.reset}

${C.bold}Read-only (no auth)${C.reset}
  ${C.green}stats${C.reset}                              All 5 module /stats endpoints
  ${C.green}chain${C.reset}                              VeilNetX head + integrity verify
  ${C.green}search${C.reset} <hashPrefix>                Search ledger by hash prefix
  ${C.green}leaderboard${C.reset} [--limit=10]           Z-Tide leaderboard
  ${C.green}proposals${C.reset} [--status=open]          QChainGov proposals list
  ${C.green}proposal${C.reset} <id>                      Single proposal + tally
  ${C.green}campaigns${C.reset} [--category=health]      QGood campaigns list
  ${C.green}pools${C.reset}                              QGood matching pools
  ${C.green}rank${C.reset} <userId>                      Z-Tide rank lookup

${C.bold}Auth required (ADMIN_EMAIL + ADMIN_PASS)${C.reset}
  ${C.yellow}me${C.reset}                                 Z-Tide /me for logged-in user
  ${C.yellow}claim-streak${C.reset}                       POST /api/ztide/me/login-streak

${C.bold}Admin (still ADMIN_EMAIL + ADMIN_PASS, all need --yes)${C.reset}
  ${C.red}approve-campaign${C.reset} <id> --yes          QGood campaign approve
  ${C.red}open-proposal${C.reset} <id> --yes             QChainGov open
  ${C.red}close-proposal${C.reset} <id> --yes            QChainGov close
  ${C.red}execute-proposal${C.reset} <id> --yes          QChainGov execute
  ${C.red}pause-pool${C.reset} <id> --yes                QGood pool pause
  ${C.red}resume-pool${C.reset} <id> --yes               QGood pool resume

  ${C.green}help${C.reset}, ${C.green}--help${C.reset}                        This screen

${C.bold}Env${C.reset}
  BASE          backend URL (default Railway prod)
  ADMIN_EMAIL   used only by auth-gated commands
  ADMIN_PASS    same
`);
}

// ----- Dispatch ----------------------------------------------------------

async function main() {
  const raw = process.argv.slice(2);
  if (raw.length === 0) { printHelp(); return; }

  const { positional, flags } = parseArgs(raw);
  const cmd = (positional.shift() || "").toLowerCase();

  if (flags.help || cmd === "help" || cmd === "--help") {
    printHelp(); return;
  }

  switch (cmd) {
    case "stats":            await cmdStats(); break;
    case "chain":            await cmdChain(); break;
    case "search":           await cmdSearch(positional[0]); break;
    case "leaderboard":      await cmdLeaderboard(flags); break;
    case "proposals":        await cmdProposals(flags); break;
    case "proposal":         await cmdProposal(positional[0]); break;
    case "campaigns":        await cmdCampaigns(flags); break;
    case "pools":            await cmdPools(); break;
    case "rank":             await cmdRank(positional[0]); break;

    case "me":               await cmdMe(); break;
    case "claim-streak":     await cmdClaimStreak(); break;

    case "approve-campaign": await cmdApproveCampaign(positional[0], flags); break;
    case "open-proposal":    await cmdProposalTransition("open",    positional[0], flags); break;
    case "close-proposal":   await cmdProposalTransition("close",   positional[0], flags); break;
    case "execute-proposal": await cmdProposalTransition("execute", positional[0], flags); break;
    case "pause-pool":       await cmdPoolTransition("pause",  positional[0], flags); break;
    case "resume-pool":      await cmdPoolTransition("resume", positional[0], flags); break;

    default:
      fail(`Unknown command: ${cmd}`);
      sub("  Run `node scripts/fintech-cli.mjs help` for usage.");
      process.exit(1);
  }
}

main().catch((e) => {
  if (e instanceof CliError) {
    if (e.code === "AUTH_MISSING") fail(e.message);
    else if (e.code === "NETWORK") fail(e.message);
    else if (e.code === "AUTH_FAIL") fail(e.message);
    else fail(e.message);
    process.exit(2);
  }
  console.error(`${C.red}crash:${C.reset}`, e);
  process.exit(2);
});
