#!/usr/bin/env node
/**
 * Paywall coverage audit.
 *
 * For each module listed in src/data/projects.ts that has a frontend
 * surface, check whether the page makes raw fetch() calls into
 * /api/<module-prefix>/ without going through the paywall helpers
 * (apiFetchOrPaywall / fetchOrPaywall). Modules that fetch raw will
 * silently 402 with no UX once PAYWALL_MODULES is flipped on — this
 * script flags them BEFORE that happens.
 *
 * The audit is intentionally simple:
 *   - A module is "covered" if its top-level page.tsx (or main client
 *     component) imports PaywallScreen OR a paywall helper from
 *     @/lib/paywall, AND there is at least one usage of
 *     apiFetchOrPaywall|fetchOrPaywall in the module subtree.
 *   - A module is "raw-fetching" if its subtree calls fetch(apiUrl(...))
 *     or fetch("/api-backend/api/<module>...") without going through
 *     the helpers.
 *
 * This is a HEURISTIC, not a type system — it can miss helpers wrapped
 * by other indirections. Treat hits as a starting list, not gospel.
 *
 * Usage:
 *   node scripts/paywall-coverage-audit.js                     # summary
 *   node scripts/paywall-coverage-audit.js --json              # machine-readable
 *   node scripts/paywall-coverage-audit.js --modules qmedia,z-tide
 *
 * Exit codes: 0 = nothing to flag, 1 = at least one module has raw fetches.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND_APP = path.join(ROOT, "frontend", "src", "app");
const PROJECTS_TS = path.join(ROOT, "aevion-globus-backend", "src", "data", "projects.ts");

const wantJson = process.argv.includes("--json");
const filterArg = process.argv.findIndex((a) => a === "--modules");
const filterModules = filterArg >= 0
  ? (process.argv[filterArg + 1] || "").split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function readFile(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function extractProjectIds(src) {
  const start = src.indexOf("export const projects");
  if (start < 0) return [];
  const eq = src.indexOf("=", start);
  if (eq < 0) return [];
  const arrStart = src.indexOf("[", eq);
  if (arrStart < 0) return [];
  let depth = 0;
  let i = arrStart;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) break; }
  }
  const slice = src.slice(arrStart, i + 1);
  const ids = new Set();
  const re = /\bid:\s*"([a-z0-9_-]+)"/gi;
  let m;
  while ((m = re.exec(slice)) !== null) ids.add(m[1]);
  return [...ids].sort();
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.(tsx?|jsx?|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function auditModule(moduleId) {
  // The frontend dir name doesn't always match the backend id (e.g.
  // `aevion-ip-bureau` → `/bureau`, `qpaynet-embedded` → `/qpaynet`).
  // Build a list of likely dir candidates.
  const candidates = [moduleId];
  if (moduleId === "aevion-ip-bureau") candidates.push("bureau");
  if (moduleId === "qpaynet-embedded") candidates.push("qpaynet");
  if (moduleId === "qtradeoffline") candidates.push("qtrade");
  if (moduleId === "kids-ai-content") candidates.push("kids-ai", "kids-ai-content");
  if (moduleId === "psyapp-deps") candidates.push("psyapp", "psyapp-deps");

  let foundDir = null;
  for (const c of candidates) {
    const p = path.join(FRONTEND_APP, c);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) { foundDir = p; break; }
  }
  if (!foundDir) return { moduleId, status: "no-frontend", files: 0 };

  const files = walk(foundDir);
  if (files.length === 0) return { moduleId, status: "no-frontend", files: 0 };

  let usesPaywallHelper = false;
  let usesPaywallScreen = false;
  const rawFetchHits = [];

  // Backend API prefix to look for in fetch URLs. We match the module id
  // verbatim — modules whose backend route doesn't match their id pass
  // through (we'd flag false positives otherwise).
  const apiNeedle = `/api/${moduleId}`;
  // For dir-aliased modules check both the id and the dir name.
  const dirName = path.basename(foundDir);
  const apiNeedleAlt = dirName !== moduleId ? `/api/${dirName}` : null;

  for (const f of files) {
    const src = readFile(f);
    if (!src) continue;
    if (/from\s+["']@\/lib\/paywall["']/.test(src)) usesPaywallHelper = true;
    if (/from\s+["']@\/components\/PaywallScreen["']/.test(src)) usesPaywallScreen = true;

    // Raw fetch detection — fetch(...) that points at this module's API.
    // Looks for a fetch() call with a URL string literal containing the API needle.
    const re = /fetch\s*\(\s*[`"'][^`"']*?(\/api\/[a-z0-9_-]+)[^`"']*[`"']/gi;
    let m;
    while ((m = re.exec(src)) !== null) {
      const url = m[1];
      if (url.startsWith(apiNeedle) || (apiNeedleAlt && url.startsWith(apiNeedleAlt))) {
        // Find the line number for this match
        const lineNo = src.slice(0, m.index).split("\n").length;
        rawFetchHits.push({ file: path.relative(ROOT, f).replace(/\\/g, "/"), line: lineNo, url });
      }
    }
    // Also catch apiUrl("...") fetches
    const reApiUrl = /fetch\s*\(\s*apiUrl\s*\(\s*[`"']([^`"']+)[`"']\s*\)/gi;
    let m2;
    while ((m2 = reApiUrl.exec(src)) !== null) {
      const apiPath = m2[1];
      if (apiPath.startsWith(apiNeedle) || (apiNeedleAlt && apiPath.startsWith(apiNeedleAlt))) {
        const lineNo = src.slice(0, m2.index).split("\n").length;
        rawFetchHits.push({ file: path.relative(ROOT, f).replace(/\\/g, "/"), line: lineNo, url: apiPath });
      }
    }
  }

  // Coverage tiers after PR #439 added the global PaywallModal + window.fetch
  // interceptor:
  //   screen     — per-page <PaywallScreen> + apiFetchOrPaywall/fetchOrPaywall.
  //                Best UX (page swap, dedicated CTA, deep-link to /pricing).
  //   modal-only — module has API calls but no <PaywallScreen>; relies on the
  //                global PaywallModal overlay (acceptable — not a silent fail).
  //   no-api     — module has a frontend dir but no /api/<id>/* calls
  //                (static landing / informational page).
  const screen = usesPaywallHelper && usesPaywallScreen;
  const status = screen
    ? "screen"
    : rawFetchHits.length > 0
      ? "modal-only"
      : "no-api-calls";
  return {
    moduleId,
    dir: path.relative(ROOT, foundDir).replace(/\\/g, "/"),
    status,
    files: files.length,
    usesPaywallHelper,
    usesPaywallScreen,
    rawFetchCount: rawFetchHits.length,
    rawFetches: rawFetchHits.slice(0, 5), // cap output
  };
}

const projectsSrc = readFile(PROJECTS_TS);
if (!projectsSrc) {
  console.error("audit: projects.ts not found");
  process.exit(2);
}

let moduleIds = extractProjectIds(projectsSrc);
if (filterModules) moduleIds = moduleIds.filter((id) => filterModules.includes(id));

const results = moduleIds.map(auditModule);

const screen = results.filter((r) => r.status === "screen");
const modalOnly = results.filter((r) => r.status === "modal-only");
const noFrontend = results.filter((r) => r.status === "no-frontend");
const noApiCalls = results.filter((r) => r.status === "no-api-calls");

if (wantJson) {
  console.log(JSON.stringify({
    total: results.length,
    screen: screen.length,
    modalOnly: modalOnly.length,
    noFrontend: noFrontend.length,
    noApiCalls: noApiCalls.length,
    results,
  }, null, 2));
  // Advisory now: PR #439's global PaywallModal catches every 402, so
  // modal-only is acceptable. No exit-1 unless someone passes --strict.
  const strict = process.argv.includes("--strict");
  process.exit(strict && modalOnly.length > 0 ? 1 : 0);
}

console.log(`Paywall coverage audit — ${results.length} module(s) in projects.ts`);
console.log("");
console.log(`✓ screen     (per-page <PaywallScreen> — best UX):     ${screen.length}`);
console.log(`◉ modal-only (covered by global PaywallModal #439):    ${modalOnly.length}`);
console.log(`◌ no-api-calls (static landing page):                  ${noApiCalls.length}`);
console.log(`◌ no frontend dir found:                                ${noFrontend.length}`);
console.log("");

if (screen.length) {
  console.log("✓ Screen-wired (page swaps to <PaywallScreen> on 402):");
  for (const r of screen) console.log(`    ${r.moduleId.padEnd(24)} ${r.dir}`);
  console.log("");
}

if (modalOnly.length) {
  console.log("◉ Modal-only (acceptable — global <PaywallModal> overlays on 402):");
  console.log("  Upgrade candidates if you want a dedicated page swap instead of a modal:");
  for (const r of modalOnly) {
    console.log(`    ${r.moduleId.padEnd(24)} ${r.rawFetchCount} raw fetch(es)  ${r.dir}`);
  }
  console.log("");
  console.log("  To upgrade: replace fetch(apiUrl('/api/<module>/...'))");
  console.log("  with apiFetchOrPaywall('/api/<module>/...') + catch PaywallError → setPaywall(e.payload).");
  console.log("");
}

// Default: always green. Pass --strict in CI/PR review to fail when any
// module is still modal-only.
const strict = process.argv.includes("--strict");
process.exit(strict && modalOnly.length > 0 ? 1 : 0);
