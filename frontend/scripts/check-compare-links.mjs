/**
 * Проверка страницы сравнения: у каждой карточки должна быть живая ссылка.
 *
 * Зачем отдельный скрипт. Ссылки в `competitors.ts` — это обычные строки, и
 * ошибка в них не ловится ни типами, ни тестами: страница соберётся, а человек
 * попадёт в никуда. На публичной странице это дороже, чем кажется.
 *
 * Важная деталь, из-за которой наивная проверка врёт: в приложении есть
 * динамический маршрут `app/[id]/page.tsx` — витрина по идентификатору модуля
 * из реестра. Поэтому `/aevion-ip-bureau` РАБОТАЕТ, хотя каталога с таким
 * именем нет. Первая версия этой проверки отрапортовала о «битой ссылке»
 * именно на нём — ложная тревога, и она же показала другое: у бюро есть
 * отдельная страница `/bureau`, которая лучше generic-витрины.
 *
 * Скрипт ничего не меняет. Запуск: node scripts/check-compare-links.mjs
 * Коды выхода: 0 — все ссылки живые, 1 — есть битые.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "..");
const repo = path.resolve(frontend, "..");

const data = fs.readFileSync(path.join(frontend, "src/data/competitors.ts"), "utf8");
const entries = [...data.matchAll(/moduleId:\s*"([^"]+)"[\s\S]*?page:\s*"([^"]+)"/g)]
  .map((m) => ({ moduleId: m[1], page: m[2] }));

const hasDynamicRoute = fs.existsSync(path.join(frontend, "src/app/[id]/page.tsx"));

/** Идентификаторы модулей из реестра — их обслуживает динамический маршрут. */
const registry = (() => {
  const p = path.join(repo, "aevion-globus-backend/src/data/projects.ts");
  if (!fs.existsSync(p)) return new Set();
  const src = fs.readFileSync(p, "utf8");
  return new Set([...src.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]));
})();

const pageExists = (route) => {
  const seg = route.replace(/^\/+|\/+$/g, "");
  if (!seg) return fs.existsSync(path.join(frontend, "src/app/page.tsx"));
  for (const ext of ["tsx", "ts", "jsx", "js"]) {
    if (fs.existsSync(path.join(frontend, "src/app", seg, `page.${ext}`))) return true;
  }
  // Динамический маршрут покрывает только идентификаторы из реестра —
  // произвольную строку он отдаст как 404, поэтому проверяем по списку.
  if (hasDynamicRoute && !seg.includes("/") && registry.has(seg)) return true;
  return false;
};

const broken = entries.filter((e) => !pageExists(e.page));
const viaDynamic = entries.filter(
  (e) => !broken.includes(e) && !fs.existsSync(path.join(frontend, "src/app", e.page.replace(/^\//, ""), "page.tsx")),
);

console.log(`Карточек в таблице: ${entries.length}`);
console.log(`Динамический маршрут /[id]: ${hasDynamicRoute ? "есть" : "НЕТ"}; идентификаторов в реестре: ${registry.size}`);
if (viaDynamic.length) {
  console.log(`\nЖивут через динамический маршрут (своей страницы нет): ${viaDynamic.length}`);
  for (const e of viaDynamic) console.log(`   ${e.moduleId} -> ${e.page}`);
  console.log("   Это не ошибка, но выделенная страница обычно содержательнее витрины.");
}
if (broken.length) {
  console.log(`\nБИТЫЕ ССЫЛКИ: ${broken.length}`);
  for (const e of broken) console.log(`   ${e.moduleId} -> ${e.page}`);
  process.exit(1);
}
console.log("\nВсе ссылки ведут на существующие страницы.");
