#!/usr/bin/env node
/**
 * CyberChess PROD smoke — READ-ONLY checks for the live CyberChess API surface
 * (/api/cyberchess*, tournaments, spectator). Closes the last live-module
 * prod-coverage gap.
 *
 * Strictly read-only: GET probes against already-deployed endpoints + auth /
 * validation gates. Touches NO game state and NO cyberchess source — the v37
 * redesign work lives in a separate chat/zone and is not modified here.
 *
 * Usage: BASE=<prod> node scripts/cyberchess-prod-smoke.js
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
const ok = (l, e) => { pass++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); };
const bad = (l, r) => { fail++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); };

async function req(method, path) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  let j;
  try { j = await r.json(); } catch { j = {}; }
  return { status: r.status, body: j, ct: r.headers.get("content-type") };
}

/**
 * Какая сборка на проде. Добавлено 13.08.2026: до этого дня /health отдавал
 * commit:"unknown", и «сервер отвечает 200» было единственным, что смок мог
 * сказать о выкатке. Разница дорогая — однажды на прод уехала не та ветка, и
 * заметили это глазами, случайно.
 *
 * Сверять с локальным HEAD в лоб нельзя: смок часто зовут из ветки, которую и
 * не выкатывали, — вышел бы постоянный красный, а к постоянному красному
 * перестают присматриваться вместе с настоящей находкой внутри. Поэтому два
 * разных уровня строгости:
 *   • "unknown" — ЖЁСТКО красный: значит выкатывали мимо scripts/railway-deploy.sh,
 *     и опознать прод больше нечем;
 *   • коммита нет в этом репозитории — тоже красный: на проде код, которого у
 *     нас нет;
 *   • коммит есть, но не предок текущей ветки — это сообщение, а не отказ:
 *     печатаем, чем отличается, и идём дальше.
 */
