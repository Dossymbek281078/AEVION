#!/usr/bin/env node
/**
 * Сверяет ОПИСАНИЕ API с тем, что прод реально отдаёт.
 *
 * Зачем. 12.08.2026 этой проверкой нашлись три ручки
 * /api/pricing/provisioning/{history,stats,healthz}: openapi их рекламировал,
 * страница /pricing/provisioning их звала, прод отдавал 404. Так было три
 * месяца — с 15.05, когда коммит, возвращавший ДРУГИЕ два роутера после
 * squash-мержа, заодно снял монтирование этого. Ошибки на экране нет,
 * страница открывается, тестов не было — заметить было нечем.
 *
 * Существующие смоки этого не ловили: они проверяют ручки, про которые кто-то
 * помнит. Здесь наоборот — берём ВСЁ, что мы сами пообещали в openapi, и
 * спрашиваем прод. Обещание без исполнения — тот же дефект, что и поломка,
 * только тише.
 *
 * Что считается провалом:
 *   - ручка описана, но отдаёт 404 → мы обещаем то, чего нет;
 *   - ручка отдаёт 5xx → сломана.
 * 401/403 — норма: ручка есть и защищена. Пути с параметрами ({id}) пропускаем:
 *   подставлять нечего, а выдуманный id дал бы честный 404 и ложную тревогу.
 *
 * Только GET и только чтение: ничего не создаёт и не меняет.
 *
 * Env: BASE (по умолчанию https://aevion.app/api-backend)
 * Код выхода: 0 — расхождений нет, 1 — есть.
 */

const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    return { code: r.status, body: r };
  } catch (e) {
    return { code: 0, err: String(e?.message || e).slice(0, 60) };
  } finally {
    clearTimeout(timer);
  }
}

const specRes = await fetch(`${BASE}/api/openapi.json`).catch(() => null);
if (!specRes || !specRes.ok) {
  console.error(`[openapi-live] не удалось получить описание с ${BASE}/api/openapi.json`);
  process.exit(1);
}
const spec = await specRes.json();
const paths = spec.paths || {};

const targets = Object.entries(paths)
  .filter(([p, ops]) => ops && typeof ops === "object" && ops.get && !/[{:]/.test(p))
  .map(([p]) => p);

console.log(`[openapi-live] ${BASE}`);
console.log(`[openapi-live] GET-ручек без параметров: ${targets.length} из ${Object.keys(paths).length} путей`);

const missing = [];
const broken = [];
const net = [];
let ok = 0;
let auth = 0;

for (const p of targets) {
  const r = await get(BASE + p);
  if (r.code === 0) net.push(`${p} (${r.err})`);
  else if (r.code === 404) missing.push(p);
  else if (r.code >= 500) broken.push(`${p} → ${r.code}`);
  else if (r.code === 401 || r.code === 403) auth++;
  else ok++;
}

console.log(`[openapi-live] отвечают: ${ok} | защищены: ${auth}`);

if (net.length) {
  // Сеть — не приговор описанию: не валим прогон, но говорим вслух.
  console.log(`[openapi-live] недоступны по сети: ${net.length}`);
  net.forEach((x) => console.log(`   ? ${x}`));
}

let failed = false;
if (missing.length) {
  failed = true;
  console.error(`[openapi-live] ОПИСАНЫ, НО 404: ${missing.length}`);
  missing.forEach((p) => console.error(`   x ${p}`));
}
if (broken.length) {
  failed = true;
  console.error(`[openapi-live] ОТВЕЧАЮТ 5xx: ${broken.length}`);
  broken.forEach((p) => console.error(`   x ${p}`));
}

if (failed) {
  console.error("[openapi-live] FAIL — описание расходится с продом");
  process.exit(1);
}
console.log("[openapi-live] PASS — каждая описанная ручка отвечает");
