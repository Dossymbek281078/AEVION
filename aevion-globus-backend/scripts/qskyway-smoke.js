#!/usr/bin/env node
/**
 * AEVION QSkyway — deterministic engine smoke test.
 *
 * DB-free pure-compute router (A* over a real OSM height field + in-memory QRight
 * slot market), so no seed / no Postgres. Exercises health, city twin, 4D routing
 * (incl. clearance invariant across all vertiport pairs) and the slot capacity gate.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/qskyway-smoke.js
 * Env: BASE default http://127.0.0.1:4001
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
// Write legs (slot booking, registry entry) self-skip against prod so the daily
// run can cover the whole read surface without leaving smoke rows behind.
const READ_ONLY = process.env.READ_ONLY === "1";
let step = 0, failed = 0;
let skipped = 0;
const skip = (n, why) => { skipped++; console.log(`  ${String(++step).padStart(2, "0")}  SKIP  ${n}  — ${why}`); };
// A skipped write leg did not pass — folding it into the pass count would make
// a prod run look like it verified more than it actually did.
// Считается ПРОЙДЕННОЕ, а не «выполненное». Прогон против прода 12.08.2026
// напечатал «8 FAILED (123/125 checks)» — и вторая половина строки читается как
// «123 прошли», хотя прошли 115. Числа в сводке о качестве не имеют права
// требовать расшифровки.
const summary = () => {
  const ran = step - skipped;
  const passed = ran - failed;
  return `${failed === 0 ? "ALL PASS" : failed + " FAILED"}  (${passed}/${ran} passed${skipped ? `, ${skipped} skipped` : ""})`;
};
const ok = (n, x) => console.log(`  ${String(++step).padStart(2, "0")}  PASS  ${n}${x ? "  " + x : ""}`);
const fail = (n, r) => { step++; failed++; console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${n}${r ? "  — " + r : ""}`); };
const assert = (c, n, r) => (c ? ok(n) : fail(n, r));
async function jget(p) { const r = await fetch(`${BASE}${p}`); return { status: r.status, json: await r.json().catch(() => null) }; }
async function jpost(p, b) { const r = await fetch(`${BASE}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => null) }; }

/**
 * Confirm we are talking to a QSkyway-capable backend before asserting anything.
 *
 * BASE defaults to port 4001, which on this machine is contested by 18+ AEVION
 * worktrees. Point this at another session's server and you get a cascade of
 * confusing failures that look like regressions in your own branch — an hour
 * went to exactly that on 2026-07-27. A liveness check is not enough: something
 * answers, it is just the wrong something.
 */
/**
 * Личность сервера, а не его способность.
 *
 * 29.08.2026: смоук прошёл 153/153, НЕ имея запущенного бэкенда этой
 * ветки — на порту 4001 сидел сервер соседней сессии. Проверки ниже
 * его пропустили, и это не недосмотр автора: он ЗНАЛ про общий порт
 * (см. комментарий выше про потерянный час 27.07) и построил защиту.
 * Она проверяла СПОСОБНОСТЬ — «это QSkyway? есть ли фича?» — а
 * способность у всех 18 worktree одинаковая: это один репозиторий.
 * Поэтому проверка пропускала ровно тот случай, против которого
 * написана.
 *
 * Цена не в ложном зелёном: смоук БРОНИРУЕТ слоты, то есть пишет в
 * чужой процесс. Соседняя сессия увидит брони, которых не делала.
 *
 * Ответ здесь чистый (без сети и без git), чтобы его можно было
 * проверить таблицей случаев — включая те, что руками не повторить.
 */
function identityVerdict(health, opts) {
  const branch = health && typeof health.branch === "string" ? health.branch : "";
  const known = branch !== "" && branch !== "unknown";
  const explicit = Boolean(opts && opts.baseIsExplicit);
  const local = opts && opts.localBranch ? opts.localBranch : "";

  if (!known) {
    if (explicit) {
      return { ok: true, note: "ветка не названа; BASE задан явно — доверяю оператору" };
    }
    return {
      ok: false,
      reason: "unidentified",
      message:
        "сервер на порту по умолчанию не называет свою ветку. На этой машине порт делят 18+ worktree, " +
        "а смоук БРОНИРУЕТ слоты: прогон против чужого процесса испортит чужие данные и ничего не скажет " +
        "о вашем коде. Поднимите бэкенд этой ветки или задайте BASE явно.",
    };
  }
  if (local && branch !== local) {
    if (explicit) {
      return { ok: true, note: "ветка сервера " + branch + " против локальной " + local + "; BASE задан явно" };
    }
    return {
      ok: false,
      reason: "other-branch",
      message: "сервер собран из ветки " + branch + ", а вы работаете в " + local + " — это чужая сессия.",
    };
  }
  return { ok: true, note: "ветка сервера: " + branch };
}

function localBranchOrEmpty() {
  try {
    return require("node:child_process")
      .execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim();
  } catch {
    // Не смогли спросить git — это «не знаю», а не «совпадает».
    // Пустая строка отключает сравнение веток, но НЕ отключает отказ
    // неопознанному серверу: слабее становится одна проверка из двух.
    return "";
  }
}
async function assertRightBackend() {
  let h;
  try {
    h = await jget("/api/qskyway/health");
  } catch (e) {
    console.error(`\nCannot reach ${BASE} — is the backend running?  (${e instanceof Error ? e.message : e})`);
    process.exit(1);
  }
  if (h.status !== 200 || h.json?.module !== "qskyway") {
    console.error(`\n${BASE} answered ${h.status}, but this is not a QSkyway backend.`);
    console.error("Another worktree is probably on this port. Check:  netstat -ano | grep LISTENING | grep ':<port> '");
    process.exit(1);
  }
  if (!(h.json.features ?? []).includes("regulatory-airspace-ceilings")) {
    console.error(`\n${BASE} is a QSkyway backend, but an OLDER build — no regulatory-airspace-ceilings feature.`);
    console.error("Restart it from this worktree, or point BASE at the right port.");
    process.exit(1);
  }

  const verdict = identityVerdict(h.json, {
    baseIsExplicit: Boolean(process.env.BASE),
    localBranch: localBranchOrEmpty(),
  });
  if (!verdict.ok) {
    console.error("");
    console.error("Не тот сервер: " + verdict.message);
    process.exit(1);
  }
  console.log("сервер опознан — " + verdict.note);
}

