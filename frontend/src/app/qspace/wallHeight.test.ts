import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  HEIGHTS, WALL_HEIGHT, demoPlan, generatePlumbing, generateWiring, planWallHeight,
  type Plan,
} from "./planModel";
import { estimatePlan } from "./estimate";

/**
 * Высота потолка — число, от которого прямо считается площадь под покраску.
 *
 * До 09.09.2026 она была константой модуля 2.70 м, и человек не мог её
 * назвать. В квартирах высота от 2.5 до 3.2 м: разница между краями — пятая
 * часть материала. Ошибка была бы тихой: модель выглядит правильной, просто
 * числа не те. Из плоского чертежа высоту узнать нельзя ни при каком разборе,
 * поэтому её и надо спрашивать.
 */
function планВысотой(h: number): Plan {
  const p = demoPlan();
  return { ...p, walls: p.walls.map((w) => ({ ...w, height: h })) };
}

describe("высота берётся из плана, а не из константы", () => {
  it("planWallHeight отдаёт высоту стены", () => {
    expect(planWallHeight(планВысотой(3.05))).toBeCloseTo(3.05, 9);
  });

  it("у плана без стен — значение по умолчанию, а не NaN", () => {
    const пусто: Plan = { name: "пусто", walls: [], openings: [], source: "demo" };
    expect(planWallHeight(пусто)).toBeCloseTo(WALL_HEIGHT, 9);
  });

  it("магистраль кабеля идёт на 25 см ниже ЭТОГО потолка", () => {
    const w = generateWiring(планВысотой(3.2));
    const верх = Math.max(...w.runs.flat().map((t) => t[2]));
    expect(верх, "магистраль осталась на прежней высоте").toBeCloseTo(3.2 - 0.25, 6);
    // контроль: у низкого потолка она НИЖЕ, иначе «зависит от плана»
    // неотличимо от «всегда 2.95»
    const w2 = generateWiring(планВысотой(2.5));
    expect(Math.max(...w2.runs.flat().map((t) => t[2]))).toBeCloseTo(2.25, 6);
  });

  it("стояки труб доходят до ЭТОГО потолка", () => {
    const p = generatePlumbing(планВысотой(3.2));
    const верх = Math.max(...[...p.cold, ...p.hot, ...p.drain].flat().map((t) => t[2]));
    expect(верх).toBeCloseTo(3.2, 6);
  });

  it("площадь стен в смете растёт вместе с высотой", () => {
    const низ = планВысотой(2.5);
    const верх = планВысотой(3.0);
    const eн = estimatePlan(низ, generateWiring(низ), generatePlumbing(низ), 4);
    const eв = estimatePlan(верх, generateWiring(верх), generatePlumbing(верх), 4);
    expect(eв.wallArea, "площадь не зависит от высоты — значит высота не доехала")
      .toBeGreaterThan(eн.wallArea);
    // Но НЕ ровно пропорционально: проёмы вычитаются постоянной площадью и
    // вместе с потолком не растут. Значит отношение обязано быть СТРОГО
    // больше 3.0/2.5 = 1.2 — и это свойство сильнее, чем совпадение с числом:
    // равенство 1.2 означало бы, что окна и двери из площади не вычитаются.
    const отношение = eв.wallArea / eн.wallArea;
    expect(отношение, "проёмы перестали вычитаться из площади стен")
      .toBeGreaterThan(1.2);
    expect(отношение, "отношение неправдоподобно велико для этого плана")
      .toBeLessThan(1.35);
  });

  it("экспортированная константа HEIGHTS.trunk осталась про умолчание", () => {
    // она описывает типовую норму, а не конкретный план; если начнёт зависеть
    // от плана — станет врать тем, кто читает её как норму
    expect(HEIGHTS.trunk).toBeCloseTo(WALL_HEIGHT - 0.25, 9);
  });
});

describe("страница показывает высоту ЭТОГО плана, а не константу", () => {
  // Классическая ловушка: расчёт починили, а показ остался на константе —
  // человек ставит 3.0, таблица печатает 2.70, и оба числа выглядят верными.
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("в разметке нет обращений к константе высоты", () => {
    const строки = client.split(String.fromCharCode(10));
    const плохие = строки
      .map((s, i) => [i + 1, s] as const)
      .filter(([, s]) => /WALL_HEIGHT/.test(s) && !/useState|import|^\s*WALL_HEIGHT,$/.test(s));
    expect(плохие.map(([i, s]) => i + ": " + s.trim()),
      "константа высоты используется в расчёте или показе — поставьте planWallHeight(plan)")
      .toEqual([]);
  });

  it("контроль прибора: сама константа в файле ЕСТЬ", () => {
    // иначе «плохих строк нет» неотличимо от «шаблон ничего не находит»
    expect(/WALL_HEIGHT/.test(client)).toBe(true);
  });

  it("поле высоты доступно человеку и подписано", () => {
    expect(client).toMatch(/id="qspace-height"/);
    expect(client, "нет подписи — читалка объявит поле только ролью")
      .toMatch(/htmlFor="qspace-height"/);
    expect(client, "не сказано, зачем это число").toMatch(/пятая часть материала/);
  });
});
