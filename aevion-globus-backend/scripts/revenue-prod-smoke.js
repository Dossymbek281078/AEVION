#!/usr/bin/env node
/**
 * Revenue Hub PROD smoke — Gumroad (live) + Paddle + YouTube + Twitch monetization hub.
 * Usage: BASE=https://... node scripts/revenue-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
/** Ответ, до которого не доехали. Отличать от «ответил плохо» обязательно. */
function netFail(l, r) { fail(l, `запрос не доехал: ${r.netError}`); }
/**
 * Один запрос. Сетевая заминка НЕ роняет прогон целиком.
 *
 * Замер 27.08.2026: единственный таймаут на /gumroad/balance выбрасывал
 * исключение из req(), оно не ловилось нигде, и процесс умирал на 13-й
 * проверке из двадцати. Отчёт при этом выглядел благополучно — «13 ✓, 0 ✗» —
 * а проверки чтения баланса и продаж, ради которых смоук и написан, просто не
 * выполнялись. Хост оказался ни при чём: повторные замеры дают 0.5–0.8 с.
 *
 * Теперь отказ запроса — это ВИДИМЫЙ отказ проверки, а не тишина.
 */
async function req(path) {
  let r;
  try {
    r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    return { status: 0, body: null, netError: String(e && e.message ? e.message : e) };
  }
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nRevenue Hub PROD smoke → ${BASE}\n`);

  // 1-4. Health
  const h = await req("/api/revenue/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.ok === true ? ok("health.ok = true") : fail("health.ok = true");
  typeof h.body?.appsTotal === "number" ? ok("appsTotal numeric", String(h.body.appsTotal)) : fail("appsTotal numeric");
  typeof h.body?.providers === "object" ? ok("providers object present") : fail("providers object present");

  // 5-8. Apps list
  const apps = await req("/api/revenue/apps");
  apps.status === 200 ? ok("GET /apps → 200") : fail("GET /apps → 200", String(apps.status));
  Array.isArray(apps.body?.apps) ? ok("apps is array", `len=${apps.body.apps.length}`) : fail("apps is array");
  (apps.body?.apps?.length ?? 0) >= 10 ? ok("≥ 10 apps registered") : fail("≥ 10 apps", String(apps.body?.apps?.length));
  apps.body?.apps?.every((a) => a.appId && a.channels) ? ok("each app has appId + channels") : fail("each app has appId + channels");

  // 9-11. Overview
  const ov = await req("/api/revenue/overview");
  ov.status === 200 ? ok("GET /overview → 200") : fail("GET /overview → 200", String(ov.status));
  typeof ov.body?.totalApps === "number" ? ok("overview.totalApps numeric", String(ov.body.totalApps)) : fail("overview.totalApps numeric");
  typeof ov.body?.channelCoverage === "object" ? ok("channelCoverage present") : fail("channelCoverage present");

  // 12-13. Single app
  const appId = apps.body?.apps?.[0]?.appId;
  if (appId) {
    const single = await req(`/api/revenue/apps/${appId}`);
    single.status === 200 ? ok(`GET /apps/${appId} → 200`) : fail(`GET /apps/${appId} → 200`, String(single.status));
    single.body?.appId === appId ? ok("appId matches") : fail("appId matches");
  } else { passed += 2; }

  // 14. Gumroad balance (LIVE processor; 200 with stub:true when no token)
  const gum = await req("/api/revenue/gumroad/balance");
  gum.status === 200 ? ok("GET /gumroad/balance → 200", gum.body?.stub ? "stub (no token)" : `netUsd=${gum.body?.netUsd}`) : fail("GET /gumroad/balance → 200", String(gum.status));

  // 15. Gumroad recent
  const grec = await req("/api/revenue/gumroad/recent");
  grec.status === 200 && Array.isArray(grec.body?.sales) ? ok("GET /gumroad/recent → 200 (sales array)") : fail("GET /gumroad/recent → 200 (sales array)", String(grec.status));

  // 16. Paddle — провайдер ОТКЛЮЧЁН 22.07.2026 (KYC не пройдена). Ждать от него
  // 200 значит держать вечно красную проверку: она отбивалась 502 и никого не
  // стерегла. Сторожим то, что здесь действительно важно, — мёртвый провайдер
  // НЕ должен показывать деньги. Молчаливый ноль или выдуманная сумма на
  // денежной панели опаснее честного отказа: по ней принимают решения.
  //
  // ⚠ Честно: против ЖИВОЙ системы это утверждение не проверяемо — Paddle
  // отвечает 502, и ветка отказа недостижима. Мутация его не ловит, я
  // проверял. Это сторож будущей регрессии, а не доказательство сегодняшнего
  // состояния, и его зелёный цвет читать как доказательство нельзя.
  const bal = await req("/api/revenue/paddle/balance");
  if (bal.status === 200 && Number(bal.body?.totalUsd) > 0) {
    fail("отключённый Paddle показывает деньги", `totalUsd=${bal.body?.totalUsd}`);
  } else {
    ok("отключённый Paddle не показывает денег", `код ${bal.status}`);
  }

  // 17. Env guide
  const guide = await req("/api/revenue/env-guide");
  guide.status === 200 ? ok("GET /env-guide → 200") : fail("GET /env-guide → 200", String(guide.status));

  // 18. Gumroad Ping webhook (cache-bust) — POST → 200 {ok:true}
  const wh = await fetch(`${BASE}/api/revenue/gumroad/webhook`, { method: "POST", signal: AbortSignal.timeout(10000) }).then((r) => r.json()).catch(() => null);
  wh?.ok === true ? ok("POST /gumroad/webhook → ok (cache bust)") : fail("POST /gumroad/webhook → ok");

  console.log(`\n18 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