async function main() {
  console.log(`QSkyway smoke → ${BASE}\n`);

  await assertRightBackend();
  const h = await jget("/api/qskyway/health");
  assert(h.status === 200 && h.json?.status === "ok", "/health ok", `status=${h.status}`);
  assert((h.json?.buildings ?? 0) >= 300, "digital twin has buildings", `n=${h.json?.buildings}`);
  const vpN = h.json?.vertiports ?? 0;
  assert(vpN >= 5, "vertiports present", `n=${vpN}`);

  const city = await jget("/api/qskyway/city");
  assert(city.status === 200 && Array.isArray(city.json?.buildings), "/city returns twin", `status=${city.status}`);
  assert(Array.isArray(city.json?.grid?.heights) && city.json.grid.heights.length > 0, "/city has height field");

  // route between vp0 and vp1
  const r01 = await jpost("/api/qskyway/route", { from: 0, to: 1 });
  assert(r01.status === 200 && Array.isArray(r01.json?.path) && r01.json.path.length > 1, "route vp0→vp1", `status=${r01.status}`);
  assert(r01.json?.cruiseAltM >= 50 && r01.json?.distanceKm > 0, "route has altitude + distance", `alt=${r01.json?.cruiseAltM} d=${r01.json?.distanceKm}`);

  // multi-city registry
  const cs = await jget("/api/qskyway/cities");
  assert(cs.status === 200 && Array.isArray(cs.json?.cities), "/cities lists registry", `status=${cs.status}`);
  const cityIds = (cs.json?.cities ?? []).map((c) => c.id);
  assert(cityIds.includes("astana") && cityIds.includes("nyc") && cityIds.includes("tokyo"), "registry has astana + nyc + tokyo", cityIds.join(","));

  // clearance invariant across all vertiport pairs, per city
  for (const cid of cityIds) {
    const ch = await jget(`/api/qskyway/city?city=${cid}`);
    const nvp = ch.json?.vertiports?.length ?? 0;
    let pairs = 0, reachable = 0, violations = 0;
    for (let i = 0; i < nvp; i++) for (let j = 0; j < nvp; j++) {
      if (i === j) continue; pairs++;
      const r = await jpost("/api/qskyway/route", { from: i, to: j, city: cid });
      if (r.status === 200 && r.json?.path) {
        reachable++;
        const { alts, obstacles } = r.json;
        for (let k = 0; k < alts.length; k++) if (alts[k] < obstacles[k] + 15) violations++;
      }
    }
    assert(reachable === pairs, `[${cid}] all vertiport pairs routable`, `${reachable}/${pairs}`);
    assert(violations === 0, `[${cid}] corridor clears obstacles + margin`, `violations=${violations}`);
  }

  // ── Phase 4: no-fly, wind, signature, vertiport suitability ──────────────
  const cityP4 = await jget("/api/qskyway/city?city=astana");
  const nofly = cityP4.json?.nofly ?? [];
  assert(Array.isArray(nofly) && nofly.length >= 1, "no-fly zones exposed", `n=${nofly.length}`);
  assert(cityP4.json?._signature?.alg === "Ed25519" && !!cityP4.json?._signature?.contentHash, "twin carries Ed25519 signature");
  // groundMs >= 0, not > 0: a real METAR reading can legitimately be calm (0 m/s).
  assert(cityP4.json?.wind?.groundMs >= 0 && cityP4.json?.wind?.topMs >= cityP4.json?.wind?.groundMs, "layered wind (grows with altitude)", `g=${cityP4.json?.wind?.groundMs} t=${cityP4.json?.wind?.topMs}`);
  assert(["metar", "illustrative"].includes(cityP4.json?.wind?.source), "wind reports its source", `source=${cityP4.json?.wind?.source}`);

  // /health surfaces METAR fetch status (fails soft — this only checks shape, not that the feed is currently up)
  const h2 = await jget("/api/qskyway/health");
  assert(typeof h2.json?.wind?.lastFetchOk === "boolean" && h2.json?.wind?.cities, "/health reports METAR wind status");

  // no-fly avoidance: no path cell may fall inside a zone
  const cell = cityP4.json?.grid?.cell ?? 20;
  let insideCount = 0, checked = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === j) continue; checked++;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "astana" });
    if (r.status !== 200) continue;
    for (const p of r.json.path) {
      const x = (p.c + 0.5) * cell, y = (p.r + 0.5) * cell;
      for (const z of nofly) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) insideCount++;
    }
  }
  assert(insideCount === 0, "routes avoid no-fly zones", `violations=${insideCount} over ${checked} routes`);

  // wind affects ETA (still vs wind differ) + fields present
  const wr = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "astana" });
  assert(typeof wr.json?.etaMinWind === "number" && typeof wr.json?.etaMinStill === "number", "route reports still + wind ETA");
  assert(wr.json?.avgWindMs >= 0, "route reports avg wind", `w=${wr.json?.avgWindMs}m/s`);

  // Ed25519 verify
  const ver = await jget("/api/qskyway/verify?city=nyc");
  assert(ver.status === 200 && ver.json?.valid === true && ver.json?.alg === "Ed25519", "Ed25519 twin signature verifies");

  // ── heights the generator could not vouch for ─────────────────────────────
  // A wrong height tag enters the twin as MEASURED and therefore flies with zero
  // safety clearance: Astana carries height=382 on a 75-storey tower, 4.7x the
  // rest of the city. The product must not present that as an ordinary fact, so
  // the flag has to survive all the way to /city — silently dropping it is the
  // regression this guards.
  const asDq = (await jget("/api/qskyway/city?city=astana")).json?.dataQuality;
  assert(Array.isArray(asDq?.suspect) && asDq.suspect.length >= 1,
    "[astana] height that towers over the city is published, not hidden",
    `suspect=${JSON.stringify(asDq?.suspect)}`);
  assert((asDq?.suspect ?? []).every((o) => o.times > 1 && o.h > 0 && Number.isInteger(o.i)),
    "[astana] each flagged height names the building and how far it stands out");
  // The second shape of the same field, and the one the UI got wrong first: a
  // contradiction record carries `was`/`levels` and no `times`. The page renders
  // the two reasons differently, so an entry missing its discriminator printed
  // "27 m (xundefined)" on Tokyo — a defect no unit test saw, because the data
  // was right and only the pairing of shape to wording was wrong.
  const tkDq = (await jget("/api/qskyway/city?city=tokyo")).json?.dataQuality;
  const contradictions = (tkDq?.suspect ?? []).filter((o) => o.was !== undefined);
  assert(contradictions.length >= 1,
    "[tokyo] a height its own floor count contradicted is reported with what the tag claimed",
    `suspect=${JSON.stringify(tkDq?.suspect)}`);
  assert(contradictions.every((o) => o.levels > 0 && o.h > o.was && o.times === undefined),
    "[tokyo] a contradiction record says was/levels and does NOT pretend to be an outlier");

  // Проверка «городу нечего пометить — он молчит». До 12.08.2026 она была
  // прибита к Нью-Йорку, а он 28.07 получил свои три записи «тег спорит со
  // счётом этажей» (коммит bba3b3e61) — и с тех пор ежедневный смок краснел на
  // ней при исправном продукте. Красная проверка при живой системе хуже
  // отсутствующей: к ней привыкают. Проверяем теперь то, ради чего она писалась,
  // и по всем городам сразу: пустого предупреждения быть не должно, а у каждой
  // записи должен быть ровно один признак — выброс (times) ИЛИ противоречие
  // (was/levels). Именно потеря признака когда-то напечатала «27 м (xundefined)».
  for (const cityId of ["astana", "nyc", "tokyo"]) {
    const dq = (await jget(`/api/qskyway/city?city=${cityId}`)).json?.dataQuality;
    const sus = dq?.suspect;
    assert(sus === undefined || (Array.isArray(sus) && sus.length > 0),
      `[${cityId}] nothing to flag means no field at all, never an empty warning`,
      `suspect=${JSON.stringify(sus)}`);
    assert((sus ?? []).every((o) => (o.times !== undefined) !== (o.was !== undefined)),
      `[${cityId}] every flagged height says WHY in exactly one way — outlier or self-contradiction`,
      `suspect=${JSON.stringify(sus)}`);
  }

  // ── спорная высота против МАРШРУТОВ: два ответа, обязанные совпадать ──────
  // До 12.08.2026 чип в шапке говорил «высоте не верим», а коридор молча на неё
  // закладывался. Само по себе предупреждение теперь есть; здесь проверяется,
  // что оно сходится с тем, что отдаёт движок, — иначе продукт снова начнёт
  // отвечать по-разному в двух местах, и заметит это опять человек.
  // Подстановка по типу застройки — вторая половина того же вопроса о доверии к
  // высотам, и ответ у неё ДРУГОЙ: спорная высота Астаны не задевает ни одного
  // маршрута, а подстановка — больше половины. Догадаться нельзя, поэтому мерим.
  const hs = await jget("/api/qskyway/height-substitution?city=astana");
  assert(hs.status === 200 && hs.json?.available === true,
    "[astana] type-substituted heights are measured against the routes, not just listed",
    `status=${hs.status} available=${hs.json?.available}`);
  assert(hs.json?.buildingsUnderRoutes <= hs.json?.buildings && hs.json?.buildings > 0,
    "[astana] buildings in the data and buildings under corridors are counted separately",
    `${hs.json?.buildingsUnderRoutes} of ${hs.json?.buildings}`);
  assert(hs.json?.pairs === 42 && hs.json?.affectedPairs <= hs.json?.routable,
    "[astana] substitution impact counts both directions of every pad pair",
    `${hs.json?.affectedPairs}/${hs.json?.routable} of ${hs.json?.pairs}`);

  // Те же утверждения по ОСТАЛЬНЫМ городам. Астана здесь богатая (38
  // подстановок), а Нью-Йорк и Токио — по одной, и это не мелочь: дефект
  // счётчика зданий 13.08.2026 не проявлялся именно на городе с единственной
  // подстановкой, где «одно здание» и «одна высота» неразличимы. Проверять
  // надо и вырожденный случай, и богатый.
  for (const c of ["nyc", "tokyo"]) {
    const h = await jget(`/api/qskyway/height-substitution?city=${c}`);
    assert(h.status === 200, `[${c}] substitution impact answers`, `status=${h.status}`);
    if (h.json?.available) {
      assert(h.json.buildingsUnderRoutes <= h.json.buildings && h.json.buildings > 0,
        `[${c}] buildings in the data and buildings under corridors are counted separately`,
        `${h.json.buildingsUnderRoutes} of ${h.json.buildings}`);
      assert(h.json.affectedPairs <= h.json.routable && h.json.pairs === 42,
        `[${c}] substitution impact counts both directions of every pad pair`,
        `${h.json.affectedPairs}/${h.json.routable} of ${h.json.pairs}`);
    } else {
      // Город без подстановок — законный случай, но он обязан объясниться,
      // а не отвечать пустым успехом.
      assert(String(h.json?.note ?? "").length > 0,
        `[${c}] a city without substitutions says so instead of answering blank`);
    }
  }

  const hd = await jget("/api/qskyway/height-dispute?city=astana");
  assert(hd.status === 200 && hd.json?.available === true,
    "[astana] the height the twin distrusts is measured against the routes, not just displayed",
    `status=${hd.status} available=${hd.json?.available}`);
  assert((hd.json?.disputed ?? []).some((d) => d.publishedM > 0 && d.osm),
    "[astana] a disputed height names the OSM object and the figure its own article publishes",
    JSON.stringify(hd.json?.disputed));
  assert(hd.json?.routable > 0 && hd.json.affectedPairs <= hd.json.routable,
    "[astana] the measurement covers every routable pair",
    `${hd.json?.affectedPairs}/${hd.json?.routable}`);
  // Сверка ответов: сколько маршрутов САМИ признают, что подняты спорной
  // высотой, против сетевого замера. Честно про её силу сегодня: обе стороны
  // равны нулю, поэтому проверка ловит ЛОЖНОЕ предупреждение на рейсе (его
  // сетевой замер не подтвердит) и не может поймать пропущенное. Станет
  // двусторонней, как только появится хоть одна затронутая пара — например,
  // если рядом с башней заведут площадку.
  let disputeSeen = 0;
  const astPads = (await jget("/api/qskyway/vertiports?city=astana")).json?.count ?? 0;
  for (let i = 0; i < astPads; i++) for (let j = 0; j < astPads; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "astana" });
    if (r.json?.heightDispute) disputeSeen++;
  }
  assert(disputeSeen === hd.json?.affectedPairs,
    "[astana] every route answers the same as the network-wide measurement",
    `routes=${disputeSeen} measured=${hd.json?.affectedPairs}`);
  // Та же сверка для подстановки, и она СИЛЬНЕЕ соседней: у спорной высоты обе
  // стороны сегодня равны нулю, а здесь затронуто 23 маршрута из 42 — значит
  // проверка ловит расхождение в обе стороны, а не только ложное срабатывание.
  // Считаем по подписанным документам: именно они уедут регулятору, и если
  // сводка города и бумага разойдутся, заметить это должен смок, а не читатель.
  let substSeen = 0, substRoutes = 0;
  for (let i = 0; i < astPads; i++) for (let j = 0; j < astPads; j++) {
    if (i === j) continue;
    const d = await jpost("/api/qskyway/route/justification", { from: i, to: j, city: "astana" });
    if (!d.json?.document) continue;
    substRoutes++;
    if (d.json.document.substitutedHeights) substSeen++;
  }
  assert(substSeen === hs.json?.affectedPairs && substRoutes === hs.json?.routable,
    "[astana] every signed document agrees with the network-wide substitution measurement",
    `documents=${substSeen}/${substRoutes} measured=${hs.json?.affectedPairs}/${hs.json?.routable}`);

  const hdTk = await jget("/api/qskyway/height-dispute?city=tokyo");
  assert(hdTk.json?.available === false,
    "[tokyo] a height the engine already overrode is not paraded as an open dispute",
    `available=${hdTk.json?.available}`);

  // ── Tokyo (third city): no-fly exposed, avoided, twin signs + verifies ────
  const tk = await jget("/api/qskyway/city?city=tokyo");
  const tkNofly = tk.json?.nofly ?? [];
  assert(tk.status === 200 && (tk.json?.buildings?.length ?? 0) >= 300, "[tokyo] twin has buildings", `n=${tk.json?.buildings?.length}`);
  assert(Array.isArray(tkNofly) && tkNofly.length >= 2, "[tokyo] no-fly zones exposed", `n=${tkNofly.length}`);
  const tkCell = tk.json?.grid?.cell ?? 20;
  let tkInside = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "tokyo" });
    if (r.status !== 200) continue;
    for (const p of r.json.path) {
      const x = (p.c + 0.5) * tkCell, y = (p.r + 0.5) * tkCell;
      for (const z of tkNofly) if (Math.hypot(x - z.x, y - z.y) <= z.radiusM) tkInside++;
    }
  }
  assert(tkInside === 0, "[tokyo] routes avoid no-fly zones", `violations=${tkInside}`);
  const tkVer = await jget("/api/qskyway/verify?city=tokyo");
  assert(tkVer.status === 200 && tkVer.json?.valid === true, "[tokyo] Ed25519 twin signature verifies");

  // vertiport suitability scoring
  const vps = await jget("/api/qskyway/vertiports?city=nyc");
  assert(vps.status === 200 && Array.isArray(vps.json?.vertiports) && vps.json.vertiports.length > 0, "vertiport scoring endpoint");
  assert(vps.json.vertiports.every((v) => typeof v.suitability === "number" && typeof v.class === "string"), "each pad has suitability + class");

  // /city embeds the same scoring as vertiportScores (frontend suitability panel reads this,
  // not the standalone /vertiports endpoint — both must agree)
  const cityNyc = await jget("/api/qskyway/city?city=nyc");
  const embedded = cityNyc.json?.vertiportScores ?? [];
  assert(Array.isArray(embedded) && embedded.length === vps.json.vertiports.length, "/city embeds vertiportScores matching /vertiports count", `${embedded.length} vs ${vps.json.vertiports.length}`);
  assert(embedded.every((v) => typeof v.suitability === "number" && typeof v.class === "string"), "embedded scores carry suitability + class");

  // ── Phase 5: height-data provenance + confidence-adjusted clearance ─────────
  const cs2 = await jget("/api/qskyway/cities");
  assert((cs2.json?.cities ?? []).every((c) => c.dataQuality && typeof c.dataQuality.measuredPct === "number" && typeof c.dataQuality.realPct === "number"), "each city reports height dataQuality");
  const hm = await jget("/api/qskyway/health");
  const bm = hm.json?.clearanceModel?.byHeightSourceM ?? {};
  assert(bm.guessed > bm.derived && bm.derived >= bm.measured, "confidence-clearance model configured (guessed > derived >= measured)", `m=${bm.measured} d=${bm.derived} g=${bm.guessed}`);
  const tkq = await jget("/api/qskyway/city?city=tokyo");
  assert(tkq.json?.dataQuality?.total > 0 && Array.isArray(tkq.json?.grid?.src) && tkq.json.grid.src.length === tkq.json.grid.heights.length, "twin carries height-source grid + dataQuality");
  const p5r = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "tokyo" });
  assert(typeof p5r.json?.avgConfClearM === "number" && typeof p5r.json?.heightConfidencePct === "number", "route reports confidence-clearance metrics");
  // confidence clearance is exercised where corridors must cross uncertain buildings.
  // A* prefers open street canyons, so not every pair is padded — scan all pairs.
  let maxPad = 0, padded = 0;
  const tvp = tkq.json?.vertiports?.length ?? 0;
  for (let i = 0; i < tvp; i++) for (let j = 0; j < tvp; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "tokyo" });
    if (r.json?.avgConfClearM > 0) { padded++; if (r.json.avgConfClearM > maxPad) maxPad = r.json.avgConfClearM; }
  }
  assert(padded > 0 && maxPad > 0, "[tokyo] confidence-clearance raises corridors over uncertain buildings", `${padded} routes padded, max=${maxPad}m`);
  // clearance invariant already holds base+conf, so the per-city loop still shows 0 violations

  // ── Честные числа рядом с уверенными (добавлено 27.08.2026) ────────────────
  //
  // Пять полей заведены в тот день, потому что соседнее поле про то же самое
  // говорило иначе, а читатель верит короткому. Без проверок здесь они тихо
  // откатятся, и никто не узнает: юнит-тесты живут в другом наборе, а прод
  // смотрят этим смоуком.
  const hq = await jget("/api/qskyway/health");
  // Эти два утверждения были декоративны ВМЕСТЕ: первое разрешало null
  // безусловно, второе — основание "store-unavailable". То есть при полностью
  // неработающем хранилище оба оставались зелёными, хотя это ровно та поломка,
  // которую они должны ловить (проверено отдельным прогоном предикатов).
  //
  // Смоук гоняется против ЖИВОГО бэкенда, где хранилище доступно. Значит здесь
  // "не смогли посчитать" — это находка, а не допустимый исход.
  assert(typeof hq.json?.slotsBookedLive === "number"
      && hq.json.slotsBookedLive <= hq.json.slotsBooked,
    "health reports live bookings apart from the total",
    `booked=${hq.json?.slotsBooked} live=${hq.json?.slotsBookedLive} basis=${hq.json?.slotsLiveBasis}`);
  assert(hq.json?.slotsLiveBasis === "all" || hq.json?.slotsLiveBasis === "sample-500",
    "health counted the live figure, not gave up on it",
    `basis=${hq.json?.slotsLiveBasis} (store-unavailable means the market could not be read)`);
  // Городская возможность обязана называть города, а идентификаторы — оставаться
  // машинными: строка 60 этого файла сверяет пункт ТОЧНЫМ равенством.
  const scope = hq.json?.featureScope?.["regulatory-airspace-ceilings"];
  assert(Array.isArray(scope) && scope.length > 0 && scope.length < Object.keys(hq.json?.airspace ?? {}).length,
    "city-scoped feature names its cities, and not all of them",
    `scope=${JSON.stringify(scope)}`);
  // `every` на ПУСТОМ массиве истинно всегда — и на отсутствующем поле тоже
  // (проверено отдельно: оба случая давали true). Поэтому сначала требуем, чтобы
  // список вообще был и был непустым, и лишь потом проверяем формат.
  assert(Array.isArray(hq.json?.features) && hq.json.features.length >= 6
      && hq.json.features.every((f) => /^[a-z0-9-]+$/.test(f)),
    "feature ids stay machine-readable (no parentheses)",
    `n=${hq.json?.features?.length} bad=${(hq.json?.features ?? []).filter((f) => !/^[a-z0-9-]+$/.test(f)).join(", ") || "none"}`);

  const ar = await jpost("/api/qskyway/route", { from: 0, to: 3, city: "astana" });
  assert(ar.json?.blindHeight && typeof ar.json.blindHeight.inertPenaltySegments === "number"
      && ar.json.blindHeight.clearedUpToM > 0,
    "route says where the confidence padding did nothing",
    `guessed=${ar.json?.blindHeight?.guessedSegments} inert=${ar.json?.blindHeight?.inertPenaltySegments} cleared<=${ar.json?.blindHeight?.clearedUpToM}m`);
  // Обе стороны, и это не педантизм: первая версия проверяла
  // `=== null || >= avg` — и оставалась ЗЕЛЁНОЙ, когда поле всегда null.
  // Мутация «вернуть null всегда» дала ALL PASS (151/151), то есть утверждение
  // разрешало ровно то, ради чего заведено. Теперь при наличии зданий требуется
  // ЧИСЛО, при их отсутствии — именно null.
  assert(ar.json?.obstacleSegments > 0
      ? (typeof ar.json.confClearOnObstaclesM === "number"
         && ar.json.confClearOnObstaclesM >= ar.json.avgConfClearM)
      : ar.json?.confClearOnObstaclesM === null,
    "padding over buildings is a real figure, not diluted by open ground",
    `obstacleSegments=${ar.json?.obstacleSegments} obstacles=${ar.json?.confClearOnObstaclesM} avg=${ar.json?.avgConfClearM}`);
  assert(ar.json?.noFly && ar.json.noFly.cellsOnPathInsideZone === 0,
    "corridor never crosses a prohibited zone",
    `zones=${ar.json?.noFly?.zonesInCity} inside=${ar.json?.noFly?.cellsOnPathInsideZone}`);
  // `undefined === undefined` истинно, поэтому голого сравнения мало: пропади оба
  // поля разом — утверждение осталось бы зелёным. Требуем, чтобы это были ЛОГИЧЕСКИЕ
  // значения, и только потом сверяем их между собой.
  assert(typeof ar.json?.avoidsNoFly === "boolean"
      && typeof ar.json?.noFly?.directLineCrosses === "boolean"
      && ar.json.avoidsNoFly === ar.json.noFly.directLineCrosses,
    "avoidsNoFly reports the route, not the city",
    `avoids=${ar.json?.avoidsNoFly} directCrosses=${ar.json?.noFly?.directLineCrosses}`);

  // ── Phase 7: regulatory airspace ceilings (real FAA UASFM feed for NYC) ─────
  const asN = cityNyc.json?.airspace;
  assert(asN?.available === true && asN.authority === "FAA", "[nyc] twin carries a real regulator ceiling feed", `authority=${asN?.authority}`);
  assert(asN.cells > 0 && asN.coveragePct >= 90, "[nyc] feed covers the twin", `${asN?.cells} cells, ${asN?.coveragePct}%`);
  assert(asN.minCeilingM === 0 && asN.maxCeilingM > 0, "[nyc] ceilings span from no-auto-authorization to a real limit", `${asN?.minCeilingM}–${asN?.maxCeilingM}m`);
  // Cities without an open regulator feed must say so rather than inventing one.
  const cityAst = await jget("/api/qskyway/city?city=astana");
  assert(cityAst.json?.airspace?.available === false, "[astana] absence of a CEILING grid is reported honestly, not faked");
  // The note must say which thing is missing. Claiming "no regulator source"
  // for a city that sits inside a published prohibited zone was false.
  assert(!/не найдено/.test(cityAst.json?.airspace?.note ?? "") && /permission/.test(cityAst.json?.airspace?.note ?? ""), "[astana] the note names the missing ceiling, not a missing regulator", (cityAst.json?.airspace?.note ?? "").slice(0, 60));

  // Advisory (default) mode must not have changed routability — the verdict is
  // added information, not a new restriction.
  const advis = await jpost("/api/qskyway/route", { from: 1, to: 2, city: "nyc" });
  assert(advis.status === 200 && advis.json?.respectCeiling === false, "[nyc] default route stays advisory", `status=${advis.status}`);
  assert(advis.json?.airspace?.available === true && typeof advis.json.airspace.compliant === "boolean", "[nyc] route carries a ceiling verdict");
  assert(advis.json.airspace.coveragePct >= 90, "[nyc] verdict covers the route", `${advis.json?.airspace?.coveragePct}%`);
  const advAst = await jpost("/api/qskyway/route", { from: 1, to: 2, city: "astana" });
  assert(advAst.json?.airspace?.compliant === null, "[astana] no feed → no verdict (null, not a green tick)");

  // Strict mode: the published ceiling becomes a hard constraint. Every corridor
  // it does return must actually respect it, and pads under a 0 ft ceiling must
  // be unreachable — that is the real regulatory picture, not a bug.
  let strictOk = 0, strictBlocked = 0, strictViolating = 0;
  const nycVp = cityNyc.json?.vertiports?.length ?? 0;
  for (let i = 0; i < nycVp; i++) for (let j = 0; j < nycVp; j++) {
    if (i === j) continue;
    const r = await jpost("/api/qskyway/route", { from: i, to: j, city: "nyc", respectCeiling: true });
    if (r.status === 200) { strictOk++; if (r.json?.airspace?.compliant !== true) strictViolating++; }
    else if (r.status === 422 && r.json?.reason === "airspace-ceiling") strictBlocked++;
  }
  assert(strictOk > 0 && strictViolating === 0, "[nyc] every strict-mode corridor respects the published ceiling", `${strictOk} routed, ${strictViolating} violating`);
  assert(strictBlocked > 0, "[nyc] pads without automatic authorization are refused in strict mode", `${strictBlocked} of ${nycVp * (nycVp - 1)} pairs`);
  const blockedEx = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "nyc", respectCeiling: true });
  assert(blockedEx.status === 422 && blockedEx.json?.airspaceIfUnrestricted?.available === true, "[nyc] ceiling refusal explains what an unrestricted flight would need", `status=${blockedEx.status}`);
  // Cities with no feed must be unaffected by the flag rather than silently blocked.
  const strictAst = await jpost("/api/qskyway/route", { from: 0, to: 1, city: "astana", respectCeiling: true });
  assert(strictAst.status === 200, "[astana] strict flag cannot block a city that has no published ceiling", `status=${strictAst.status}`);

  // The snapshot is frozen data about a rule that changes — the service must be
  // able to say whether it is still current, and must not guess when unchecked.
  const fr = asN.freshness;
  assert(fr && typeof fr.checked === "boolean" && "upToDate" in fr, "[nyc] airspace layer reports a freshness verdict");
  assert(fr.snapshotEffective === asN.effective, "[nyc] freshness verdict names the edition actually routed against", `${fr?.snapshotEffective}`);
  assert(fr.checked === false ? fr.upToDate === null : typeof fr.upToDate === "boolean", "[nyc] unchecked freshness is null, never a silent 'fresh'", `checked=${fr?.checked} upToDate=${fr?.upToDate}`);

  // The ceiling layer is attested too, not just the city twin — otherwise "we
  // routed against FAA edition X" is an unverifiable claim.
  assert(asN._signature?.alg === "Ed25519" && /^[0-9a-f]{64}$/.test(asN._signature?.contentHash ?? ""), "[nyc] airspace layer carries an Ed25519 attestation");
  const sigVer = await jget("/api/qskyway/verify?city=nyc");
  assert(sigVer.status === 200 && sigVer.json?.twin?.valid === true, "[nyc] twin signature verifies", `status=${sigVer.status}`);
  assert(sigVer.json?.airspace?.attested === true && sigVer.json.airspace.valid === true, "[nyc] airspace signature verifies");
  assert(sigVer.json.airspace.contentHash === asN._signature.contentHash, "[nyc] /verify and /city attest the same airspace content");
  assert(sigVer.json.airspace.effective === asN.effective, "[nyc] attestation is bound to the published edition", `${sigVer.json?.airspace?.effective}`);
  const verAst = await jget("/api/qskyway/verify?city=astana");
  assert(verAst.json?.airspace?.attested === false && verAst.json.airspace.valid === null, "[astana] nothing to attest is reported as such, not as invalid");
  assert(verAst.json?.valid === true, "[astana] twin verdict is unaffected by the absent airspace layer");

  // Pads inherit the same published ceiling as the grid they stand on.
  const padCeil = (cityNyc.json?.vertiportScores ?? []).filter((v) => typeof v.ceilingM === "number");
  assert(padCeil.length === nycVp, "[nyc] every pad reports its published ceiling", `${padCeil.length}/${nycVp}`);
  assert(padCeil.some((v) => v.needsAtcCoordination === true), "[nyc] pads under a 0 ft ceiling are flagged for ATC coordination");

  // One signed document an operator can actually file, instead of stitching
  // three responses together by hand.
  const just = await jpost("/api/qskyway/route/justification", { from: 1, to: 2, city: "nyc" });
  assert(just.status === 200 && just.json?.document?.kind === "qskyway.route.justification/2", "[nyc] route justification issued", `status=${just.status}`);
  const jd = just.json.document;
  assert(jd.twinContentHash === cityNyc.json._signature.contentHash, "justification binds the twin actually routed over");
  assert(jd.airspace?.contentHash === asN._signature.contentHash, "justification binds the airspace edition actually obeyed");
  assert(jd.airspace?.effective === asN.effective && jd.airspace?.authority === "FAA", "justification names the authority and edition", `${jd.airspace?.authority} ${jd.airspace?.effective}`);
  assert(typeof jd.airspace?.compliant === "boolean", "justification states the verdict, green or not");
  assert(typeof just.json?.scope === "string" && just.json.scope.includes("НЕ"), "scope limit travels with the document");
  // Бумага обязана называть и то, где обещанный просвет НЕ гарантирован.
  // Добавлено 27.08.2026: до этого документ говорил, где высоту ПОДСТАВИЛИ, но
  // молчал про участки, где страховочный запас съеден полом коридора. На таком
  // маршруте бумага выглядела чистой. Проверяем на Астане: там обмера нет вовсе,
  // и слепой дефолт встречается на каждом коридоре со зданиями.
  const jastana = await jpost("/api/qskyway/route/justification", { from: 0, to: 3, city: "astana" });
  const jda = jastana.json?.document;
  assert(jda?.blindHeight && typeof jda.blindHeight.inertPenaltySegments === "number"
      && typeof jda.blindHeight.guessedSegments === "number"
      && jda.blindHeight.clearedUpToM > 0
      && jda.blindHeight.inertPenaltySegments <= jda.blindHeight.guessedSegments,
    "[astana] filing states where the promised clearance is not guaranteed",
    `guessed=${jda?.blindHeight?.guessedSegments} inert=${jda?.blindHeight?.inertPenaltySegments} cleared<=${jda?.blindHeight?.clearedUpToM}m`);
  // И это поле — ПОД подписью, а не рядом: подмена обязана ломать хеш.
  const jtamper = await jpost("/api/qskyway/route/justification/verify", {
    document: { ...jda, blindHeight: { ...jda.blindHeight, inertPenaltySegments: 0 } },
    attestation: jastana.json.attestation,
  });
  assert(jtamper.json?.valid === false && jtamper.json?.hashValid === false,
    "[astana] rewriting the clearance caveat breaks the signature",
    `valid=${jtamper.json?.valid} hashValid=${jtamper.json?.hashValid}`);
  const jver = await jpost("/api/qskyway/route/justification/verify", { document: jd, attestation: just.json.attestation });
  assert(jver.json?.valid === true && jver.json?.hashValid === true && jver.json?.signatureValid === true, "justification verifies round-trip");
  // Tampering must be caught and attributed: a changed value is a hash failure,
  // not a signature failure, and the two must not be reported as one.
  const tampered = await jpost("/api/qskyway/route/justification/verify", {
    document: { ...jd, cruiseAltM: jd.cruiseAltM + 100 }, attestation: just.json.attestation,
  });
  assert(tampered.json?.valid === false && tampered.json?.hashValid === false, "tampered justification is rejected as a content change", `hashValid=${tampered.json?.hashValid}`);
  const justAst = await jpost("/api/qskyway/route/justification", { from: 0, to: 1, city: "astana" });
  assert(justAst.status === 200 && justAst.json?.document?.airspace === null, "[astana] justification omits an altitude verdict it cannot make");
  assert(/AIP KZ/.test(justAst.json?.document?.permission?.authority ?? ""), "[astana] justification still discloses the prohibition that does apply");
  // Astana has no CEILING grid but does have a published prohibition, so the
  // scope must say which of the two is missing — "нет" alone matched either.
  assert(/потолк/i.test(justAst.json?.scope ?? "") && /ЗАПРЕТНАЯ/.test(justAst.json?.scope ?? ""), "[astana] scope calls the prohibition a prohibition, not a permission regime", (justAst.json?.scope ?? "").slice(0, 90));
  assert(justAst.json?.document?.permission?.kind === "prohibition", "[astana] the SIGNED document carries the prohibition/permission distinction");
  assert(!/требует индивидуального разрешения/.test(justAst.json?.scope ?? ""), "[astana] the filing never says a banned flight merely needs permission");

  // Phase 8: a permission regime is a published rule too — a city with no
  // ceiling grid must not be reported as having no regulator.
  const cityTk = await jget("/api/qskyway/city?city=tokyo");
  const perm = cityTk.json?.airspace?.permission;
  assert(cityTk.json?.airspace?.available === false, "[tokyo] no ceiling grid is published — still reported honestly");
  assert(perm?.available === true && /MLIT/.test(perm.authority ?? ""), "[tokyo] permission regime from the real authority is reported", `${perm?.authority}`);
  assert(perm.basis === "raster-sampled", "[tokyo] permission provenance says it was sampled, not ingested", `basis=${perm?.basis}`);
  assert(perm.coveragePct === 100 && perm.uniform === true, "[tokyo] uniform coverage is stated as uniform, not drawn as a map", `${perm?.coveragePct}%`);
  // Astana: the eAIP publishes a prohibited area that covers the whole twin.
  // Reporting it as "no source" was the module's own worst inaccuracy.
  // The disclaimer is read by every API consumer; it must not still be claiming
  // Astana has no source after the source was found.
  const disc = h.json?.disclaimer ?? "";
  assert(/UAP28/.test(disc) && !/Астана — открытого фида регулятора не найдено/.test(disc), "disclaimer names Astana's real zone rather than claiming none exists", disc.slice(-90));
  const permAst = await jget("/api/qskyway/city?city=astana");
  const pa = permAst.json?.airspace?.permission;
  assert(pa?.available === true && /AIP KZ/.test(pa.authority ?? ""), "[astana] published prohibited area is reported", `${pa?.authority}`);
  assert(pa.kind === "prohibition", "[astana] a prohibition is not rendered as a permission", `kind=${pa?.kind}`);
  // The UI picks its label off this field, so its absence would silently relabel
  // a ban as "needs permission" — the exact collapse the type exists to prevent.
  const pt = (await jget("/api/qskyway/city?city=tokyo")).json?.airspace?.permission;
  assert(pt?.kind === "permission", "[tokyo] permission regime keeps its own kind", `kind=${pt?.kind}`);
  assert(pa.basis === "ingested" && /UAP28/.test(pa.regime ?? ""), "[astana] zone identifier and provenance are stated", `${pa?.regime?.slice(0, 40)}`);
  assert(pa.coveragePct === 100 && /ЗАПРЕТНОЙ/.test(pa.note ?? ""), "[astana] full coverage is stated as prohibition, not as 'needs permission'");
  // A demo circle named after a real restriction must say it is a demo circle.
  const gov = (permAst.json?.nofly ?? []).find((z) => z.id === "nfz-gov");
  assert(gov && /демо/i.test(gov.name ?? ""), "[astana] the placeholder zone is named as a placeholder", gov?.name);
  assert(gov && /UAP28/.test(gov.realityNote ?? "") && /4\.5/.test(gov.realityNote ?? ""), "[astana] the placeholder points at the real published zone it stands in for");
  const cov = cs2.json?.airspaceCoverage ?? (await jget("/api/qskyway/cities")).json?.airspaceCoverage;
  assert(cov?.withRegulatoryLayer === 3 && cov?.withFeed === 1 && cov?.withCeilings === 1 && cov?.withPermissionRegime === 2, "every city has a published rule, and only one of them publishes a feed", `layer=${cov?.withRegulatoryLayer} feed=${cov?.withFeed} ceil=${cov?.withCeilings} perm=${cov?.withPermissionRegime}`);
  assert(Array.isArray(cov?.missing) && cov.missing.length === 0, "nothing is left claiming no regulator source", (cov?.missing ?? []).join(","));
  const justTk = await jpost("/api/qskyway/route/justification", { from: 0, to: 1, city: "tokyo" });
  assert(justTk.json?.document?.permission?.authority && /MLIT/.test(justTk.json.document.permission.authority), "[tokyo] justification carries the permission regime it must disclose");
  // The disclaimer must not contradict the document it is attached to.
  assert(/режим разрешений/.test(justTk.json?.scope ?? "") && !/фида регулятора нет/.test(justTk.json?.scope ?? ""), "[tokyo] scope text matches what the document actually contains");

  // What the ceiling costs across the whole network — the figure the page shows
  // and the pitch quotes, so it must come from the engine, not from a slide.
  const imp = await jget("/api/qskyway/airspace/impact?city=nyc");
  assert(imp.status === 200 && imp.json?.available === true, "[nyc] regulatory impact is measured", `status=${imp.status}`);
  assert(imp.json?.pairs === imp.json?.routable, "[nyc] impact measures every pair, all still routable in advisory mode", `${imp.json?.routable}/${imp.json?.pairs}`);
  assert(imp.json.compliant > 0 && imp.json.compliant < imp.json.pairs, "[nyc] the published ceiling genuinely bites — some pairs comply, some do not", `${imp.json?.compliant}/${imp.json?.pairs}`);
  assert(imp.json.strictRoutable <= imp.json.pairs && imp.json.strictRoutable >= imp.json.compliant, "[nyc] strict-routable sits between compliant and total", `strict=${imp.json?.strictRoutable}`);
  assert(imp.json.padsNeedingAtc >= 1 && !/\d+ площадок стоят/.test(imp.json.note ?? ""), "[nyc] impact note counts pads with correct Russian agreement", imp.json?.note?.slice(-60));
  const impTk = await jget("/api/qskyway/airspace/impact?city=tokyo");
  assert(impTk.json?.available === false, "[tokyo] no ceiling grid means nothing to measure, said plainly");

  // The shipped Bitcoin proof: a proof nobody keeps is a proof that does not
  // exist, so the one for the edition in use must verify with no arguments.
  // The verdict is computed on first ask, not at boot: the route has to reach the
  // OpenTimestamps calendars, and until one answers it legitimately reports
  // pending. Only after bitcoin-confirmed is the verdict cached. Asserting on a
  // cold first request therefore fails on a freshly restarted server and passes
  // on a warm one — which is a property of the clock, not of the code. Poll a
  // bounded number of times, and let the assertions below judge the result.
  let pf = await jget("/api/qskyway/airspace/proof?city=nyc");
  for (let i = 0; i < 12 && pf.json?.verification?.fullyProven !== true; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    pf = await jget("/api/qskyway/airspace/proof?city=nyc");
  }
  assert(pf.status === 200 && pf.json?.contentHash === asN._signature.contentHash, "[nyc] shipped proof is for the edition actually served", `${pf.status}`);
  assert(pf.json?.coversCurrentEdition === true, "[nyc] shipped proof still covers the current edition");
  assert(pf.json?.verification?.ots?.verified === true && pf.json?.verification?.ots?.status === "bitcoin-confirmed", "[nyc] shipped proof verifies against Bitcoin", `block=${pf.json?.verification?.ots?.bitcoinBlockHeight}`);
  assert(pf.json?.verification?.fullyProven === true && pf.json?.bitcoinBlockHeight > 0, "[nyc] edition is trustlessly timestamped", `block=${pf.json?.bitcoinBlockHeight}`);
  // The verdict is cached once Bitcoin-confirmed so a public GET stops calling
  // the OpenTimestamps calendars on every request; the cached answer must be the
  // same answer, not a trimmed one.
  const pf2 = await jget("/api/qskyway/airspace/proof?city=nyc");
  assert(JSON.stringify(pf2.json) === JSON.stringify(pf.json), "[nyc] repeat proof request returns an identical verdict (served from cache)");
  // Anchoring an edition that is already anchored must not stamp again: a public
  // POST into someone else's calendars is an open tap, and a second timestamp
  // over the same hash proves nothing the first one did not.
  const reAnchor = await jpost("/api/qskyway/airspace/anchor", { city: "nyc" });
  assert(reAnchor.status === 200 && reAnchor.json?.reused === true, "[nyc] re-anchoring an already-anchored edition reuses the shipped proof", `reused=${reAnchor.json?.reused}`);
  assert(reAnchor.json?.contentHash === asN._signature.contentHash && (reAnchor.json?.calendars ?? []).length === 0, "[nyc] the reused answer is the same proof and hit no calendars");
  const pfAst = await jget("/api/qskyway/airspace/proof?city=astana");
  assert(pfAst.status === 404, "[astana] no shipped proof where there is no edition to anchor", `status=${pfAst.status}`);

  // Registry bridge. The DB is optional for QSkyway but mandatory for QRight, so
  // both outcomes are legitimate — what must never happen is a success response
  // when nothing was written.
  if (READ_ONLY) {
    skip("[nyc] airspace edition registered in QRight", "READ_ONLY — registry write skipped");
  } else {
  const reg1 = await jpost("/api/qskyway/airspace/register", { city: "nyc" });
  if (reg1.status === 503) {
    assert(!reg1.json?.ok && typeof reg1.json?.error === "string", "registry unavailable is reported as failure, not silent success", "no DB in this env");
  } else {
    assert(reg1.status === 201 || reg1.status === 200, "[nyc] airspace edition registered in QRight", `status=${reg1.status}`);
    assert(reg1.json?.contentHash === asN._signature.contentHash, "registry entry carries the signed layer's hash");
    // Idempotency is on the hash, so a second call must resolve to the same object.
    const reg2 = await jpost("/api/qskyway/airspace/register", { city: "nyc" });
    assert(reg2.json?.alreadyRegistered === true && reg2.json?.qrightObjectId === reg1.json.qrightObjectId, "re-registering the same edition returns the same object, not a duplicate");
  }
  const regAst = await jpost("/api/qskyway/airspace/register", { city: "astana" });
  assert(regAst.status === 422, "[astana] nothing to register without a regulator feed", `status=${regAst.status}`);
  }

  // bad route rejected
  const bad = await jpost("/api/qskyway/route", { from: 0, to: 0 });
  assert(bad.status === 422, "same-vertiport route rejected", `status=${bad.status}`);

  // slot market: capacity 4 then 409, non-overlapping ok
  // routeId must be unique per run — against a persistent (Postgres) store, a
  // fixed id collides with slots booked by earlier runs and books=0 forever.
  const rid = "smoke-route-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const before = await jget("/api/qskyway/slots");
  assert(before.status === 200 && typeof before.json?.count === "number" && Array.isArray(before.json?.slots), "GET /slots lists the market", `count=${before.json?.count}`);
  assert(["postgres", "memory"].includes(before.json?.store), "GET /slots reports its store backend", `store=${before.json?.store}`);
  if (READ_ONLY) {
    // Квитанцию можно проверить и без записи, если рынок не пуст: ручка только
    // читает. Пустой рынок — законный случай, тогда честно пропускаем.
    const any = (before.json?.slots ?? [])[0];
    if (any) {
      const v = await jget(`/api/qskyway/slots/${encodeURIComponent(any.id)}/verify`);
      assert(v.status === 200 && v.json?.matches === true,
        "receipt of an existing slot verifies against the stored record",
        `status=${v.status} matches=${v.json?.matches}`);
      assert(/НЕ якорь/.test(v.json?.scope ?? ""),
        "receipt verification states it is not an external-ledger anchor");
    } else {
      skip("slot receipt verification", "рынок пуст — проверять нечего");
    }
    skip("slot market capacity gate", "READ_ONLY — booking writes skipped");
    console.log(`\n${summary()}`);
    process.exit(failed === 0 ? 0 : 1);
  }
  let okCount = 0, conflict = false;
  // Последний ответ держим ВНЕ цикла: 31.08 подсказка про предел частоты
  // читала `s.status`, а `const s` жила внутри цикла — ReferenceError,
  // причём КАЖДЫЙ раз, потому что аргументы считаются до вызова assert.
  // Прогон умирал здесь, и 14 утверждений хвоста не выполнялись никогда.
  let lastStatus = 0;
  for (let i = 0; i < 5; i++) {
    const s = await jpost("/api/qskyway/slots", { routeId: rid, t0: "2026-07-11T09:00:00Z", t1: "2026-07-11T09:03:00Z", holder: "op" + i });
    lastStatus = s.status;
    if (s.status === 201) okCount++; else if (s.status === 409) conflict = true;
  }
  assert(okCount === 4, "slot market books up to capacity" + rateLimitHint(lastStatus), `booked=${okCount}`);
  assert(conflict, "slot market rejects over-capacity (409)");
  const late = await jpost("/api/qskyway/slots", { routeId: rid, t0: "2026-07-11T10:00:00Z", t1: "2026-07-11T10:03:00Z", holder: "late" });
  assert(late.status === 201, "non-overlapping window bookable", `status=${late.status}`);
  assert(typeof late.json?.slot?.receipt === "string" && late.json.slot.receipt.startsWith("qright:"), "slot issues QRight receipt");
  // Квитанция только что выданной брони обязана сходиться, а несуществующий
  // слот — отвечать «не найден», а не «не сходится»: это разные ответы.
  const vOk = await jget(`/api/qskyway/slots/${encodeURIComponent(late.json.slot.id)}/verify`);
  assert(vOk.status === 200 && vOk.json?.matches === true,
    "fresh receipt verifies against the stored record", `status=${vOk.status} matches=${vOk.json?.matches}`);
  const vMissing = await jget("/api/qskyway/slots/slot-does-not-exist/verify");
  assert(vMissing.status === 404,
    "unknown slot is 'not found', not 'tampered'", `status=${vMissing.status}`);

  const after = await jget("/api/qskyway/slots");
  assert(after.json?.count === before.json.count + okCount + 1, "GET /slots count reflects new bookings", `${before.json.count} → ${after.json?.count}`);
  assert(after.json.slots.some((s) => s.id === late.json.slot.id), "GET /slots list includes the just-booked slot");

  // ── Phase 9: байты, которыми проверяющий проверяет нас ──────────
  //
  // Обе ручки заведены 29.08 и до сих пор жили только в тестах. Их смысл
  // в том, чтобы человек СО СТОРОНЫ мог пересчитать наш хэш: без байтов
  // подпись доказывает лишь, что мы что-то подписали. Молчаливая поломка
  // здесь неотличима от работы — 200 отдаётся в обоих случаях, поэтому
  // проверяем не код ответа, а воспроизводимость.
  const ed = await jget("/api/qskyway/airspace/edition?city=nyc");
  assert(ed.status === 200, "GET /airspace/edition отвечает", `status=${ed.status}`);
  assert(typeof ed.json?.payload === "string" && ed.json.payload.length > 0,
    "редакция публикует сами байты, а не только хэш");
  assert(ed.json?.payloadBytes === Buffer.byteLength(ed.json?.payload ?? "", "utf8"),
    "заявленная длина байтов совпадает с настоящей");
  // `verifyYourself` — ОБЪЕКТ со `steps`, а не массив. Первая версия
  // спрашивала массив и падала на исправном коде; форму спросил у живой
  // ручки, а не вспомнил.
  assert(Array.isArray(ed.json?.verifyYourself?.steps) && ed.json.verifyYourself.steps.length > 0,
    "к байтам приложен рецепт проверки");

  const sp = await jget("/api/qskyway/city/signed-payload?city=nyc");
  assert(sp.status === 200, "GET /city/signed-payload отвечает", `status=${sp.status}`);
  assert(typeof sp.json?.payload === "string" && sp.json.payload.length > 0,
    "подпись твина публикует байты, которые она покрывает");
  assert(sp.json?.payloadBytes === Buffer.byteLength(sp.json?.payload ?? "", "utf8"),
    "длина байтов твина совпадает с настоящей");

  console.log(`\n${summary()}`);
  process.exit(failed === 0 ? 0 : 1);
}
// Запуск только когда файл вызван напрямую. Без этого условия ЛЮБОЙ
// импорт (в том числе из теста) поднимал бы боевой смоук: сеть, брони
// в чужом процессе и process.exit посреди чужого прогона.
if (require.main === module) {
  main().catch((e) => {
    // Падение обязано называть, СКОЛЬКО проверок осталось невыполненными.
    // 31.08 прогон умирал на 147-м из ~155, и это выглядело как одна
    // упавшая проверка: четырнадцать хвостовых не выполнялись НИКОГДА, а
    // заметили это только через сутки. Доля («девять процентов») тут
    // успокаивает, число — нет: у этих четырнадцати нет замены, они в
    // режиме записи и на проде не гоняются.
    let total = 0;
    try {
      const own = require("node:fs").readFileSync(__filename, "utf8");
      // Без регулярки НАМЕРЕННО: при генерации этого файла обратный слэш
      // съелся на границе инструмента, и /\bassert.../ стал символом забоя —
      // совпадений ноль, счётчик молча дал бы 0 и число из сообщения
      // исчезло бы. Подсчёт по подстроке этого класса отказов не имеет.
      total = own.split("assert(").length - 1;
    } catch { /* не смогли посчитать — скажем только выполненные */ }
    console.error("");
    console.error("ПРОГОН ОБОРВАН на проверке " + step +
      (total ? " из примерно " + total + "; НЕ ВЫПОЛНЕНО около " + Math.max(0, total - step) : "") +
      " — это не одна упавшая проверка, а оборванный хвост набора.");
    console.error("smoke crashed:", e);
    process.exit(1);
  });
}

// Открыто ради проверки таблицей случаев: часть из них (чужая ветка на
// нашем порту) руками не воспроизвести, не подняв вторую сессию.
/**
 * Отличить «предел частоты исчерпан» от настоящего отказа.
 *
 * 29.08.2026: второй прогон подряд падал с booked=0 и status=429, а
 * сообщения шли по делу («slot market books up to capacity»). Читается
 * как поломка ветки — я сам перебрал два неверных диагноза, прежде чем
 * посмотрел код ответа. Подсказка стоит одной строки и экономит час.
 */
function rateLimitHint(status) {
  if (status !== 429) return "";
  return " — ПРЕДЕЛ ЧАСТОТЫ (429), а не поломка ветки: смоук выжег свою же квоту. " +
    "Перезапустите сервер или подождите окно предела.";
}

module.exports = { identityVerdict, rateLimitHint };
