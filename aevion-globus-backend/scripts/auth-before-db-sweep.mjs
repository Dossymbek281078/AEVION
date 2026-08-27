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
 * ГРАНИЦА, которую надо знать: проверяется то, что объявлено в спеке
 * /api/openapi.json. Ручка, которой в спеке нет, сюда не попадёт — и это
 * ровно тот случай, когда «ноль находок» означает «не искали».
 *
 * Запуск:
 *   GOOD_DB_URL=$(node scripts/smoke-db-setup.mjs --print-url)  *     node scripts/auth-before-db-sweep.mjs
 *
 * Замер 19.08.2026: 221 ручка, 42 требуют авторизации, 4 отвечают 5xx.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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

// Пути берём ИЗ КОДА, а не из спеки.
//
// Спека /api/openapi.json описывает 295 путей, а определений маршрутов в
// src/routes — 1370. То есть свип по спеке проверял пятую часть и об этом
// молчал: «8 находок» звучало как «на платформе восемь», а означало
// «восемь среди объявленного». Ноль по неполному списку — это «не искали»,
// а не «нечего искать».
function routesFromCode() {
  const SRC = new URL("../src/", import.meta.url);
  const index = readFileSync(new URL("index.ts", SRC), "utf8");
  const importOf = new Map();
  for (const m of index.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/routes\/([\w./-]+)"/g)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) importOf.set(name, m[2]);
    }
  }
  const out = [];
  const unresolved = [];
  for (const m of index.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
    const file = importOf.get(m[2]);
    if (!file) { unresolved.push(m[2]); continue; }
    let src;
    try { src = readFileSync(new URL("routes/" + file + ".ts", SRC), "utf8"); }
    catch { unresolved.push(m[2]); continue; }
    for (const r of src.matchAll(/\w*[Rr]outer\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      const p = (m[1] + r[2]).replace(/\/+$/, "") || "/";
      out.push([r[1].toUpperCase(), p.replace(/:[A-Za-z_]\w*/g, "probe-nonexistent-id")]);
    }
  }
  // Честно печатаем, чего НЕ достали: молчаливый пропуск превращает охват в
  // обещание, которого инструмент не выполняет.
  if (unresolved.length) {
    console.error(`  не разрешено точек монтирования: ${unresolved.length} (${unresolved.slice(0, 4).join(", ")})`);
  }
  return [...new Map(out.map((x) => [x.join(" "), x])).values()];
}

async function pathsFromSpec(base) {
  const r = await fetch(`${base}/api/openapi.json`, { signal: AbortSignal.timeout(20000) });
  const spec = await r.json();
  const out = [];
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    for (const m of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      // Пути с параметрами тоже проверяем: неавторизованному отказ обязан
      // прийти ДО любого поиска, поэтому значение параметра безразлично.
      // Подставляем заведомо несуществующий — тогда с живой базой ответ
      // будет 401 (если авторизация нужна) либо 404 (если нет), и первое от
      // второго отличается однозначно.
      const concrete = p.replace(/\{[^}]+\}/g, "probe-nonexistent-id");
      out.push([m.toUpperCase(), concrete, p]);
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
  const list = routesFromCode();
  console.error(`  ручек всего (параметры подставлены): ${list.length}`);
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
console.log(`\nручек проверено (включая пути с параметрами): ${Object.keys(good.r).length}`);
console.log(`из них требуют авторизации (401 с живой базой): ${needAuth}`);
console.log(`отвечают 5xx вместо 401 при недоступной базе: ${hits.length}\n`);
for (const h of hits) console.log(`  ${String(h.bad).padEnd(4)} ${h.k}`);
writeFileSync("C:/Users/user/AppData/Local/Temp/sweep401.json", JSON.stringify({ good: good.r, bad }, null, 1));
