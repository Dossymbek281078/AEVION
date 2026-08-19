#!/usr/bin/env node
/**
 * Какие ручки отвечают 5xx на обычный мусор во входных данных.
 *
 * Этот класс, в отличие от «401 при недоступной базе», виден НА ЖИВОМ ПРОДЕ:
 * робот шлёт ?limit=abc, и вместо «неверный запрос» приходит «у нас
 * сломалось». 4xx — ответ о запросе; 5xx поднимает людей и топит настоящие
 * аварии в шуме.
 *
 * Маршруты берутся ИЗ КОДА (точка монтирования + путь роутера), а не из
 * спеки: спека описывает 295 путей из 1107.
 *
 * Токен получаем регистрацией свежего пользователя — тем же способом, каким
 * это делают смоуки проекта. Без него проверяются только публичные ручки
 * (711 из 1107); с ним — 1027.
 *
 * ГРАНИЦЫ, которые надо знать:
 *  - вложенные роутеры (router.use("/x", subRouter)) не раскрываются; на
 *    19.08.2026 такие есть только у build.ts, и его подручки сюда не входят;
 *  - «чистый» запрос и «мусорный» сравниваются между собой: если ручка
 *    отвечает 5xx на оба, она не считается находкой — там своя поломка.
 *
 * Замер 20.08.2026: 1027 доступных ручек, 4 ломаются от мусора, и причина у
 * всех одна — Number(req.query.x ?? 50). Оператор ?? ловит только отсутствие
 * значения, но НЕ NaN, и NaN уходит прямо в SQL LIMIT. Безопасная форма —
 * Number(req.query.x) || 50: NaN ложен, подставится значение по умолчанию.
 *
 * Запуск:
 *   GOOD_DB_URL=$(node scripts/smoke-db-setup.mjs --print-url)  *     node scripts/junk-input-sweep.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/user/aevion-qskyway/aevion-globus-backend";
const GOOD = process.env.GOOD_DB_URL;

function routesFromCode() {
  const SRC = new URL("file:///" + ROOT + "/src/");
  const index = readFileSync(new URL("index.ts", SRC), "utf8");
  const importOf = new Map();
  for (const m of index.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/routes\/([\w./-]+)"/g)) {
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(/\s+as\s+/).pop().trim();
      if (n) importOf.set(n, m[2]);
    }
  }
  const out = [];
  for (const m of index.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
    const f = importOf.get(m[2]);
    if (!f) continue;
    let src;
    try { src = readFileSync(new URL("routes/" + f + ".ts", SRC), "utf8"); } catch { continue; }
    for (const r of src.matchAll(/\w*[Rr]outer\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      const p = (m[1] + r[2]).replace(/\/+$/, "") || "/";
      out.push([r[1].toUpperCase(), p.replace(/:[A-Za-z_]\w*/g, "probe-id")]);
    }
  }
  return [...new Map(out.map((x) => [x.join(" "), x])).values()];
}

const srv = spawn("npx ts-node-dev --respawn --transpile-only src/index.ts", {
  shell: true, cwd: ROOT, stdio: ["ignore", "ignore", "ignore"],
  env: { ...process.env, PORT: "4183", DATABASE_URL: GOOD },
});
const stop = () => spawnSync("taskkill", ["/pid", String(srv.pid), "/T", "/F"], { stdio: "ignore" });
process.on("exit", stop);
const BASE = "http://127.0.0.1:4183";
const t0 = Date.now();
let up = false;
while (Date.now() - t0 < 420000) {
  try { if ((await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) })).ok) { up = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}
if (!up) { console.log("сервер не поднялся"); process.exit(2); }
console.error(`  поднялся за ~${Math.round((Date.now() - t0) / 1000)} с`);

const list = routesFromCode();
console.error(`  маршрутов: ${list.length}`);

// Мусор, какой присылает обычный робот: неразбираемая дата, буквы вместо
// числа, отрицательный предел, неизвестное поле сортировки.
const JUNK_QS = "?before=zzz&after=zzz&limit=abc&offset=-5&cursor=%20&sort=nope&page=1e9";
const JUNK_BODY = JSON.stringify({ id: [], amount: "не число", when: "zzz", limit: -1, nested: { a: [1, {}] } });

// Токен получаем так же, как это делают смоуки проекта, — регистрацией
// свежего пользователя. Свой JWT на отладочном секрете подписывать не надо:
// это второй способ делать то, что в репозитории уже делается одним.
let TOKEN = null;
try {
  const email = `junk-sweep-${Date.now()}@example.com`;
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Test1234!", name: "Junk Sweep" }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  TOKEN = j.token || j.accessToken || j?.data?.token || null;
} catch {}
console.error(TOKEN ? "  токен получен — ручки за авторизацией тоже проверяются"
                    : "  ТОКЕН НЕ ПОЛУЧЕН — проверены только публичные ручки");

const clean = {}, junk = {};
async function hit(m, p, withJunk) {
  try {
    const auth = TOKEN ? { authorization: `Bearer ${TOKEN}` } : {};
    const r = await fetch(BASE + p + (withJunk && m === "GET" ? JUNK_QS : ""), {
      method: m,
      headers: m === "GET" ? auth : { "content-type": "application/json", ...auth },
      body: m === "GET" ? undefined : (withJunk ? JUNK_BODY : "{}"),
      signal: AbortSignal.timeout(12000),
    });
    return r.status;
  } catch { return 0; }
}
for (const [m, p] of list) {
  const k = `${m} ${p}`;
  clean[k] = await hit(m, p, false);
  // Без токена мимо 401 не пройти; с токеном — проходим и проверяем разбор.
  if (!TOKEN && (clean[k] === 401 || clean[k] === 403)) continue;
  if (clean[k] === 401 || clean[k] === 403) continue;  // и с токеном не пустили
  junk[k] = await hit(m, p, true);
}
const reachable = Object.keys(junk).length;
const hits = Object.keys(junk).filter((k) => junk[k] >= 500 && clean[k] < 500);
console.log(`\nмаршрутов всего: ${list.length}`);
console.log(`доступны без авторизации: ${reachable}`);
console.log(`ломаются от мусора (5xx на мусор, не 5xx на пустой запрос): ${hits.length}\n`);
for (const k of hits) console.log(`  ${junk[k]}  ${k}   (без мусора было ${clean[k]})`);
writeFileSync("C:/Users/user/AppData/Local/Temp/junk-sweep.json", JSON.stringify({ clean, junk }, null, 1));
stop();
