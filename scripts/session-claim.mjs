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
//   node scripts/session-claim.mjs --file <path> # who ALREADY changed this file
//   node scripts/session-claim.mjs --map         # print module -> paths map
//   node scripts/session-claim.mjs               # summarize every worktree's zone
//
// Why --file exists (added 2026-08-10 after a real duplicate). The module check
// looks at branch NAMES and at UNCOMMITTED files. Both missed a collision that
// cost two sessions the same two hours: another worktree had already COMMITTED
// its change to frontend/src/data/pitchFacts.ts, so nothing was dirty, and its
// branch was called fix/pitch-one-denominator — the word "pitchFacts" appears
// nowhere in it. Asking about the module returned FREE, truthfully and
// uselessly. Shared files (data/*.ts, guards in __tests__/) belong to no single
// module, so ask about the FILE before touching them.
//
// Exit code: 0 = free (or informational), 1 = claimed by another worktree.
//
// Скорость (30.10.2026). Замер: 186 worktree, один вход
// `frontend/src/app/compare` — 227 с (каждый вызов git на этой машине ~0.4 с,
// а на worktree шло по 2-3 вызова ПОСЛЕДОВАТЕЛЬНО). tests/sessionClaimGuard.test.ts
// гонит 11 входов и не укладывался в 240 с. Что сделано, смысл ответа прежний:
//  (а) один `git worktree list --porcelain`, как и был;
//  (б) возраст последнего коммита ветки берётся из того же единственного
//      `git for-each-ref`, что и отсечка свежести, а не `git log -1` на каждый
//      worktree; дорогой `git diff main...ветка` по-прежнему только для веток
//      моложе 14 дней. Старый (>14 дн.) worktree с чистым деревом ничего не держит:
//      держит файл тот, кто его недавно коммитил или правит сейчас, — для такого
//      status пропускается тоже, если за 14 дней не двигались ни коммит ветки,
//      ни .git/HEAD, ни .git/index (проверка mtime без запуска git; ошибка чтения
//      = считаем живым). Остаточный риск: сессия 14+ дней создаёт ТОЛЬКО новые
//      неотслеживаемые файлы и ни разу не трогает git — такую мы не увидим;
//  (в) кэш «ветка@sha против main@sha → файлы под корнями зон» в os.tmpdir()/aevion-session-claim.json
//      (запись атомарно, через временный файл + rename). Ключ — sha вершины ветки
//      и sha main, поэтому устареть он не может: сменилась вершина — другой ключ.
//      Чистоту дерева НЕ кэшируем: правка tracked-файла не меняет ни mtime
//      .git/HEAD, ни .git/index, кэш по mtime пропустил бы живую правку;
//  (г) проверки worktree идут параллельно, не больше 8 процессов git разом.

import { execSync, exec } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Асинхронный sh: тот же контракт (пустая строка при ошибке), но не блокирует.
function shAsync(cmd, cwd, raw = false) {
  return new Promise((res) => {
    exec(cmd, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      res(err ? "" : raw ? String(stdout) : String(stdout).trim());
    });
  });
}

/** map с потолком одновременных задач; порядок результатов = порядок входа. */
async function pmap(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
const PAR = 8;

// Кэш — только ускорение: нечитаемый/битый файл = пустой кэш, ответ тот же.
const CACHE_FILE = join(tmpdir(), "aevion-session-claim.json");
const CACHE_MAX = 3000;
const cache = (() => {
  try {
    const j = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    if (j && typeof j.diff === "object" && j.diff) return { diff: j.diff, status: j.status && typeof j.status === "object" ? j.status : {} };
  } catch {
    /* нет файла / битый JSON — начинаем с пустого */
  }
  return { diff: {}, status: {} };
})();
// Корни, под которыми лежат ВСЕ зоны модулей (zonesFor). Один status/diff по
// корням обслуживает любой вход, поэтому результат годится в общий кэш.
const ZONE_ROOTS = ["frontend/src/app", "aevion-globus-backend/src/routes"];
const ROOTS_SPEC = ZONE_ROOTS.map((p) => `"${p}"`).join(" ");
// Срок жизни снимка «что грязно в worktree». Только он — не вечный кэш: чистоту
// по mtime кэшировать нельзя (см. шапку). Цена: чужая правка, начатая менее
// двух минут назад, может не попасть в ответ. Отключить: SESSION_CLAIM_NOCACHE=1.
const STATUS_TTL_MS = process.env.SESSION_CLAIM_NOCACHE ? 0 : 30_000; // 30.10.2026, решение Оркестратора: 30 с, не 120 — окно ложного FREE сужено до одного прохода (живой запуск ~43 с), 2 минуты слепоты = окно, когда два окна берут один файл
let cacheDirty = false;
function saveCache() {
  if (!cacheDirty) return;
  try {
    // Слияние с файлом на диске: параллельные запуски (тест гонит по 4) пишут
    // каждый свои ключи, и «последний перезаписал» терял бы чужие.
    try {
      const disk = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      if (disk && typeof disk.diff === "object" && disk.diff) cache.diff = { ...disk.diff, ...cache.diff };
      if (disk && typeof disk.status === "object" && disk.status) {
        const merged = { ...disk.status };
        for (const [k, v] of Object.entries(cache.status)) if (!merged[k] || merged[k].t <= v.t) merged[k] = v;
        cache.status = merged;
      }
    } catch {
      /* на диске нет или битый — пишем свой */
    }
    const keys = Object.keys(cache.diff);
    if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache.diff[k];
    const nowMs = Date.now();
    for (const [k, v] of Object.entries(cache.status)) if (nowMs - v.t > 3600_000) delete cache.status[k];
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache));
    renameSync(tmp, CACHE_FILE); // атомарно: параллельный читатель не увидит половину файла
  } catch (e) {
    console.error(`(кэш не записан: ${e.message} — ответ от этого не меняется)`);
  }
}

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

