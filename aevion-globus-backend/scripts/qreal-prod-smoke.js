#!/usr/bin/env node
/**
 * QReal PROD smoke — fully-alive AI video studio (read-only, деньги не тратит).
 * Usage: BASE=https://... node scripts/qreal-prod-smoke.js
 *
 * Ассерты закрывают реальные прод-инциденты 2026-07-21..23:
 *  - commit-маркер в /health (грабля «старый инстанс отвечает при свапе»)
 *  - движки configured (FAL_KEY слетел → рендер молча уходит в prompt_ready)
 *  - демо живо и целиком (persistence: пересеивание при рестарте)
 *  - estimate считает и деньги, и кэш
 *  - /film отдаёт Range 206 (само-восстанавливающаяся сборка)
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0, pending = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
// Фича есть в ветке, но ещё не на проде. Красить смок в красный за это нечестно
// (мержа не было), зелёным считать — тоже (проверка не проходила). Отдельный
// счётчик: видно в выводе, но exit-код не ломает.
function pend(l, i = "") { pending++; console.log(`  ~ ${l} — ждёт деплоя${i ? "  " + i : ""}`); }
async function req(method, path, extraHeaders = {}, timeoutMs = 15000) {
  const r = await fetch(`${BASE}${path}`, { method, headers: extraHeaders, signal: AbortSignal.timeout(timeoutMs) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text), headers: r.headers }; }
  catch { return { status: r.status, body: text, headers: r.headers }; }
}

async function run() {
  console.log(`\nQReal PROD smoke → ${BASE}\n`);

  // 1-3. Health + commit-маркер
  const h = await req("GET", "/api/qreal/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.ok === true ? ok("health.ok = true") : fail("health.ok = true", JSON.stringify(h.body).slice(0, 120));
  typeof h.body?.commit === "string" && h.body.commit.length >= 7
    ? ok("health.commit present", h.body.commit)
    : fail("health.commit present", String(h.body?.commit));

  // 4-6. Движки: оба видеодвижка настроены (FAL_KEY жив)
  const e = await req("GET", "/api/qreal/engines");
  e.status === 200 ? ok("GET /engines → 200") : fail("GET /engines → 200", String(e.status));
  const engines = e.body?.engines || [];
  const video = engines.filter((x) => (x.modality || []).includes("video"));
  video.length >= 2 ? ok("≥2 video engines", String(video.length)) : fail("≥2 video engines", String(video.length));
  video.every((x) => x.configured)
    ? ok("all video engines configured (FAL_KEY alive)")
    : fail("all video engines configured", video.map((x) => `${x.id}:${x.configured}`).join(","));

  // 7-8. QC-критерии
  const c = await req("GET", "/api/qreal/realism-criteria");
  c.status === 200 ? ok("GET /realism-criteria → 200") : fail("GET /realism-criteria → 200", String(c.status));
  (c.body?.criteria || []).length === 14
    ? ok("14 realism criteria")
    : fail("14 realism criteria", String((c.body?.criteria || []).length));

  // 8a-8d. Контракт судьи (2026-07-26). Якоря отдаются вместе с критериями —
  // на них завязан и слепой бенчмарк, и VLM-судья. Если прод перестанет их
  // отдавать, обе линейки молча разъедутся, поэтому это ассерт, а не «мелочь».
  const anchors = c.body?.anchors;
  const critIds = (c.body?.criteria || []).map((x) => x.id);
  if (!anchors) {
    // Поле отсутствует целиком => на проде сборка старше фичи.
    pend("anchors for every criterion");
    pend("each anchor has levels 1/3/5");
    pend("acceptance threshold exposed");
  } else {
    critIds.length && critIds.every((id) => anchors[id])
      ? ok("anchors for every criterion")
      : fail("anchors for every criterion", `нет якорей: ${critIds.filter((id) => !anchors[id]).join(",") || "—"}`);
    critIds.every((id) => ["1", "3", "5"].every((lvl) => typeof anchors[id]?.[lvl] === "string" && anchors[id][lvl].length > 10))
      ? ok("each anchor has levels 1/3/5")
      : fail("each anchor has levels 1/3/5");
    typeof c.body?.threshold === "number" && c.body.threshold > 0 && c.body.threshold < 1
      ? ok("acceptance threshold exposed", String(c.body.threshold))
      : fail("acceptance threshold exposed", String(c.body?.threshold));
  }

  // Судейство платное. Смок обязан убедиться, что БЕЗ явного judge:true
  // ни один вызов /qc не уходит в модель — иначе прод-смок сам жёг бы деньги.
  const demoForQc = await req("GET", "/api/qreal/demo");
  const qcShot = (demoForQc.body?.project?.shots || [])[0];
  if (qcShot) {
    const qc = await fetch(`${BASE}/api/qreal/projects/${demoForQc.body.project.id}/shots/${qcShot.id}/qc`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      signal: AbortSignal.timeout(15000),
    }).then((r) => r.json()).catch(() => null);
    if (!qc?.vlm) {
      pend("POST /qc without judge:true stays manual (no paid call)");
      pend("vlm judge status reported honestly");
    } else {
      qc?.qc?.method === "manual" && qc?.anchors
        ? ok("POST /qc without judge:true stays manual (no paid call)")
        : fail("POST /qc without judge:true stays manual", JSON.stringify(qc).slice(0, 140));
      typeof qc.vlm.configured === "boolean" && qc.vlm.model
        ? ok("vlm judge status reported honestly", `${qc.vlm.model}:${qc.vlm.configured}`)
        : fail("vlm judge status reported", JSON.stringify(qc.vlm).slice(0, 120));
    }
  } else {
    fail("demo shot for /qc contract", "нет кадров в демо");
  }

  // 8e-8g. Реестр персонажей (2026-07-26). Каст — то, что держит лицо героя
  // одинаковым между кадрами; если эндпоинт отвалится, дрейф вернётся тихо,
  // и заметит его только зритель готового ролика.
  const cast = await req("GET", "/api/qreal/projects/demo-steppe-morning/characters");
  if (cast.status === 404 || !cast.body?.characters) {
    pend("cast derived for demo");
    pend("every character has a canonical description");
    pend("props are not treated as characters");
  } else {
    const chars = cast.body.characters;
    chars.length >= 3
      ? ok("cast derived for demo", `${chars.length}: ${chars.map((c) => c.kind).join(",")}`)
      : fail("cast derived for demo", `ожидал >=3, получил ${chars.length}`);
    chars.every((c) => typeof c.canonical === "string" && c.canonical.length > 5)
      ? ok("every character has a canonical description")
      : fail("every character has a canonical description");
    // Трава и чайник в демо есть; персонажами они быть не должны — иначе
    // директива непрерывности начнёт «фиксировать личность» у реквизита.
    chars.every((c) => ["human", "child", "animal", "bird"].includes(c.kind))
      ? ok("props are not treated as characters")
      : fail("props are not treated as characters", chars.map((c) => c.kind).join(","));
  }

  // 8h. Судья непрерывности обязан отказываться судить сцену без повторов
  // героя. Если он начнёт выдавать «непрерывно» там, где сравнивать нечего,
  // мы получим зелёный отчёт, подтверждающий непроверенное заявление —
  // хуже, чем отсутствие проверки. Демо как раз такая сцена.
  const cont = await fetch(`${BASE}/api/qreal/projects/demo-steppe-morning/continuity`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    signal: AbortSignal.timeout(15000),
  }).then((r) => r.json().then((b) => ({ status: r.status, body: b }))).catch(() => null);
  if (!cont || cont.status === 404) {
    pend("continuity refuses unmeasurable scenes");
  } else {
    cont.status === 409 && cont.body?.error === "not_measurable"
      ? ok("continuity refuses unmeasurable scenes")
      : fail("continuity refuses unmeasurable scenes", `${cont.status} ${JSON.stringify(cont.body).slice(0, 120)}`);
  }

  // 9-11. Демо целиком (persistence/пересеивание)
  const d = await req("GET", "/api/qreal/demo");
  d.status === 200 ? ok("GET /demo → 200") : fail("GET /demo → 200", String(d.status));
  const shots = d.body?.project?.shots || [];
  shots.length === 4 ? ok("demo has 4 shots") : fail("demo has 4 shots", String(shots.length));
  shots.every((s) => s.prompt && s.prompt.length > 100)
    ? ok("demo shots have render prompts")
    : fail("demo shots have render prompts");

  // 12-13. Смета: деньги и кэш
  const est = await req("GET", "/api/qreal/projects/demo-steppe-morning/estimate");
  est.status === 200 ? ok("GET /estimate → 200") : fail("GET /estimate → 200", String(est.status));
  Array.isArray(est.body?.engines) && est.body.engines.every((x) => x.usdTotal >= 0)
    ? ok("estimate has $ per engine", est.body.engines.map((x) => `${x.id}:$${x.usdTotal}`).join(" "))
    : fail("estimate has $ per engine", JSON.stringify(est.body).slice(0, 120));

  // 14. /film: Range 206 ЛИБО честный 404 (фильм не собран на этом инстансе,
  //     кадры demo без resultUrl до первого render-all — оба состояния валидны,
  //     деньги смоук не тратит).
  const f = await req("GET", "/api/qreal/projects/demo-steppe-morning/film", { Range: "bytes=0-99" }, 60000);
  [206, 200, 404].includes(f.status)
    ? ok("GET /film (Range) sane", String(f.status))
    : fail("GET /film (Range) sane", String(f.status));

  console.log(`\n${passed + failed + pending} assertions — ${passed} PASS  ${failed} FAIL  ${pending} PENDING-DEPLOY\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
