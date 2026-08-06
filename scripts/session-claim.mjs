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

// Files another branch has ALREADY COMMITTED under the given zone prefixes.
//
// Without this the guard has a blind spot that costs exactly what it exists to
// prevent. On 05.08.2026 two sessions fixed the same defect in
// routes/pricing.ts: one claimed "pricing", the other claimed "qskyway" and
// committed its pricing.ts change hours earlier. Nothing was dirty, and the
// branch name said nothing about pricing — so the check answered FREE, and the
// duplicate surfaced only as a merge conflict on identical lines.
//
// Committed work is a stronger claim than uncommitted work, not a weaker one:
// it means someone already finished there.
// Ветки, тронутые за последние две недели. Дублирование случается между
// ЖИВЫМИ сессиями, а сравнение всех 48 worktree подряд стоило лишних секунд —
// команду, которую зовут перед каждой правкой, при задержке просто перестают
// звать. Замерено 05.08.2026: было 4.5 с без этой проверки, 11 с со сплошным
// перебором, 7 с с отсечкой по свежести. Итоговая цена слепого пятна — 2.5 с.
const RECENT_BRANCHES = (() => {
  const out = sh(
    `git for-each-ref --sort=-committerdate --format="%(refname:short) %(committerdate:unix)" refs/heads`,
    ROOT,
  );
  const cutoff = Math.floor(Date.now() / 1000) - 14 * 24 * 3600;
  const set = new Set();
  for (const line of out.split("\n")) {
    const [name, ts] = line.trim().split(/\s+/);
    if (name && Number(ts) >= cutoff) set.add(name);
  }
  return set;
})();

function committedInZone(branch, prefixes) {
  if (!branch || branch === "main" || branch === "master") return [];
  if (!RECENT_BRANCHES.has(branch)) return [];
  // Three dots: only what the branch added since it diverged, not what main
  // moved on to — otherwise every stale branch looks like it touches everything.
  // Пути отдаём git'у, а не фильтруем в JS: без этого проверка по 48 worktree
  // занимала 11 секунд вместо секунды, а команду, которую зовут перед каждой
  // правкой, при такой задержке просто перестают звать.
  const paths = prefixes.filter(Boolean).map((p) => `"${p}"`).join(" ");
  if (!paths) return [];
  const out = sh(`git diff --name-only main...${branch} -- ${paths}`, ROOT);
  if (!out) return [];
  return out.split("\n").map((f) => f.trim()).filter(Boolean);
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
const overlaps = [];
for (const wt of wts) {
  if (resolve(wt.path) === self) continue;
  const branch = (wt.branch || "").toLowerCase();
  const byName = branch.includes(token) || branch.includes(id.toLowerCase());
  const byFiles = dirtyInZone(wt.path, prefixes);
  const byCommits = committedInZone(wt.branch, prefixes);
  // Закоммиченное НЕ блокирует. Иначе на живом репозитории почти любая зона
  // выглядит занятой: pricing.ts, например, тронут четырьмя ветками сразу.
  // Сторож, который звенит всегда, перестаёт значить что-либо — его глушат, и
  // вместе с ним теряются настоящие срабатывания.
  // Возраст последнего коммита чужой ветки. Без него «занято» звучит одинаково
  // и для сессии, которая работает прямо сейчас, и для брошенной. 06.08.2026
  // страж сказал CLAIMED про feat/qskyway-airspace-trust — я не стал трогать
  // зону, а ветка не менялась ДЕВЯТЬ дней при чистом каталоге: готовые фиксы
  // живых дефектов прода простаивали всё это время.
  let ageDays = null;
  if (wt.branch) {
    const ts = sh(`git log -1 --format=%ct ${wt.branch}`, ROOT);
    if (ts) ageDays = Math.floor((Date.now() / 1000 - Number(ts)) / 86400);
  }
  if (byName || byFiles.length) conflicts.push({ wt, byName, byFiles, byCommits, ageDays });
  else if (byCommits.length) overlaps.push({ wt, byCommits });
}

console.log(`Module "${id}"  zones: ${prefixes.join(", ") || "(core)"}\n`);
// Перекрытие по УЖЕ ЗАКОММИЧЕННЫМ файлам печатается отдельно от блокировки:
// это не «занято», а «здесь уже сделано — посмотри, прежде чем делать снова».
function printOverlaps() {
  if (!overlaps.length) return;
  console.log(`\nℹ️  В этой зоне уже есть закоммиченные правки в других ветках`);
  console.log(`   (не блокирует — но сначала посмотрите, не сделано ли уже):`);
  for (const o of overlaps) {
    console.log(`   • ${o.wt.branch}`);
    for (const f of o.byCommits.slice(0, 4)) console.log(`       ${f}`);
  }
  console.log(`   Посмотреть: git log --oneline main..<ветка> -- <файл>`);
}

if (conflicts.length === 0) {
  console.log(`✅ FREE — no other worktree is claiming "${id}". Safe to work here.`);
  console.log(`   Reminder: use a branch named feat/${id}-... and commit --only your zone.`);
  printOverlaps();
  process.exit(0);
}

console.log(`⚠️  CLAIMED by another worktree — do NOT edit "${id}" here:`);
for (const c of conflicts) {
  const why = [
    c.byName ? "branch name" : null,
    // Неделя без коммитов — повод посмотреть, жива ли та сессия, а не молча
    // уступать зону: работа могла быть доделана и брошена.
    c.ageDays !== null && c.ageDays >= 7 ? `⚠ последний коммит ${c.ageDays} дн. назад` : null,
    c.byFiles.length ? `${c.byFiles.length} dirty file(s)` : null,
    c.byCommits.length ? `${c.byCommits.length} already committed` : null,
  ]
    .filter(Boolean)
    .join(" + ");
  console.log(`   • ${c.wt.branch}  (${why})  ${c.wt.path}`);
  for (const f of c.byFiles.slice(0, 5)) console.log(`       ${f}`);
  // Закоммиченное показываем отдельной пометкой: это не «кто-то сейчас правит»,
  // а «здесь уже сделано» — реакция другая, вплоть до «не делай второй раз».
  for (const f of c.byCommits.slice(0, 5)) console.log(`       ${f}  (уже закоммичено)`);
}
printOverlaps();
console.log(`\nPick a different, free module or coordinate before touching this one.`);
process.exit(1);
