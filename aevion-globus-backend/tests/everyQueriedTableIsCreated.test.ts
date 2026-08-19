// Каждая таблица, которую код ЗАПРАШИВАЕТ, должна создаваться кодом же.
//
// Два дефекта одного дня (19.08.2026), оба нашлись только зондом по проду:
//
//   AppSubscription — объявлена ТОЛЬКО в prisma/schema.prisma. На проде её нет,
//     и /api/apps/access отвечал 500 на любой настоящий адрес почты. В неё
//     пишут оба обработчика покупок: денежный путь шёл через таблицу-призрак.
//
//   SkillBadge — не существует вовсе: создаётся "BuildSkillBadge", и колонок
//     "testTitle"/"status" нет ни в одной таблице. Запрос не мог выполниться
//     НИКОГДА, а `catch {}` это прятал — человек с заработанными значками
//     получал «привяжите профиль QBuild».
//
// Общее: «модель есть в схеме» и «таблица есть в базе» — разные утверждения,
// и ничто их не связывало. В этом репозитории схему ведут КОДОМ (216 CREATE
// TABLE IF NOT EXISTS против нуля применённых миграций Prisma), поэтому
// источник истины здесь — код, а не schema.prisma.

import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const files = walk(SRC).map((p) => ({ p, s: readFileSync(p, "utf8") }));

const created = new Set<string>();
for (const { s } of files) {
  for (const m of s.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/g)) created.add(m[1]);
}

const referenced = new Map<string, string[]>();
for (const { p, s } of files) {
  // EXTRACT(EPOCH FROM "endedAt") — это КОЛОНКА внутри функции, не таблица.
  // Без этого выреза сторож краснел на живом коде, то есть был бы отключён
  // в первый же день.
  const sql = s.replace(/EXTRACT\s*\([^)]*\)/gi, " ");
  for (const m of sql.matchAll(/(?:\bFROM|\bINTO|\bUPDATE|\bJOIN)\s+"(\w+)"/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], []);
    referenced.get(m[1])!.push(path.relative(SRC, p));
  }
}

describe("таблицы, которые запрашивает код, создаются кодом", () => {
  test("предохранитель: сканер действительно что-то нашёл", () => {
    // Иначе пустые множества дали бы вечно зелёный тест, ничего не проверяющий.
    expect(created.size).toBeGreaterThan(100);
    expect(referenced.size).toBeGreaterThan(100);
  });

  test("нет запросов к таблицам, которых никто не создаёт", () => {
    const missing = [...referenced.entries()]
      .filter(([t]) => !created.has(t))
      .map(([t, where]) => `${t} <- ${[...new Set(where)].join(", ")}`);
    expect(missing).toEqual([]);
  });

  test("AppSubscription создаётся кодом, а не только в схеме Prisma", () => {
    // Отдельно и по имени: это денежный путь, и именно он молчал.
    expect(created.has("AppSubscription")).toBe(true);
  });
});