// ── Ответ «FREE» обязан быть обеспечен настоящими зонами ───────────────────
//
// Этот инструмент выдаёт разрешение редактировать. Значит, единственный опасный
// для него исход — не отказ, а ЛОЖНОЕ разрешение: оно посылает сессию в чужой
// каталог, ровно туда, ради чего инструмент и написан.
//
// А выдавалось оно на двух совершенно обычных входах (проверено 28.07.2026):
//
//   session-claim.mjs frontend/src/app/compare   → зона frontend/src/app/frontend/src/app/compare
//   session-claim.mjs qskiway  (опечатка)        → зона frontend/src/app/qskiway
//
// Обе не существуют, поэтому не совпадают ни с чем, поэтому «✅ FREE». Причём
// первый вход естественнее правильного: в глобальном правиле команда стоит
// рядом с путями, и рука сама подставляет путь. Второй страшнее: ЛЮБАЯ описка в
// имени модуля означала разрешение.

/** Путь внутри репозитория → id модуля, которому он принадлежит (или null). */
function idFromPath(p) {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  const app = norm.match(/(?:^|\/)frontend\/src\/app\/([^/]+)/);
  if (app) return reverseAlias(app[1], "app");
  const route = norm.match(/(?:^|\/)aevion-globus-backend\/src\/routes\/([^/]+?)(?:\.ts)?(?:\/|$)/);
  if (route) return reverseAlias(route[1], "route");
  return null;
}

/** Каталог/файл зоны → id модуля: у части модулей имя папки отличается от id. */
function reverseAlias(name, kind) {
  for (const [id, a] of Object.entries(ALIAS)) {
    if (kind === "app" && a.app === name) return id;
    if (kind === "route" && (a.routes || []).some((r) => r === name || r === `${name}.ts`)) return id;
  }
  return name;
}

