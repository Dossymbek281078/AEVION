#!/usr/bin/env node
// Сверка публичной документации API с тем, что на самом деле зарегистрировано.
//   node scripts/api-docs-drift.mjs
//
// Отчёт, а не гейт: часть расхождений — решение о составе публичного API,
// а не опечатка, и чинить их «чтобы стало зелено» нельзя.
//
// Почему проверка вообще нужна. Страницы /developers и /pricing/api-pricing
// продают доступ к API. Путь на них — обещание, по которому человек пишет код.
// Ошибка здесь не роняет наш сервис: она роняет чужую интеграцию, и узнаём мы
// об этом от разработчика, который уже потратил вечер.
//
// Срез 12.08.2026: обещано 65 путей, не разрешается 26. Расхождения ДВУХ
// разных видов, и лечатся они по-разному:
//
//   1. Ручка ЕСТЬ, но под другим префиксом — документация показывает не туда.
//      Подтверждено ДВА пути (сверкой тела обработчика, не имени):
//        /api/bureau/protect        → pipelineRouter.post("/protect")
//        /api/bureau/protect-batch  → pipelineRouter.post("/protect-batch")
//      В bureauRouter этих обработчиков нет вовсе, а pipeline делает ровно
//      поток IP Bureau: объект QRight + Quantum Shield + сертификат.
//
//   2. Ручки по обещанному адресу нет — остальные 24. Выбор за владельцем
//      продукта: завести или убрать из документации. Скрипт намеренно НЕ
//      предлагает второе автоматически.
//
//   🔴 Ловушка, в которую я попал первым: СОВПАДЕНИЕ ПОСЛЕДНЕГО СЕГМЕНТА НЕ
//   ОЗНАЧАЕТ ТУ ЖЕ ОПЕРАЦИЮ. Сначала к виду 1 у меня попали пять путей — по
//   тому, что где-то в бэкенде нашёлся обработчик с таким же именем. Три
//   оказались чужими: ventures.post("/submit") принимает питч стартапа, а не
//   артефакт Planet; auth.post("/register") регистрирует пользователя, а не
//   объект QRight; qcoreai.post("/batch") — пакетные задачи ИИ, а не пакетная
//   подпись. "/submit", "/register", "/batch", "/verify", "/history" есть в
//   пяти-шести роутерах каждый. Сверять по телу обработчика: иначе «починка
//   адреса» молча отправит интегратора в чужую ручку.
//
// Чего проверка НЕ умеет и где врала при написании (чтобы не повторять):
//   • роутер может стоять третьим аргументом после middleware —
//     app.use("/api/qcoreai", requireModule("qcoreai"), qcoreaiRouter).
//     Регулярка «второй аргумент» объявляла живые ручки несуществующими;
//   • часть ручек висит прямо на app, без роутера (app.get("/api/openapi.json"));
//   • :id, {id} и ПЛЕЙСХОЛДЕР_КАПСОМ из примеров — одно и то же место под
//     значение, иначе каждый пример считался бы отдельной ручкой.
//   Из-за этих трёх первый прогон показал 32 расхождения вместо 26 — то есть
//   шесть живых ручек были объявлены мёртвыми. Прежде чем верить числу отсюда,
//   проверяйте выборку грепом по исходникам бэкенда.

// Сверка: каждая ручка, обещанная на страницах документации, должна быть
// зарегистрирована на бэкенде. Статически — без сети.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/user/aevion-money";
const DOCS = [
  "frontend/src/app/developers/page.tsx",
  "frontend/src/app/pricing/api-pricing/page.tsx",
];

const promised = new Map();
for (const rel of DOCS) {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of text.matchAll(/\/api\/[a-z0-9][a-z0-9/_.:{}-]*/gi)) {
    const p = m[0].replace(/\/+$/, "");
    if (p.length < 6) continue;
    if (!promised.has(p)) promised.set(p, new Set());
    promised.get(p).add(rel.split("/").slice(-2)[0]);
  }
}

const BSRC = path.join(ROOT, "aevion-globus-backend/src");
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules") continue;
    const f = path.join(d, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.ts$/.test(e)) out.push(f);
  }
  return out;
}
const files = walk(BSRC);

// Роутер — ПОСЛЕДНИЙ идентификатор в use(...): между путём и роутером часто
// стоит middleware, например app.use("/api/qcoreai", requireModule("qcoreai"),
// qcoreaiRouter). Регулярка «второй аргумент» ловила requireModule и объявляла
// живые ручки несуществующими.
const mounts = [];
const handlers = [];
for (const f of files) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/\b([A-Za-z_$][\w$]*)\.use\(\s*["'`](\/[^"'`]*)["'`]\s*,([^;]*?)\)\s*;/g)) {
    const args = m[3];
    const ids = [...args.matchAll(/([A-Za-z_$][\w$]*)\s*(?:,|$)/g)].map((x) => x[1]);
    const child = ids[ids.length - 1];
    if (child) mounts.push({ parent: m[1], prefix: m[2], child });
  }
  for (const m of t.matchAll(/\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]*)["'`]/g)) {
    handlers.push({ routerVar: m[1], subpath: m[3] });
  }
}

const registered = new Set();
const addPath = (p) => registered.add(p.replace(/\/+$/, "") || "/");
function expand(prefix, routerVar, depth, seen = new Set()) {
  const key = routerVar + "@" + prefix;
  if (depth > 6 || seen.has(key)) return;
  seen.add(key);
  for (const h of handlers) {
    if (h.routerVar === routerVar) addPath(prefix + (h.subpath === "/" ? "" : h.subpath));
  }
  for (const m of mounts) {
    if (m.parent === routerVar) expand(prefix + m.prefix, m.child, depth + 1, seen);
  }
}
for (const m of mounts) if (m.parent === "app") expand(m.prefix, m.child, 0);
// Часть ручек висит прямо на app, без роутера: app.get("/api/openapi.json").
// Обход только по монтированиям их не видит и объявляет несуществующими.
for (const h of handlers) if (h.routerVar === "app" && h.subpath.startsWith("/")) addPath(h.subpath);

// :id, {id} и ПЛЕЙСХОЛДЕРЫ_КАПСОМ — всё это одно и то же «сюда подставят
// значение». Без последнего /api/bureau/verify/CERT_ID из примера в
// документации считался бы отдельной несуществующей ручкой.
const norm = (p) =>
  p
    .replace(/\{[^}]*\}?/g, "*")
    .replace(/:[^/]+/g, "*")
    .split("/")
    .map((s) => (/^[A-Z][A-Z0-9_]{2,}$/.test(s) ? "*" : s))
    .join("/")
    .replace(/\/+$/, "")
    .toLowerCase();
const regNorm = new Set([...registered].map(norm));

const missing = [];
for (const [p, pages] of promised) if (!regNorm.has(norm(p))) missing.push({ p, pages: [...pages] });
missing.sort((a, b) => a.p.localeCompare(b.p));

console.log(`обещано на страницах: ${promised.size}`);
console.log(`зарегистрировано на бэкенде: ${registered.size}`);
console.log(`\nОБЕЩАНО, НО НЕ НАЙДЕНО: ${missing.length}`);
for (const m of missing) console.log(`  ${m.p}   [${m.pages.join(", ")}]`);
