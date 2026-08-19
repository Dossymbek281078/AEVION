import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Сторож против возврата класса. 19.08.2026.
//
// Разъезд личности вырос не из ошибки, а из ЧЕТЫРЁХ независимых реализаций
// одного и того же: турниры, подбор, присутствие и главная страница каждая
// читала ключ сама. Пока читателей много, разъезд возвращается — сегодня они
// совпали, завтра кто-то напишет пятую.
//
// Проверяется не текст, а КОЛИЧЕСТВО прямых обращений мимо общего источника, и
// сравнение одностороннее: стало меньше — зелёный, больше — красный. Сторож,
// который краснеет на починке, приучает себя не читать.

const ROOT = path.join(__dirname, "..");
const SHARED = path.join("tournaments", "playerIdentity.ts");

// Главная страница `page.tsx` принадлежит другим веткам (по шесть коммитов у
// каждой из четырёх), поэтому её обращения оставлены и здесь ЗАФИКСИРОВАНЫ
// числом, а не прощены молча.
//
// Их ровно четыре, и они разные — сторож поправил мой счёт, когда я поставил
// три по памяти:
//   • 3 чтения с подстановкой `|| "anon"` — из-за них отчёты античита от
//     неопознанных игроков падают в общую кучу под одним id;
//   • 1 запись — привязка к настоящему аккаунту при входе, она законна.
const MAX_DIRECT_READS = 4;

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe("личность игрока читается из одного места", () => {
  test("прямых обращений к ключу мимо общего источника не больше зафиксированного", () => {
    const hits: string[] = [];
    for (const f of walk(ROOT)) {
      if (f.endsWith(SHARED)) continue;
      const src = fs.readFileSync(f, "utf-8");
      // Только настоящие обращения к хранилищу, не упоминания в комментариях.
      const m = src.match(/localStorage\s*\.\s*(get|set)Item\s*\(\s*["'`]cyberchess\.userId["'`]/g);
      if (m) hits.push(`${path.relative(ROOT, f)} × ${m.length}`);
    }
    const total = hits.reduce((n, h) => n + Number(h.split("× ")[1]), 0);
    expect(total, `прямые обращения: ${hits.join("; ") || "нет"}`).toBeLessThanOrEqual(MAX_DIRECT_READS);
  });

  test("общий источник существует и отдаёт обе функции", () => {
    const src = fs.readFileSync(path.join(ROOT, SHARED), "utf-8");
    expect(src).toMatch(/export function tournamentUserId/);
    expect(src).toMatch(/export function knownUserId/);
  });
});