/** Существует ли хоть одна зона модуля на диске. */
function zonesExist(prefixes) {
  return prefixes.some((p) => existsSync(resolve(ROOT, p)));
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
// «Живой» worktree: последний коммит ветки, .git/HEAD или .git/index моложе
// 14 дней. У живой копии (в этой сессии 94 из 187) status обязателен. У старой
// и без движения git за две недели — пропускаем: ничего не держит (см. шапку).
// Любая ошибка чтения = «живой»: сомневаясь, проверяем, а не пропускаем.
const LIVE_CUTOFF_MS = Date.now() - 14 * 24 * 3600 * 1000;
function isLiveWorktree(wt) {
  const ts = wt.branch ? BRANCH_INFO.get(wt.branch)?.ts : undefined;
  if (ts && ts * 1000 >= LIVE_CUTOFF_MS) return true;
  try {
    let gd = join(wt.path, ".git");
    if (statSync(gd).isFile()) gd = resolve(wt.path, readFileSync(gd, "utf8").replace(/^gitdir:\s*/, "").trim());
    return (
      statSync(join(gd, "index")).mtimeMs >= LIVE_CUTOFF_MS || statSync(join(gd, "HEAD")).mtimeMs >= LIVE_CUTOFF_MS
    );
  } catch {
    return true;
  }
}

async function dirtyInZone(wt, prefixes) {
  const wtPath = wt.path;
  if (!isLiveWorktree(wt)) return [];
  // status только по корням зон: git не обходит все ~6000 файлов копии
  // (30.10.2026). Результат — общий для любого входа (фильтр по зоне ниже) и
  // живёт в кэше STATUS_TTL_MS.
  // raw: без trim() всего вывода — иначе у первой строки " M путь" съедался
  // ведущий пробел, и slice(3) откусывал первую букву пути (первая грязная
  // правка не совпадала с зоной = ложное FREE).
  const hit = cache.status[wtPath];
  let files;
  if (hit && Date.now() - hit.t < STATUS_TTL_MS && Array.isArray(hit.files)) {
    files = hit.files;
  } else {
    const status = await shAsync(`git status --porcelain -- ${ROOTS_SPEC}`, wtPath, true);
    files = status ? status.split("\n").map((l) => l.slice(3).trim()).filter(Boolean) : [];
    if (STATUS_TTL_MS > 0 && files.length <= 3000) {
      cache.status[wtPath] = { t: Date.now(), files };
      cacheDirty = true;
    }
  }
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
const BRANCH_INFO = new Map(); // ветка -> { ts, sha } из одного for-each-ref
const RECENT_BRANCHES = (() => {
  const out = sh(
    `git for-each-ref --sort=-committerdate --format="%(refname:short) %(committerdate:unix) %(objectname)" refs/heads`,
    ROOT,
  );
  const cutoff = Math.floor(Date.now() / 1000) - 14 * 24 * 3600;
  const set = new Set();
  for (const line of out.split("\n")) {
    const [name, ts, sha] = line.trim().split(/\s+/);
    if (!name) continue;
    BRANCH_INFO.set(name, { ts: Number(ts), sha });
    if (Number(ts) >= cutoff) set.add(name);
  }
  return set;
})();
const MAIN_SHA = sh("git rev-parse main", ROOT);

async function committedInZone(branch, prefixes) {
  if (!branch || branch === "main" || branch === "master") return [];
  if (!RECENT_BRANCHES.has(branch)) return [];
  // Three dots: only what the branch added since it diverged, not what main
  // moved on to — otherwise every stale branch looks like it touches everything.
  // Пути отдаём git'у (не весь репозиторий): на 48 worktree это 1 с вместо 11 с.
  // С 30.10.2026 пути — корни ВСЕХ зон, результат кэшируется по (вершина ветки,
  // main) и фильтруется по зоне в JS, поэтому второй и следующие входы не
  // запускают git diff. Фильтр — по границе пути, как pathspec: «routes/compare»
  // ловит routes/compare/x.ts, но не routes/compare-x.ts. (Целиком, без корней,
  // список не кэшируем: main на этой машине далеко позади, у веток ~4000 файлов.)
  const zone = prefixes.filter(Boolean);
  if (!zone.length) return [];
  const tip = BRANCH_INFO.get(branch)?.sha;
  const key = tip && MAIN_SHA ? `${tip}|${MAIN_SHA}|roots` : null;
  let all = key && Array.isArray(cache.diff[key]) ? cache.diff[key] : null;
  if (!all) {
    const out = await shAsync(`git diff --name-only main...${branch} -- ${ROOTS_SPEC}`, ROOT);
    all = out ? out.split("\n").map((f) => f.trim()).filter(Boolean) : [];
    if (key && all.length <= 3000) {
      cache.diff[key] = all;
      cacheDirty = true;
    }
  }
  const files = all.filter((f) => zone.some((p) => f === p || f.startsWith(p + "/")));
  return files;
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
  const dirties = await pmap(
    wts,
    PAR,
    async (wt) => (await shAsync("git status --porcelain", wt.path)).split("\n").filter(Boolean).length,
  );
  for (const [i, wt] of wts.entries()) {
    const dirty = dirties[i];
    const mark = resolve(wt.path) === self ? " (this session)" : "";
    console.log(`  ${wt.branch || "(detached)"}  [${dirty} dirty]  ${wt.path}${mark}`);
  }
  console.log("\nRule: 1 module = 1 worktree = 1 branch. Claim before editing:");
  console.log("  node scripts/session-claim.mjs <module-id>");
  process.exit(0);
}

// ── --file mode: кто УЖЕ менял этот файл в своей ветке ────────────────────
// Смотрим коммиты, а не грязь в рабочей папке: чужая работа чаще всего уже
// закоммичена, и именно поэтому проверка по имени зоны её не видит.
if (arg === "--file") {
  const target = process.argv[3];
  if (!target) {
    console.log("Usage: node scripts/session-claim.mjs --file <path-from-repo-root>");
    process.exit(0);
  }
  console.log(`File "${target}" — who already changed it on their branch:
`);
  const touched = [];
  const cand = wts.filter((wt) => resolve(wt.path) !== self && wt.branch);
  const counts = await pmap(cand, PAR, async (wt) =>
    Number((await shAsync(`git rev-list --count main..${wt.branch} -- "${target}"`, ROOT)) || "0"),
  );
  cand.forEach((wt, i) => {
    if (counts[i] > 0) touched.push({ branch: wt.branch, path: wt.path, commits: counts[i] });
  });
  if (!touched.length) {
    console.log("✅ FREE — no other worktree has committed changes to this file.");
    process.exit(0);
  }
  console.log("⚠️  Уже правят — согласуй, иначе мерж затрёт чужое:");
  for (const t of touched.sort((a, b) => b.commits - a.commits)) {
    console.log(`   • ${t.branch}  (${t.commits} коммит(ов) по этому файлу)  ${t.path}`);
  }
  console.log(`\nПосмотреть чужую правку: git diff main...<ветка> -- ${target}`);
  process.exit(1);
}

// Claim-check mode for a specific module.
//
// Путь принимаем, но НЕ как имя модуля: сначала переводим в id владеющего им
// модуля. Иначе `frontend/src/app/compare` превращалось в зону
// `frontend/src/app/frontend/src/app/compare` и отвечало «свободно».
let id = arg;
if (/[/\\]/.test(arg)) {
  const mapped = idFromPath(arg);
  if (!mapped) {
    console.error(`Путь "${arg}" не удалось отнести ни к одному модулю.`);
    console.error(`Зоны модулей — это frontend/src/app/<модуль> и`);
    console.error(`aevion-globus-backend/src/routes/<модуль>[.ts]. Позовите по имени модуля:`);
    console.error(`  node scripts/session-claim.mjs <module-id>`);
    process.exit(2);
  }
  console.log(`(путь "${arg}" отнесён к модулю "${mapped}")`);
  id = mapped;
}

const { appDir, routes } = zonesFor(id);
const prefixes = [appDir, ...routes].filter(Boolean);

// Неизвестный модуль — это НЕ «свободно». У опечатки зоны не существует, она ни
// с чем не совпадает, и молчание выглядело бы как разрешение.
if (!(id in ALIAS) && !zonesExist(prefixes)) {
  console.error(`Модуль "${id}" не найден: ни одна из его зон не существует на диске.`);
  console.error(`  ${prefixes.join("\n  ")}`);
  console.error(`\nСкорее всего опечатка в имени. Список worktree и их зон:`);
  console.error(`  node scripts/session-claim.mjs`);
  console.error(`\nЭто НЕ значит «свободно» — проверка не выполнена.`);
  process.exit(2);
}
const token = (ALIAS[id]?.app || id).toLowerCase();

const conflicts = [];
const overlaps = [];
const others = wts.filter((wt) => resolve(wt.path) !== self);
const checked = await pmap(others, PAR, async (wt) => {
  const branch = (wt.branch || "").toLowerCase();
  const byName = branch.includes(token) || branch.includes(id.toLowerCase());
  const byFiles = await dirtyInZone(wt, prefixes);
  // Закоммиченное НЕ блокирует. Иначе на живом репозитории почти любая зона
  // выглядит занятой: pricing.ts, например, тронут четырьмя ветками сразу.
  // Сторож, который звенит всегда, перестаёт значить что-либо — его глушат, и
  // вместе с ним теряются настоящие срабатывания.
  const byCommits = await committedInZone(wt.branch, prefixes);
  // Возраст последнего коммита чужой ветки. Без него «занято» звучит одинаково
  // и для сессии, которая работает прямо сейчас, и для брошенной. 06.08.2026
  // страж сказал CLAIMED про feat/qskyway-airspace-trust — я не стал трогать
  // зону, а ветка не менялась ДЕВЯТЬ дней при чистом каталоге: готовые фиксы
  // живых дефектов прода простаивали всё это время.
  // С 30.10.2026 берём из общего for-each-ref, а не `git log -1` на worktree.
  let ageDays = null;
  if (wt.branch) {
    const ts = BRANCH_INFO.get(wt.branch)?.ts ?? Number(await shAsync(`git log -1 --format=%ct ${wt.branch}`, ROOT));
    if (ts) ageDays = Math.floor((Date.now() / 1000 - ts) / 86400);
  }
  return { wt, byName, byFiles, byCommits, ageDays };
});
for (const c of checked) {
  if (c.byName || c.byFiles.length) conflicts.push(c);
  else if (c.byCommits.length) overlaps.push({ wt: c.wt, byCommits: c.byCommits });
}
saveCache();

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
