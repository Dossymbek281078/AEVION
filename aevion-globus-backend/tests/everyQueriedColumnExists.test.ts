// Каждая колонка, которую код запрашивает, должна существовать в CREATE TABLE.
//
// Пять дефектов 19.08.2026, все — «ручка не работала НИКОГДА»:
//   BuildDocument       — код писал verified*/rejectReason, таблица ведёт
//                         reviewed*/reviewNote. Три ручки документов, 500.
//   BuildSafetyBriefing — код писал workerId/items, таблица хранит
//                         userId/itemsJson. Подпись инструктажа не сохранялась.
//   BuildPortfolioPhoto — ORDER BY "sortOrder", колонки нет. Фотографии
//                         портфолио не показывались ни разу.
//
// Почему это не ловилось ничем: TypeScript проверяет SQL как СТРОКУ, тесты в
// эти ручки не ходят, а Sentry-запись «column does not exist» неотличима от
// шума. Видно только сверкой с CREATE TABLE.
//
// Точность прибора важнее охвата: первая версия давала 12 срабатываний, из них
// 7 — шум (псевдонимы AS "n" в ORDER BY, EXTRACT(... FROM "колонка"), имена
// временных выборок). Всегда-красный сторож отключают в первый же день,
// поэтому проверяются только позиции, где имя ОБЯЗАНО быть колонкой.

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");
const walk = (d: string, a: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (p.endsWith(".ts")) a.push(p);
  }
  return a;
};
const files = walk(SRC).map((p) => ({ p, s: readFileSync(p, "utf8") }));

// колонки каждой таблицы
const cols = new Map<string, Set<string>>();
for (const { s } of files) {
  for (const m of s.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"\s*\(([\s\S]*?)\n\s*\)\s*;/g)) {
    const set = cols.get(m[1]) ?? new Set<string>();
    for (const c of m[2].matchAll(/^\s*"(\w+)"/gm)) set.add(c[1]);
    cols.set(m[1], set);
  }
}
for (const { s } of files) {
  for (const m of s.matchAll(/ALTER TABLE "(\w+)"\s+ADD COLUMN (?:IF NOT EXISTS )?"(\w+)"/g)) {
    (cols.get(m[1]) ?? cols.set(m[1], new Set()).get(m[1])!).add(m[2]);
  }
}

const problems: string[] = [];
let checked = 0;
for (const { p, s } of files) {
  for (const m of s.matchAll(/`([^`]{20,1500})`/g)) {
    const q = m[1];
    if (!/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(q)) continue;
    // EXTRACT(EPOCH FROM "col") — колонка внутри функции, не таблица
    const sql = q.replace(/EXTRACT\s*\([^)]*\)/gi, " ");
    const tabs = new Set([...sql.matchAll(/(?:FROM|INTO|UPDATE|JOIN)\s+"(\w+)"/g)].map((x) => x[1]));
    if (tabs.size !== 1) continue;                       // соединения пропускаем: неоднозначно
    const t = [...tabs][0];
    const known = cols.get(t);
    if (!known) continue;
    checked++;

    const used = new Set<string>();
    for (const ins of sql.matchAll(new RegExp(`INSERT INTO\s+"${t}"\s*\(([^)]*)\)`, "gi")))
      for (const c of ins[1].matchAll(/"(\w+)"/g)) used.add(c[1]);
    for (const c of sql.matchAll(/(?:SET|,)\s*"(\w+)"\s*=/gi)) used.add(c[1]);
    for (const c of sql.matchAll(/(?:WHERE|AND|OR)\s+"(\w+)"\s*(?:=|<|>|!=|IS|IN|LIKE)/gi)) used.add(c[1]);
    for (const c of sql.matchAll(/ORDER BY\s+"(\w+)"/gi)) used.add(c[1]);
    const sel = sql.match(/SELECT\s+([\s\S]*?)\s+FROM\b/i);
    if (sel) {
      const body = sel[1].replace(/\sAS\s+"(\w+)"/gi, " ").replace(/\)\s*"(\w+)"/g, " ");
      for (const c of body.matchAll(/"(\w+)"/g)) used.add(c[1]);
    }
    // псевдонимы, объявленные этим же запросом, колонками не являются
    const aliases = new Set([...sql.matchAll(/\sAS\s+"(\w+)"/gi)].map((x) => x[1]));
    const bad = [...used].filter((c) => c !== t && !known.has(c) && !aliases.has(c)).sort();
    if (bad.length) {
      const line = s.slice(0, m.index ?? 0).split("\n").length;
      problems.push(`${path.relative(SRC, p).split(path.sep).join("/")}:${line} ${t} <- ${bad.join(",")}`);
    }
  }
}

describe("колонки в запросах существуют в таблицах", () => {
  test("предохранитель: сканер разобрал таблицы и проверил запросы", () => {
    // Пустые множества дали бы вечно зелёный тест, ничего не проверяющий.
    expect(cols.size).toBeGreaterThan(100);
    expect(checked).toBeGreaterThan(50);
  });

  test("нет запросов к несуществующим колонкам", () => {
    expect(problems).toEqual([]);
  });
});
