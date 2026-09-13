import { describe, expect, it } from "vitest";
import { parseDxf } from "./dxf";
import { readPdfSegments, planFromPdfSegments } from "./pdf";
import { parseProjectFile } from "./project";

/**
 * Ворота запуска, пункт 4: отказ показывается ОТКАЗОМ.
 *
 * Мусор на входе не должен ни падать, ни — что гораздо хуже — выдавать
 * правдоподобную модель. Проверяется, что человеку сказано СЛОВАМИ, а не
 * показан пустой экран или тишина.
 *
 * Отдельно проверяется, что сообщение человеческое: без кодов, стеков и
 * английских имён функций.
 */

const МУСОР = [
  "",
  "не чертёж вовсе",
  "\u0000\u0001\u0002",
  "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n", // валидный DXF, но пустой
  "x".repeat(5000),
];

let проверено = 0;

const ЧЕЛОВЕЧНО = (s: string) => {
  проверено++;
  expect(s.length, `сообщение пустое: «${s}»`).toBeGreaterThan(10);
  expect(s, `в сообщении технический жаргон: «${s}»`)
    .not.toMatch(/undefined|null|Error:|at [A-Za-z]+\.|TypeError|\bstack\b/);
  expect(s, `сообщение не по-русски: «${s}»`).toMatch(/[а-яё]/i);
};

describe("мусор на входе не выдаётся за модель", () => {
  it("DXF: любой мусор даёт либо пустой план, либо предупреждение словами", () => {
    for (const g of МУСОР) {
      const r = parseDxf(g);
      const пусто = r.plan === null || r.plan.walls.length === 0;
      expect(пусто || r.warnings.length > 0, `мусор «${g.slice(0, 20)}» дал модель молча`).toBe(true);
      for (const w of r.warnings) ЧЕЛОВЕЧНО(w);
    }
  });

  it("PDF: мусор не даёт плана и объясняет, чего не хватило", async () => {
    for (const g of МУСОР) {
      const src = await readPdfSegments(new TextEncoder().encode(g));
      const r = planFromPdfSegments(src, 10);
      expect(r.plan, `мусор «${g.slice(0, 20)}» дал план из PDF`).toBeNull();
      for (const w of r.warnings) ЧЕЛОВЕЧНО(w);
    }
  });

  it("файл проекта: чужой или битый JSON не ломает сцену и говорит человеку", () => {
    for (const g of [...МУСОР, '{"version":99}', '{"version":1}', "[]", "null"]) {
      const r = parseProjectFile(g);
      expect(r.ok, `«${g.slice(0, 20)}» принят как исправный проект`).toBe(false);
      if (!r.ok) ЧЕЛОВЕЧНО(r.reason);
    }
  });

  it("сообщений реально проверено, а не ноль", () => {
    // «все сообщения человечные» ничего не значит, если сообщений не было ни
    // одного: цикл по пустому списку проходит молча. Знаменатель обязателен.
    expect(проверено, "ни одного сообщения об отказе не проверено — тест пуст")
      .toBeGreaterThanOrEqual(5);
  });

  it("контроль прибора: ИСПРАВНЫЙ вход принимается", () => {
    // без этого «всё отвергнуто» неотличимо от «отвергается вообще всё»
    const ok = parseDxf(
      "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nA-WALL\n10\n0\n20\n0\n11\n5\n21\n0\n"
      + "0\nLINE\n8\nA-WALL\n10\n5\n20\n0\n11\n5\n21\n4\n0\nENDSEC\n0\nEOF\n",
    );
    expect(ok.plan, "исправный DXF отвергнут — проверка отвергает всё подряд").not.toBeNull();
    expect(ok.plan!.walls.length).toBeGreaterThan(1);
  });
});
