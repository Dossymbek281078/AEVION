import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { queryNumber } from "../src/lib/queryNumber";

/**
 * `Number(req.query.limit ?? 50)` выглядит защищённым — умолчание же есть.
 * Но `??` ловит только null/undefined, а `?limit=zzz` даёт строку: Number("zzz")
 * = NaN, и NaN проходит СКВОЗЬ любой зажим (Math.min(NaN, 200) = NaN). Дальше
 * либо `LIMIT NaN` и 500 от Postgres, либо `slice(0, NaN)` и молчаливо пустой
 * ответ.
 *
 * Замер 19.08.2026: 14 таких мест в пяти файлах, включая шесть в qpaynet
 * (деньги). Два соседних файла закрывали дыру вручную через Number.isFinite —
 * то есть про ловушку знали, но точечно.
 *
 * Отдельно про мою же первую попытку: я «починил» это как
 * Math.min(Math.max(Number(x), 1), N). Отрицательное закрылось, NaN — НЕТ, и
 * мой тогдашний тест был зелёным, потому что проверял только отрицательное.
 * Поэтому здесь матрица мусора, а не один случай.
 */

const GARBAGE: Array<[string, unknown, number]> = [
  ["строка без цифр", "zzz", 50],
  ["хвост после числа", "12abc", 50],
  ["пусто ?limit=", "", 50],
  ["не задан", undefined, 50],
  ["null", null, 50],
  ["массив ?limit=1&limit=2", ["7", "9"], 7],
  ["объект", { a: 1 }, 50],
  ["пробел", "   ", 50],
  ["Infinity", "Infinity", 50],
  ["-Infinity", "-Infinity", 50],
  ["NaN словом", "NaN", 50],
];

describe("queryNumber", () => {
  test.each(GARBAGE)("на входе %s не даёт NaN", (_name, raw, expected) => {
    const v = queryNumber(raw, 50);
    expect(Number.isFinite(v), `вернулось ${v}`).toBe(true);
    expect(v).toBe(expected);
  });

  test("нормальные значения проходят как есть, включая дробные и отрицательные", () => {
    expect(queryNumber("25", 50)).toBe(25);
    expect(queryNumber("2.5", 50)).toBe(2.5); // радиус в км — округлять нельзя
    expect(queryNumber("-5", 50)).toBe(-5); // зажим — забота вызывающего
    expect(queryNumber("0", 50)).toBe(0);
  });

  test("контроль: старая форма на этой же матрице ДАЁТ NaN", () => {
    // Если однажды Number начнёт вести себя иначе — тест это заметит и
    // объяснит, почему помощник вообще существует.
    const old = (raw: unknown) => Math.min(Math.max(Number(raw ?? 50), 1), 200);
    expect(Number.isNaN(old("zzz"))).toBe(true);
    expect(Number.isNaN(old("12abc"))).toBe(true);
  });
});

// ─── сторож по исходникам ────────────────────────────────────────────────────

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

const ROUTES = join(__dirname, "..", "src", "routes");
const RAW = /Number\(\s*req\.query\.[A-Za-z_]\w*\s*\?\?/;

describe("сторож: сырой Number(req.query.X ?? D) не возвращается в маршруты", () => {
  const files = tsFiles(ROUTES);

  test("контроль: сканер вообще читает файлы и видит req.query", () => {
    expect(files.length).toBeGreaterThan(50);
    const withQuery = files.filter((f) => readFileSync(f, "utf8").includes("req.query"));
    expect(withQuery.length).toBeGreaterThan(20);
  });

  test("контроль: сканер краснеет на заведомо дырявой строке", () => {
    expect(RAW.test("  const limit = Number(req.query.limit ?? 50);")).toBe(true);
    expect(RAW.test("  const limit = queryNumber(req.query.limit, 50);")).toBe(false);
  });

  test("каждое оставшееся место защищено Number.isFinite рядом", () => {
    const bad: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.trim();
        // комментарии не считаем — иначе сторож покраснеет на собственном разборе
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;
        if (!RAW.test(line)) return;
        const window = lines.slice(i, i + 4).join("\n");
        if (!window.includes("Number.isFinite")) {
          bad.push(`${f.split(/[\/]/).slice(-2).join("/")}:${i + 1}  ${code}`);
        }
      });
    }
    expect(bad, `NaN уедет в SQL или в slice:\n${bad.join("\n")}`).toEqual([]);
  });
});
