#!/usr/bin/env node
/**
 * DevHub PROD smoke — все 8 вкладок и 15 подвкладок медиа.
 *
 * ⚠️ У ЭТОГО СКРИПТА ЕСТЬ ЦЕНА, И ДО 28.08.2026 ОНА БЫЛА СКРЫТА.
 *
 * Проверка каждой медиа-ручки состояла из двух запросов: с неполным телом
 * (ждём 400 — это бесплатно) и с ПОЛНЫМ, годным телом. Второй запрос на проде,
 * где ключи заданы, выполняется по-настоящему. То есть каждый прогон:
 *
 *   • тратил платную генерацию — озвучка, картинка, звук, музыка;
 *   • отправлял НАСТОЯЩЕЕ письмо на test@example.com (отскок от несуществующего
 *     адреса бьёт по репутации отправителя и жжёт суточный потолок Brevo в 300);
 *   • отправлял НАСТОЯЩИЕ SMS и WhatsApp на +79001234567 — живой номер
 *     постороннего человека;
 *   • создавал в БОЕВОМ магазине платёжную позицию «Smoke Item» за $9.99.
 *
 * При этом сам файл называется prod-smoke, а строка запуска предлагала боевой
 * адрес первым. То есть он приглашал сделать ровно то, чего делать нельзя.
 * След на проде остался: среди проектов DevHub лежат prod-smoke-test,
 * react-preview-smoke, pomodoro retest и cf-pages-test — прогоны были.
 *
 * ТЕПЕРЬ ПО УМОЛЧАНИЮ ТРАТЯЩАЯ ПОЛОВИНА НЕ ВЫПОЛНЯЕТСЯ. Остаются ворота
 * проверки (неполное тело → 400) и чтения — они бесплатны и ничего не шлют.
 * Пропуск виден в выводе и в итоговой строке: молчаливый пропуск превратил бы
 * «не проверяли» в «проверено», а это хуже отсутствия проверки.
 *
 * Запуск:
 *   node scripts/devhub-prod-smoke.js                       # безопасно, по умолчанию
 *   BASE=http://localhost:4001 node scripts/devhub-prod-smoke.js
 *   DEVHUB_SMOKE_ALLOW_SPEND=1 node scripts/devhub-prod-smoke.js   # тратит деньги и шлёт
 *
 * Флаг включать осознанно и вручную. В расписание ставить ТОЛЬКО версию по
 * умолчанию: ежедневная трата и ежедневная отправка постороннему — это решение
 * основателя, а не побочный эффект сторожа.
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

/**
 * Тратящая половина — только по явному флагу. Умолчание безопасное: скрипт
 * зовут и вручную, и (после 28.08) из расписания, а «по умолчанию тратим»
 * означает трату при каждом невнимательном запуске.
 */
const ALLOW_SPEND = process.env.DEVHUB_SMOKE_ALLOW_SPEND === "1";

/**
 * Пишущая половина: создание проекта, правка переменных и файлов, снипеты.
 * Денег не стоит и наружу не шлёт, но ПИШЕТ В БОЕВУЮ БАЗУ, а уборка в конце
 * срабатывает не всегда: на проде до сих пор лежат prod-smoke-test,
 * react-preview-smoke и pomodoro retest — следы прежних прогонов.
 *
 * Поэтому в расписании остаются только чтения и ворота проверки: сторож,
 * который сам ежедневно мусорит в продуктовой базе, — плохой сторож.
 */
const ALLOW_WRITE = process.env.DEVHUB_SMOKE_ALLOW_WRITE === "1";

let passed = 0; let failed = 0; let skipped = 0;
/** Пропуск ВИДЕН. Молчаливый превратил бы «не проверяли» в «проверено». */
function skip(l, why) { skipped++; console.log(`  ○ ${l} — пропущено: ${why}`); }
function ok(l, e)   { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
// Ограничитель темпа — это НЕ ответ на вопрос «работает ли ручка»: её просто
// не спросили. Раньше такой ответ приходил как находка, и пять прогонов
// подряд 28.08 дали три ложные тревоги. Сторож, краснеющий от собственной
// частоты, приучает себя не читать.
//
// Совпадение по ЧИСЛУ целиком, а не по подстроке: иначе под правило попали бы
// подобные числа внутри причины. Пропуск ВИДИМЫЙ и называет причину —
// молчаливого проглатывания здесь нет.
function fail(l, r) {
  if (r && String(r).split(/[^0-9]+/).includes("429")) {
    return skip(l, "ограничитель темпа — проверить не удалось");
  }
  failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`);
}
function info(l, e) { console.log(`  ℹ ${l}${e ? "  " + e : ""}`); }

async function req(method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  const opts = { method, headers, signal: AbortSignal.timeout(12000) };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${BASE}${path}`, opts);
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct: r.headers.get("content-type") || "" };
  } catch (e) {
    return { status: 0, body: {}, ct: "", error: e?.message };
  }
}

