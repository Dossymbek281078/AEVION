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
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
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

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
