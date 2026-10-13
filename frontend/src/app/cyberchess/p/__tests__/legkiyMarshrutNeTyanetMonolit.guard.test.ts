import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Лёгкий маршрут /cyberchess/p/<id> не тянет монолит шахмат.
 *
 * Повод 13.10.2026: полная страница — 1,37 МБ исходника, ~900 КБ сжатого JS,
 * доска на Fast 3G через ~7 с. Порог маршрута: сжатый JS ≤300 КБ (мерится на
 * проде прибором), а здесь — прокси: сумма исходников локальных модулей, которые
 * маршрут импортирует напрямую, и запрет на известные тяжёлые модули.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");
const МАРШРУТ = join(КОРЕНЬ, "p");
const ЗАПРЕЩЕНО = ["page.tsx", "page", "@/lib/products", "./AiCoach", "../AiCoach", "coachKnowledge", "chessCoachEngine", "coachLessons", "variants", "tournament", "chessSounds", "deepEngine", "stockfish"];
const ПРЕДЕЛ_БАЙТ = 150_000;

function файлыМаршрута(): string[] {
  const out: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (n === "__tests__") continue; if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) out.push(p); } };
  walk(МАРШРУТ);
  return out;
}

function импорты(src: string): string[] {
  const out: string[] = [];
  const re = /^import (?!type )[^;]*? from "([^"]+)";/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function путьМодуля(изФайла: string, спец: string): string | null {
  let base: string;
  if (спец.startsWith("@/")) base = join(process.cwd(), "src", спец.slice(2));
  else if (спец.startsWith(".")) base = join(изФайла, "..", спец);
  else return null;
  for (const c of [base + ".ts", base + ".tsx", join(base, "index.ts")]) if (existsSync(c)) return c;
  return null;
}

describe("лёгкий маршрут задачи не тянет монолит", () => {
  const файлы = файлыМаршрута();

  it("знаменатель: маршрут состоит из страницы, клиента и логики", () => {
    const имена = файлы.map((f) => f.slice(МАРШРУТ.length + 1).replace(/\\/g, "/")).sort();
    expect(имена).toEqual(["LegkayaZadacha.tsx", "[id]/page.tsx", "logikaZadachi.ts"]);
  });

  it("🔴 ни один файл маршрута не импортирует запрещённые тяжёлые модули", () => {
    for (const f of файлы) {
      const src = readFileSync(f, "utf8");
      for (const спец of импорты(src)) {
        for (const з of ЗАПРЕЩЕНО) {
          const хвост = спец.split("/").pop() ?? спец;
          expect(спец === з || хвост === з || спец.endsWith("/" + з), `${f.slice(КОРЕНЬ.length)} импортирует ${спец}`).toBe(false);
        }
      }
      expect(src, "динамический импорт монолита тоже запрещён").not.toMatch(/import\("\.\.\/page"\)|import\("\.\.\/\.\.\/page"\)/);
    }
  });

  it(`храповик: исходники локальных импортов маршрута ≤ ${ПРЕДЕЛ_БАЙТ.toLocaleString("ru-RU")} байт`, () => {
    const видели = new Set<string>();
    let сумма = 0;
    for (const f of файлы) for (const спец of импорты(readFileSync(f, "utf8"))) {
      const p = путьМодуля(f, спец);
      if (!p || видели.has(p)) continue;
      видели.add(p);
      сумма += statSync(p).size;
    }
    expect(видели.size, "знаменатель: модулей").toBeGreaterThan(3);
    expect(сумма, `сумма ${сумма} байт по ${видели.size} модулям`).toBeLessThanOrEqual(ПРЕДЕЛ_БАЙТ);
  });

  it("события воронки — те же, что у полной версии: открытие по ссылке, первый ход, решено", () => {
    const клиент = readFileSync(join(МАРШРУТ, "LegkayaZadacha.tsx"), "utf8");
    expect(клиент).toContain('feature: "puzzle_link_open"');
    expect(клиент).toContain('otmetitPervyyHod(pervyyHodRef, "puzzle", id)');
    expect(клиент).toContain('type: "puzzle_solved"');
    expect(клиент).toContain('source: "cyberchess/board"');
    const страница = readFileSync(join(МАРШРУТ, "[id]/page.tsx"), "utf8");
    expect(страница).toContain("<PageTracking");
    expect(страница).toContain("zadanieNadDoskoy(pz, locale)");
  });
});