// Media test: validates 400 gate, accepts 200/201/503/4xx(API error) for valid input
async function mediaTest(label, path, badBody, goodBody) {
  // 1. Missing field → 400
  const bad = await req("POST", path, badBody);
  if (bad.status === 400) ok(`${label} validation gate → 400`);
  // 429 от НАШЕГО ограничителя темпа — это неотвеченный вопрос, а не находка:
  // ручка не отказалась принять мусор, её просто не спросили. Сторож, который
  // краснеет от собственной частоты, приучает себя не читать. Замер 28.08:
  // пять прогонов подряд дали три ложные находки ровно так.
  else if (bad.status === 429) skip(`${label} validation gate`, "ограничитель темпа — проверить не удалось");
  else fail(`${label} validation gate`, `got ${bad.status}`);

  // 2. Valid input:
  //    200/201 = key configured + success
  //    503     = API key not set (graceful)
  //    4xx     = key configured but external API error (quota/model/etc) — still OK
  //    0       = network timeout — informational only
  if (!ALLOW_SPEND) {
    skip(`${label} — запрос с годным телом`, "тратит деньги или шлёт наружу; DEVHUB_SMOKE_ALLOW_SPEND=1 чтобы выполнить");
    return;
  }
  const good = await req("POST", path, goodBody);
  if (good.status === 200 || good.status === 201) {
    ok(`${label} → configured + 200`, `keys set`);
  } else if (good.status === 503) {
    ok(`${label} → graceful 503`, `API key not set on prod`);
  } else if (good.status >= 400 && good.status < 600) {
    ok(`${label} → key set, external API error`, `status=${good.status}`);
  } else if (good.status === 0) {
    ok(`${label} → network timeout (informational)`, `status=0`);
  } else {
    fail(`${label} unexpected status`, `got ${good.status} ${JSON.stringify(good.body).slice(0, 80)}`);
  }
}

