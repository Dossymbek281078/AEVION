#!/usr/bin/env node
/**
 * Какие ручки отвечают 5xx вместо 401, когда база недоступна.
 *
 * Зачем поведением, а не разбором кода. Тот же вопрос я сначала решал
 * грепом и насчитал 49 обработчиков «с опасным порядком строк». Проба
 * показала другое число и другой состав, причём ошибалась она в ОБЕ стороны:
 *
 *  - лишние: у qpaynet и qcontract порядок строк тот же, а поведение верное —
 *    их инициализаторы поглощают отказ, и выполнение доходит до проверки;
 *  - пропущенные: `POST /api/qpaynet/requests` греп не увидел вовсе, потому
 *    что там ВТОРОЙ инициализатор с другим именем (`ensureRequestsTable`),
 *    а шаблон искал только `ensureTables`.
 *
 * Между формой кода и поведением стоит вызываемая функция, и она решает
 * исход. Поэтому здесь спрашиваем сервер, а не текст.
 *
 * Как устроено: один и тот же локальный бэкенд поднимается ДВАЖДЫ — с живой
 * базой и с заведомо несуществующей. Дефект = «401 с живой базой, 5xx с
 * недоступной». Прод не трогаем вовсе: часть ручек принимает POST, и
 * неавторизованный POST наружу — это риск создать данные, если какая-то из
 * них авторизации не требует.
 *
 * ГРАНИЦА, которую надо знать: проверяются только пути БЕЗ параметров
 * (221 из спеки на 19.08.2026). Ручки вида /masks/:id/revoke сюда не входят,
 * и по ним ответа этот инструмент не даёт.
 *
 * Запуск:
 *   GOOD_DB_URL=$(node scripts/smoke-db-setup.mjs --print-url)  *     node scripts/auth-before-db-sweep.mjs
 *
 * Замер 19.08.2026: 221 ручка, 42 требуют авторизации, 4 отвечают 5xx.
 */
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = "C:/Users/user/aevion-qskyway/aevion-globus-backend";
const GOOD = process.env.GOOD_DB_URL;
const BAD = "postgresql://postgres:postgres@127.0.0.1:5432/aevion_no_such_db_19aug";

async function withServer(port, dbUrl, fn) {
  const srv = spawn("npx ts-node-dev --respawn --transpile-only src/index.ts", {
    shell: true, cwd: ROOT, stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, PORT: String(port), DATABASE_URL: dbUrl },
  });
  const stop = () => spawnSync("taskkill", ["/pid", String(srv.pid), "/T", "/F"], { stdio: "ignore" });
  try {
    const base = `http://127.0.0.1:${port}`;
    const t0 = Date.now();
    let up = false;
    while (Date.now() - t0 < 420000) {
      try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })).ok) { up = true; break; } } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!up) throw new Error("сервер не поднялся");
    console.error(`  поднялся за ~${Math.round((Date.now() - t0) / 1000)} с`);
    return await fn(base);
  } finally { stop(); }
}

// Пути берём из собственной спеки сервиса.
async function paths(base) {
  const r = await fetch(`${base}/api/openapi.json`, { signal: AbortSignal.timeout(20000) });
  const spec = await r.json();
  const out = [];
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    for (const m of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      if (p.includes("{")) continue;           // с параметрами — отдельный разговор
      out.push([m.toUpperCase(), p]);
    }
  }
  return out;
}

async function probe(base, list) {
  const res = {};
  for (const [m, p] of list) {
    try {
      const r = await fetch(base + p, {
        method: m,
        headers: m === "GET" ? {} : { "content-type": "application/json" },
        body: m === "GET" ? undefined : "{}",
        signal: AbortSignal.timeout(12000),
      });
      res[`${m} ${p}`] = r.status;
    } catch { res[`${m} ${p}`] = 0; }
  }
  return res;
}

console.error("[1/2] сервер с ЖИВОЙ базой");
const good = await withServer(4181, GOOD, async (base) => {
  const list = await paths(base);
  console.error(`  ручек без параметров: ${list.length}`);
  const r = await probe(base, list);
  return { list, r };
});

console.error("[2/2] сервер с НЕДОСТУПНОЙ базой");
const bad = await withServer(4182, BAD, (base) => probe(base, good.list));

// Дефект: с живой базой 401, с недоступной 5xx.
const hits = [];
for (const k of Object.keys(good.r)) {
  if (good.r[k] === 401 && bad[k] >= 500) hits.push({ k, good: good.r[k], bad: bad[k] });
}
const needAuth = Object.values(good.r).filter((s) => s === 401).length;
console.log(`\nручек проверено: ${Object.keys(good.r).length}`);
console.log(`из них требуют авторизации (401 с живой базой): ${needAuth}`);
console.log(`отвечают 5xx вместо 401 при недоступной базе: ${hits.length}\n`);
for (const h of hits) console.log(`  ${String(h.bad).padEnd(4)} ${h.k}`);
writeFileSync("C:/Users/user/AppData/Local/Temp/sweep401.json", JSON.stringify({ good: good.r, bad }, null, 1));