function localGit(args) {
  try {
    const { execFileSync } = require("node:child_process");
    return execFileSync("git", args, { cwd: __dirname + "/..", encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

async function checkBuildStamp() {
  const r = await req("GET", "/health");
  if (r.status !== 200) return bad("GET /health", `${r.status}`);

  const commit = String(r.body?.commit || "");
  if (!commit || commit === "unknown") {
    return bad(
      "какая сборка на проде — неизвестно",
      'commit:"unknown" — выкатывали мимо scripts/railway-deploy.sh, опознать прод нечем',
    );
  }

  const inRepo = localGit(["rev-parse", "--is-inside-work-tree"]) === "true";
  if (!inRepo) return ok("сборка на проде", `commit=${commit} (репозиторий рядом не найден — сверить не с чем)`);

  const known = localGit(["cat-file", "-e", `${commit}^{commit}`]) !== null;
  if (!known) {
    return bad("сборка на проде неизвестна репозиторию", `commit=${commit} — такого коммита у нас нет`);
  }

  const head = localGit(["rev-parse", "HEAD"]) || "";
  if (head.startsWith(commit)) return ok("сборка на проде", `commit=${commit} — совпадает с HEAD`);

  const ahead = localGit(["rev-list", "--count", `${commit}..HEAD`]);
  ok("сборка на проде", `commit=${commit}; в текущей ветке сверх неё ${ahead ?? "?"} коммит(ов)`);
}

async function run() {
  console.log(`\nCyberChess PROD smoke (read-only) → ${BASE}\n`);

  await checkBuildStamp();

  // CPI leaderboard — public, paginated shape.
  let r = await req("GET", "/api/cyberchess/cpi/leaderboard");
  if (r.status === 200 && Array.isArray(r.body?.data?.items)) ok("GET /cyberchess/cpi/leaderboard", `items=${r.body.data.items.length} factor=${r.body.data.factor}`);
  else bad("cpi/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // CPI /me requires a userId query param — validation gate.
  r = await req("GET", "/api/cyberchess/cpi/me");
  if (r.status === 400) ok("GET /cyberchess/cpi/me (no userId) → 400", r.body?.error ? String(r.body.error).slice(0, 40) : "");
  else bad("cpi/me validation gate", `got=${r.status}`);

  // Server-authoritative reads. Added 2026-08-12, when these four learned to
  // answer 503 instead of an invented zero on a database outage: an outage used
  // to arrive as "you have 0 Chessy", "no games", "no players" — statements
  // nobody had verified. Nothing here checked them at all, so the change would
  // have shipped unwatched. A live prod answers, so 200 is the expectation;
  // a 503 from this smoke means the store is genuinely unavailable, which is
  // exactly what we want to hear about.
  r = await req("GET", "/api/cyberchess/matchmaking/wallet/leaderboard?limit=5");
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.leaderboard)) ok("GET /matchmaking/wallet/leaderboard", `count=${r.body.count}`);
  else bad("matchmaking/wallet/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/cyberchess/matchmaking/leaderboard?speed=blitz&limit=5");
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.leaderboard)) ok("GET /matchmaking/leaderboard", `speed=blitz count=${r.body.count}`);
  else bad("matchmaking/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // Validation gate, not a data check: without userId the answer must be 400
  // rather than a balance for nobody.
  r = await req("GET", "/api/cyberchess/matchmaking/wallet");
  if (r.status === 400) ok("GET /matchmaking/wallet (no userId) → 400");
  else bad("matchmaking/wallet validation gate", `got=${r.status}`);

  // Daily leaderboard — public. An empty board is honest; a 503 means the file
  // behind it could not be read, which since 12.08 is said out loud instead of
  // being served as "nobody has solved it yet".
  r = await req("GET", "/api/cyberchess-daily/leaderboard?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) ok("GET /cyberchess-daily/leaderboard", `total=${r.body.total}`);
  else bad("cyberchess-daily/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // Хранилище турниров и задачи дня: работает ли перенос в Postgres.
  //
  // Проверка была намеренно мягкой к 404, пока перенос лежал в невлитой ветке:
  // жёсткое требование сделало бы смок красным до самой выкатки, а к красному
  // по расписанию перестают присматриваться. 13.08.2026 код выкачен и обе ручки
  // отвечают, поэтому послабление снято — иначе исчезнувшая ручка читалась бы
  // как «ещё не выкачено», то есть регрессия выглядела бы штатным состоянием.
  for (const [label, path_] of [
    ["турниры", "/api/cyberchess-tournaments/_persistence"],
    ["задача дня", "/api/cyberchess-daily/_persistence"],
  ]) {
    r = await req("GET", path_);
    if (r.status !== 200) {
      bad(`хранилище ${label}`, `${r.status}`);
      continue;
    }
    const db = r.body?.db || r.body?.persistence?.db || {};
    if (!db.configured) {
      // На проде DATABASE_URL есть — значит модуль его не увидел.
      bad(`хранилище ${label}: база не настроена`, "данные живут на файле и теряются при деплое");
    } else if (!db.connected) {
      bad(`хранилище ${label}: подключиться не вышло`, `причина: ${db.lastErrorKind || "неизвестна"}`);
    } else if (Number(db.saveErrors) > 0) {
      bad(`хранилище ${label}: ошибки записи`, `${db.saveErrors}, причина: ${db.lastErrorKind || "неизвестна"}`);
    } else {
      ok(`хранилище ${label}`, `подключено, записей ${db.saves}, из базы поднято: ${db.adoptedFromDb}`);
    }
  }

  // Upcoming events — public.
  r = await req("GET", "/api/cyberchess/upcoming");
  if (r.status === 200) ok("GET /cyberchess/upcoming → 200");
  else bad("cyberchess/upcoming", `${r.status}`);

  // Results — auth-gated.
  r = await req("GET", "/api/cyberchess/results");
  if (r.status === 401) ok("GET /cyberchess/results (no auth) → 401");
  else bad("cyberchess/results auth gate", `got=${r.status}`);

  // Tournaments list — public, count + array.
  r = await req("GET", "/api/cyberchess-tournaments/list");
  let firstTid;
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.tournaments)) {
    firstTid = r.body.tournaments[0]?.id;
    ok("GET /cyberchess-tournaments/list", `count=${r.body.count} n=${r.body.tournaments.length}`);
  } else bad("tournaments/list", `${r.status}`);

  // Tournament detail by id (if any exist).
  if (firstTid) {
    r = await req("GET", `/api/cyberchess-tournaments/${encodeURIComponent(firstTid)}`);
    if (r.status === 200) ok("GET /cyberchess-tournaments/:id", `id=${firstTid}`);
    else bad("tournaments/:id", `${r.status}`);
  } else {
    ok("GET /cyberchess-tournaments/:id", "skipped — no tournaments listed");
  }

  // Time-controls meta — public matchmaking presets.
  r = await req("GET", "/api/cyberchess-tournaments/__meta/time-controls");
  if (r.status === 200 && Array.isArray(r.body?.matchmaking)) ok("GET /__meta/time-controls", `presets=${r.body.matchmaking.length}`);
  else bad("time-controls", `${r.status}`);

  // Spectator — public list + replays.
  r = await req("GET", "/api/cyberchess-spectator/list");
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.games)) ok("GET /cyberchess-spectator/list", `games=${r.body.games.length}`);
  else bad("spectator/list", `${r.status}`);

  r = await req("GET", "/api/cyberchess-spectator/replays");
  if (r.status === 200) ok("GET /cyberchess-spectator/replays → 200");
  else bad("spectator/replays", `${r.status}`);

  // Content-Type on a public endpoint.
  r = await req("GET", "/api/cyberchess-tournaments/list");
  if (/application\/json/i.test(r.ct || "")) ok("Content-Type application/json on /tournaments/list", r.ct);
  else bad("content-type", `ct=${r.ct}`);

  // ── Живая СТРАНИЦА, а не только ручка ────────────────────────────────────
  //
  // Заведено 19.08.2026 после находки, которую не поймал ни один сторож: на
  // /cyberchess/daily висела таблица «Топ-100 серий» с выдуманными сериями под
  // именами настоящих гроссмейстеров, и числа менялись при каждой отрисовке.
  // Все проверки до этой смотрели на бэкенд либо на код ответа страницы, а
  // выдумка живёт в её ТЕЛЕ: код 200 про содержимое не говорит ничего.
  //
  // Имена настоящих людей рядом с придуманными о них цифрами — не вопрос вкуса,
  // поэтому проверка жёсткая, а не предупреждение.
  const FRONT = (process.env.FRONT || "https://aevion.app").replace(/\/+$/, "");
  const FORBIDDEN = ["Magnus", "Hikaru", "Fabiano", "Praggnanandhaa", "Nakamura"];
  try {
    const page = await fetch(FRONT + "/cyberchess/daily", { redirect: "follow" });
    const html = await page.text();

    // Контроль прибора: страница обязана содержать то, что там точно есть. Без
    // него пустой ответ или редирект дали бы «запрещённых имён нет», то есть
    // зелёный на нечитанной странице.
    if (/головоломка|puzzle/i.test(html)) {
      const found = FORBIDDEN.filter((n) => html.includes(n));
      if (!found.length) ok("на странице задачи дня нет выдуманной таблицы под чужими именами");
      else bad("выдуманная таблица под именами настоящих людей", "найдены: " + found.join(", "));
    } else {
      bad("страница задачи дня прочитана", "тело не похоже на страницу пазла (" + html.length + " байт) — проверка НЕ выполнена");
    }
  } catch (e) {
    bad("страница задачи дня доступна", String(e && e.message ? e.message : e));
  }

  console.log(`\n${pass + fail} assertions — ${pass} PASS  ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