async function run() {
  console.log(`\nDevHub PROD smoke → ${BASE}\n`);

  // ── 1. Health ─────────────────────────────────────────────────────────
  console.log("1. Health");
  const h = await req("GET", "/api/devhub/health");
  if (h.status === 200 && h.body?.status === "ok") ok("GET /devhub/health", `db=${h.body.db}`);
  // Печатаем и КОД, и поле: с 28.08 `status` отражает состояние базы, поэтому
  // деградация приходит как 200 + "degraded". Без поля вывод «✗ health ↳ 200»
  // выглядел бы противоречием и заставлял лезть в код.
  else { fail("GET /devhub/health", `HTTP ${h.status}, status=${h.body?.status ?? "нет поля"}, db=${h.body?.db ?? "?"}`); process.exitCode = 1; return; }

  // ОБЛАСТЬ ОХВАТА. `status: "ok"` говорит только про наше хранилище, а
  // провайдеры проверяются отдельной ручкой. Оговорка добавлена 28.08; если
  // она пропадёт с прода, читатель снова решит, что "ok" покрывает всё.
  //
  // Не FAIL, а информация с проверкой: на старом проде поля ещё нет, и
  // краснеть из-за невыкаченной ветки — ложная тревога.
  if (h.body?.covers === "storage") ok("health называет область охвата", "covers=storage");
  else if (h.status === 200) skip("health называет область охвата", "поля covers нет — ветка не выкачена");

  // ── 1б. Проектные ручки живы (без создания проекта) ──────────────
  //
  // Замер 28.08.2026: смоук упоминал 43 ручки из 92, то есть меньше половины.
  // Большинство непокрытых требуют существующего проекта, а создавать его в
  // расписании нельзя — это запись в боевую базу каждый день.
  //
  // Выход: отсутствующий МАРШРУТ и отсутствующий ПРОЕКТ различаются ТЕЛОМ
  // ответа, а не кодом. Оба дают 404, но:
  //
  //   живой маршрут, нет проекта  ->  {"error":"project not found"}
  //   маршрута нет вовсе          ->  {"error":"route_not_found"}
  //
  // Значит «project not found» доказывает, что маршрут смонтирован И его
  // обработчик отработал. Ничего не создаётся, денег не тратится.
  console.log(String.fromCharCode(10) + "1б. Проектные ручки живы");
  {
    const NOBODY = "00000000-0000-0000-0000-000000000000";
    const SCOPED = [
      "/checkpoints", "/collaborators", "/database", "/files",
      "/deployments", "/github/status", "/github/branches",
      "/domain/status", "/export", "/sdk",
      // Добавлено следом: ручки с ДОПОЛНИТЕЛЬНЫМ параметром отвечают так же —
      // «project not found» до разбора параметра, значит маршрут жив.
      "/env/validate", "/preview-proxy", "/file-binary?path=x",
    ];
    for (const tail of SCOPED) {
      const r = await req("GET", `/api/devhub/projects/${NOBODY}${tail}`);
      const body = JSON.stringify(r.body ?? {});
      if (r.status === 404 && body.includes("project not found")) {
        ok(`маршрут жив: ${tail}`);
      } else if (body.includes("route_not_found")) {
        fail(`маршрут ${tail}`, "маршрута НЕТ на проде");
      } else if (r.status === 503 || r.status === 401) {
        skip(`маршрут ${tail}`, `ответ ${r.status} — проверить не удалось`);
      } else {
        fail(`маршрут ${tail}`, `${r.status} ${body.slice(0, 40)}`);
      }
    }
  }

  // ── 2. Project CRUD ───────────────────────────────────────────────────
  console.log("\n2. Project CRUD");
  // ЖИВОСТЬ ЗАПИСИ БЕЗ ЗАПИСИ. Полный цикл создания пропускается в
  // расписании (пишет в боевую базу), и до 28.08 это значило, что ежедневный
  // сторож НИ РАЗУ не проверял ядро продукта — создание проекта. Пустое тело
  // закрывает главное даром: маршрут существует, дошёл до проверки входных
  // данных и отверг мусор. Не создаётся ничего.
  //
  // Контроль обязателен: выдуманный адрес того же префикса отвечает 404, то
  // есть 400 здесь — свойство ЭТОЙ ручки, а не общий ответ платформы.
  {
    const empty = await req("POST", "/api/devhub/projects", {});
    if (empty.status === 400) ok("POST /projects жив (пустое тело → 400)");
    else if (empty.status === 404) fail("POST /projects", "маршрута нет (404)");
    else fail("POST /projects — проверка входа", `got ${empty.status}`);

    const emptySnip = await req("POST", "/api/devhub/snippets", {});
    if (emptySnip.status === 400) ok("POST /snippets жив (пустое тело → 400)");
    else if (emptySnip.status === 404) fail("POST /snippets", "маршрута нет (404)");
    else fail("POST /snippets — проверка входа", `got ${emptySnip.status}`);
  }

    // ПЛАТНЫЕ ручки — та же проба пустым телом. Дорогая половина не
    // выполняется: обработчик отвергает запрос до вызова модели, значит ни
    // денег, ни записей. Замер 28.08 на проде: /ask -> 400 "question
    // required", /plan -> 400 "idea is required".
    for (const [route, label] of [["/ask", "вопрос к ИИ"], ["/plan", "план проекта"]]) {
      const r = await req("POST", "/api/devhub" + route, {});
      if (r.status === 400) ok(`POST ${route} жив (${label})`);
      else if (r.status === 404) fail(`POST ${route}`, "маршрута нет (404)");
      else fail(`POST ${route} — проверка входа`, `got ${r.status}`);
    }

    // ПРОЕКТНЫЕ POST — проба выдуманным проектом. Прежде чем это добавлять,
    // проверено ПО КОДУ, что каждый обработчик спрашивает проект в первых
    // строках, до всякой работы: у публикации это строка 6037, до неё только
    // чтение проекта. Иначе проба выкатила бы что-нибудь по-настоящему.
    //
    // Замер на проде подтвердил: все три отвечают 404 «project not found».
    for (const tail of ["/apply-template", "/deploy/pages", "/database/provision"]) {
      const r = await req("POST", `/api/devhub/projects/${"00000000-0000-0000-0000-000000000000"}${tail}`, {});
      const body = JSON.stringify(r.body ?? {});
      if (r.status === 404 && body.includes("project not found")) ok(`POST жив: ${tail}`);
      else if (body.includes("route_not_found")) fail(`POST ${tail}`, "маршрута НЕТ на проде");
      else if (r.status === 503) skip(`POST ${tail}`, "хранилище недоступно");
      else fail(`POST ${tail}`, `${r.status} ${body.slice(0, 36)}`);
    }

    // Медийные ручки, отвергающие пустое тело до вызова провайдера.
    for (const route of ["/media/upload-image", "/media/email-template-create", "/media/voice-clone/preview"]) {
      const r = await req("POST", "/api/devhub" + route, {});
      if (r.status === 400) ok(`POST ${route} жив`);
      else if (r.status === 404) fail(`POST ${route}`, "маршрута нет (404)");
      else if (r.status === 503) skip(`POST ${route}`, "провайдер не настроен");
      else fail(`POST ${route} — проверка входа`, `got ${r.status}`);
    }

  // Create
  const created = ALLOW_WRITE
    ? await req("POST", "/api/devhub/projects", { name: `Smoke-${Date.now()}`, stack: "next" })
    : (skip("Project CRUD", "пишет в боевую базу; DEVHUB_SMOKE_ALLOW_WRITE=1 чтобы выполнить"), { status: -1, body: {} });
  let projId = null;
  if (created.status === -1) { /* пропущено осознанно, уже сказано */ }
  else if (created.status === 201 && created.body?.project?.id) {
    projId = created.body.project.id;
    ok("POST /projects → 201", `id=${projId.slice(0, 8)}`);
  } else fail("POST /projects → 201", `${created.status}`);

  if (projId) {
    // Get
    const got = await req("GET", `/api/devhub/projects/${projId}`);
    if (got.status === 200 && got.body?.project?.id === projId) ok("GET /projects/:id → 200");
    else fail("GET /projects/:id", `${got.status}`);

    // List
    const list = await req("GET", "/api/devhub/projects");
    if (list.status === 200 && Array.isArray(list.body?.projects)) ok("GET /projects → 200", `count=${list.body.projects.length}`);
    else fail("GET /projects", `${list.status}`);

    // Patch
    const patched = await req("PATCH", `/api/devhub/projects/${projId}`, { description: "smoke patched" });
    if (patched.status === 200) ok("PATCH /projects/:id → 200");
    else fail("PATCH /projects/:id", `${patched.status}`);

    // Env vars CRUD
    console.log("\n3. Env Vars");
    const envPut = await req("PUT", `/api/devhub/projects/${projId}/env`, { key: "SMOKE_VAR", value: "hello" });
    if (envPut.status === 200) ok("PUT /projects/:id/env → 200");
    else fail("PUT /projects/:id/env", `${envPut.status}`);

    const envGet = await req("GET", `/api/devhub/projects/${projId}/env`);
    if (envGet.status === 200 && typeof envGet.body?.env === "object") ok("GET /projects/:id/env → 200");
    else fail("GET /projects/:id/env", `${envGet.status}`);

    const envDel = await req("DELETE", `/api/devhub/projects/${projId}/env/SMOKE_VAR`);
    if (envDel.status === 200) ok("DELETE /projects/:id/env/:key → 200");
    else fail("DELETE /projects/:id/env/:key", `${envDel.status}`);

    // File CRUD
    console.log("\n4. Files");
    const filePut = await req("PUT", `/api/devhub/projects/${projId}/file`, { path: "smoke.js", content: "// smoke" });
    if (filePut.status === 200 || filePut.status === 201) ok("PUT /projects/:id/file → 200/201");
    else fail("PUT /projects/:id/file", `${filePut.status}`);

    const fileGet = await req("GET", `/api/devhub/projects/${projId}/file?path=smoke.js`);
    if (fileGet.status === 200 && fileGet.body?.file) ok("GET /projects/:id/file → 200");
    else fail("GET /projects/:id/file", `${fileGet.status}`);

    const files = await req("GET", `/api/devhub/projects/${projId}/files`);
    if (files.status === 200 && Array.isArray(files.body?.files)) ok("GET /projects/:id/files → 200", `count=${files.body.files.length}`);
    else fail("GET /projects/:id/files", `${files.status}`);

    // Deployments list
    console.log("\n5. Deployments");
    const depls = await req("GET", `/api/devhub/projects/${projId}/deployments`);
    if (depls.status === 200 && Array.isArray(depls.body?.deployments)) ok("GET /projects/:id/deployments → 200");
    else fail("GET /projects/:id/deployments", `${depls.status}`);

    // GitHub auth gate
    console.log("\n6. GitHub (auth gate)");
    const ghStatus = await req("GET", `/api/devhub/projects/${projId}/github/status`);
    if (ghStatus.status === 401 || ghStatus.status === 200) ok("GET github/status → 401 or 200", `${ghStatus.status}`);
    else fail("GET github/status", `${ghStatus.status}`);

    const ghBranches = await req("GET", `/api/devhub/projects/${projId}/github/branches`);
    if (ghBranches.status === 400 || ghBranches.status === 200 || ghBranches.status === 503) ok("GET github/branches graceful", `${ghBranches.status}`);
    else fail("GET github/branches", `${ghBranches.status}`);

    // Delete project (cleanup)
    const del = await req("DELETE", `/api/devhub/projects/${projId}`);
    if (del.status === 200) ok("DELETE /projects/:id → 200 (cleanup)");
    else info("DELETE /projects/:id", `${del.status} (informational)`);
  }

  // ── 7. Templates ──────────────────────────────────────────────────────
  console.log("\n7. Templates");
  const tmpls = await req("GET", "/api/devhub/templates");
  if (tmpls.status === 200 && Array.isArray(tmpls.body?.templates)) ok("GET /templates → 200", `count=${tmpls.body.templates.length}`);
  else fail("GET /templates", `${tmpls.status}`);

  // ── 8. Agent templates ────────────────────────────────────────────────
  console.log("\n8. Agent Templates");
  const agentTmpls = await req("GET", "/api/devhub/agent/templates");
  if (agentTmpls.status === 200 && Array.isArray(agentTmpls.body?.templates)) ok("GET /agent/templates → 200", `count=${agentTmpls.body.templates.length}`);
  else fail("GET /agent/templates", `${agentTmpls.status}`);

  // ── 9. Snippets ───────────────────────────────────────────────────────
  console.log("\n9. Snippets");
  const tag = `smoke-${Date.now()}`;
  const snip = ALLOW_WRITE
    ? await req("POST", "/api/devhub/snippets", { title: "Smoke", content: "// test", language: "javascript", tags: [tag] })
    : (skip("Snippets", "пишет в боевую базу; DEVHUB_SMOKE_ALLOW_WRITE=1 чтобы выполнить"), { status: -1, body: {} });
  let snipId = null;
  if (snip.status === -1) { /* пропущено осознанно, уже сказано */ }
  else if (snip.status === 201 && snip.body?.snippet?.id) { snipId = snip.body.snippet.id; ok("POST /snippets → 201", `id=${snipId.slice(0,8)}`); }
  else fail("POST /snippets → 201", `${snip.status}`);

  if (snipId) {
    const sg = await req("GET", `/api/devhub/snippets/${snipId}`);
    if (sg.status === 200) ok("GET /snippets/:id → 200");
    else fail("GET /snippets/:id", `${sg.status}`);
    const star = await req("POST", `/api/devhub/snippets/${snipId}/star`);
    if (star.status === 200 && typeof star.body?.stars === "number") ok("POST /snippets/:id/star → 200", `stars=${star.body.stars}`);
    else fail("POST /snippets/:id/star", `${star.status}`);
  }

  const snipList = await req("GET", `/api/devhub/snippets?tag=${encodeURIComponent(tag)}&limit=5`);
  if (snipList.status === 200 && Array.isArray(snipList.body?.snippets)) ok("GET /snippets?tag= → 200");
  else fail("GET /snippets", `${snipList.status}`);

  if (snipId) {
    // Уборка за собой. Пока ручка не выкачена, отличаем «её нет» от «нельзя
    // удалить» по ТЕЛУ: наш обработчик отвечает {"error":"snippet not found"},
    // а отсутствующий маршрут — страницей Express. По одному коду 404 эти два
    // случая неразличимы, и смоук краснел бы на непривезённой починке.
    const rm = await req("DELETE", `/api/devhub/snippets/${snipId}`);
    const ourHandler = rm.body && typeof rm.body === "object" && rm.body.error === "snippet not found";
    if (rm.status === 200) ok("DELETE /snippets/:id → 200 (cleanup)");
    else if (rm.status === 404 && !ourHandler) info("DELETE /snippets/:id", "ручка ещё не выкачена — сниппет останется на полке");
    else fail("DELETE /snippets/:id", `${rm.status} — свой сниппет снять не удалось`);
  }

  const snipBad = await req("POST", "/api/devhub/snippets", { content: "no title" });
  if (snipBad.status === 400) ok("POST /snippets missing title → 400");
  else fail("POST /snippets validation", `${snipBad.status}`);

  // ── 10. Media: TTS ────────────────────────────────────────────────────
  console.log("\n10. Media — TTS");
  await mediaTest("TTS", "/api/devhub/media/tts", {}, { text: "Hello from AEVION DevHub smoke test", voice: "Rachel" });

  // ── 11. Media: Image ──────────────────────────────────────────────────
  console.log("\n11. Media — Image");
  await mediaTest("Image", "/api/devhub/media/image", {}, { prompt: "A futuristic AEVION logo, minimalist", size: "1024x1024" });

  // ── 12. Media: SFX ────────────────────────────────────────────────────
  console.log("\n12. Media — SFX");
  await mediaTest("SFX", "/api/devhub/media/sfx", {}, { text: "door creak sound effect" });

  // ── 13. Media: Music ──────────────────────────────────────────────────
  console.log("\n13. Media — Music");
  await mediaTest("Music", "/api/devhub/media/music", {}, { prompt: "Calm background music for a tech product demo" });

  // ── 14. Media: Voice Clone ────────────────────────────────────────────
  console.log("\n14. Media — Voice Clone");
  const vcBad = await req("POST", "/api/devhub/media/voice-clone", {});
  if (vcBad.status === 400) ok("VoiceClone validation gate → 400");
  else fail("VoiceClone validation", `${vcBad.status}`);

  // ── 15. Media: STT ────────────────────────────────────────────────────
  console.log("\n15. Media — STT");
  const sttBad = await req("POST", "/api/devhub/media/stt", {});
  if (sttBad.status === 400) ok("STT validation gate → 400");
  else fail("STT validation", `${sttBad.status}`);

  // ── 16. Media: Email ──────────────────────────────────────────────────
  console.log("\n16. Media — Email");
  await mediaTest("Email", "/api/devhub/media/email",
    { subject: "test" },
    { to: "test@example.com", subject: "DevHub smoke", htmlBody: "<p>Test email</p>" }
  );

  // ── 17. Media: Email Templates ────────────────────────────────────────
  console.log("\n17. Media — Email Templates");
  const emailTmpls = await req("GET", "/api/devhub/media/email-templates");
  if (emailTmpls.status === 200 || emailTmpls.status === 503) ok("GET /media/email-templates", `${emailTmpls.status}`);
  else fail("GET /media/email-templates", `${emailTmpls.status}`);

  // ── 17б. Каталоги и состояние студии ───────────────────────────────
  // Пять ручек, которые НИЧЕГО не стоят и не зависят от проекта: каталоги
  // моделей, панель возможностей, здоровье провайдеров и остаток кредитов.
  // Добавлены 28.08.2026 — до этого смоук их не спрашивал, хотя на первых двух
  // держатся ОБЕЩАНИЯ посадочной («видео», «3D»): она читает `configured` и
  // показывает раздел только когда провайдер настроен. Отвалится ключ — витрина
  // тихо перестанет обещать, и узнать об этом было неоткуда.
  // 17г. Обещание не спорит с НАШЕЙ ЖЕ пробой.
//
// Замер 29.08.2026, и он неприятнее отдельного случая с доменом: на проде
// ручка providers/health уже отвечала `cloudflare_zone: ok=false, "zone
// status: unknown"`, а панель возможностей рядом объявляла домен живым.
// Проверка БЫЛА — её просто никто не сверял с обещанием.
//
// Поэтому сверка общая: если возможность обещана как live, а её проба
// красная, это расхождение, как бы возможность ни называлась.
try {
  const cr = await req("GET", "/api/devhub/studio/capabilities");
  const pr = await req("GET", "/api/devhub/providers/health");
  const caps = cr.body?.capabilities || [];
  const checks = pr.body?.checks || [];
  const probe = new Map(checks.map((c) => [c.name, c]));
  // Пара «возможность → проба». Только те, где проба действительно есть:
  // выдуманная пара давала бы вечно зелёный результат.
  //
  // Замер 29.08 на ВЫКАЧЕННОМ проде: сходятся пять пар из восьми. Три
  // остальные (3d, translate, github) не мёртвые — возможность 3d и пробы
  // deepl/github появляются в этой же ветке и сойдутся после выкатки.
  // Не убирайте их как лишние: пара, которой сегодня нет, завтра есть.
  const PAIRS = [
    ["domain", "cloudflare_zone"],
    ["video", "replicate"],
    ["3d", "replicate"],
    ["email", "brevo"],
    ["sms", "brevo"],
    ["whatsapp", "brevo"],
    ["translate", "deepl"],
    ["github", "github"],
  ];
  let compared = 0;
  const clash = [];
  for (const [capId, probeName] of PAIRS) {
    const cap = caps.find((c) => c && c.id === capId);
    const chk = probe.get(probeName);
    if (!cap || !chk) continue;
    compared += 1;
    if (cap.status === "live" && chk.ok === false) {
      clash.push(`${capId} обещан live, а проба ${probeName}: ${chk.detail || "не прошла"}`);
    }
  }
  if (compared === 0) {
    skip("обещания против проб", "ни одной пары не сошлось — сверять нечего");
  } else if (clash.length === 0) {
    ok(`обещания не спорят с пробами (сверено пар: ${compared})`);
  } else {
    for (const c of clash) fail("обещание спорит с пробой", c);
  }
} catch (e) {
  skip("обещания против проб", `проверить не удалось: ${String(e).slice(0, 60)}`);
}

// 17в. Обещание домена сверяется с ИМЕНЕМ, а не с нашей же переменной.
//
// Состояние возможности "domain" берётся из DEVHUB_AEVION_BUILD_ZONE_ACTIVE —
// осознанного флага, который человек ставит, «когда зона заработает». Замер
// 29.08.2026: на проде флаг стоял, а у aevion.build НОЛЬ NS-записей. Панель
// говорила «Домен — работает», человек получил бы адрес, который не
// открывается.
//
// Ни один тест кода этого не увидит: код верен, неверна настройка прода.
// Поэтому проверка живёт здесь и спрашивает не нас, а систему имён.
try {
  const capsRes = await req("GET", "/api/devhub/studio/capabilities");
  const caps = capsRes.body?.capabilities || [];
  const dom = caps.find((c) => c && c.id === "domain");
  if (!dom) {
    skip("домен: состояние", "возможности не отдались — сверять нечего");
  } else if (dom.status !== "live") {
    ok(`домен честно не обещан (${dom.status})`);
  } else {
    const dns = await import("node:dns");
    let ns = [];
    try {
      ns = await dns.promises.resolveNs("aevion.build");
    } catch {
      ns = [];
    }
    if (ns.length > 0) ok(`домен обещан и зона делегирована (NS: ${ns.length})`);
    else fail("домен обещан, а зона НЕ делегирована", "у aevion.build ноль NS-записей — снимите DEVHUB_AEVION_BUILD_ZONE_ACTIVE");
  }
} catch (e) {
  skip("домен: состояние", `проверить не удалось: ${String(e).slice(0, 60)}`);
}

console.log("\n17б. Каталоги и состояние студии");
  for (const [label, path, key] of [
    ["каталог видеомоделей", "/api/devhub/media/video/models", "models"],
    ["каталог 3D-моделей", "/api/devhub/media/3d/models", "models"],
    ["панель возможностей", "/api/devhub/studio/capabilities", "capabilities"],
    ["здоровье провайдеров", "/api/devhub/providers/health", "checks"],
    ["остаток кредитов", "/api/devhub/studio/credits", null],
  ]) {
    const r = await req("GET", path);
    if (r.status !== 200) { fail(`GET ${path}`, `${r.status}`); continue; }
    if (key) {
      // Список, а не просто 200: пустой каталог тоже вернул бы 200, и обещание
      // на витрине оказалось бы без содержимого.
      const arr = r.body?.[key];
      if (Array.isArray(arr) && arr.length > 0) ok(`${label} → ${arr.length}`);
      else fail(`${label}`, `поле ${key} пусто или не список`);
    } else if (path.endsWith("/studio/credits")) {
      // Не просто 200: сверяем ДВА СПИСКА в живом ответе. Возможности
      // заводятся в таблице тарифов, а показываются по отдельному списку —
      // 02.09.2026 они разошлись в ТРЁХ местах сразу, и человек тратил бы
      // квоту, которой не видит. Сторожа в тестах читают исходник и до прода
      // не дотягиваются; здесь проверяется то, что реально выкачено.
      const изТаблицы = Object.keys(r.body?.tierInfo?.free || {}).sort();
      const наЭкране = Object.keys(r.body?.usage || {}).sort();
      if (изТаблицы.length === 0) {
        fail(`${label}`, "таблица тарифов не пришла в ответе");
      } else if (изТаблицы.join(",") !== наЭкране.join(",")) {
        const нет = изТаблицы.filter((k) => !наЭкране.includes(k));
        fail(`${label}`, `остаток не показывает: ${нет.join(", ") || "(лишние поля)"}`);
      } else {
        ok(`${label} → ${наЭкране.length} возможностей, списки сходятся`);
      }
    } else ok(`${label} → 200`);
  }

  // ── 18. Media: Payment Link ───────────────────────────────────────────
  console.log("\n18. Media — Payment (Lemon Squeezy)");
  const payBad = await req("POST", "/api/devhub/media/payment-link", {});
  if (payBad.status === 400) ok("Payment validation gate → 400");
  else fail("Payment validation", `${payBad.status}`);

  // Этот запрос СОЗДАЁТ позицию в боевом магазине Lemon Squeezy. Не по расписанию.
  const payGood = ALLOW_SPEND
    ? await req("POST", "/api/devhub/media/payment-link", { name: "Smoke Item", amountCents: 999 })
    : (skip("Payment — создание позиции", "создаёт товар в боевом магазине"), { status: -1, body: {} });
  // Осознанный пропуск НЕ должен краснеть: сторож, дающий FAIL там, где мы
  // сами решили не тратить, приучает не читать его вывод.
  if (payGood.status === -1) { /* пропущено, уже сказано в skip() */ }
  else if (payGood.status === 200 || payGood.status === 201) ok("Payment → configured + 200");
  else if (payGood.status === 503) ok("Payment → graceful 503 (LS keys not set)");
  else if (payGood.status >= 400) ok("Payment → key set, LS API error", `${payGood.status}`);
  else fail("Payment unexpected", `${payGood.status}`);

  // ── 19. Media: SMS ────────────────────────────────────────────────────
  console.log("\n19. Media — SMS");
  await mediaTest("SMS", "/api/devhub/media/sms",
    {},
    { recipient: "+79001234567", content: "DevHub smoke test SMS" }
  );

  // ── 20. Media: WhatsApp ───────────────────────────────────────────────
  console.log("\n20. Media — WhatsApp");
  await mediaTest("WhatsApp", "/api/devhub/media/whatsapp",
    {},
    { contactNumber: "+79001234567", templateId: "1" }
  );

  // ── 21. Media: Translate ──────────────────────────────────────────────
  console.log("\n21. Media — Translate");
  await mediaTest("Translate", "/api/devhub/media/translate",
    {},
    { text: "Hello world", targetLang: "RU" }
  );

  // ── 21b. Media: Gumroad checkout (only live processor) ────────────────
  console.log("\n21b. Media — Gumroad checkout");
  await mediaTest("Gumroad", "/api/devhub/media/gumroad-checkout",
    {},
    { permalink: "aevion-devhub-smoke" }
  );

  // ── 22. Media: Drive ──────────────────────────────────────────────────
  console.log("\n22. Media — Drive");
  const driveBad = await req("POST", "/api/devhub/media/drive-search", {});
  if (driveBad.status === 400 || driveBad.status === 503) ok("Drive validation/config gate", `${driveBad.status}`);
  else fail("Drive validation gate", `${driveBad.status}`);

  const driveGood = await req("POST", "/api/devhub/media/drive-search", { query: "smoke test document" });
  if (driveGood.status === 200 || driveGood.status === 201) ok("Drive search → configured + 200");
  else if (driveGood.status === 503 || driveGood.status === 401) ok("Drive search → graceful not-configured", `${driveGood.status}`);
  else fail("Drive search unexpected", `${driveGood.status}`);

  // ── 23. Project: Validation gates ────────────────────────────────────
  console.log("\n23. Validation gates");
  const projBad = await req("POST", "/api/devhub/projects", {});
  if (projBad.status === 400) ok("POST /projects missing name → 400");
  else fail("POST /projects validation", `${projBad.status}`);

  const projNotFound = await req("GET", "/api/devhub/projects/no-such-id-xyz");
  if (projNotFound.status === 404) ok("GET /projects/:id 404 graceful");
  else fail("GET /projects non-existent", `${projNotFound.status}`);

  // ── Final ─────────────────────────────────────────────────────────────
  console.log(
    `\n${passed + failed} проверок — ${passed} PASS  ${failed} FAIL  ${skipped} пропущено` +
    (skipped && !ALLOW_SPEND
      ? `\nПропущено потому, что тратит деньги или шлёт наружу. Это НЕ «проверено».`
      : "") + "\n"
  );
  // process.exit() поверх незакрытых соединений undici роняет node на Windows
  // ассертом libuv (src/win/async.c:76) — инструмент печатает итог и возвращает
  // 127, то есть код выхода врёт. Воспроизведено на этом же скрипте 28.08.2026.
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((e) => { console.error("crash:", e); process.exitCode = 2; });
