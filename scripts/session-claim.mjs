#!/usr/bin/env node
// AEVION session-isolation guard.
//
// Answers one question before you start editing a module: "is any OTHER
// worktree / session already working this module?" If yes, you risk the exact
// collision that costs hours (two sessions, one file, git conflicts) — pick a
// free module instead.
//
// It needs NO shared state file: worktrees share one .git, so branch names and
// each worktree's dirty files are already visible cross-session. We infer a
// claim from (a) another worktree's branch name mentioning the module, or
// (b) another worktree having uncommitted changes under the module's paths.
//
// Usage:
//   node scripts/session-claim.mjs <module-id>   # check one module
//   node scripts/session-claim.mjs --map         # print module -> paths map
//   node scripts/session-claim.mjs               # summarize every worktree's zone
//
// Exit code: 0 = free (or informational), 1 = claimed by another worktree.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Module id → source zones. Most modules are app/<id> + routes/<id>.ts;
//    the exceptions below are where the folder/file name diverges from the id.
const ALIAS = {
  qbuild: { app: "build", routes: ["build", "build.ts"] },
  "qpaynet-embedded": { app: "qpaynet", routes: ["qpaynet.ts"] },
  "aevion-ip-bureau": { app: "bureau", routes: ["bureau.ts"] },
  "z-tide": { app: null, routes: ["ztide.ts"] },
  "multichat-engine": { app: "multichat-engine", routes: ["multichat.ts"] },
  "kids-ai-content": { app: "kids-ai-content", routes: ["kidsAiContent.ts"] },
  "psyapp-deps": { app: "psyapp-deps", routes: ["psyappDeps.ts"] },
  "voice-of-earth": { app: null, routes: ["voiceOfEarth.ts"] },
  "startup-exchange": { app: null, routes: ["startupExchange.ts"] },
  qtradeoffline: { app: "qtradeoffline", routes: ["qtradeoffline.ts", "qtrade.ts"] },
  globus: { app: null, routes: [] }, // core surface, handled by index/data
  constitution: { app: "constitution", routes: ["constitution", "constitution.ts", "planetConstitution.ts"] },
};

function zonesFor(id) {
  const a = ALIAS[id] || {};
  const appDir = a.app === null ? null : `frontend/src/app/${a.app || id}`;
  const routeNames = a.routes || [`${id}`, `${id}.ts`];
  const routes = routeNames.map((r) => `aevion-globus-backend/src/routes/${r}`);
  return { appDir, routes };
}

function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// Repo root = the current worktree's toplevel.
const ROOT = sh("git rev-parse --show-toplevel", process.cwd());
if (!ROOT) {
  console.error("Not inside a git repo.");
  process.exit(2);
}

// Parse `git worktree list --porcelain` → [{ path, branch }]
function worktrees() {
  const out = sh("git worktree list --porcelain", ROOT);
  const list = [];
  let cur = {};
  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace("refs/heads/", "");
    else if (line === "") { if (cur.path) list.push(cur); cur = {}; }
  }
  if (cur.path) list.push(cur);
  return list;
}

// Files a worktree has touched (uncommitted) under the given zone prefixes.
function dirtyInZone(wtPath, prefixes) {
  const status = sh("git status --porcelain", wtPath);
  if (!status) return [];
  const files = status.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  return files.filter((f) => prefixes.some((p) => p && f.startsWith(p)));
}

const arg = process.argv[2];

if (arg === "--map") {
  const ids = process.argv.slice(3);
  const show = ids.length ? ids : Object.keys(ALIAS);
  for (const id of show) console.log(id, "→", JSON.stringify(zonesFor(id)));
  process.exit(0);
}

const wts = worktrees();
const self = resolve(ROOT);

if (!arg) {
  // Summary mode: what zone is each worktree dirty in?
  console.log("AEVION worktrees and their current activity:\n");
  for (const wt of wts) {
    const dirty = sh("git status --porcelain", wt.path).split("\n").filter(Boolean).length;
    const mark = resolve(wt.path) === self ? " (this session)" : "";
    console.log(`  ${wt.branch || "(detached)"}  [${dirty} dirty]  ${wt.path}${mark}`);
  }
  console.log("\nRule: 1 module = 1 worktree = 1 branch. Claim before editing:");
  console.log("  node scripts/session-claim.mjs <module-id>");
  process.exit(0);
}

// Claim-check mode for a specific module.
const id = arg;
const { appDir, routes } = zonesFor(id);
const prefixes = [appDir, ...routes].filter(Boolean);
const token = (ALIAS[id]?.app || id).toLowerCase();

const conflicts = [];
for (const wt of wts) {
  if (resolve(wt.path) === self) continue;
  const branch = (wt.branch || "").toLowerCase();
  const byName = branch.includes(token) || branch.includes(id.toLowerCase());
  const byFiles = dirtyInZone(wt.path, prefixes);
  if (byName || byFiles.length) {
    conflicts.push({ wt, byName, byFiles });
  }
}

console.log(`Module "${id}"  zones: ${prefixes.join(", ") || "(core)"}\n`);
if (conflicts.length === 0) {
  console.log(`✅ FREE — no other worktree is claiming "${id}". Safe to work here.`);
  console.log(`   Reminder: use a branch named feat/${id}-... and commit --only your zone.`);
  process.exit(0);
}

console.log(`⚠️  CLAIMED by another worktree — do NOT edit "${id}" here:`);
for (const c of conflicts) {
  const why = [c.byName ? "branch name" : null, c.byFiles.length ? `${c.byFiles.length} dirty file(s)` : null]
    .filter(Boolean)
    .join(" + ");
  console.log(`   • ${c.wt.branch}  (${why})  ${c.wt.path}`);
  for (const f of c.byFiles.slice(0, 5)) console.log(`       ${f}`);
}
console.log(`\nPick a different, free module or coordinate before touching this one.`);
process.exit(1);
